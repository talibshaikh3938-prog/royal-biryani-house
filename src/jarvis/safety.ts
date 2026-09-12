/**
 * JARVIS Safety Policies & Redaction Engine
 * Enforces the Three-Level Safety Model and data privacy
 */

import { JarvisErrorCategory, JarvisLevel, JarvisSeverity } from './types';

// Strict blacklist of operations JARVIS is prohibited from altering autonomously
const FORBIDDEN_AUTONOMOUS_OPERATIONS = new Set([
  'settleDiningSessionAtomic',
  'settleDiningSession',
  'recordDiningSessionPayment',
  'markOrderAsPaid',
  'updateOrderStatusPaid',
  'voidPayment',
  'refundPayment',
  'createStaffProfile',
  'updateStaffRole',
  'deleteStaffProfile',
  'migrateDatabase',
  'alterSchema',
  'dropTable',
  'executeRawSql'
]);

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /anon_?key/i,
  /service_?role/i,
  /token/i,
  /qr_?token/i,
  /auth/i,
  /authorization/i,
  /bearer/i,
  /card_?number/i,
  /cvv/i,
  /pin/i
];

/**
 * Recursively redacts secrets, tokens, passwords, and sensitive credentials
 */
export function redactSensitiveData(data: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let str = data;
    // 1. Redact Supabase secret / publishable keys and generic secret keys
    str = str.replace(/sb_secret_[a-zA-Z0-9_.-]+/g, '[REDACTED_API_KEY]');
    str = str.replace(/sb_publishable_[a-zA-Z0-9_.-]+/g, '[REDACTED_API_KEY]');
    str = str.replace(/(?:key|secret|token)\s*[:=]\s*[a-zA-Z0-9_\-.]{16,}/gi, 'key=[REDACTED_API_KEY]');
    // 2. Redact JWT tokens (anywhere in string)
    str = str.replace(/eyJ[a-zA-Z0-9_-]{15,}(\.[a-zA-Z0-9_-]+)*/g, '[REDACTED_JWT]');
    // 3. Redact Table QR tokens
    str = str.replace(/rbh_(tok|sec)_[a-z0-9_]+/gi, '[REDACTED_QR_TOKEN]');
    // 4. Redact Bearer tokens
    str = str.replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]');
    // 5. Redact password assignments
    str = str.replace(/password\s*[:=]\s*[^\s,]+/gi, 'password=[REDACTED_PASSWORD]');
    return str;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(data);
}

/**
 * Asserts that an operation is NOT in the Level 3 forbidden list.
 * Throws a hard security violation if violated.
 */
export function assertNonCriticalOperation(operation: string, category?: JarvisErrorCategory): void {
  const cleanOp = (operation || '').trim();
  const lower = cleanOp.toLowerCase();

  const isFinancial =
    category === 'FINANCIAL' ||
    lower.includes('settle') ||
    lower.includes('payment') ||
    lower.includes('refund') ||
    lower.includes('bill') ||
    lower.includes('gst') ||
    lower.includes('discount') ||
    lower.includes('paid');

  const isSecurity =
    category === 'SECURITY' ||
    lower.includes('rls') ||
    lower.includes('role') ||
    lower.includes('policy') ||
    lower.includes('permission') ||
    lower.includes('grant') ||
    lower.includes('tenant') ||
    lower.includes('bypass') ||
    lower.includes('auth');

  const isSchema =
    lower.includes('schema') ||
    lower.includes('migration') ||
    lower.includes('drop') ||
    lower.includes('alter') ||
    lower.includes('truncate');

  if (
    FORBIDDEN_AUTONOMOUS_OPERATIONS.has(cleanOp) ||
    isFinancial ||
    isSecurity ||
    isSchema
  ) {
    throw new Error(
      `CRITICAL_OPERATION_BLOCKED: Operation "${cleanOp}" is a Level 3 Critical Operation. ` +
      `JARVIS is strictly prohibited from mutating financial records, payments, staff roles, or security policies autonomously.`
    );
  }
}

/**
 * Classifies an incident into Level 1, 2, or 3
 */
export function classifyFailureLevel(
  category: JarvisErrorCategory, 
  operation: string,
  error?: any
): { level: JarvisLevel; severity: JarvisSeverity } {
  // Check Level 3 Critical Conditions
  if (category === 'FINANCIAL' || category === 'SECURITY' || FORBIDDEN_AUTONOMOUS_OPERATIONS.has(operation)) {
    return { level: 3, severity: 'CRITICAL' };
  }

  const errorStr = String(error?.message || error || '').toLowerCase();
  if (errorStr.includes('rls') || errorStr.includes('permission denied') || errorStr.includes('jwt') || errorStr.includes('unauthorized')) {
    return { level: 3, severity: 'CRITICAL' };
  }

  // Check Level 1 Safe Auto-Recovery Conditions
  if (
    category === 'NETWORK' || 
    category === 'TIMEOUT' || 
    category === 'REALTIME' || 
    category === 'PRINT' || 
    isTransientError(error)
  ) {
    return { level: 1, severity: 'LOW' };
  }

  // Default to Level 2: Diagnose & Alert
  return { level: 2, severity: 'MEDIUM' };
}

/**
 * Checks whether an error is transient / retryable
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  const msg = String(error?.message || error).toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('failed to fetch') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('rate limit') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset')
  );
}
