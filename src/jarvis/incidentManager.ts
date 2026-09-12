/**
 * JARVIS Incident Management Engine
 * Handles tenant-scoped incident persistence, deduplication, cooldowns, and Antigravity-ready export
 */

import { JarvisIncident, JarvisModule, JarvisErrorCategory, JarvisSeverity, JarvisLevel, JarvisRecoveryResult } from './types';
import { redactSensitiveData, classifyFailureLevel, assertNonCriticalOperation } from './safety';

const INCIDENTS_STORAGE_PREFIX = 'rbh_jarvis_incidents';
const DEDUPLICATION_WINDOW_MS = 60000; // 60-second cooldown window for duplicate errors

// Safe in-memory store fallback for SSR / headless execution
const inMemoryIncidentStore = new Map<string, JarvisIncident[]>();

function getStorageKey(restaurantId: string): string {
  const clean = (restaurantId || 'rbh-main-branch').trim().toLowerCase();
  return `${INCIDENTS_STORAGE_PREFIX}:${clean}`;
}

function loadIncidents(restaurantId: string): JarvisIncident[] {
  const key = getStorageKey(restaurantId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    }
  } catch {}
  return inMemoryIncidentStore.get(key) || [];
}

function persistIncidents(restaurantId: string, incidents: JarvisIncident[]): void {
  const key = getStorageKey(restaurantId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(incidents.slice(0, 50))); // Keep last 50
    }
  } catch {}
  inMemoryIncidentStore.set(key, incidents.slice(0, 50));
}

export interface CreateIncidentParams {
  restaurantId: string;
  module: JarvisModule;
  operation: string;
  errorCategory?: JarvisErrorCategory;
  category?: JarvisErrorCategory;
  rawError?: any;
  error?: any;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  recoveryAttempts?: number;
  recoveryResult?: JarvisRecoveryResult;
  recommendedAction?: string;
  explicitSeverity?: JarvisSeverity;
  severity?: JarvisSeverity;
  explicitLevel?: JarvisLevel;
  level?: JarvisLevel;
}

export class JarvisIncidentManager {
  /**
   * Registers or updates a deduplicated incident
   */
  public createIncident(params: CreateIncidentParams): JarvisIncident {
    const {
      restaurantId,
      module,
      operation,
      errorCategory = params.category || (module === 'NETWORK' ? 'NETWORK' : module === 'DATABASE' ? 'DATABASE' : module === 'REALTIME' ? 'REALTIME' : 'APPLICATION'),
      rawError = params.error,
      context = params.metadata || params.context || {},
      recoveryAttempts = 0,
      recoveryResult = 'failed',
      recommendedAction,
      explicitSeverity = params.severity,
      explicitLevel = params.level
    } = params;

    const classification = classifyFailureLevel(errorCategory, operation, rawError);
    const level: JarvisLevel = explicitLevel || classification.level;
    const severity: JarvisSeverity = explicitSeverity || classification.severity;

    // Redact all sensitive context
    const safeContext = redactSensitiveData({
      ...context,
      errorMessage: rawError?.message || String(rawError || 'Unknown error'),
      errorStack: rawError?.stack ? String(rawError.stack).slice(0, 300) : undefined
    });

    const fingerprint = `${restaurantId}:${module}:${operation}:${errorCategory}`;
    const incidents = loadIncidents(restaurantId);
    const now = new Date();
    const nowMs = now.getTime();

    // Deduplication check: Is there an existing open incident with identical fingerprint within window?
    const existingIdx = incidents.findIndex(
      inc => inc.fingerprint === fingerprint && !inc.resolved && (nowMs - new Date(inc.timestamp).getTime()) < DEDUPLICATION_WINDOW_MS
    );

    if (existingIdx >= 0) {
      const existing = incidents[existingIdx];
      existing.occurrences += 1;
      existing.occurrenceCount = existing.occurrences;
      existing.timestamp = now.toISOString();
      existing.recoveryAttempts += recoveryAttempts;
      existing.recoveryResult = recoveryResult;
      existing.safeContext = safeContext;
      if (recommendedAction) existing.recommendedAction = recommendedAction;
      persistIncidents(restaurantId, incidents);
      this.dispatchUpdate(restaurantId);
      return existing;
    }

    // Generate unique incident ID
    const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const incidentId = `JARVIS-INC-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${shortId}`;

    const newIncident: JarvisIncident = {
      id: incidentId,
      timestamp: now.toISOString(),
      restaurantId,
      module,
      operation,
      errorCategory,
      severity,
      level,
      safeContext,
      recoveryAttempts,
      recoveryResult,
      recommendedAction: recommendedAction || this.generateDefaultAction(module, operation, errorCategory),
      productionMutationPerformed: false, // Strictly false: Level 3 safety compliance
      resolved: recoveryResult === 'recovered',
      resolvedAt: recoveryResult === 'recovered' ? now.toISOString() : undefined,
      fingerprint,
      occurrences: 1,
      occurrenceCount: 1,
      correlationId: `corr_${Math.random().toString(36).substring(2, 9)}`
    };

    incidents.unshift(newIncident);
    persistIncidents(restaurantId, incidents);
    this.dispatchUpdate(restaurantId);
    return newIncident;
  }

  public getIncidents(restaurantId: string): JarvisIncident[] {
    return loadIncidents(restaurantId);
  }

  public getActiveIncidents(restaurantId: string): JarvisIncident[] {
    return loadIncidents(restaurantId).filter(i => !i.resolved);
  }

  public resolveIncident(id: string, restaurantId: string): boolean {
    const incidents = loadIncidents(restaurantId);
    const target = incidents.find(i => i.id === id);
    if (target) {
      target.resolved = true;
      target.resolvedAt = new Date().toISOString();
      target.recoveryResult = 'recovered';
      persistIncidents(restaurantId, incidents);
      this.dispatchUpdate(restaurantId);
      return true;
    }
    return false;
  }

  public clearAllIncidents(restaurantId: string): void {
    persistIncidents(restaurantId, []);
    this.dispatchUpdate(restaurantId);
  }

  /**
   * Generates a clean, copyable Antigravity / ChatGPT prompt format for human diagnosis
   */
  public generateAntigravityPrompt(incident: Partial<JarvisIncident>): string {
    const promptText = [
      `==================================================`,
      `JARVIS INCIDENT REPORT — ROYAL BIRYANI HOUSE RMS`,
      `==================================================`,
      `Incident ID: ${incident.id || 'N/A'}`,
      `Correlation ID: ${incident.correlationId || 'N/A'}`,
      `Timestamp: ${incident.timestamp || new Date().toISOString()}`,
      `Restaurant Tenant: ${incident.restaurantId || 'rbh-main-branch'}`,
      `Severity: ${incident.severity || 'HIGH'} (Safety Level: ${incident.level || 2})`,
      `Module: ${incident.module || 'SYSTEM'}`,
      `Operation: ${incident.operation || 'unknown'}`,
      `Error Category: ${incident.errorCategory || 'APPLICATION'}`,
      `Occurrences: ${incident.occurrences || incident.occurrenceCount || 1}`,
      `Auto-Recovery Attempted: ${(incident.recoveryAttempts ?? 0) > 0 ? 'YES' : 'NO'} (${incident.recoveryAttempts || 0} attempts)`,
      `Recovery Result: ${incident.recoveryResult || 'failed'}`,
      `Production Mutation Performed by JARVIS: NO (Level 3 Safety Compliant)`,
      `Recommended Action: ${incident.recommendedAction || 'Inspect diagnostic log'}`,
      ``,
      `Safe Diagnostic Context:`,
      JSON.stringify(incident.safeContext || (incident.message ? { message: incident.message } : {}), null, 2),
      ``,
      `Prompt for Antigravity / AI Studio Fix:`,
      `"Diagnose and fix the ${incident.module || 'SYSTEM'} failure in operation ${incident.operation || 'unknown'} for restaurant tenant ${incident.restaurantId || 'rbh-main-branch'}. ` +
      `The error encountered was ${incident.safeContext?.errorMessage || incident.message || incident.errorCategory || 'Operational failure'}. ` +
      `Ensure no financial mutations or security compromises are introduced."`,
      `==================================================`
    ].join('\n');

    return redactSensitiveData(promptText);
  }

  private generateDefaultAction(module: JarvisModule, op: string, cat: JarvisErrorCategory): string {
    if (cat === 'NETWORK' || cat === 'TIMEOUT') {
      return 'Verify client network connectivity or Supabase connection parameters in .env.local.';
    }
    if (cat === 'REALTIME') {
      return 'Check Supabase Realtime channel status and ensure WebSocket connection is allowed.';
    }
    if (cat === 'PRINT') {
      return 'Check thermal printer hardware, ESC/POS paper spool, or browser print dialogue.';
    }
    if (cat === 'SECURITY') {
      return 'Inspect RLS policies and table QR tokens. Do NOT bypass security definer functions.';
    }
    if (cat === 'FINANCIAL') {
      return 'STOP: Human cash reconciliation required. Verify payment logs and POS register.';
    }
    return `Inspect operation "${op}" in module "${module}" and verify backend response.`;
  }

  private dispatchUpdate(restaurantId: string): void {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent('rbh_jarvis_updated', { detail: { restaurantId } }));
      } catch {}
    }
  }
}

export const globalIncidentManager = new JarvisIncidentManager();
