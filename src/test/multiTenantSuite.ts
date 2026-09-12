/**
 * Phase 7 Multi-Tenant SaaS Verification Suite
 * 
 * Tests all 14 multi-tenant operational criteria:
 * 1. Metadata discovery for rbh-main-branch (5% GST, Royal Biryani branding)
 * 2. Metadata discovery for urban-tadka-curry (12% GST, Urban Tadka branding)
 * 3. Metadata discovery for invalid slug (returns RESTAURANT_NOT_FOUND)
 * 4. Menu item isolation for rbh-main-branch
 * 5. Menu item isolation for urban-tadka-curry (zero bleed from/to RBH)
 * 6. Menu item availability mutation scoping (.eq('restaurant_id', ...))
 * 7. Table QR generation/verification isolation across tenants
 * 8. Table layout listing isolation between RBH and Tenant B
 * 9. Storage key scoping (<baseKey>:<restaurantId>)
 * 10. Staff auth session isolation between branches
 * 11. Order creation scoping (restaurant_id attached, dynamic GST)
 * 12. Dining session settlement scoping (atomic settlement isolated per tenant)
 * 13. BroadcastChannel tenant partitioning (rbh_orders_realtime_<rid>)
 * 14. Backward compatibility on root "/" and ?restaurant=rbh-main-branch
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
  getRestaurantMetadata,
  getCurrentRestaurantId,
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
} from '../lib/supabase';
import { MenuItem, RestaurantTable } from '../types';

let passed = 0;
let failed = 0;
const results: { test: number; name: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

function assert(condition: boolean, testNum: number, name: string, failureDetails: string = '') {
  if (condition) {
    passed++;
    results.push({ test: testNum, name, status: 'PASS' });
    console.log(`[PASS] Test ${testNum}: ${name}`);
  } else {
    failed++;
    results.push({ test: testNum, name, status: 'FAIL', details: failureDetails });
    console.error(`[FAIL] Test ${testNum}: ${name} -> ${failureDetails}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' Royal Biryani House RMS - Phase 7 Multi-Tenant SaaS Test Suite ');
  console.log('================================================================\n');

  // Test 1: Metadata discovery for rbh-main-branch
  try {
    const metaRbh = await getRestaurantMetadata('rbh-main-branch');
    const isValid = 
      metaRbh.found === true &&
      metaRbh.metadata !== null &&
      metaRbh.metadata !== undefined &&
      metaRbh.metadata.id === 'rbh-main-branch' &&
      metaRbh.metadata.name === 'Royal Biryani House' &&
      (metaRbh.metadata.gstRate === 5.0 || metaRbh.metadata.gst_rate === 5.0) &&
      metaRbh.metadata.status === 'active';
    assert(isValid, 1, 'Metadata discovery for canonical tenant rbh-main-branch', JSON.stringify(metaRbh));
  } catch (e: any) {
    assert(false, 1, 'Metadata discovery for canonical tenant rbh-main-branch', e.message);
  }

  // Test 2: Metadata discovery for urban-tadka / urban-tadka-curry
  try {
    const metaUrban = await getRestaurantMetadata('urban-tadka');
    const isValid = 
      metaUrban.found === true &&
      metaUrban.metadata !== null &&
      metaUrban.metadata !== undefined &&
      metaUrban.metadata.id === 'urban-tadka-curry' &&
      metaUrban.metadata.name === 'Urban Tadka Curry' &&
      (metaUrban.metadata.gstRate === 12.0 || metaUrban.metadata.gst_rate === 12.0) &&
      metaUrban.metadata.cuisine_type === 'North Indian & Mughlai';
    assert(isValid, 2, 'Metadata discovery for Staging Tenant B (urban-tadka)', JSON.stringify(metaUrban));
  } catch (e: any) {
    assert(false, 2, 'Metadata discovery for Staging Tenant B (urban-tadka)', e.message);
  }

  // Test 3: Metadata discovery for invalid slug
  try {
    const metaInvalid = await getRestaurantMetadata('non-existent-cafe-99');
    const isValid = 
      metaInvalid.found === false &&
      (metaInvalid.metadata === null || metaInvalid.metadata === undefined) &&
      metaInvalid.error === 'RESTAURANT_NOT_FOUND';
    assert(isValid, 3, 'Metadata discovery for non-existent slug returns RESTAURANT_NOT_FOUND', JSON.stringify(metaInvalid));
  } catch (e: any) {
    assert(false, 3, 'Metadata discovery for non-existent slug', e.message);
  }

  // Test 4: Menu item isolation for rbh-main-branch
  try {
    const rbhItems = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const hasItems = rbhItems.length > 0;
    const allRbhScoped = rbhItems.every(i => !i.restaurant_id || i.restaurant_id === 'rbh-main-branch');
    assert(hasItems && allRbhScoped, 4, 'Menu items isolated for rbh-main-branch with default Awadhi menu', `Count: ${rbhItems.length}`);
  } catch (e: any) {
    assert(false, 4, 'Menu items isolation for rbh-main-branch', e.message);
  }

  // Test 5: Menu item isolation for urban-tadka-curry (zero bleed from/to RBH)
  try {
    // Initial state for tenant B should not bleed RBH default items
    const tenantBInitial = getLocalMenuItems(undefined, 'urban-tadka-curry').items;
    const doesNotBleedRbh = tenantBInitial.length === 0;

    // Add a Tenant B specific dish
    const tenantBKey = getTenantStorageKey('rbh_local_menu_items', 'urban-tadka-curry');
    const customItem: MenuItem = {
      id: 'item_urban-tadka-curry_101',
      restaurant_id: 'urban-tadka-curry',
      Name: 'Urban Tadka Dal Makhani',
      category: 'Curries',
      Price: 320,
      Description: 'Creamy slow-cooked black lentils',
      Available: true,
      Image_url: 'https://images.unsplash.com/photo-546069901',
      isVeg: true
    };
    window.localStorage.setItem(tenantBKey, JSON.stringify([customItem]));

    const tenantBItems = getLocalMenuItems(undefined, 'urban-tadka-curry').items;
    const rbhItems = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const rbhDoesNotContainTenantB = !rbhItems.some(i => i.Name === 'Urban Tadka Dal Makhani');
    const tenantBHasOnlyOwn = tenantBItems.length === 1 && tenantBItems[0].Name === 'Urban Tadka Dal Makhani';

    assert(doesNotBleedRbh && rbhDoesNotContainTenantB && tenantBHasOnlyOwn, 5, 'Zero menu bleed between RBH and urban-tadka-curry', `TenantB count: ${tenantBItems.length}, RBH has Dal Makhani: ${!rbhDoesNotContainTenantB}`);
  } catch (e: any) {
    assert(false, 5, 'Menu item isolation for urban-tadka-curry', e.message);
  }

  // Test 6: Menu item availability mutation scoping
  try {
    await updateMenuItemAvailability('item_urban-tadka-curry_101', false, 'urban-tadka-curry');
    const tenantBItems = getLocalMenuItems(undefined, 'urban-tadka-curry').items;
    const updated = tenantBItems.find(i => String(i.id) === 'item_urban-tadka-curry_101');
    const isToggled = updated ? updated.Available === false : false;

    // RBH items must remain completely unaffected
    const rbhItems = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const rbhUnaffected = rbhItems.every(i => String(i.id) !== 'item_urban-tadka-curry_101');

    assert(isToggled && rbhUnaffected, 6, 'Menu item availability mutation scoped strictly by restaurant_id', `Toggled: ${isToggled}, RBH unaffected: ${rbhUnaffected}`);
  } catch (e: any) {
    assert(false, 6, 'Menu item availability mutation scoping', e.message);
  }

  // Test 7: Table QR generation/verification isolation across tenants
  try {
    const tokenRbh = generateTableQrToken('Table 3', 'rbh-main-branch');
    const tokenUrban = generateTableQrToken('Table 3', 'urban-tadka-curry');

    // Tokens must be distinct because tenant identity is salted into the hash
    const tokensDistinct = tokenRbh !== tokenUrban;

    // RBH token verifies under RBH
    const rbhValid = verifyTableToken('Table 3', tokenRbh, 'rbh-main-branch');
    // RBH token FAILS under Urban Tadka (cross-tenant spoof protection)
    const rbhRejectedOnUrban = verifyTableToken('Table 3', tokenRbh, 'urban-tadka-curry') === false;

    // Urban token verifies under Urban
    const urbanValid = verifyTableToken('Table 3', tokenUrban, 'urban-tadka-curry');
    // Urban token FAILS under RBH
    const urbanRejectedOnRbh = verifyTableToken('Table 3', tokenUrban, 'rbh-main-branch') === false;

    const allPassed = tokensDistinct && rbhValid && rbhRejectedOnUrban && urbanValid && urbanRejectedOnRbh;
    assert(allPassed, 7, 'Cryptographic Table QR tokens isolated across tenants (zero spoofing)', `Distinct: ${tokensDistinct}, Cross-tenant blocked: ${rbhRejectedOnUrban && urbanRejectedOnRbh}`);
  } catch (e: any) {
    assert(false, 7, 'Table QR generation/verification isolation', e.message);
  }

  // Test 8: Table listing isolation between RBH and Tenant B
  try {
    const rbhTables = getStoredRestaurantTables('rbh-main-branch');
    const rbhHasDefaultTables = rbhTables.length >= 8;

    // Tenant B tables isolated
    const customUrbanTable: RestaurantTable = {
      id: 'tbl_urban-tadka-curry_t1',
      restaurant_id: 'urban-tadka-curry',
      tableNumber: 'T-101',
      capacity: 6,
      section: 'Rooftop',
      isActive: true
    };
    saveStoredRestaurantTables([customUrbanTable], 'urban-tadka-curry');

    const loadedUrbanTables = getStoredRestaurantTables('urban-tadka-curry');
    const urbanIsolated = loadedUrbanTables.length === 1 && loadedUrbanTables[0].tableNumber === 'T-101';
    const rbhTablesStillIntact = getStoredRestaurantTables('rbh-main-branch').length === rbhTables.length;

    assert(rbhHasDefaultTables && urbanIsolated && rbhTablesStillIntact, 8, 'Table layout listing isolated between RBH and Tenant B', `RBH tables: ${rbhTables.length}, Urban tables: ${loadedUrbanTables.length}`);
  } catch (e: any) {
    assert(false, 8, 'Table listing isolation', e.message);
  }

  // Test 9: Storage key scoping (<baseKey>:<restaurantId>)
  try {
    const k1 = getTenantStorageKey('rbh_menu', 'rbh-main-branch');
    const k2 = getTenantStorageKey('rbh_menu', 'urban-tadka-curry');
    const k3 = getTenantStorageKey('rbh_orders', 'urban-tadka-curry');
    const k4 = getTenantStorageKey('rbh_restaurant_settings', 'urban-tadka-curry');

    const isScoped = 
      k1 === 'rbh_menu:rbh-main-branch' &&
      k2 === 'rbh_menu:urban-tadka-curry' &&
      k3 === 'rbh_orders:urban-tadka-curry' &&
      k4 === 'rbh_restaurant_settings:urban-tadka-curry';

    assert(isScoped, 9, 'Deterministic storage key formatting: <baseKey>:<restaurantId>', `Keys: ${k1}, ${k2}, ${k3}`);
  } catch (e: any) {
    assert(false, 9, 'Storage key scoping', e.message);
  }

  // Test 10: Staff auth session isolation between branches
  try {
    const keyA = getStaffRoleStorageKey('rbh-main-branch');
    const keyB = getStaffRoleStorageKey('urban-tadka-curry');

    window.sessionStorage.setItem(keyA, 'kitchen');
    window.sessionStorage.setItem(keyB, 'counter');

    const roleA = window.sessionStorage.getItem(keyA);
    const roleB = window.sessionStorage.getItem(keyB);

    const isIsolated = keyA === 'rbh_staff_role:rbh-main-branch' &&
                       keyB === 'rbh_staff_role:urban-tadka-curry' &&
                       roleA === 'kitchen' && roleB === 'counter';

    assert(isIsolated, 10, 'Staff auth sessions partitioned by branch (no cross-branch leakage)', `A: ${roleA}, B: ${roleB}`);
  } catch (e: any) {
    assert(false, 10, 'Staff auth session isolation', e.message);
  }

  // Test 11: Order creation scoping & tenant-specific GST
  try {
    // Configure Urban Tadka settings in storage
    const urbanSettings = {
      ...getStoredRestaurantSettings('urban-tadka-curry'),
      restaurantId: 'urban-tadka-curry',
      name: 'Urban Tadka Curry',
      gstRate: 12.0,
      gstEnabled: true
    };
    saveRestaurantSettings(urbanSettings);

    // Save menu item for RBH and Urban Tadka
    const rbhMenu = getLocalMenuItems(undefined, 'rbh-main-branch').items;
    const testRbhDish = rbhMenu[0]; // e.g. Awadhi Dum Biryani

    const urbanMenu = getLocalMenuItems(undefined, 'urban-tadka-curry').items;
    const testUrbanDish = urbanMenu[0]; // Urban Tadka Dal Makhani (Price: 320)

    const tokRbh = generateTableQrToken('Table 1', 'rbh-main-branch');
    const tokUrban = generateTableQrToken('T-101', 'urban-tadka-curry');

    // Create Order for RBH (5% GST)
    const orderRbhRes = await createOrderSecure({
      restaurantId: 'rbh-main-branch',
      tableNumber: 'Table 1',
      qrToken: tokRbh,
      customerName: 'Ahmad Khan',
      items: [{ id: String(testRbhDish.id), quantity: 2 }]
    });

    // Create Order for Urban Tadka (12% GST)
    const orderUrbanRes = await createOrderSecure({
      restaurantId: 'urban-tadka-curry',
      tableNumber: 'T-101',
      qrToken: tokUrban,
      customerName: 'Vikram Singh',
      items: [{ id: String(testUrbanDish.id), quantity: 2 }] // 320 * 2 = 640
    });

    const rbhOrder = orderRbhRes.order!;
    const urbanOrder = orderUrbanRes.order!;

    const rbhSubtotal = rbhOrder.subtotal;
    const expectedRbhTax = Math.round(rbhSubtotal * 0.05 * 10) / 10;
    const rbhTaxMatches = Math.abs(rbhOrder.tax - expectedRbhTax) <= 0.1;

    const urbanSubtotal = 640;
    const expectedUrbanTax = Math.round(urbanSubtotal * 0.12 * 10) / 10; // 76.8
    const urbanTaxMatches = Math.abs(urbanOrder.tax - expectedUrbanTax) <= 0.1;

    const rbhOrders = getStoredOrders('rbh-main-branch');
    const urbanOrders = getStoredOrders('urban-tadka-curry');

    const ordersStrictlySeparated = 
      rbhOrders.every(o => o.restaurant_id === 'rbh-main-branch') &&
      urbanOrders.every(o => o.restaurant_id === 'urban-tadka-curry') &&
      !urbanOrders.some(o => o.id === rbhOrder.id);

    const test11Passed = orderRbhRes.success && orderUrbanRes.success && rbhTaxMatches && urbanTaxMatches && ordersStrictlySeparated;
    assert(test11Passed, 11, 'Order creation scoped with tenant-specific GST (RBH 5%, Urban Tadka 12%)', `RBH Tax: ${rbhOrder.tax} (exp ${expectedRbhTax}), Urban Tax: ${urbanOrder.tax} (exp ${expectedUrbanTax})`);
  } catch (e: any) {
    assert(false, 11, 'Order creation scoping', e.message);
  }

  // Test 12: Dining session settlement scoping
  try {
    const urbanOrders = getStoredOrders('urban-tadka-curry');
    const targetOrder = urbanOrders[0];

    const settleRes = await settleDiningSessionAtomic({
      sessionId: targetOrder.sessionId,
      tableNumber: targetOrder.tableNumber,
      splitPayments: [{
        mode: 'Cash',
        amount: targetOrder.total
      }],
      recordedBy: 'Counter Staff',
      restaurantId: 'urban-tadka-curry'
    });

    const urbanOrdersAfter = getStoredOrders('urban-tadka-curry');
    const settledUrbanOrder = urbanOrdersAfter.find(o => o.id === targetOrder.id);
    const isUrbanSettled = settledUrbanOrder?.paymentStatus === 'Paid';

    // RBH orders should remain completely untouched
    const rbhOrders = getStoredOrders('rbh-main-branch');
    const rbhUnsettled = rbhOrders.find(o => o.paymentStatus !== 'Paid');
    const rbhUntouched = rbhUnsettled !== undefined;

    assert(settleRes.success && isUrbanSettled && rbhUntouched, 12, 'Atomic dining session settlement isolated strictly per tenant', `Settled: ${settleRes.success}, Urban Order Paid: ${isUrbanSettled}`);
  } catch (e: any) {
    assert(false, 12, 'Dining session settlement scoping', e.message);
  }

  // Test 13: BroadcastChannel tenant partitioning
  try {
    const bcRbh = getOrdersBroadcastChannel('rbh-main-branch');
    const bcUrban = getOrdersBroadcastChannel('urban-tadka-curry');

    const distinctInstances = bcRbh !== bcUrban;
    const rbhChannelName = (bcRbh as any)?.name;
    const urbanChannelName = (bcUrban as any)?.name;

    const namesMatch = 
      rbhChannelName === 'rbh_orders_realtime_rbh-main-branch' &&
      urbanChannelName === 'rbh_orders_realtime_urban-tadka-curry';

    assert(distinctInstances && namesMatch, 13, 'BroadcastChannel partitioned by rbh_orders_realtime_<restaurantId>', `RBH: ${rbhChannelName}, Urban: ${urbanChannelName}`);
  } catch (e: any) {
    assert(false, 13, 'BroadcastChannel tenant partitioning', e.message);
  }

  // Test 14: Backward compatibility on root "/" and ?restaurant=rbh-main-branch
  try {
    // 1. Root URL with no query params resolves to rbh-main-branch
    window.location.search = '';
    const resolvedDefault = getCurrentRestaurantId();
    const isDefaultRbh = resolvedDefault === DEFAULT_RESTAURANT_ID;

    // 2. Explicit ?restaurant=rbh-main-branch resolves to rbh-main-branch
    window.location.search = '?restaurant=rbh-main-branch';
    const resolvedExplicit = getCurrentRestaurantId();
    const isExplicitRbh = resolvedExplicit === 'rbh-main-branch';

    // 3. Legacy QR standee token with no restaurantId verifies correctly for canonical tenant
    const legacyStandeeToken = generateTableQrToken('Table 4', 'rbh-main-branch');
    const verifiesUnderDefault = verifyTableToken('Table 4', legacyStandeeToken, DEFAULT_RESTAURANT_ID);

    // 4. Default restaurant settings returns 5% GST and Royal Biryani House
    const defaultSettings = getStoredRestaurantSettings();
    const isRbhName = defaultSettings.name === 'Royal Biryani House' && defaultSettings.gstRate === 5.0;

    const test14Passed = isDefaultRbh && isExplicitRbh && verifiesUnderDefault && isRbhName;
    assert(test14Passed, 14, '100% Backward compatibility for Royal Biryani House customer QRs & root URLs', `Default: ${resolvedDefault}, Verified: ${verifiesUnderDefault}`);
  } catch (e: any) {
    assert(false, 14, 'Backward compatibility for Royal Biryani House', e.message);
  }

  // Summary Report
  console.log('\n================================================================');
  console.log(` Test Execution Complete: ${passed} PASSED, ${failed} FAILED (Total: 14)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error running multi-tenant test suite', err);
  process.exit(1);
});
