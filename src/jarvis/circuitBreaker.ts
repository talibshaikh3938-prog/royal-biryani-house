/**
 * JARVIS Circuit Breaker & Exponential Backoff Engine
 * Prevents alert storms and protects backend services from cascading failures
 */

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerRecord {
  state: BreakerState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export class JarvisCircuitBreaker {
  private breakers = new Map<string, BreakerRecord>();
  private readonly defaultFailureThreshold: number;
  private readonly defaultCooldownMs: number;

  constructor(failureThreshold = 3, cooldownMs = 15000) {
    this.defaultFailureThreshold = failureThreshold;
    this.defaultCooldownMs = cooldownMs;
  }

  private getRecord(key: string): BreakerRecord {
    let rec = this.breakers.get(key);
    if (!rec) {
      rec = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0
      };
      this.breakers.set(key, rec);
    }
    return rec;
  }

  public getState(key: string): BreakerState {
    const rec = this.getRecord(key);
    const now = Date.now();

    if (rec.state === 'OPEN' && now >= rec.nextAttemptTime) {
      rec.state = 'HALF_OPEN';
    }

    return rec.state;
  }

  public canAttempt(key: string): boolean {
    const state = this.getState(key);
    return state === 'CLOSED' || state === 'HALF_OPEN';
  }

  public recordSuccess(key: string): void {
    const rec = this.getRecord(key);
    if (rec.state === 'HALF_OPEN') {
      rec.successCount++;
      if (rec.successCount >= 2) {
        rec.state = 'CLOSED';
        rec.failureCount = 0;
        rec.successCount = 0;
      }
    } else if (rec.state === 'CLOSED') {
      rec.failureCount = 0;
    }
  }

  public recordFailure(key: string, cooldownMs = this.defaultCooldownMs): void {
    const rec = this.getRecord(key);
    rec.failureCount++;
    rec.lastFailureTime = Date.now();
    rec.successCount = 0;

    if (rec.failureCount >= this.defaultFailureThreshold || rec.state === 'HALF_OPEN') {
      rec.state = 'OPEN';
      // Exponential backoff for repeated trip
      const tripMultiplier = Math.min(Math.floor(rec.failureCount / this.defaultFailureThreshold), 4);
      rec.nextAttemptTime = Date.now() + cooldownMs * Math.pow(1.5, tripMultiplier);
    }
  }

  public reset(key?: string): void {
    if (key) {
      this.breakers.delete(key);
    } else {
      this.breakers.clear();
    }
  }

  /**
   * Helper to compute exponential backoff with jitter
   */
  public static calculateBackoff(attempt: number, baseMs = 300, maxMs = 3000): number {
    const backoff = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    const jitter = Math.random() * 0.2 * backoff; // 20% jitter
    return Math.floor(backoff + jitter);
  }
}

export const globalCircuitBreaker = new JarvisCircuitBreaker();
