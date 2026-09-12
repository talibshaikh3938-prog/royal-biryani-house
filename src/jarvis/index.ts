/**
 * JARVIS Reliability & Incident Management System
 * Royal Biryani House RMS
 * 
 * Centralized API entry point for RMS reliability instrumentation
 */

import { 
  JarvisIncident, 
  JarvisHealthStatus, 
  JarvisHealthSummary, 
  JarvisModule, 
  JarvisErrorCategory,
  JarvisSeverity,
  JarvisLevel
} from './types';
import { globalIncidentManager, CreateIncidentParams } from './incidentManager';
import { executeSafeRecovery, ExecuteSafeRecoveryOptions } from './recovery';
import { globalCircuitBreaker } from './circuitBreaker';
import { redactSensitiveData, assertNonCriticalOperation, classifyFailureLevel } from './safety';

export * from './types';
export * from './safety';
export * from './circuitBreaker';
export * from './incidentManager';
export * from './recovery';

class JarvisSystem {
  /**
   * Executes a transient/safe operation with automatic bounded retry,
   * verification, circuit breaker protection, and automatic incident escalation.
   */
  public async executeSafe<T>(options: ExecuteSafeRecoveryOptions<T>): Promise<T> {
    return executeSafeRecovery(options);
  }

  /**
   * Manually records an incident into the tenant-scoped registry.
   */
  public recordIncident(params: CreateIncidentParams): JarvisIncident {
    return globalIncidentManager.createIncident(params);
  }

  /**
   * Evaluates the current operational health of a restaurant tenant.
   */
  public getHealth(restaurantId: string): JarvisHealthSummary {
    const incidents = globalIncidentManager.getIncidents(restaurantId);
    const active = incidents.filter(i => !i.resolved);
    const critical = active.filter(i => i.severity === 'CRITICAL' || i.level === 3);
    const recovered = incidents.filter(i => i.recoveryResult === 'recovered');

    let status: JarvisHealthStatus = 'HEALTHY';
    if (critical.length > 0) {
      status = 'CRITICAL';
    } else if (active.length > 0) {
      status = 'DEGRADED';
    }

    return {
      status,
      activeIncidentsCount: active.length,
      criticalIncidentsCount: critical.length,
      autoRecoveriesCount: recovered.length,
      lastIncidentTime: active.length > 0 ? active[0].timestamp : undefined,
      restaurantId
    };
  }

  public getIncidents(restaurantId: string): JarvisIncident[] {
    return globalIncidentManager.getIncidents(restaurantId);
  }

  public getActiveIncidents(restaurantId: string): JarvisIncident[] {
    return globalIncidentManager.getActiveIncidents(restaurantId);
  }

  public resolveIncident(id: string, restaurantId: string): boolean {
    return globalIncidentManager.resolveIncident(id, restaurantId);
  }

  public clearAllIncidents(restaurantId: string): void {
    globalIncidentManager.clearAllIncidents(restaurantId);
  }

  public generateAntigravityPrompt(incident: Partial<JarvisIncident>): string {
    return globalIncidentManager.generateAntigravityPrompt(incident);
  }

  public onUpdate(callback: (restaurantId: string) => void): () => void {
    if (typeof window === 'undefined' || !window.addEventListener) {
      return () => {};
    }
    const handler = (event: any) => {
      const rid = event?.detail?.restaurantId || 'rbh-main-branch';
      callback(rid);
    };
    window.addEventListener('rbh_jarvis_updated', handler);
    return () => window.removeEventListener('rbh_jarvis_updated', handler);
  }
}

export const jarvis = new JarvisSystem();
