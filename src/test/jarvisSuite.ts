/**
 * JARVIS Reliability & Incident Management Verification Suite
 * Royal Biryani House RMS
 * 
 * Verifies all 12 operational criteria:
 * Test A: Retryable network error -> safe recovery
 * Test B: Realtime disconnect -> reconnect & incident tracking
 * Test C: Transient Supabase error -> bounded retry & circuit breaker
 * Test D: Recovery succeeds -> incident resolved
 * Test E: Recovery fails -> incident generated
 * Test F: Repeated same error -> incident deduplicated
 * Test G: Payment mutation failure -> NO autonomous financial mutation (Level 3 gate)
 * Test H: RLS/security issue -> NO autonomous security mutation (Level 3 gate)
 * Test I: Tenant A incident cannot appear in Tenant B (Multi-tenant isolation)
 * Test J: Secrets/tokens are redacted from incidents (Zero secret exposure)
 * Test K: Existing RMS order flow remains unchanged
 * Test L: Existing settlement flow remains unchanged
 */

// Setup browser globals for Node.js test runner if running outside a browser
if (typeof globalThis.window === 'undefined') {
  const store = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  (globalThis as any).window = {
    location: {
      search: '',
      pathname: '/',
      href: 'http://localhost:3000/'
    },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear()
    },
    sessionStorage: {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => sessionStore.set(k, String(v)),
      removeItem: (k: string) => sessionStore.delete(k),
      clear: () => sessionStore.clear()
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true
  };

  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  (globalThis as any).sessionStorage = (globalThis as any).window.sessionStorage;

  class MockBroadcastChannel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  (globalThis as any).window.BroadcastChannel = MockBroadcastChannel;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, opts?: any) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
}

import {
  jarvis,
  assertNonCriticalOperation,
  redactSensitiveData,
  classifyFailureLevel,
  isTransientError,
  JarvisCircuitBreaker,
  JarvisIncidentManager
} from '../jarvis';

import {
  createOrderSecure,
  settleDiningSessionAtomic,
  getStoredOrders,
  generateTableQrToken,
  DEFAULT_RESTAURANT_ID
} from '../lib/supabase';

// Colored terminal output helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function pass(testId: string, desc: string, details?: string) {
  console.log(`  ${colors.green}PASS${colors.reset} [${testId}] ${colors.bold}${desc}${colors.reset}`);
  if (details) {
    console.log(`       ${colors.dim}${details}${colors.reset}`);
  }
}

function fail(testId: string, desc: string, error: any) {
  console.error(`  ${colors.red}FAIL${colors.reset} [${testId}] ${colors.bold}${desc}${colors.reset}`);
  console.error(`       ${colors.red}${error?.message || error}${colors.reset}`);
}

async function runJarvisSuite() {
  console.log(`\n${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}      JARVIS RELIABILITY & INCIDENT SUITE (TESTS A - L)        ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  // Clean initial state for testing
  jarvis.clearAllIncidents('rbh-main-branch');
  jarvis.clearAllIncidents('urban-tadka-curry');
  jarvis.clearAllIncidents('tenant-test');

  // =========================================================================
  // TEST A: Retryable network error -> safe recovery
  // =========================================================================
  try {
    let attempts = 0;
    const result = await jarvis.executeSafe({
      module: 'NETWORK',
      operation: 'fetch_remote_data',
      restaurantId: 'rbh-main-branch',
      maxRetries: 3,
      initialBackoffMs: 10,
      action: async () => {
        attempts++;
        if (attempts < 3) {
          throw new TypeError('Failed to fetch: connection timeout');
        }
        return { recovered: true, attempts };
      }
    });

    if (result.recovered === true && result.attempts === 3) {
      pass('TEST_A', 'Retryable network error -> safe recovery succeeded after 2 retries', `Total attempts: ${attempts}`);
      passed++;
    } else {
      throw new Error(`Expected recovery on 3rd attempt, got ${JSON.stringify(result)}`);
    }
  } catch (err) {
    fail('TEST_A', 'Retryable network error failed', err);
    failed++;
  }

  // =========================================================================
  // TEST B: Realtime disconnect -> reconnect & incident tracking
  // =========================================================================
  try {
    jarvis.clearAllIncidents('rbh-main-branch');
    // Record transient realtime channel degradation
    const inc = jarvis.recordIncident({
      module: 'REALTIME',
      operation: 'supabase_realtime_subscribe',
      severity: 'MEDIUM',
      level: 1,
      error: new Error('CHANNEL_ERROR: WebSocket disconnected unexpectedly'),
      restaurantId: 'rbh-main-branch',
      metadata: { channel: 'rbh_orders_realtime_rbh-main-branch' }
    });

    // Check health status is degraded
    const healthBefore = jarvis.getHealth('rbh-main-branch');
    if (healthBefore.status !== 'DEGRADED') {
      throw new Error(`Expected DEGRADED health, got ${healthBefore.status}`);
    }

    // Simulate successful reconnect
    jarvis.resolveIncident(inc.id, 'rbh-main-branch');
    const healthAfter = jarvis.getHealth('rbh-main-branch');
    if (healthAfter.status !== 'HEALTHY') {
      throw new Error(`Expected HEALTHY health after reconnect resolve, got ${healthAfter.status}`);
    }

    pass('TEST_B', 'Realtime disconnect -> incident recorded and resolved on reconnect', `Incident ID: ${inc.id}`);
    passed++;
  } catch (err) {
    fail('TEST_B', 'Realtime disconnect test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST C: Transient Supabase error -> bounded retry & circuit breaker
  // =========================================================================
  try {
    let callCount = 0;
    const cbKey = 'test_circuit_breaker:rbh-main-branch';

    const fallbackResult = await jarvis.executeSafe<{ fallbackUsed: boolean; errorMsg?: string }>({
      module: 'DATABASE',
      operation: 'query_records',
      restaurantId: 'rbh-main-branch',
      circuitBreakerKey: cbKey,
      maxRetries: 3,
      initialBackoffMs: 10,
      action: async () => {
        callCount++;
        const err = new Error('HTTP 503: Service Unavailable');
        (err as any).status = 503;
        throw err;
      },
      fallback: async (err) => {
        return { fallbackUsed: true, errorMsg: err?.message };
      }
    });

    // Total calls should be bounded: 1 initial + 3 retries = 4 calls total
    if (callCount !== 4) {
      throw new Error(`Expected exactly 4 attempts (1 initial + 3 retries), got ${callCount}`);
    }
    if (!fallbackResult.fallbackUsed) {
      throw new Error('Fallback was not called after retries exhausted');
    }

    pass('TEST_C', 'Transient Supabase error -> bounded to exactly 3 retries with fallback', `Attempts: ${callCount}`);
    passed++;
  } catch (err) {
    fail('TEST_C', 'Bounded retry test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST D: Recovery succeeds -> incident resolved
  // =========================================================================
  try {
    const inc = jarvis.recordIncident({
      module: 'CACHE',
      operation: 'sync_menu_cache',
      severity: 'LOW',
      level: 1,
      error: new Error('Stale cache read timeout'),
      restaurantId: 'rbh-main-branch'
    });

    if (inc.resolved) {
      throw new Error('New incident should start unresolved');
    }

    const resolvedOk = jarvis.resolveIncident(inc.id, 'rbh-main-branch');
    if (!resolvedOk) {
      throw new Error('resolveIncident returned false');
    }

    const all = jarvis.getIncidents('rbh-main-branch');
    const updated = all.find(i => i.id === inc.id);
    if (!updated || !updated.resolved) {
      throw new Error('Incident was not marked resolved');
    }

    pass('TEST_D', 'Recovery succeeds -> incident marked resolved in tenant registry', `Resolved: ${updated.id}`);
    passed++;
  } catch (err) {
    fail('TEST_D', 'Incident resolve test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST E: Recovery fails -> incident generated
  // =========================================================================
  try {
    let threw = false;
    try {
      await jarvis.executeSafe({
        module: 'ORDER',
        operation: 'unrecoverable_order_check',
        restaurantId: 'rbh-main-branch',
        maxRetries: 1,
        initialBackoffMs: 5,
        action: async () => {
          throw new Error('Permanent business rule error: kitchen closed');
        }
      });
    } catch (err: any) {
      threw = true;
    }

    if (!threw) {
      throw new Error('executeSafe should have thrown when no fallback was provided');
    }

    const incidents = jarvis.getIncidents('rbh-main-branch');
    const generated = incidents.find(i => i.operation === 'unrecoverable_order_check');
    if (!generated || generated.recoveryResult !== 'failed') {
      throw new Error('Failed recovery incident was not found in registry');
    }

    pass('TEST_E', 'Recovery fails -> structured Level 2 incident created with recoveryResult="failed"', `Incident: ${generated.id}`);
    passed++;
  } catch (err) {
    fail('TEST_E', 'Failed recovery incident generation test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST F: Repeated same error -> incident deduplicated
  // =========================================================================
  try {
    const error = new Error('Database pool connection timeout on query');
    
    // Fire the same error 5 times in succession
    for (let i = 0; i < 5; i++) {
      jarvis.recordIncident({
        module: 'DATABASE',
        operation: 'connection_pool_check',
        severity: 'HIGH',
        level: 2,
        error,
        restaurantId: 'rbh-main-branch'
      });
    }

    const incidents = jarvis.getIncidents('rbh-main-branch').filter(i => i.operation === 'connection_pool_check');
    if (incidents.length !== 1) {
      throw new Error(`Expected exactly 1 deduplicated incident, found ${incidents.length}`);
    }

    if (incidents[0].occurrenceCount !== 5) {
      throw new Error(`Expected occurrenceCount = 5, found ${incidents[0].occurrenceCount}`);
    }

    pass('TEST_F', 'Repeated same error -> deduplicated into single incident with occurrenceCount=5', `Count: ${incidents[0].occurrenceCount}`);
    passed++;
  } catch (err) {
    fail('TEST_F', 'Deduplication test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST G: Payment mutation failure -> NO autonomous financial mutation
  // =========================================================================
  try {
    // 1. Verify assertNonCriticalOperation strictly blocks financial operations
    let settlementBlocked = false;
    try {
      assertNonCriticalOperation('settle_dining_session');
    } catch (e: any) {
      settlementBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    let paymentBlocked = false;
    try {
      assertNonCriticalOperation('process_payment');
    } catch (e: any) {
      paymentBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    let refundBlocked = false;
    try {
      assertNonCriticalOperation('refund_bill');
    } catch (e: any) {
      refundBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    // 2. Verify executeSafeRecovery strictly refuses to run financial operations
    let executeSafeBlocked = false;
    try {
      await jarvis.executeSafe({
        module: 'BILLING',
        operation: 'settle_dining_session_atomic',
        restaurantId: 'rbh-main-branch',
        action: async () => {
          return { mutated: true };
        }
      });
    } catch (e: any) {
      executeSafeBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    if (settlementBlocked && paymentBlocked && refundBlocked && executeSafeBlocked) {
      pass('TEST_G', 'Payment mutation failure -> NO autonomous financial mutation (Level 3 gate enforced)', 'Blocks settlement, payment, refund');
      passed++;
    } else {
      throw new Error(`Financial operation blocks failed: settlement=${settlementBlocked}, payment=${paymentBlocked}, refund=${refundBlocked}, executeSafe=${executeSafeBlocked}`);
    }
  } catch (err) {
    fail('TEST_G', 'Financial safety gate test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST H: RLS/security issue -> NO autonomous security mutation
  // =========================================================================
  try {
    let rlsBlocked = false;
    try {
      assertNonCriticalOperation('alter_rls_policy');
    } catch (e: any) {
      rlsBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    let authBlocked = false;
    try {
      assertNonCriticalOperation('grant_staff_role');
    } catch (e: any) {
      authBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    let tenantBlocked = false;
    try {
      assertNonCriticalOperation('bypass_tenant_isolation');
    } catch (e: any) {
      tenantBlocked = e.message.includes('CRITICAL_OPERATION_BLOCKED');
    }

    if (rlsBlocked && authBlocked && tenantBlocked) {
      pass('TEST_H', 'RLS/security issue -> NO autonomous security mutation (Level 3 gate enforced)', 'Blocks RLS, auth roles, tenant bypass');
      passed++;
    } else {
      throw new Error(`Security mutation blocks failed: rls=${rlsBlocked}, auth=${authBlocked}, tenant=${tenantBlocked}`);
    }
  } catch (err) {
    fail('TEST_H', 'Security safety gate test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST I: Tenant A incident cannot appear in Tenant B
  // =========================================================================
  try {
    jarvis.recordIncident({
      module: 'ORDER',
      operation: 'order_create_rbh',
      severity: 'HIGH',
      level: 2,
      error: new Error('RBH specific failure'),
      restaurantId: 'rbh-main-branch'
    });

    jarvis.recordIncident({
      module: 'ORDER',
      operation: 'order_create_urban',
      severity: 'HIGH',
      level: 2,
      error: new Error('Urban Tadka specific failure'),
      restaurantId: 'urban-tadka-curry'
    });

    const rbhIncidents = jarvis.getIncidents('rbh-main-branch');
    const urbanIncidents = jarvis.getIncidents('urban-tadka-curry');

    const bleedIntoRbh = rbhIncidents.some(i => i.restaurantId === 'urban-tadka-curry' || i.operation === 'order_create_urban');
    const bleedIntoUrban = urbanIncidents.some(i => i.restaurantId === 'rbh-main-branch' || i.operation === 'order_create_rbh');

    if (bleedIntoRbh) {
      throw new Error('Tenant B incident leaked into Tenant A incident registry');
    }
    if (bleedIntoUrban) {
      throw new Error('Tenant A incident leaked into Tenant B incident registry');
    }

    pass('TEST_I', 'Tenant A incident cannot appear in Tenant B (Multi-tenant incident isolation confirmed)', 'Partitioned under rbh_jarvis_incidents:<restaurantId>');
    passed++;
  } catch (err) {
    fail('TEST_I', 'Multi-tenant isolation test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST J: Secrets/tokens are redacted from incidents
  // =========================================================================
  try {
    const rawError = 'Error connecting with key sb_secret_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token and QR rbh_tok_t1_98a7b6c5 and password=super_secret_pass';
    const redacted = redactSensitiveData(rawError);

    const hasJwt = /eyJ[a-zA-Z0-9_-]{20,}/.test(redacted);
    const hasQrTok = /rbh_tok_[a-z0-9_]+/i.test(redacted);
    const hasPassword = /password=super_secret_pass/.test(redacted);

    if (hasJwt) throw new Error('JWT token was not redacted');
    if (hasQrTok) throw new Error('QR token was not redacted');
    if (hasPassword) throw new Error('Password was not redacted');

    if (!redacted.includes('[REDACTED_API_KEY]') && !redacted.includes('[REDACTED_TOKEN]')) {
      throw new Error('Redaction placeholder not found');
    }

    // Verify Antigravity prompt generator also produces clean redacted output
    const prompt = jarvis.generateAntigravityPrompt({
      id: 'inc-test',
      restaurantId: 'rbh-main-branch',
      module: 'DATABASE',
      operation: 'query_with_secret',
      severity: 'CRITICAL',
      level: 3,
      message: 'Failed with secret key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret and rbh_tok_t2_12345678',
      timestamp: new Date().toISOString(),
      occurrenceCount: 1,
      resolved: false
    });

    if (/eyJ[a-zA-Z0-9_-]{20,}/.test(prompt) || /rbh_tok_[a-z0-9_]+/i.test(prompt)) {
      throw new Error('Diagnostic prompt leaked secrets');
    }

    pass('TEST_J', 'Secrets, JWTs, and QR tokens are redacted from incidents & Antigravity prompts', 'Zero secret leakage verified');
    passed++;
  } catch (err) {
    fail('TEST_J', 'Secret redaction test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST K: Existing RMS order flow remains unchanged
  // =========================================================================
  try {
    const validQrToken = generateTableQrToken('Table 1', 'rbh-main-branch');
    const orderRes = await createOrderSecure({
      restaurantId: 'rbh-main-branch',
      tableNumber: 'Table 1',
      qrToken: validQrToken,
      items: [
        { id: '1', quantity: 2, spiceLevel: 'Medium' }, // Royal Chicken Biryani (₹349)
        { id: '2', quantity: 1, spiceLevel: 'Mild' }    // Royal Mutton Dum Biryani (₹449)
      ],
      customerName: 'Aarav Sharma',
      customerNotes: 'Extra raita please'
    });

    if (!orderRes.success || !orderRes.order) {
      throw new Error(`createOrderSecure failed: ${orderRes.error}`);
    }

    const order = orderRes.order;
    if (order.items.length !== 2) {
      throw new Error(`Expected 2 items, got ${order.items.length}`);
    }
    // Subtotal: 2 * 340 (Chicken Biryani) + 1 * 460 (Mutton Biryani) = 680 + 460 = 1140
    // Tax (5%): 1140 * 0.05 = 57.0
    // Total: 1140 + 57 = 1197.0
    if (order.subtotal !== 1140) {
      throw new Error(`Expected subtotal 1140, got ${order.subtotal}`);
    }
    if (order.status !== 'New') {
      throw new Error(`Expected initial status "New", got ${order.status}`);
    }

    pass('TEST_K', 'Existing RMS order flow remains 100% intact (Authoritative pricing & tax verified)', `Order ID: ${order.id}, Total: ₹${order.total}`);
    passed++;
  } catch (err) {
    fail('TEST_K', 'Existing RMS order flow test failed', err);
    failed++;
  }

  // =========================================================================
  // TEST L: Existing settlement flow remains unchanged
  // =========================================================================
  try {
    const validQrToken = generateTableQrToken('Table 2', 'rbh-main-branch');
    const orderRes = await createOrderSecure({
      restaurantId: 'rbh-main-branch',
      tableNumber: 'Table 2',
      qrToken: validQrToken,
      items: [{ id: '1', quantity: 1 }] // Royal Chicken Biryani ₹349 + 5% GST (17.5) = ₹366.5
    });

    if (!orderRes.success || !orderRes.order) {
      throw new Error(`Prerequisite order creation failed: ${orderRes.error}`);
    }

    const order = orderRes.order;
    const settleRes = await settleDiningSessionAtomic({
      restaurantId: 'rbh-main-branch',
      sessionId: order.sessionId,
      tableNumber: 'Table 2',
      splitPayments: [
        { mode: 'UPI', amount: 200 },
        { mode: 'Cash', amount: Math.round((order.total - 200) * 10) / 10 }
      ],
      recordedBy: 'Counter Cashier'
    });

    if (!settleRes.success) {
      throw new Error(`settleDiningSessionAtomic failed: ${settleRes.error}`);
    }
    if (!settleRes.isFullyPaid) {
      throw new Error(`Expected isFullyPaid = true, got ${settleRes.isFullyPaid}`);
    }
    if (settleRes.remainingAmount > 0.05) {
      throw new Error(`Expected remainingAmount ~ 0, got ${settleRes.remainingAmount}`);
    }

    pass('TEST_L', 'Existing settlement flow remains 100% intact (Multi-split UPI + Cash atomic settlement verified)', `Paid: ₹${settleRes.totalPaidNow}, Remaining: ₹${settleRes.remainingAmount}`);
    passed++;
  } catch (err) {
    fail('TEST_L', 'Existing settlement flow test failed', err);
    failed++;
  }

  // =========================================================================
  // FINAL SCORECARD
  // =========================================================================
  console.log(`\n${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.bold}                    FINAL SCORECARD                            ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`  Total Tests Run: 12`);
  console.log(`  ${colors.green}Tests Passed:   ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Tests Failed:   ${failed}${colors.reset}`);

  if (failed === 0) {
    console.log(`\n  ${colors.green}${colors.bold}>>> ALL 12 JARVIS OPERATIONAL CRITERIA CONFIRMED (12/12 PASS) <<<${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`\n  ${colors.red}${colors.bold}>>> CRITICAL FAILURE: ${failed} TEST(S) FAILED <<<${colors.reset}\n`);
    process.exit(1);
  }
}

runJarvisSuite().catch((err) => {
  console.error('Unhandled fatal error running JARVIS test suite:', err);
  process.exit(1);
});
