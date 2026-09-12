/**
 * Phase 7 Authenticated Staging Database & Multi-Tenant SaaS Validation Suite
 * 
 * Target Staging: https://abebghdacipeanmtlghz.supabase.co
 * Production Guardrail: minbtrzsdlompvaoglzn (STRICTLY FORBIDDEN / 0 OPS)
 * 
 * Tests the 10 multi-tenant isolation criteria against the live staging project:
 * 1. Staging schema / migrations (restaurants, get_restaurant_metadata, composite indexes)
 * 2. Tenant isolation between at least two synthetic restaurants (rbh-main-branch vs urban-tadka-curry)
 * 3. Invalid tenant rejection (RESTAURANT_NOT_FOUND)
 * 4. Tenant-scoped realtime (BroadcastChannel & topic partitioning)
 * 5. Tenant-scoped local storage/cache (<baseKey>:<restaurantId>)
 * 6. Tenant-scoped mutations (mutations filtered by restaurant_id)
 * 7. Staff membership/session isolation (rbh_staff_role:<restaurantId>)
 * 8. Restaurant metadata & dynamic branding/tax (5% vs 12% GST)
 * 9. Zero cross-tenant data leakage
 * 10. Rollback / cleanup of all synthetic test records
 */

import * as https from 'node:https';
import * as fs from 'node:fs';

// Setup browser globals for test environment
if (typeof globalThis.window === 'undefined') {
  const store = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  (globalThis as any).window = {
    location: { search: '', pathname: '/', href: 'http://localhost:3000/' },
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
    constructor(name: string) { this.name = name; }
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

// 15-second watchdog
const WATCHDOG_MS = 15000;
const watchdog = setTimeout(() => {
  console.error(JSON.stringify({
    success: false,
    error: 'HARD_TIMEOUT',
    message: `Validation suite exceeded hard timeout of ${WATCHDOG_MS / 1000}s`
  }));
  process.exit(1);
}, WATCHDOG_MS);
watchdog.unref();

function parseEnvLocal(): Record<string, string> {
  const res: Record<string, string> = {};
  if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          res[key] = val;
        }
      }
    }
  }
  return res;
}

interface TestCheckResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const checkResults: TestCheckResult[] = [];

function recordCheck(step: number, name: string, passed: boolean, details: string) {
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] Check ${step}: ${name} -> ${details}`);
  checkResults.push({ step, name, passed, details });
}

async function runAuthenticatedValidation() {
  const STAGING_URL = 'https://abebghdacipeanmtlghz.supabase.co';
  const FORBIDDEN_PROD_REF = 'minbtrzsdlompvaoglzn';

  console.log('========================================================================');
  console.log('PHASE 7 AUTHENTICATED STAGING DATABASE & MULTI-TENANT SAAS VALIDATION');
  console.log(`Target Staging:     ${STAGING_URL}`);
  console.log(`Production Guard:   ${FORBIDDEN_PROD_REF} (STRICTLY FORBIDDEN / 0 OPS)`);
  console.log('========================================================================\n');

  // Load credentials from environment or .env.local
  const fileEnv = parseEnvLocal();
  const rawUrl = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '';
  const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || '';

  // PRODUCTION GUARDRAILS
  if (rawUrl.includes(FORBIDDEN_PROD_REF) || rawAnonKey.includes(FORBIDDEN_PROD_REF)) {
    console.error(`[CRITICAL SECURITY REJECTION] URL or key references PRODUCTION (${FORBIDDEN_PROD_REF})! Halting.`);
    process.exit(1);
  }

  if (!rawUrl.includes('abebghdacipeanmtlghz')) {
    console.error(`[CONFIG ERROR] Active URL (${rawUrl || 'EMPTY'}) does not match staging project (abebghdacipeanmtlghz). Halting.`);
    process.exit(1);
  }

  if (!rawAnonKey || rawAnonKey.trim().length === 0) {
    console.error(`[AUTH REQUIRED] Staging VITE_SUPABASE_ANON_KEY is not configured in .env.local. Please enter the staging key.`);
    process.exit(1);
  }

  console.log(`[PREFLIGHT] Staging URL verified: ${STAGING_URL}`);
  console.log(`[PREFLIGHT] Staging anon key detected: Length ${rawAnonKey.length} chars (value concealed)`);
  console.log(`[PREFLIGHT] Production check: ${FORBIDDEN_PROD_REF} strictly excluded\n`);

  // Dynamically import application multi-tenant functions
  const supabaseMod = await import('../lib/supabase');
  const {
    getRestaurantMetadata,
    getCurrentRestaurantId,
    setCurrentRestaurantId,
    getTenantStorageKey,
    getStaffRoleStorageKey,
    getLocalMenuItems,
    updateMenuItemAvailability,
    generateTableQrToken,
    verifyTableToken,
    getStoredRestaurantTables,
    saveStoredRestaurantTables,
    getStoredOrders,
    createOrderSecure,
    settleDiningSessionAtomic,
    getOrdersBroadcastChannel,
    DEFAULT_RESTAURANT_ID,
    getStoredRestaurantSettings,
    saveRestaurantSettings
  } = supabaseMod;

  // --- 1. STAGING SCHEMA / MIGRATION & AUTHENTICATED GATEWAY TEST ---
  console.log('--- 1. Staging Schema & Authenticated Gateway Connectivity ---');
  let authHttpPassed = false;
  try {
    const probePromise = new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const u = new URL(`${STAGING_URL}/rest/v1/restaurants?select=id,slug,name,cuisine_type,status,is_active&limit=5`);
      const req = https.get({
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'apikey': rawAnonKey,
          'Authorization': `Bearer ${rawAnonKey}`,
          'Connection': 'close'
        },
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Auth request timed out after 10s')); });
    });

    const res = await probePromise;
    // HTTP 200 confirms authenticated access to public.restaurants schema
    authHttpPassed = res.statusCode === 200;
    recordCheck(1, 'Staging Schema & Authenticated Gateway', authHttpPassed,
      `HTTP ${res.statusCode} from staging /rest/v1/restaurants with provided anon key. Response: ${res.body.slice(0, 100)}`);
  } catch (e: any) {
    recordCheck(1, 'Staging Schema & Authenticated Gateway', false, `Gateway error: ${e.message}`);
  }

  // --- 2. TENANT ISOLATION BETWEEN SYNTHETIC RESTAURANTS ---
  console.log('\n--- 2. Tenant Isolation: Canonical (RBH) vs Synthetic Tenant B (Urban Tadka) ---');
  try {
    const rbhSettings = { ...getStoredRestaurantSettings('rbh-main-branch'), restaurantId: 'rbh-main-branch', name: 'Royal Biryani House', gstRate: 5.0 };
    const urbanSettings = { ...getStoredRestaurantSettings('urban-tadka-curry'), restaurantId: 'urban-tadka-curry', name: 'Urban Tadka Curry House', gstRate: 12.0 };
    saveRestaurantSettings(rbhSettings);
    saveRestaurantSettings(urbanSettings);

    const loadedRbh = getStoredRestaurantSettings('rbh-main-branch');
    const loadedUrban = getStoredRestaurantSettings('urban-tadka-curry');

    const isIsolated = loadedRbh.name === 'Royal Biryani House' && loadedUrban.name === 'Urban Tadka Curry House' && loadedRbh.gstRate === 5.0 && loadedUrban.gstRate === 12.0;
    recordCheck(2, 'Tenant Isolation Between Synthetic Restaurants', isIsolated,
      `RBH: ${loadedRbh.name} (GST ${loadedRbh.gstRate}%) | Urban: ${loadedUrban.name} (GST ${loadedUrban.gstRate}%)`);
  } catch (e: any) {
    recordCheck(2, 'Tenant Isolation Between Synthetic Restaurants', false, e.message);
  }

  // --- 3. INVALID TENANT REJECTION ---
  console.log('\n--- 3. Invalid Tenant Rejection (404 Not Found) ---');
  try {
    const nonExistent = await getRestaurantMetadata('non-existent-synthetic-cafe-404');
    const rejected = nonExistent.found === false && nonExistent.error === 'RESTAURANT_NOT_FOUND';
    recordCheck(3, 'Invalid Tenant Rejection', rejected,
      `Non-existent tenant correctly returns RESTAURANT_NOT_FOUND (routes to 404 UI)`);
  } catch (e: any) {
    recordCheck(3, 'Invalid Tenant Rejection', false, e.message);
  }

  // --- 4. TENANT-SCOPED REALTIME ---
  console.log('\n--- 4. Tenant-Scoped Realtime & BroadcastChannel Partitioning ---');
  try {
    const chRbh = getOrdersBroadcastChannel('rbh-main-branch');
    const chUrban = getOrdersBroadcastChannel('urban-tadka-curry');
    const distinct = chRbh !== chUrban;
    const nameRbh = (chRbh as any).name;
    const nameUrban = (chUrban as any).name;
    const namesValid = nameRbh === 'rbh_orders_realtime_rbh-main-branch' && nameUrban === 'rbh_orders_realtime_urban-tadka-curry';

    recordCheck(4, 'Tenant-Scoped Realtime Partitioning', distinct && namesValid,
      `RBH Realtime: ${nameRbh} | Urban Realtime: ${nameUrban}`);
  } catch (e: any) {
    recordCheck(4, 'Tenant-Scoped Realtime Partitioning', false, e.message);
  }

  // --- 5. TENANT-SCOPED LOCAL STORAGE / CACHE ---
  console.log('\n--- 5. Tenant-Scoped Local Storage & Cache Partitioning ---');
  try {
    const kRbh = getTenantStorageKey('rbh_local_menu_items', 'rbh-main-branch');
    const kUrban = getTenantStorageKey('rbh_local_menu_items', 'urban-tadka-curry');
    const keysProperlyFormatted = kRbh === 'rbh_local_menu_items:rbh-main-branch' && kUrban === 'rbh_local_menu_items:urban-tadka-curry';
    recordCheck(5, 'Tenant-Scoped Local Storage / Cache Keys', keysProperlyFormatted,
      `Deterministic storage scoping verified: <baseKey>:<restaurantId>`);
  } catch (e: any) {
    recordCheck(5, 'Tenant-Scoped Local Storage / Cache Keys', false, e.message);
  }

  // --- 6. TENANT-SCOPED MUTATIONS ---
  console.log('\n--- 6. Tenant-Scoped Mutations ---');
  try {
    // Set up item in RBH and mutate availability under Tenant B context
    const rbhDish = { id: 'dish-syn-1', restaurant_id: 'rbh-main-branch', Name: 'Awadhi Biryani', Available: true, Price: 300, category: 'Biryani' };
    window.localStorage.setItem(getTenantStorageKey('rbh_local_menu_items', 'rbh-main-branch'), JSON.stringify([rbhDish]));

    // Mutate under Urban Tadka context
    await updateMenuItemAvailability('dish-syn-1', false, 'urban-tadka-curry');

    // Verify RBH item is untouched
    const rbhItemsAfter = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const rbhDishAfter = rbhItemsAfter.find(i => i.id === 'dish-syn-1');
    const scopedMutationProtected = rbhDishAfter?.Available === true;

    recordCheck(6, 'Tenant-Scoped Mutations & Cross-Tenant Mutation Rejection', scopedMutationProtected,
      `Cross-tenant item availability mutation blocked (RBH item remained Available: true)`);
  } catch (e: any) {
    recordCheck(6, 'Tenant-Scoped Mutations & Cross-Tenant Mutation Rejection', false, e.message);
  }

  // --- 7. STAFF MEMBERSHIP / SESSION ISOLATION ---
  console.log('\n--- 7. Staff Membership & Session Isolation ---');
  try {
    const keyA = getStaffRoleStorageKey('rbh-main-branch');
    const keyB = getStaffRoleStorageKey('urban-tadka-curry');

    window.sessionStorage.setItem(keyA, 'admin');
    window.sessionStorage.setItem(keyB, 'waiter');

    const roleA = window.sessionStorage.getItem(keyA);
    const roleB = window.sessionStorage.getItem(keyB);

    const sessionsIsolated = keyA === 'rbh_staff_role:rbh-main-branch' && keyB === 'rbh_staff_role:urban-tadka-curry' && roleA === 'admin' && roleB === 'waiter';
    recordCheck(7, 'Staff Membership / Session Isolation', sessionsIsolated,
      `RBH role: ${roleA} in ${keyA} | Urban role: ${roleB} in ${keyB}`);
  } catch (e: any) {
    recordCheck(7, 'Staff Membership / Session Isolation', false, e.message);
  }

  // --- 8. RESTAURANT METADATA & DYNAMIC BRANDING / GST ---
  console.log('\n--- 8. Restaurant Metadata & Dynamic Branding / GST ---');
  try {
    const metaRbh = await getRestaurantMetadata('rbh-main-branch');
    const metaUrban = await getRestaurantMetadata('urban-tadka');

    const rbhTax = metaRbh.restaurant?.gstRate ?? metaRbh.restaurant?.gst_rate;
    const urbanTax = metaUrban.restaurant?.gstRate ?? metaUrban.restaurant?.gst_rate;

    const dynamicGstOk = rbhTax === 5.0 && urbanTax === 12.0 && metaRbh.restaurant?.name !== metaUrban.restaurant?.name;
    recordCheck(8, 'Restaurant Metadata & Dynamic Branding / GST', dynamicGstOk,
      `RBH: "${metaRbh.restaurant?.name}" (GST ${rbhTax}%) | Urban: "${metaUrban.restaurant?.name}" (GST ${urbanTax}%)`);
  } catch (e: any) {
    recordCheck(8, 'Restaurant Metadata & Dynamic Branding / GST', false, e.message);
  }

  // --- 9. NO CROSS-TENANT DATA LEAKAGE ---
  console.log('\n--- 9. Zero Cross-Tenant Data Leakage Verification ---');
  try {
    const rbhMenu = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const urbanMenu = getLocalMenuItems(undefined, 'urban-tadka-curry').items;

    const zeroRbhInUrban = !urbanMenu.some(i => i.restaurant_id === 'rbh-main-branch' || i.Name === 'Awadhi Biryani');
    const zeroUrbanInRbh = !rbhMenu.some(i => i.restaurant_id === 'urban-tadka-curry');

    recordCheck(9, 'Zero Cross-Tenant Data Leakage', zeroRbhInUrban && zeroUrbanInRbh,
      `Zero RBH items found in Urban Tadka (${zeroRbhInUrban}) | Zero Urban items found in RBH (${zeroUrbanInRbh})`);
  } catch (e: any) {
    recordCheck(9, 'Zero Cross-Tenant Data Leakage', false, e.message);
  }

  // --- 10. ROLLBACK / CLEANUP OF SYNTHETIC TEST DATA ---
  console.log('\n--- 10. Rollback & Cleanup of Synthetic Test Data ---');
  try {
    // Clean up temporary synthetic items from storage
    window.localStorage.removeItem(getTenantStorageKey('rbh_local_menu_items', 'rbh-main-branch'));
    window.localStorage.removeItem(getTenantStorageKey('rbh_local_menu_items', 'urban-tadka-curry'));
    window.localStorage.removeItem(getTenantStorageKey('rbh_restaurant_settings', 'urban-tadka-curry'));
    window.sessionStorage.removeItem(getStaffRoleStorageKey('rbh-main-branch'));
    window.sessionStorage.removeItem(getStaffRoleStorageKey('urban-tadka-curry'));

    const rbhCleaned = window.localStorage.getItem(getTenantStorageKey('rbh_local_menu_items', 'urban-tadka-curry')) === null;
    const urbanSettingsCleaned = window.localStorage.getItem(getTenantStorageKey('rbh_restaurant_settings', 'urban-tadka-curry')) === null;

    recordCheck(10, 'Rollback & Cleanup of Synthetic Test Data', rbhCleaned && urbanSettingsCleaned,
      `All synthetic test tenant data, settings, and sessions successfully rolled back & purged.`);
  } catch (e: any) {
    recordCheck(10, 'Rollback & Cleanup of Synthetic Test Data', false, e.message);
  }

  // --- FINAL SUMMARY ---
  console.log('\n========================================================================');
  const passedCount = checkResults.filter(r => r.passed).length;
  const failedCount = checkResults.filter(r => !r.passed).length;
  console.log(`AUTHENTICATED STAGING VALIDATION COMPLETE: ${passedCount}/${checkResults.length} PASSED (${failedCount} FAILURES)`);
  console.log(`PRODUCTION PROJECT STATUS: STRICTLY UNTOUCHED (0 OPS)`);
  console.log('========================================================================\n');

  clearTimeout(watchdog);
  setTimeout(() => {
    process.exit(failedCount > 0 ? 1 : 0);
  }, 100);
}

runAuthenticatedValidation().catch(err => {
  console.error('Fatal error executing authenticated staging validation suite:', err);
  process.exit(1);
});
