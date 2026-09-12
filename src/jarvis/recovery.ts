/**
 * JARVIS Safe Recovery Pipeline
 * DETECT -> CLASSIFY -> ATTEMPT SAFE RECOVERY -> VERIFY -> RESOLVE_OR_ALERT
 */

import { JarvisModule, JarvisErrorCategory, JarvisIncident, JarvisSeverity, JarvisLevel } from './types';
import { assertNonCriticalOperation, classifyFailureLevel, isTransientError } from './safety';
import { globalCircuitBreaker, JarvisCircuitBreaker } from './circuitBreaker';
import { globalIncidentManager } from './incidentManager';

export interface ExecuteSafeRecoveryOptions<T> {
  restaurantId: string;
  module: JarvisModule;
  operation: string;
  category?: JarvisErrorCategory;
  action: () => Promise<T>;
  maxRetries?: number;
  initialBackoffMs?: number;
  circuitBreakerKey?: string;
  isIdempotent?: boolean;
  verifyResult?: (result: T) => boolean;
  fallback?: (err?: any) => T | Promise<T>;
  context?: Record<string, any>;
}

export async function executeSafeRecovery<T>(
  options: ExecuteSafeRecoveryOptions<T>
): Promise<T> {
  const {
    restaurantId,
    module,
    operation,
    category = (module === 'NETWORK' ? 'NETWORK' : module === 'DATABASE' ? 'DATABASE' : module === 'REALTIME' ? 'REALTIME' : 'APPLICATION'),
    action,
    maxRetries = 2,
    initialBackoffMs,
    circuitBreakerKey,
    isIdempotent = false,
    verifyResult,
    fallback,
    context = {}
  } = options;

  const breakerKey = circuitBreakerKey || `${restaurantId}:${module}:${operation}`;

  // 1. LEVEL 3 CRITICAL SAFETY GATE:
  // Reject autonomous recovery for financial, payment, or security mutations
  try {
    assertNonCriticalOperation(operation, category);
  } catch (err: any) {
    // Escalate immediately to Level 3 Critical Incident without retrying
    globalIncidentManager.createIncident({
      restaurantId,
      module,
      operation,
      errorCategory: category,
      rawError: err,
      context,
      recoveryAttempts: 0,
      recoveryResult: 'manual_required',
      recommendedAction: 'CRITICAL: Human authorization required. Autonomous modification strictly prohibited.',
      explicitSeverity: 'CRITICAL',
      explicitLevel: 3
    });
    throw err;
  }

  // 2. CIRCUIT BREAKER GATE:
  if (!globalCircuitBreaker.canAttempt(breakerKey)) {
    const error = new Error(`Circuit breaker is OPEN for ${breakerKey}. Skipping execution to prevent alert storm.`);
    globalIncidentManager.createIncident({
      restaurantId,
      module,
      operation,
      errorCategory: category,
      rawError: error,
      context,
      recoveryAttempts: 0,
      recoveryResult: 'failed',
      recommendedAction: 'Service is cooling down. Check backend status or wait for circuit recovery.'
    });

    if (fallback) {
      return await fallback(error);
    }
    throw error;
  }

  // 3. EXECUTION & RECOVERY PIPELINE:
  const isRetryable =
    isIdempotent ||
    category === 'NETWORK' ||
    category === 'TIMEOUT' ||
    module === 'NETWORK' ||
    module === 'DATABASE' ||
    module === 'CACHE' ||
    module === 'PRINT' ||
    module === 'MENU' ||
    operation.startsWith('fetch_') ||
    operation.startsWith('query_') ||
    operation.startsWith('get_');

  const effectiveMaxRetries = isRetryable ? Math.min(maxRetries, 3) : 0;

  let lastError: any = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    attempts++;
    try {
      // Execute the primary action
      const result = await action();

      // VERIFY STEP: Do not assume success, verify with predicate if supplied
      if (verifyResult && !verifyResult(result)) {
        throw new Error(`Verification predicate failed for operation ${operation}`);
      }

      // Success confirmed!
      globalCircuitBreaker.recordSuccess(breakerKey);

      // If this was a successful recovery after previous attempts, resolve any active incident
      if (attempt > 0) {
        const fingerprint = `${restaurantId}:${module}:${operation}:${category}`;
        const active = globalIncidentManager.getActiveIncidents(restaurantId).find(i => i.fingerprint === fingerprint);
        if (active) {
          globalIncidentManager.resolveIncident(active.id, restaurantId);
        }
      }

      return result;
    } catch (err: any) {
      lastError = err;

      // If error is non-transient and not explicitly retryable/idempotent, break early
      if (!isTransientError(err) && !isIdempotent && !isRetryable) {
        break;
      }

      // Wait with exponential backoff before next attempt
      if (attempt < effectiveMaxRetries) {
        const backoffMs = typeof initialBackoffMs === 'number'
          ? Math.max(1, initialBackoffMs * Math.pow(1.5, attempt))
          : JarvisCircuitBreaker.calculateBackoff(attempt);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // 4. FAILURE HANDLING & INCIDENT GENERATION:
  globalCircuitBreaker.recordFailure(breakerKey);

  const incident = globalIncidentManager.createIncident({
    restaurantId,
    module,
    operation,
    errorCategory: category,
    rawError: lastError,
    context,
    recoveryAttempts: attempts,
    recoveryResult: fallback ? 'recovered' : 'failed'
  });

  // If a fallback exists, execute it safely
  if (fallback) {
    try {
      const fallbackResult = await fallback();
      // Fallback succeeded, mark incident as mitigated
      globalIncidentManager.resolveIncident(incident.id, restaurantId);
      return fallbackResult;
    } catch (fallbackErr) {
      // Both action and fallback failed
      throw lastError;
    }
  }

  throw lastError;
}
