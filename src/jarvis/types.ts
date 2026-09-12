/**
 * JARVIS Reliability & Incident Management Types
 * Royal Biryani House RMS
 */

export type JarvisSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type JarvisLevel = 1 | 2 | 3;
// Level 1: Safe Automatic Recovery (transient, idempotent, non-financial)
// Level 2: Diagnose & Alert (requires human inspection, non-destructive)
// Level 3: Critical / Human Approval (strictly prohibited from autonomous modification)

export type JarvisModule = 
  | 'KDS' 
  | 'POS' 
  | 'ORDER' 
  | 'AUTH' 
  | 'REALTIME' 
  | 'PRINT' 
  | 'STORAGE' 
  | 'NETWORK' 
  | 'DATABASE'
  | 'CACHE'
  | 'MENU'
  | 'BILLING'
  | 'UI';

export type JarvisErrorCategory = 
  | 'NETWORK' 
  | 'TIMEOUT' 
  | 'REALTIME' 
  | 'PRINT' 
  | 'AUTH' 
  | 'SECURITY' 
  | 'FINANCIAL' 
  | 'DATABASE'
  | 'APPLICATION'
  | 'UNKNOWN';

export type JarvisRecoveryResult = 'recovered' | 'failed' | 'manual_required';

export interface JarvisIncident {
  id: string;
  timestamp: string;
  restaurantId: string;
  module: JarvisModule;
  operation: string;
  errorCategory: JarvisErrorCategory;
  severity: JarvisSeverity;
  level: JarvisLevel;
  safeContext: Record<string, any>;
  recoveryAttempts: number;
  recoveryResult: JarvisRecoveryResult;
  recommendedAction: string;
  productionMutationPerformed: false; // Strictly false
  resolved: boolean;
  resolvedAt?: string;
  fingerprint: string;
  occurrences: number;
  occurrenceCount?: number;
  message?: string;
  correlationId: string;
}

export type JarvisHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface JarvisHealthSummary {
  status: JarvisHealthStatus;
  activeIncidentsCount: number;
  criticalIncidentsCount: number;
  autoRecoveriesCount: number;
  lastIncidentTime?: string;
  restaurantId: string;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}
