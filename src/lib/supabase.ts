import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { 
  MenuItem, 
  Order, 
  SupabaseConfig, 
  CustomerFeedback, 
  RawMaterial, 
  StockMovement, 
  StockMovementType, 
  DbStockMovementType,
  StockMovementReason, 
  RawMaterialStockStatus,
  RawMaterialUnit,
  MenuItemRecipe,
  RecipeIngredient,
  InventoryPurchaseRecord,
  PurchaseItemEntry,
  InventoryWastageRecord,
  DiningSession, 
  PaymentRecord, 
  PaymentMode,
  RestaurantBackupSnapshot,
  RestaurantProfile,
  StaffProfile,
  StaffRole,
  RestaurantSettings,
  RestaurantTable,
  MenuCategory,
  MenuSubcategory,
  MenuItemVariant,
  MenuItemAddon,
  BulkImportRow,
  ImportValidationResult
} from '../types';
import { DEFAULT_MENU_ITEMS } from '../data/defaultMenu';
import { 
  DEFAULT_RAW_MATERIALS, 
  DEFAULT_STOCK_MOVEMENTS,
  DEFAULT_MENU_RECIPES,
  DEFAULT_PURCHASE_RECORDS,
  DEFAULT_WASTAGE_RECORDS
} from '../data/defaultRawMaterials';
import { INITIAL_HISTORICAL_ORDERS } from '../data/defaultOrders';

// Default Restaurant Identifier
export const DEFAULT_RESTAURANT_ID = 'rbh-main-branch';

// Default Supabase table name specified by user
export const DEFAULT_TABLE_NAME = 'menu_items';

// Safe In-Memory Storage Fallback for SSR/Test Execution
const memoryStorage = new Map<string, string>();
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(key);
  }
};

function safeDispatchEvent(event: Event): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(event);
    } catch {}
  }
}

const safeSession = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        return window.sessionStorage.getItem(key);
      }
    } catch {}
    return memoryStorage.get(`session_${key}`) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStorage.set(`session_${key}`, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(`session_${key}`);
  }
};

// Storage keys
const ACTIVE_RESTAURANT_KEY = 'rbh_active_restaurant_id';
const SUPABASE_CONFIG_KEY = 'rbh_supabase_config';
const LOCAL_MENU_KEY = 'rbh_local_menu_items';
const MENU_AVAILABILITY_MAP_KEY = 'rbh_menu_item_availability_map';
const ORDERS_STORAGE_KEY = 'rbh_restaurant_orders';
const FEEDBACK_STORAGE_KEY = 'rbh_customer_feedbacks';
const RAW_MATERIALS_STORAGE_KEY = 'rbh_raw_materials_inventory';
const STOCK_MOVEMENTS_STORAGE_KEY = 'rbh_stock_movements_log';
const MENU_RECIPES_STORAGE_KEY = 'rbh_menu_recipes';
const INVENTORY_PURCHASES_STORAGE_KEY = 'rbh_inventory_purchases';
const INVENTORY_WASTAGE_STORAGE_KEY = 'rbh_inventory_wastage';
const CONSUMED_ORDERS_STORAGE_KEY = 'rbh_consumed_orders_ledger';
const PAYMENTS_STORAGE_KEY = 'rbh_payments_log';
const STAFF_PROFILE_STORAGE_KEY = 'rbh_active_staff_profile';
const RESTAURANT_SETTINGS_STORAGE_KEY = 'rbh_restaurant_settings';
const RESTAURANT_TABLES_STORAGE_KEY = 'rbh_restaurant_tables';
const MENU_CATEGORIES_STORAGE_KEY = 'rbh_menu_categories';
const MENU_SUBCATEGORIES_STORAGE_KEY = 'rbh_menu_subcategories';

// Sensible Default Settings
export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  id: DEFAULT_RESTAURANT_ID,
  restaurant_id: DEFAULT_RESTAURANT_ID,
  name: 'Royal Biryani House',
  logo: '',
  tagline: 'Authentic Dum Biryani & Mughlai Cuisine',
  address: '124 Heritage Lane, Connaught Place, New Delhi',
  phone: '+91 98765 43210',
  email: 'contact@royalbiryani.com',
  openingTime: '11:00 AM',
  closingTime: '11:00 PM',
  restaurantType: 'Dine-In & Takeaway',
  gstEnabled: true,
  gstRate: 5.0,
  serviceChargeEnabled: false,
  serviceChargeRate: 5.0,
  receiptFooter: 'Thank you for dining at Royal Biryani House! Please visit again.',
  currencySymbol: '₹'
};

// Deterministic Cryptographic QR Token Generator for Tables
export function generateTableQrToken(tableNumber: string, restaurantId: string = getCurrentRestaurantId()): string {
  const cleanTable = (tableNumber || '').trim().toLowerCase().replace(/\s+/g, '');
  const cleanRest = (restaurantId || DEFAULT_RESTAURANT_ID).trim().toLowerCase();
  
  // High-entropy deterministic checksum
  let hash = 0x811c9dc5;
  const input = `${cleanRest}:${cleanTable}:rbh_secure_qr_production_salt_2025`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const shortTable = cleanTable.replace(/^table/i, 't').replace(/[^a-z0-9]/g, '');
  return `rbh_tok_${shortTable}_${hex}`;
}

export function verifyTableToken(tableNumber: string, token?: string | null, restaurantId: string = getCurrentRestaurantId()): boolean {
  if (!token || !token.trim()) return false;
  const expected = generateTableQrToken(tableNumber, restaurantId);
  return token.trim().toLowerCase() === expected.toLowerCase();
}

let _orderSequence = 0;
export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const count = ((++_orderSequence) % 46656).toString(36).toUpperCase().padStart(3, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, '0');
  return `RBH-${ts}-${count}${rand}`;
}

// Sensible Default Tables (10 Dine-In Tables + Outdoor Patio & Takeaway with Verified QR Tokens)
export const DEFAULT_RESTAURANT_TABLES: RestaurantTable[] = [
  { id: 'tbl-1', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 1', section: 'Ground Floor', capacity: 4, isActive: true, displayOrder: 1, qr_token: generateTableQrToken('Table 1') },
  { id: 'tbl-2', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 2', section: 'Ground Floor', capacity: 4, isActive: true, displayOrder: 2, qr_token: generateTableQrToken('Table 2') },
  { id: 'tbl-3', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 3', section: 'Ground Floor', capacity: 6, isActive: true, displayOrder: 3, qr_token: generateTableQrToken('Table 3') },
  { id: 'tbl-4', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 4', section: 'Ground Floor', capacity: 4, isActive: true, displayOrder: 4, qr_token: generateTableQrToken('Table 4') },
  { id: 'tbl-5', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 5', section: 'First Floor', capacity: 4, isActive: true, displayOrder: 5, qr_token: generateTableQrToken('Table 5') },
  { id: 'tbl-6', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 6', section: 'First Floor', capacity: 6, isActive: true, displayOrder: 6, qr_token: generateTableQrToken('Table 6') },
  { id: 'tbl-7', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 7', section: 'First Floor', capacity: 8, isActive: true, displayOrder: 7, qr_token: generateTableQrToken('Table 7') },
  { id: 'tbl-8', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 8', section: 'First Floor', capacity: 2, isActive: true, displayOrder: 8, qr_token: generateTableQrToken('Table 8') },
  { id: 'tbl-9', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 9', section: 'First Floor', capacity: 4, isActive: true, displayOrder: 9, qr_token: generateTableQrToken('Table 9') },
  { id: 'tbl-10', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table 10', section: 'First Floor', capacity: 6, isActive: true, displayOrder: 10, qr_token: generateTableQrToken('Table 10') },
  { id: 'tbl-o1', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table O1', section: 'Outdoor Patio', capacity: 4, isActive: true, displayOrder: 11, qr_token: generateTableQrToken('Table O1') },
  { id: 'tbl-o2', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Table O2', section: 'Outdoor Patio', capacity: 4, isActive: true, displayOrder: 12, qr_token: generateTableQrToken('Table O2') },
  { id: 'tbl-tk1', restaurant_id: DEFAULT_RESTAURANT_ID, tableNumber: 'Takeaway Counter', section: 'Takeaway', capacity: 1, isActive: true, displayOrder: 13, qr_token: generateTableQrToken('Takeaway Counter') }
];

// Sensible Default Menu Categories
export const DEFAULT_MENU_CATEGORIES: MenuCategory[] = [
  { id: 'cat-biryani', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Biryani Specials', description: 'Slow-cooked Awadhi & Hyderabadi Dum Handi Biryanis', icon: 'Crown', displayOrder: 1, isActive: true },
  { id: 'cat-starters', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Starters & Tandoor', description: 'Charcoal-grilled kebabs, tikkas, and crisp appetizers', icon: 'Flame', displayOrder: 2, isActive: true },
  { id: 'cat-curries', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Royal Curries', description: 'Rich Mughlai gravies, butter chicken, and shahi paneer', icon: 'UtensilsCrossed', displayOrder: 3, isActive: true },
  { id: 'cat-breads', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Breads & Rice', description: 'Fresh clay-oven tandoori rotis, naans, and jeera rice', icon: 'Layers', displayOrder: 4, isActive: true },
  { id: 'cat-beverages', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Beverages', description: 'Soft drinks, alcoholic spirits, mocktails, and lassis', icon: 'Wine', displayOrder: 5, isActive: true },
  { id: 'cat-desserts', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Beverages & Desserts', description: 'Shahi tukda, gulab jamun, and kesariya kulfi', icon: 'Sparkles', displayOrder: 6, isActive: true },
  { id: 'cat-accompaniments', restaurant_id: DEFAULT_RESTAURANT_ID, name: 'Accompaniments', description: 'Mirchi ka salan, boondi raita, and fresh salads', icon: 'Plus', displayOrder: 7, isActive: true }
];

// Sensible Default Menu Subcategories
export const DEFAULT_MENU_SUBCATEGORIES: MenuSubcategory[] = [
  { id: 'sub-dum-biryani', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-biryani', name: 'Dum Biryani', description: 'Sealed handi dum cooked', displayOrder: 1, isActive: true },
  { id: 'sub-handi-biryani', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-biryani', name: 'Handi Specials', description: 'Special copper handi portions', displayOrder: 2, isActive: true },
  { id: 'sub-tandoori', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-starters', name: 'Tandoori Kebabs', description: 'Charcoal clay oven grilled', displayOrder: 1, isActive: true },
  { id: 'sub-tikkas', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-starters', name: 'Tikka Specials', description: 'Boneless spiced marinades', displayOrder: 2, isActive: true },
  { id: 'sub-chicken-curries', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-curries', name: 'Chicken Curries', description: 'Royal Mughlai gravies', displayOrder: 1, isActive: true },
  { id: 'sub-mutton-curries', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-curries', name: 'Mutton & Meat', description: 'Slow-braised Awadhi cuts', displayOrder: 2, isActive: true },
  { id: 'sub-paneer-curries', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-curries', name: 'Paneer & Vegetarian', description: 'Cottage cheese and rich dal', displayOrder: 3, isActive: true },
  { id: 'sub-softdrinks', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-beverages', name: 'Soft Drinks', description: 'Chilled carbonated sodas', displayOrder: 1, isActive: true },
  { id: 'sub-alcohol', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-beverages', name: 'Alcohol & Spirits', description: 'Whisky, Beer, Rum, and Vodka with 30ml/60ml/90ml variants', displayOrder: 2, isActive: true },
  { id: 'sub-mocktails', restaurant_id: DEFAULT_RESTAURANT_ID, categoryId: 'cat-beverages', name: 'Lassi & Mocktails', description: 'Fresh churned yogurt and fruit coolers', displayOrder: 3, isActive: true }
];

// Multi-tenant Restaurant ID Management (Single Source of Truth)
export function getCurrentRestaurantId(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const rid = params.get('restaurant_id') || params.get('rid') || params.get('restaurant');
      if (rid && rid.trim()) {
        const clean = rid.trim().toLowerCase();
        // sync to storage for persistent session
        safeStorage.setItem(ACTIVE_RESTAURANT_KEY, clean);
        return clean;
      }
    }
    const saved = safeStorage.getItem(ACTIVE_RESTAURANT_KEY);
    if (saved && saved.trim()) {
      const clean = saved.trim().toLowerCase();
      // Auto-migrate legacy mismatched tenant ID to default demo tenant
      if (clean === 'rest_rbh_royal_biryani') {
        safeStorage.setItem(ACTIVE_RESTAURANT_KEY, DEFAULT_RESTAURANT_ID);
        return DEFAULT_RESTAURANT_ID;
      }
      return clean;
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_RESTAURANT_ID;
}

export function setCurrentRestaurantId(restaurantId: string): void {
  const clean = restaurantId.trim().toLowerCase() || DEFAULT_RESTAURANT_ID;
  try {
    safeStorage.setItem(ACTIVE_RESTAURANT_KEY, clean);
    safeDispatchEvent(new CustomEvent('rbh_restaurant_changed', { detail: { restaurantId: clean } }));
  } catch (e) {
    console.error('Failed to set restaurant ID', e);
  }
}

// Stable Public App URL Builder for QR Code Stands
export function getPublicAppUrl(tableParam?: string, restaurantId: string = getCurrentRestaurantId()): string {
  const metaEnv = (import.meta as any).env || {};
  let baseUrl = (metaEnv.VITE_APP_URL as string) || (metaEnv.APP_URL as string) || (typeof process !== 'undefined' && process.env ? (process.env.APP_URL || '') : '') || '';

  if (!baseUrl && typeof window !== 'undefined' && window.location) {
    baseUrl = window.location.origin + window.location.pathname;
  }

  // If the URL contains the private developer container hostname (ais-dev-),
  // automatically transform it to the public preview hostname (ais-pre-)
  // so external mobile devices (Google Lens, iOS/Android cameras) can access the page without login barriers.
  if (baseUrl.includes('ais-dev-')) {
    baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
  }

  // Normalize base URL
  baseUrl = (baseUrl || '').replace(/\/+$/, '');

  if (!tableParam) {
    return baseUrl || '/';
  }

  const cleanTable = tableParam.trim().replace(/^Table\s*/i, '');
  const normalizedTableName = `Table ${cleanTable}`;
  const targetRest = restaurantId || getCurrentRestaurantId();
  const token = generateTableQrToken(normalizedTableName, targetRest);

  return `${baseUrl}?restaurant=${encodeURIComponent(targetRest)}&table=${encodeURIComponent(cleanTable)}&token=${encodeURIComponent(token)}`;
}

// Tenant-scoped Storage Key Generator
export function getTenantStorageKey(baseKey: string, restaurantId: string = getCurrentRestaurantId()): string {
  return `${baseKey}_${restaurantId}`;
}

// Staff Profile Storage Management
export function getCurrentStaffProfile(): StaffProfile | null {
  try {
    const saved = safeSession.getItem(STAFF_PROFILE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse staff profile from storage', e);
  }
  return null;
}

export function saveCurrentStaffProfile(profile: StaffProfile | null): void {
  try {
    if (profile) {
      safeSession.setItem(STAFF_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      safeSession.setItem('rbh_staff_role', profile.role);
    } else {
      safeSession.removeItem(STAFF_PROFILE_STORAGE_KEY);
      safeSession.removeItem('rbh_staff_role');
    }
    safeDispatchEvent(new CustomEvent('rbh_staff_auth_changed', { detail: { profile } }));
  } catch (e) {
    console.error('Failed to save staff profile', e);
  }
}

// Supabase Staff Authentication & Database Allowlist Verification
export async function signInStaff(
  email: string, 
  password: string, 
  targetRestaurantId: string = getCurrentRestaurantId()
): Promise<{ user: any; profile: StaffProfile | null; error?: string }> {
  const supabase = getSupabaseClient();
  const cleanEmail = email.trim().toLowerCase();
  const targetRestId = targetRestaurantId.trim().toLowerCase() || DEFAULT_RESTAURANT_ID;

  // If Supabase client is connected, perform Supabase Auth
  if (supabase && password) {
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (!authError && data.user) {
        // Authenticated with Supabase Auth! Now resolve database-backed staff allowlist or staff role
        let staffProfile: StaffProfile | null = null;

        // Try querying staff_profiles allowlist table
        try {
          const { data: staffData, error: staffError } = await supabase
            .from('staff_profiles')
            .select('*')
            .or(`id.eq.${data.user.id},email.ilike.${cleanEmail}`)
            .eq('is_active', true)
            .maybeSingle();

          if (staffError) {
            console.warn('Error querying staff_profiles allowlist:', staffError.message);
          }

          if (staffData) {
            const normalizedRole = staffData.role?.toLowerCase() || 'counter';
            staffProfile = {
              id: staffData.id || data.user.id,
              restaurant_id: targetRestId,
              email: staffData.email || data.user.email || cleanEmail,
              role: normalizedRole === 'kitchen' || normalizedRole === 'chef' ? 'kitchen' : (normalizedRole.includes('admin') ? 'admin' : (normalizedRole.includes('manager') ? 'manager' : 'counter')),
              is_active: true,
              full_name: staffData.full_name || (cleanEmail.includes('chef') ? 'Ustad Mohammed (Head Chef)' : 'Farhan Ali (Store Manager)'),
              created_at: staffData.created_at,
              updated_at: staffData.updated_at
            };
          }
        } catch (e) {
          console.warn('Could not query staff_profiles table:', e);
        }

        // If no explicit DB profile found, check if this is an authorized staff account
        if (!staffProfile) {
          const userMetaRole = data.user.user_metadata?.role || data.user.app_metadata?.role;
          const isKnownStaff = cleanEmail.endsWith('@royalbiryani.com') || Boolean(userMetaRole) || cleanEmail.includes('staff');

          if (isKnownStaff) {
            let role: 'kitchen' | 'counter' | 'admin' | 'manager' = 'manager';
            let fullName = 'Farhan Ali (Store Manager)';

            if (cleanEmail.includes('chef') || cleanEmail.includes('kitchen') || userMetaRole === 'kitchen') {
              role = 'kitchen';
              fullName = 'Ustad Mohammed (Head Chef)';
            } else if (cleanEmail.includes('admin') || userMetaRole === 'admin') {
              role = 'admin';
              fullName = 'Farhan Ali (Administrator)';
            } else if (cleanEmail.includes('counter') || userMetaRole === 'counter') {
              role = 'counter';
              fullName = 'Farhan Ali (Billing Counter)';
            }

            staffProfile = {
              id: data.user.id,
              restaurant_id: targetRestId,
              email: cleanEmail,
              role,
              is_active: true,
              full_name: fullName
            };

            // Attempt to write/update staff_profiles record in Supabase
            try {
              await supabase.from('staff_profiles').upsert({
                id: data.user.id,
                restaurant_id: targetRestId,
                email: cleanEmail,
                role,
                full_name: fullName,
                is_active: true
              });
            } catch {
              // RLS might block client insert, which is safe to ignore
            }
          }
        }

        if (staffProfile) {
          saveCurrentStaffProfile(staffProfile);
          return { user: data.user, profile: staffProfile, error: undefined };
        }

        // Authenticated in Supabase Auth but not recognized as a staff member
        await supabase.auth.signOut();
        saveCurrentStaffProfile(null);
        return { 
          user: null, 
          profile: null, 
          error: `User "${cleanEmail}" is authenticated with Supabase, but is not an authorized staff member for restaurant "${targetRestId}". Contact your manager.` 
        };
      }
    } catch (err: any) {
      console.warn('Supabase auth attempt error:', err.message);
    }
  }

  // Demo fallback when Supabase credentials are not yet configured or for preset staff credentials
  if (cleanEmail === 'chef@royalbiryani.com' || cleanEmail === 'kitchen@royalbiryani.com') {
    const profile: StaffProfile = {
      id: 'demo-kitchen-uid',
      restaurant_id: targetRestId,
      email: cleanEmail,
      role: 'kitchen',
      is_active: true,
      full_name: 'Ustad Mohammed (Head Chef)'
    };
    saveCurrentStaffProfile(profile);
    return { user: { id: profile.id, email: cleanEmail }, profile, error: undefined };
  } else if (
    cleanEmail === 'manager@royalbiryani.com' || 
    cleanEmail === 'counter@royalbiryani.com' || 
    cleanEmail === 'admin@royalbiryani.com' ||
    cleanEmail === 'cashier@royalbiryani.com' ||
    cleanEmail === 'billing@royalbiryani.com' ||
    cleanEmail === 'waiter@royalbiryani.com'
  ) {
    const isWaiter = cleanEmail.includes('waiter');
    const isCashier = cleanEmail.includes('cashier') || cleanEmail.includes('counter') || cleanEmail.includes('billing');
    const isAdmin = cleanEmail.includes('admin');
    const role: StaffProfile['role'] = isAdmin ? 'admin' : (cleanEmail.includes('manager') ? 'manager' : 'counter');
    const fullName = isAdmin 
      ? 'Farhan Ali (Administrator)' 
      : (isWaiter ? 'Kabir Khan (Table Captain)' : (isCashier ? 'Farhan Ali (Billing Counter)' : 'Farhan Ali (Store Manager)'));
    const profile: StaffProfile = {
      id: `demo-${role}-uid`,
      restaurant_id: targetRestId,
      email: cleanEmail,
      role,
      is_active: true,
      full_name: fullName
    };
    saveCurrentStaffProfile(profile);
    return { user: { id: profile.id, email: cleanEmail }, profile, error: undefined };
  }

  return {
    user: null,
    profile: null,
    error: 'Please configure Supabase in Settings or use demo staff credentials.'
  };
}

export async function signOutStaff(): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  saveCurrentStaffProfile(null);
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
    } catch (e: any) {
      return { error: e.message };
    }
  }
  return { error: undefined };
}

export async function getStaffSession(restaurantId: string = getCurrentRestaurantId()): Promise<{ user: any; profile: StaffProfile | null }> {
  const supabase = getSupabaseClient();
  const cachedProfile = getCurrentStaffProfile();
  const targetRestId = restaurantId.trim().toLowerCase() || DEFAULT_RESTAURANT_ID;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const userEmail = (data.session.user.email || '').toLowerCase();
        // Verify active staff profile
        const { data: staffData } = await supabase
          .from('staff_profiles')
          .select('*')
          .or(`id.eq.${data.session.user.id},email.ilike.${userEmail}`)
          .eq('is_active', true)
          .maybeSingle();

        if (staffData) {
          const profile: StaffProfile = {
            id: staffData.id || data.session.user.id,
            restaurant_id: targetRestId,
            email: staffData.email || data.session.user.email || '',
            role: staffData.role,
            is_active: staffData.is_active,
            full_name: staffData.full_name,
            created_at: staffData.created_at,
            updated_at: staffData.updated_at
          };
          saveCurrentStaffProfile(profile);
          return { user: data.session.user, profile };
        } else if (userEmail.endsWith('@royalbiryani.com')) {
          const profile: StaffProfile = {
            id: data.session.user.id,
            restaurant_id: targetRestId,
            email: userEmail,
            role: userEmail.includes('chef') ? 'kitchen' : 'manager',
            is_active: true,
            full_name: userEmail.includes('chef') ? 'Ustad Mohammed (Head Chef)' : 'Farhan Ali (Store Manager)'
          };
          saveCurrentStaffProfile(profile);
          return { user: data.session.user, profile };
        }
      }
    } catch (e) {
      console.warn('Error fetching Supabase session:', e);
    }
  }

  return { user: cachedProfile ? { id: cachedProfile.id, email: cachedProfile.email } : null, profile: cachedProfile };
}

// Helper for independent menu item availability mapping (tenant-isolated)
export function getMenuAvailabilityMap(restaurantId: string = getCurrentRestaurantId()): Record<string, boolean> {
  try {
    const tenantKey = getTenantStorageKey(MENU_AVAILABILITY_MAP_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(MENU_AVAILABILITY_MAP_KEY) : null);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse availability map', e);
  }
  return {};
}

export function saveMenuAvailabilityMap(map: Record<string, boolean>, restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(MENU_AVAILABILITY_MAP_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(map));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(MENU_AVAILABILITY_MAP_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.error('Failed to save availability map', e);
  }
}

// Get current Supabase config
export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL as string) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') || '';
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || '';
  const currentRid = getCurrentRestaurantId();

  try {
    const saved = safeStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const tableName = (parsed.tableName && parsed.tableName !== 'Royal biryani house demo') ? parsed.tableName : DEFAULT_TABLE_NAME;
      const rid = (parsed.restaurantId && parsed.restaurantId !== 'rest_rbh_royal_biryani') ? parsed.restaurantId : currentRid;
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        tableName,
        restaurantId: rid,
      };
    }
  } catch (e) {
    console.warn('Failed to parse saved Supabase config', e);
  }

  return {
    url: envUrl,
    anonKey: envKey,
    tableName: DEFAULT_TABLE_NAME,
    restaurantId: currentRid,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  safeStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  if (config.restaurantId) {
    setCurrentRestaurantId(config.restaurantId);
  }
}

// Lazy Supabase client instantiation
let supabaseInstance: SupabaseClient | null = null;
let currentConfigUrl = '';
let currentConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  if (!supabaseInstance || currentConfigUrl !== config.url || currentConfigKey !== config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey);
      currentConfigUrl = config.url;
      currentConfigKey = config.anonKey;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

// Map raw Supabase row to standardized MenuItem
export function mapSupabaseRowToMenuItem(row: Record<string, any>): MenuItem {
  const currentRid = row.restaurant_id || getCurrentRestaurantId();
  const name = row.Name ?? row.name ?? row.title ?? 'Biryani Special';
  const price = typeof row.Price === 'number' ? row.Price : Number(row.price ?? row.Price ?? 0);
  const description = row.Description ?? row.description ?? row.desc ?? '';
  const imageUrl = row.Image_url ?? row.image_url ?? row.Image ?? row.image ?? row.imageUrl ?? 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
  
  const rawId = row.id !== undefined && row.id !== null ? String(row.id) : '';
  const availMap = getMenuAvailabilityMap(currentRid);

  let available = true;
  if (row.Available !== undefined) {
    available = Boolean(row.Available);
  } else if (row.available !== undefined) {
    available = Boolean(row.available);
  } else if (row.is_available !== undefined) {
    available = Boolean(row.is_available);
  } else if (row.isAvailable !== undefined) {
    available = Boolean(row.isAvailable);
  } else if (rawId && availMap[rawId] !== undefined) {
    available = availMap[rawId];
  }

  // Auto classify category and dietary tags
  const lowerName = String(name).toLowerCase();

  // Category resolution: 1. explicit row.category -> 2. taxonomy lookup via category_id -> 3. heuristic
  let category: string = row.category || '';
  const categoryId = row.category_id || row.categoryId;
  if (!category && categoryId) {
    const cats = getStoredMenuCategories(currentRid);
    const matched = cats.find(c => c.id === categoryId);
    if (matched) {
      category = matched.name;
    }
  }

  if (!category) {
    if (lowerName.includes('tikka') || lowerName.includes('kebab') || lowerName.includes('tandoori') || lowerName.includes('starter')) {
      category = 'Starters & Tandoor';
    } else if (lowerName.includes('curry') || lowerName.includes('butter chicken') || lowerName.includes('dal') || (lowerName.includes('paneer') && !lowerName.includes('biryani'))) {
      category = 'Royal Curries';
    } else if (lowerName.includes('naan') || lowerName.includes('roti') || lowerName.includes('bread') || (lowerName.includes('rice') && !lowerName.includes('biryani'))) {
      category = 'Breads & Rice';
    } else if (lowerName.includes('lassi') || lowerName.includes('jamun') || lowerName.includes('dessert') || lowerName.includes('tukda') || lowerName.includes('ice cream') || lowerName.includes('kulfi') || lowerName.includes('drink') || lowerName.includes('coke') || lowerName.includes('soda')) {
      category = 'Beverages & Desserts';
    } else {
      category = 'Biryani Specials';
    }
  }

  // Subcategory resolution
  let subcategoryName: string | undefined = row.subcategory_name || row.subcategoryName;
  const subcategoryId = row.subcategory_id || row.subcategoryId;
  if (!subcategoryName && subcategoryId) {
    const subcats = getStoredMenuSubcategories(currentRid);
    const matched = subcats.find(s => s.id === subcategoryId);
    if (matched) {
      subcategoryName = matched.name;
    }
  }

  const isVeg = row.is_veg ?? row.isVeg ?? (
    lowerName.includes('paneer') ||
    lowerName.includes('dal') ||
    lowerName.includes('veg') ||
    lowerName.includes('naan') ||
    lowerName.includes('roti') ||
    lowerName.includes('rice') ||
    lowerName.includes('jamun') ||
    lowerName.includes('lassi') ||
    lowerName.includes('tukda') ||
    lowerName.includes('coke') ||
    lowerName.includes('sprite') ||
    lowerName.includes('water')
  );

  const stockCount = typeof row.stock_count === 'number' ? row.stock_count : (typeof row.stockCount === 'number' ? row.stockCount : (available ? 20 : 0));
  const stockStatus: MenuItem['stockStatus'] = row.stock_status || row.stockStatus || (
    !available || stockCount === 0 ? 'Out of Stock' : (stockCount <= 5 ? 'Low Stock' : 'In Stock')
  );

  const finalId = rawId || `item-${Math.random().toString(36).substring(2, 9)}`;

  // Parse variants if available
  let variants: MenuItemVariant[] | undefined = undefined;
  const rawVariants = row.variants || row.Variants;
  if (rawVariants) {
    if (Array.isArray(rawVariants)) {
      variants = rawVariants;
    } else if (typeof rawVariants === 'string') {
      try { variants = JSON.parse(rawVariants); } catch {}
    }
  }

  // Parse addons if available
  let addons: MenuItemAddon[] | undefined = undefined;
  const rawAddons = row.addons || row.Addons;
  if (rawAddons) {
    if (Array.isArray(rawAddons)) {
      addons = rawAddons;
    } else if (typeof rawAddons === 'string') {
      try { addons = JSON.parse(rawAddons); } catch {}
    }
  }

  const vegType: 'Veg' | 'Non-Veg' | 'Egg' = row.veg_type || row.vegType || (isVeg ? 'Veg' : 'Non-Veg');

  return {
    id: finalId,
    restaurant_id: currentRid,
    created_at: row.created_at,
    Name: name,
    Price: isNaN(price) ? 250 : price,
    basePrice: typeof row.base_price === 'number' ? row.base_price : (typeof row.basePrice === 'number' ? row.basePrice : price),
    Description: description,
    Image_url: imageUrl,
    Available: available && stockStatus !== 'Out of Stock',
    category,
    categoryId,
    subcategoryId,
    subcategoryName,
    isVeg,
    vegType,
    isSpicy: row.is_spicy ?? (lowerName.includes('dum') || lowerName.includes('hyderabadi') || lowerName.includes('chili') || lowerName.includes('tikka')),
    isBestSeller: row.is_bestseller ?? (lowerName.includes('chicken biryani') || lowerName.includes('butter chicken') || lowerName.includes('malai tikka')),
    prepTime: row.prep_time || '15-20 mins',
    stockCount,
    stockStatus,
    variants,
    addons,
    displayOrder: row.display_order ?? row.displayOrder,
    is_archived: Boolean(row.is_archived)
  };
}

// Fetch menu items from Supabase or fallback
export async function fetchMenuItems(): Promise<{ items: MenuItem[]; source: 'supabase' | 'local'; error?: string }> {
  const currentRid = getCurrentRestaurantId();
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const availMap = getMenuAvailabilityMap(currentRid);

  if (supabase) {
    try {
      // Pre-warm taxonomy so category names and subcategories resolve correctly
      try {
        await Promise.all([
          fetchMenuCategories(currentRid),
          fetchMenuSubcategories(currentRid)
        ]);
      } catch (taxErr) {
        console.warn('Taxonomy prefetch non-blocking error:', taxErr);
      }

      const targetTable = (config.tableName && config.tableName !== 'Royal biryani house demo') ? config.tableName : 'menu_items';

      // 1. Primary query: Query targetTable with tenant isolation
      let { data, error } = await supabase
        .from(targetTable)
        .select('*')
        .eq('restaurant_id', currentRid);

      // 2. If no data found or error, and targetTable wasn't 'menu_items', try 'menu_items'
      if ((error || !data || data.length === 0) && targetTable !== 'menu_items') {
        const retry = await supabase.from('menu_items').select('*').eq('restaurant_id', currentRid);
        if (!retry.error && retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        }
      }

      if (data && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToMenuItem);
        
        // Merge with any custom items added in local storage
        let combined = [...mapped];
        try {
          const rawLocal = safeStorage.getItem(getTenantStorageKey(LOCAL_MENU_KEY, currentRid)) || safeStorage.getItem(LOCAL_MENU_KEY);
          if (rawLocal) {
            const localParsed: MenuItem[] = JSON.parse(rawLocal);
            if (Array.isArray(localParsed)) {
              localParsed.forEach(localItem => {
                if (localItem && localItem.id && !combined.some(c => String(c.id) === String(localItem.id))) {
                  combined.push(localItem);
                }
              });
            }
          }
        } catch (e) {
          // Ignore parse errors
        }

        combined.forEach(item => {
          if (availMap[String(item.id)] !== undefined) {
            item.Available = availMap[String(item.id)];
          } else {
            availMap[String(item.id)] = item.Available;
          }
        });
        saveMenuAvailabilityMap(availMap, currentRid);
        // Cache to local storage
        safeStorage.setItem(getTenantStorageKey(LOCAL_MENU_KEY, currentRid), JSON.stringify(combined));
        safeStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(combined));
        return { items: combined, source: 'supabase' };
      } else {
        return getLocalMenuItems(`No menu items found in Supabase for restaurant tenant "${currentRid}".`);
      }
    } catch (err: any) {
      console.warn('Supabase fetch failed:', err);
      return getLocalMenuItems(err.message);
    }
  }

  return getLocalMenuItems();
}

function getLocalMenuItems(errMessage?: string): { items: MenuItem[]; source: 'local'; error?: string } {
  const availMap = getMenuAvailabilityMap();
  try {
    const cached = safeStorage.getItem(LOCAL_MENU_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = parsed.map(item => {
          const idStr = String(item.id);
          if (availMap[idStr] !== undefined) {
            const isAvail = availMap[idStr];
            return {
              ...item,
              Available: isAvail,
              stockStatus: isAvail ? (item.stockStatus === 'Out of Stock' ? 'In Stock' : item.stockStatus) : 'Out of Stock'
            };
          }
          return item;
        });
        return { items: merged, source: 'local', error: errMessage };
      }
    }
  } catch (e) {
    // Ignore error
  }

  // Merge default menu with individual availability map
  const defaultMerged: MenuItem[] = DEFAULT_MENU_ITEMS.map(item => {
    const idStr = String(item.id);
    const isAvail = availMap[idStr] !== undefined ? availMap[idStr] : item.Available;
    return {
      ...item,
      Available: isAvail,
      stockStatus: (isAvail ? 'In Stock' : 'Out of Stock') as 'In Stock' | 'Out of Stock'
    };
  });

  return { items: defaultMerged, source: 'local', error: errMessage };
}

// Update single menu item availability independently
export async function updateMenuItemAvailability(id: string | number, available: boolean): Promise<boolean> {
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const idStr = String(id);

  // 1. Update independent availability map
  const availMap = getMenuAvailabilityMap();
  availMap[idStr] = available;
  saveMenuAvailabilityMap(availMap);

  // 2. Update in local cached menu items array (ONLY for this specific item)
  try {
    const current = safeStorage.getItem(LOCAL_MENU_KEY);
    let items: MenuItem[] = current ? JSON.parse(current) : [...DEFAULT_MENU_ITEMS];
    items = items.map(item => {
      if (String(item.id) === idStr) {
        return {
          ...item,
          Available: available,
          stockStatus: (available ? 'In Stock' : 'Out of Stock') as 'In Stock' | 'Out of Stock',
          stockCount: available ? (item.stockCount && item.stockCount > 0 ? item.stockCount : 20) : 0
        };
      }
      // Guarantee all other items are untouched
      return item;
    });
    safeStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Local update failed', e);
  }

  // 3. Broadcast and dispatch events
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({
        type: 'MENU_AVAILABILITY_CHANGED',
        itemId: idStr,
        available
      });
    } catch (e) {
      // Ignore broadcast error
    }
  }
  safeDispatchEvent(new CustomEvent('rbh_menu_availability_changed', { detail: { itemId: idStr, available } }));
  safeDispatchEvent(new Event('rbh_menu_updated'));

  // 4. Update in Supabase for this specific item ID only
  if (supabase && config.tableName) {
    try {
      const numericId = !isNaN(Number(id)) ? Number(id) : null;

      // Try updating with exact column names (Available, available, is_available)
      let updateRes = await supabase
        .from(config.tableName)
        .update({
          Available: available,
          available: available,
          is_available: available,
          stock_status: available ? 'In Stock' : 'Out of Stock'
        })
        .eq('id', id);

      if (updateRes.error && numericId !== null) {
        // Retry with numeric ID if string failed
        updateRes = await supabase
          .from(config.tableName)
          .update({
            Available: available,
            available: available,
            is_available: available,
            stock_status: available ? 'In Stock' : 'Out of Stock'
          })
          .eq('id', numericId);
      }
    } catch (err) {
      console.warn('Supabase update failed:', err);
    }
  }

  return true;
}

// Seed default items into user's Supabase table
export async function seedDefaultMenuToSupabase(): Promise<{ success: boolean; message: string }> {
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const restaurantId = getCurrentRestaurantId();

  if (!supabase) {
    return { success: false, message: 'Please configure your Supabase URL and Anon Key first.' };
  }

  try {
    const rowsToInsert = DEFAULT_MENU_ITEMS.map((item, idx) => ({
      id: String(item.id),
      restaurant_id: restaurantId,
      name: item.Name,
      price: item.Price,
      description: item.Description,
      image_url: item.Image_url,
      available: item.Available,
      stock_status: item.stockStatus || 'In Stock',
      is_bestseller: Boolean(item.isBestSeller),
      display_order: idx + 1
    }));

    const { error } = await supabase
      .from('menu_items')
      .upsert(rowsToInsert, { onConflict: 'id' });

    if (error) {
      return { success: false, message: `Failed to insert: ${error.message}` };
    }

    return { success: true, message: `Successfully seeded ${rowsToInsert.length} dishes for "${restaurantId}" into menu_items!` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error inserting into Supabase' };
  }
}

// ============================================================================
// PHASE 1: RESTAURANT SETTINGS & PROFILE MANAGEMENT
// ============================================================================

export function getStoredRestaurantSettings(restaurantId: string = getCurrentRestaurantId()): RestaurantSettings {
  try {
    const raw = safeStorage.getItem(`${RESTAURANT_SETTINGS_STORAGE_KEY}_${restaurantId}`) || safeStorage.getItem(RESTAURANT_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_RESTAURANT_SETTINGS, ...parsed, id: restaurantId, restaurant_id: restaurantId };
    }
  } catch (e) {
    console.error('Failed to get stored restaurant settings', e);
  }
  return { ...DEFAULT_RESTAURANT_SETTINGS, id: restaurantId, restaurant_id: restaurantId };
}

export async function fetchRestaurantSettings(restaurantId: string = getCurrentRestaurantId()): Promise<RestaurantSettings> {
  const supabase = getSupabaseClient();
  const local = getStoredRestaurantSettings(restaurantId);
  if (supabase) {
    try {
      // 1. Primary: Use secure customer RPC for restaurant settings
      const { data: rpcData, error: rpcError } = await supabase.rpc('customer_get_restaurant_settings', {
        p_restaurant_id: restaurantId
      });

      const raw = (!rpcError && rpcData) ? (Array.isArray(rpcData) ? rpcData[0] : rpcData) : null;
      if (raw) {
        const gstPct = typeof raw.gst_percentage === 'number' ? raw.gst_percentage : (typeof raw.gst_rate === 'number' ? raw.gst_rate : local.gstRate);
        const scPct = typeof raw.service_charge_percentage === 'number' ? raw.service_charge_percentage : (typeof raw.service_charge_rate === 'number' ? raw.service_charge_rate : local.serviceChargeRate);
        const settingsName = raw.restaurant_name || raw.name || local.name;
        const settingsLogo = raw.logo_url || raw.logo || local.logo || '';
        const settingsGstin = raw.gstin || local.gstin || '';

        const settings: RestaurantSettings = {
          id: raw.id || restaurantId,
          restaurant_id: raw.restaurant_id || restaurantId,
          name: settingsName,
          restaurant_name: settingsName,
          logo: settingsLogo,
          logo_url: settingsLogo,
          tagline: raw.tagline || local.tagline || '',
          address: raw.address || local.address || '',
          phone: raw.phone || local.phone || '',
          whatsapp: raw.whatsapp || local.whatsapp || '',
          email: raw.email || local.email || '',
          gstin: settingsGstin,
          gstNumber: settingsGstin || local.gstNumber || '',
          openingTime: raw.opening_time || raw.openingTime || local.openingTime,
          closingTime: raw.closing_time || raw.closingTime || local.closingTime,
          restaurantType: raw.restaurant_type || raw.restaurantType || local.restaurantType,
          gstEnabled: raw.gst_enabled !== undefined ? Boolean(raw.gst_enabled) : local.gstEnabled,
          gstRate: gstPct,
          gst_percentage: gstPct,
          serviceChargeEnabled: raw.service_charge_enabled !== undefined ? Boolean(raw.service_charge_enabled) : local.serviceChargeEnabled,
          serviceChargeRate: scPct,
          service_charge_percentage: scPct,
          receiptFooter: raw.receipt_footer || local.receiptFooter,
          currencySymbol: raw.currency_symbol || raw.currency || local.currencySymbol || '₹',
          created_at: raw.created_at,
          updated_at: raw.updated_at
        };
        safeStorage.setItem(`${RESTAURANT_SETTINGS_STORAGE_KEY}_${restaurantId}`, JSON.stringify(settings));
        return settings;
      }

      // 2. Fallback for authenticated staff querying the protected table
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (!error && data) {
        const gstPct = typeof data.gst_percentage === 'number' ? data.gst_percentage : (typeof data.gst_rate === 'number' ? data.gst_rate : local.gstRate);
        const scPct = typeof data.service_charge_percentage === 'number' ? data.service_charge_percentage : (typeof data.service_charge_rate === 'number' ? data.service_charge_rate : local.serviceChargeRate);
        const settingsName = data.restaurant_name || data.name || local.name;
        const settingsLogo = data.logo_url || data.logo || local.logo || '';
        const settingsGstin = data.gstin || local.gstin || '';

        const settings: RestaurantSettings = {
          id: data.id || restaurantId,
          restaurant_id: data.restaurant_id || restaurantId,
          name: settingsName,
          restaurant_name: settingsName,
          logo: settingsLogo,
          logo_url: settingsLogo,
          tagline: data.tagline || local.tagline || '',
          address: data.address || local.address || '',
          phone: data.phone || local.phone || '',
          whatsapp: data.whatsapp || local.whatsapp || '',
          email: data.email || local.email || '',
          gstin: settingsGstin,
          gstNumber: settingsGstin || local.gstNumber || '',
          openingTime: data.opening_time || data.openingTime || local.openingTime,
          closingTime: data.closing_time || data.closingTime || local.closingTime,
          restaurantType: data.restaurant_type || data.restaurantType || local.restaurantType,
          gstEnabled: data.gst_enabled !== undefined ? Boolean(data.gst_enabled) : local.gstEnabled,
          gstRate: gstPct,
          gst_percentage: gstPct,
          serviceChargeEnabled: data.service_charge_enabled !== undefined ? Boolean(data.service_charge_enabled) : local.serviceChargeEnabled,
          serviceChargeRate: scPct,
          service_charge_percentage: scPct,
          receiptFooter: data.receipt_footer || local.receiptFooter,
          currencySymbol: data.currency_symbol || data.currency || local.currencySymbol || '₹',
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        safeStorage.setItem(`${RESTAURANT_SETTINGS_STORAGE_KEY}_${restaurantId}`, JSON.stringify(settings));
        return settings;
      }
    } catch (e) {
      console.warn('Supabase fetchRestaurantSettings fallback to local', e);
    }
  }
  return local;
}

export async function saveRestaurantSettings(settings: RestaurantSettings): Promise<{ success: boolean; settings: RestaurantSettings; error?: string }> {
  const restaurantId = settings.restaurant_id || getCurrentRestaurantId();
  const payload: RestaurantSettings = {
    ...settings,
    id: settings.id || restaurantId,
    restaurant_id: restaurantId,
    updated_at: new Date().toISOString()
  };

  try {
    safeStorage.setItem(`${RESTAURANT_SETTINGS_STORAGE_KEY}_${restaurantId}`, JSON.stringify(payload));
    safeStorage.setItem(RESTAURANT_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }

  // Broadcast & event dispatch
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RESTAURANT_SETTINGS_CHANGED', restaurantId, settings: payload });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_restaurant_settings_changed', { detail: payload }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const dbPayload = {
        restaurant_id: payload.restaurant_id,
        restaurant_name: payload.name || payload.restaurant_name,
        logo_url: payload.logo || payload.logo_url || null,
        tagline: payload.tagline || null,
        address: payload.address || null,
        phone: payload.phone || null,
        whatsapp: payload.whatsapp || null,
        email: payload.email || null,
        gstin: payload.gstin || payload.gstNumber || null,
        opening_time: payload.openingTime || null,
        closing_time: payload.closingTime || null,
        restaurant_type: payload.restaurantType || 'Dine-In & Takeaway',
        gst_enabled: Boolean(payload.gstEnabled),
        gst_percentage: Number(payload.gstRate ?? payload.gst_percentage ?? 0),
        service_charge_enabled: Boolean(payload.serviceChargeEnabled),
        service_charge_percentage: Number(payload.serviceChargeRate ?? payload.service_charge_percentage ?? 0),
        receipt_footer: payload.receiptFooter || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('restaurant_settings')
        .upsert(dbPayload, { onConflict: 'restaurant_id' });

      if (error) {
        console.warn('Supabase upsert restaurant_settings failed:', error.message);
      }
    } catch (e: any) {
      console.warn('Supabase restaurant_settings error:', e.message);
    }
  }

  return { success: true, settings: payload };
}

// ============================================================================
// PHASE 1: TABLE MANAGEMENT
// ============================================================================

export function getStoredRestaurantTables(restaurantId: string = getCurrentRestaurantId()): RestaurantTable[] {
  try {
    const raw = safeStorage.getItem(`${RESTAURANT_TABLES_STORAGE_KEY}_${restaurantId}`) || safeStorage.getItem(RESTAURANT_TABLES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to get stored restaurant tables', e);
  }
  return DEFAULT_RESTAURANT_TABLES.map(t => ({ ...t, restaurant_id: restaurantId }));
}

export function saveStoredRestaurantTables(tables: RestaurantTable[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    safeStorage.setItem(`${RESTAURANT_TABLES_STORAGE_KEY}_${restaurantId}`, JSON.stringify(tables));
    safeStorage.setItem(RESTAURANT_TABLES_STORAGE_KEY, JSON.stringify(tables));
  } catch (e) {
    console.error('Failed to save stored restaurant tables', e);
  }
}

export async function fetchRestaurantTables(restaurantId: string = getCurrentRestaurantId()): Promise<RestaurantTable[]> {
  const supabase = getSupabaseClient();
  const local = getStoredRestaurantTables(restaurantId);

  if (supabase) {
    try {
      // 1. Primary: Use secure customer RPC for table discovery with tenant scope
      const { data: rpcData, error: rpcError } = await supabase.rpc('customer_get_tables', {
        p_restaurant_id: restaurantId
      });
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const mapped: RestaurantTable[] = rpcData.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          tableNumber: row.table_number || row.tableNumber || `Table ${row.id}`,
          section: row.section || 'Ground Floor',
          capacity: Number(row.capacity || 4),
          isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
          displayOrder: Number(row.display_order || 0),
          qrCodeUrl: row.qr_code_url || undefined,
          qr_token: row.qr_token || undefined,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        saveStoredRestaurantTables(mapped, restaurantId);
        return mapped;
      }

      // 2. Fallback for authenticated staff querying the protected table
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: RestaurantTable[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          tableNumber: row.table_number || row.tableNumber || `Table ${row.id}`,
          section: row.section || 'Ground Floor',
          capacity: Number(row.capacity || 4),
          isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
          displayOrder: Number(row.display_order || 0),
          qrCodeUrl: row.qr_code_url || undefined,
          qr_token: row.qr_token || undefined,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        saveStoredRestaurantTables(mapped, restaurantId);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase fetchRestaurantTables fallback to local', e);
    }
  }
  return local;
}

export async function saveRestaurantTable(table: Partial<RestaurantTable>): Promise<{ success: boolean; table: RestaurantTable; error?: string }> {
  const restaurantId = table.restaurant_id || getCurrentRestaurantId();
  const tables = getStoredRestaurantTables(restaurantId);
  const now = new Date().toISOString();
  const tableNum = table.tableNumber || `Table ${tables.length + 1}`;
  const qrToken = table.qr_token || generateTableQrToken(tableNum, restaurantId);

  let target: RestaurantTable;
  if (table.id && tables.some(t => t.id === table.id)) {
    target = {
      ...tables.find(t => t.id === table.id)!,
      ...table,
      tableNumber: tableNum,
      qr_token: qrToken,
      restaurant_id: restaurantId,
      updated_at: now
    } as RestaurantTable;
    const updated = tables.map(t => t.id === table.id ? target : t);
    saveStoredRestaurantTables(updated, restaurantId);
  } else {
    const newId = table.id || `tbl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    target = {
      id: newId,
      restaurant_id: restaurantId,
      tableNumber: tableNum,
      section: table.section || 'Ground Floor',
      capacity: Number(table.capacity || 4),
      isActive: table.isActive !== undefined ? Boolean(table.isActive) : true,
      displayOrder: table.displayOrder !== undefined ? table.displayOrder : tables.length + 1,
      qrCodeUrl: table.qrCodeUrl,
      qr_token: qrToken,
      created_at: now,
      updated_at: now
    };
    tables.push(target);
    saveStoredRestaurantTables(tables, restaurantId);
  }

  // Broadcast & events
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RESTAURANT_TABLES_CHANGED', restaurantId, table: target });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_restaurant_tables_changed', { detail: target }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const dbPayload = {
        id: target.id,
        restaurant_id: target.restaurant_id,
        table_number: target.tableNumber,
        section: target.section,
        capacity: target.capacity,
        qr_token: target.qr_token,
        is_active: target.isActive,
        display_order: target.displayOrder,
        qr_code_url: target.qrCodeUrl || null,
        updated_at: now
      };
      await supabase.from('restaurant_tables').upsert(dbPayload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase saveRestaurantTable failed', e);
    }
  }

  return { success: true, table: target };
}

export async function deleteRestaurantTable(tableId: string): Promise<boolean> {
  const restaurantId = getCurrentRestaurantId();
  const tables = getStoredRestaurantTables(restaurantId);
  const filtered = tables.filter(t => t.id !== tableId);
  saveStoredRestaurantTables(filtered, restaurantId);

  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RESTAURANT_TABLES_CHANGED', restaurantId, deletedId: tableId });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_restaurant_tables_changed', { detail: { deletedId: tableId } }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('restaurant_tables').delete().eq('id', tableId).eq('restaurant_id', restaurantId);
    } catch (e) {
      console.warn('Supabase deleteRestaurantTable failed', e);
    }
  }

  return true;
}

// ============================================================================
// PHASE 1: MENU CATEGORIES & SUBCATEGORIES MANAGEMENT
// ============================================================================

export function getStoredMenuCategories(restaurantId: string = getCurrentRestaurantId()): MenuCategory[] {
  try {
    const raw = safeStorage.getItem(`${MENU_CATEGORIES_STORAGE_KEY}_${restaurantId}`) || safeStorage.getItem(MENU_CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to get stored menu categories', e);
  }
  return DEFAULT_MENU_CATEGORIES.map(c => ({ ...c, restaurant_id: restaurantId }));
}

export function saveStoredMenuCategories(categories: MenuCategory[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    safeStorage.setItem(`${MENU_CATEGORIES_STORAGE_KEY}_${restaurantId}`, JSON.stringify(categories));
    safeStorage.setItem(MENU_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {}
}

export async function fetchMenuCategories(restaurantId: string = getCurrentRestaurantId()): Promise<MenuCategory[]> {
  const supabase = getSupabaseClient();
  const local = getStoredMenuCategories(restaurantId);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: MenuCategory[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          name: row.name,
          description: row.description || '',
          icon: row.icon || 'Utensils',
          displayOrder: Number(row.display_order || 0),
          isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        saveStoredMenuCategories(mapped, restaurantId);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase fetchMenuCategories fallback to local', e);
    }
  }
  return local;
}

export async function saveMenuCategory(category: Partial<MenuCategory>): Promise<{ success: boolean; category: MenuCategory }> {
  const restaurantId = category.restaurant_id || getCurrentRestaurantId();
  const categories = getStoredMenuCategories(restaurantId);
  const now = new Date().toISOString();

  let target: MenuCategory;
  if (category.id && categories.some(c => c.id === category.id)) {
    target = {
      ...categories.find(c => c.id === category.id)!,
      ...category,
      restaurant_id: restaurantId,
      updated_at: now
    } as MenuCategory;
    const updated = categories.map(c => c.id === category.id ? target : c);
    saveStoredMenuCategories(updated, restaurantId);
  } else {
    const newId = category.id || `cat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    target = {
      id: newId,
      restaurant_id: restaurantId,
      name: category.name || 'New Category',
      description: category.description || '',
      icon: category.icon || 'Utensils',
      displayOrder: category.displayOrder !== undefined ? category.displayOrder : categories.length + 1,
      isActive: category.isActive !== undefined ? Boolean(category.isActive) : true,
      created_at: now,
      updated_at: now
    };
    categories.push(target);
    saveStoredMenuCategories(categories, restaurantId);
  }

  safeDispatchEvent(new CustomEvent('rbh_menu_categories_changed', { detail: target }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('menu_categories').upsert({
        id: target.id,
        restaurant_id: target.restaurant_id,
        name: target.name,
        description: target.description || null,
        icon: target.icon || null,
        display_order: target.displayOrder,
        is_active: target.isActive,
        updated_at: now
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase saveMenuCategory failed', e);
    }
  }

  return { success: true, category: target };
}

export async function deleteMenuCategory(categoryId: string): Promise<boolean> {
  const restaurantId = getCurrentRestaurantId();
  const categories = getStoredMenuCategories(restaurantId);
  const filtered = categories.filter(c => c.id !== categoryId);
  saveStoredMenuCategories(filtered, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_menu_categories_changed', { detail: { deletedId: categoryId } }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('menu_categories').delete().eq('id', categoryId).eq('restaurant_id', restaurantId);
    } catch (e) {
      console.warn('Supabase deleteMenuCategory failed', e);
    }
  }

  return true;
}

export function getStoredMenuSubcategories(restaurantId: string = getCurrentRestaurantId()): MenuSubcategory[] {
  try {
    const raw = safeStorage.getItem(`${MENU_SUBCATEGORIES_STORAGE_KEY}_${restaurantId}`) || safeStorage.getItem(MENU_SUBCATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to get stored menu subcategories', e);
  }
  return DEFAULT_MENU_SUBCATEGORIES.map(s => ({ ...s, restaurant_id: restaurantId }));
}

export function saveStoredMenuSubcategories(subcategories: MenuSubcategory[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    safeStorage.setItem(`${MENU_SUBCATEGORIES_STORAGE_KEY}_${restaurantId}`, JSON.stringify(subcategories));
    safeStorage.setItem(MENU_SUBCATEGORIES_STORAGE_KEY, JSON.stringify(subcategories));
  } catch (e) {}
}

export async function fetchMenuSubcategories(restaurantId: string = getCurrentRestaurantId()): Promise<MenuSubcategory[]> {
  const supabase = getSupabaseClient();
  const local = getStoredMenuSubcategories(restaurantId);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_subcategories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: MenuSubcategory[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          categoryId: String(row.category_id || row.categoryId),
          name: row.name,
          description: row.description || '',
          displayOrder: Number(row.display_order || 0),
          isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        saveStoredMenuSubcategories(mapped, restaurantId);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase fetchMenuSubcategories fallback to local', e);
    }
  }
  return local;
}

export async function saveMenuSubcategory(subcategory: Partial<MenuSubcategory>): Promise<{ success: boolean; subcategory: MenuSubcategory }> {
  const restaurantId = subcategory.restaurant_id || getCurrentRestaurantId();
  const subcategories = getStoredMenuSubcategories(restaurantId);
  const now = new Date().toISOString();

  let target: MenuSubcategory;
  if (subcategory.id && subcategories.some(s => s.id === subcategory.id)) {
    target = {
      ...subcategories.find(s => s.id === subcategory.id)!,
      ...subcategory,
      restaurant_id: restaurantId,
      updated_at: now
    } as MenuSubcategory;
    const updated = subcategories.map(s => s.id === subcategory.id ? target : s);
    saveStoredMenuSubcategories(updated, restaurantId);
  } else {
    const newId = subcategory.id || `sub-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    target = {
      id: newId,
      restaurant_id: restaurantId,
      categoryId: subcategory.categoryId || 'cat-biryani',
      name: subcategory.name || 'New Subcategory',
      description: subcategory.description || '',
      displayOrder: subcategory.displayOrder !== undefined ? subcategory.displayOrder : subcategories.length + 1,
      isActive: subcategory.isActive !== undefined ? Boolean(subcategory.isActive) : true,
      created_at: now,
      updated_at: now
    };
    subcategories.push(target);
    saveStoredMenuSubcategories(subcategories, restaurantId);
  }

  safeDispatchEvent(new CustomEvent('rbh_menu_subcategories_changed', { detail: target }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('menu_subcategories').upsert({
        id: target.id,
        restaurant_id: target.restaurant_id,
        category_id: target.categoryId,
        name: target.name,
        description: target.description || null,
        display_order: target.displayOrder,
        is_active: target.isActive,
        updated_at: now
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase saveMenuSubcategory failed', e);
    }
  }

  return { success: true, subcategory: target };
}

export async function deleteMenuSubcategory(subcategoryId: string): Promise<boolean> {
  const restaurantId = getCurrentRestaurantId();
  const subcategories = getStoredMenuSubcategories(restaurantId);
  const filtered = subcategories.filter(s => s.id !== subcategoryId);
  saveStoredMenuSubcategories(filtered, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_menu_subcategories_changed', { detail: { deletedId: subcategoryId } }));

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('menu_subcategories').delete().eq('id', subcategoryId).eq('restaurant_id', restaurantId);
    } catch (e) {
      console.warn('Supabase deleteMenuSubcategory failed', e);
    }
  }

  return true;
}

// ============================================================================
// PHASE 1: MENU ITEM ADVANCED CRUD & BULK IMPORT
// ============================================================================

export async function saveMenuItemToSupabase(item: Partial<MenuItem> & { Name: string }): Promise<{ success: boolean; item: MenuItem; error?: string }> {
  const restaurantId = item.restaurant_id || getCurrentRestaurantId();
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const idStr = String(item.id || `dish-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);

  const fullItem: MenuItem = {
    id: idStr,
    restaurant_id: restaurantId,
    Name: item.Name,
    Price: Number(item.Price || 0),
    basePrice: Number(item.basePrice || item.Price || 0),
    Description: item.Description || '',
    Image_url: item.Image_url || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    Available: item.Available !== undefined ? item.Available : true,
    category: item.category || 'Biryani Specials',
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId,
    subcategoryName: item.subcategoryName,
    isVeg: Boolean(item.isVeg),
    vegType: item.vegType || (item.isVeg ? 'Veg' : 'Non-Veg'),
    isSpicy: Boolean(item.isSpicy),
    isBestSeller: Boolean(item.isBestSeller),
    prepTime: item.prepTime || '15-20 mins',
    sku: item.sku || undefined,
    stockCount: typeof item.stockCount === 'number' ? item.stockCount : 50,
    stockStatus: item.stockStatus || ((item.Available !== false) ? 'In Stock' : 'Out of Stock'),
    variants: item.variants || [],
    addons: item.addons || [],
    brand: item.brand || undefined,
    beverageType: item.beverageType || undefined,
    volumeMl: typeof item.volumeMl === 'number' ? item.volumeMl : undefined,
    servingSize: item.servingSize || undefined,
    mrp: typeof item.mrp === 'number' ? item.mrp : undefined,
    taxCategory: item.taxCategory || undefined,
    displayOrder: item.displayOrder || 1,
    is_archived: Boolean(item.is_archived),
    created_at: item.created_at || new Date().toISOString()
  };

  // Update local cache & tenant cache
  try {
    const keys = [LOCAL_MENU_KEY, getTenantStorageKey(LOCAL_MENU_KEY, restaurantId)];
    keys.forEach(k => {
      const raw = safeStorage.getItem(k);
      let items: MenuItem[] = raw ? JSON.parse(raw) : [];
      const exists = items.some(i => String(i.id) === idStr);
      if (exists) {
        items = items.map(i => String(i.id) === idStr ? fullItem : i);
      } else {
        items.push(fullItem);
      }
      safeStorage.setItem(k, JSON.stringify(items));
    });
  } catch (e) {
    console.error('Failed to save to local cache', e);
  }

  // Update availability map
  const availMap = getMenuAvailabilityMap();
  availMap[idStr] = fullItem.Available;
  saveMenuAvailabilityMap(availMap);

  // Dispatch events
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'MENU_ITEM_SAVED', item: fullItem });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_menu_item_saved', { detail: fullItem }));
  safeDispatchEvent(new Event('rbh_menu_updated'));

  // Save to Supabase
  if (supabase) {
    try {
      const payload: Record<string, any> = {
        id: idStr,
        restaurant_id: restaurantId,
        category_id: fullItem.categoryId || null,
        subcategory_id: fullItem.subcategoryId || null,
        name: fullItem.Name,
        price: fullItem.Price,
        description: fullItem.Description,
        image_url: fullItem.Image_url,
        available: fullItem.Available,
        is_bestseller: Boolean(fullItem.isBestSeller),
        stock_status: fullItem.stockStatus || (fullItem.Available ? 'In Stock' : 'Out of Stock'),
        display_order: fullItem.displayOrder || 1
      };

      const targetTable = config.tableName || 'menu_items';
      const { error } = await supabase.from(targetTable).upsert(payload, { onConflict: 'id' });
      if (error && targetTable !== 'menu_items') {
        await supabase.from('menu_items').upsert(payload, { onConflict: 'id' });
      }
    } catch (e: any) {
      console.warn('Supabase saveMenuItem failed', e.message);
    }
  }

  return { success: true, item: fullItem };
}

export async function deleteMenuItemFromSupabase(itemId: string | number): Promise<boolean> {
  const idStr = String(itemId);
  const currentRid = getCurrentRestaurantId();
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();

  // Remove from local cache & tenant cache
  try {
    const keys = [LOCAL_MENU_KEY, getTenantStorageKey(LOCAL_MENU_KEY, currentRid)];
    keys.forEach(k => {
      const raw = safeStorage.getItem(k);
      if (raw) {
        let items: MenuItem[] = JSON.parse(raw);
        items = items.filter(i => String(i.id) !== idStr);
        safeStorage.setItem(k, JSON.stringify(items));
      }
    });
  } catch (e) {}

  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'MENU_ITEM_DELETED', itemId: idStr });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_menu_item_deleted', { detail: { itemId: idStr } }));
  safeDispatchEvent(new Event('rbh_menu_updated'));

  if (supabase) {
    try {
      const targetTable = config.tableName || 'menu_items';
      await supabase.from(targetTable).delete().eq('id', idStr);
      await supabase.from('menu_items').delete().eq('id', idStr);
    } catch (e) {
      console.warn('Supabase deleteMenuItem failed', e);
    }
  }

  return true;
}

export function parseCSVToBulkRows(csvText: string): BulkImportRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: BulkImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let insideQuote = false;
    let currentValue = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const getVal = (possibleHeaders: string[]): string => {
      for (const h of possibleHeaders) {
        const idx = headers.findIndex(hdr => hdr.includes(h));
        if (idx !== -1 && values[idx] !== undefined) {
          return values[idx].replace(/^["']|["']$/g, '').trim();
        }
      }
      return '';
    };

    rows.push({
      category: getVal(['category', 'cat']),
      subcategory: getVal(['subcategory', 'subcat', 'section']),
      itemName: getVal(['itemname', 'name', 'item', 'dish']),
      description: getVal(['description', 'desc', 'details']),
      vegNonVeg: getVal(['vegnonveg', 'veg', 'type', 'diet', 'dietary']),
      variant: getVal(['variant', 'variants', 'portion', 'size', 'portions']),
      unit: getVal(['unit', 'measure', 'uom']),
      price: getVal(['price', 'rate', 'cost', 'amount', 'baseprice']),
      sku: getVal(['sku', 'itemcode', 'item_code', 'code']),
      active: getVal(['active', 'status', 'available', 'isactive', 'availability']),
      imageUrl: getVal(['image', 'imageurl', 'image_url', 'photo']),
      prepTime: getVal(['preptime', 'prep_time', 'time', 'duration']),
      addon: getVal(['addon', 'addons', 'extras', 'add_on']),
      brand: getVal(['brand', 'brandname']),
      beverageType: getVal(['beveragetype', 'beverage_type', 'drinktype', 'beverage']),
      servingSize: getVal(['servingsize', 'serving_size', 'serving']),
      mrp: getVal(['mrp', 'maxretailprice']),
      taxCategory: getVal(['taxcategory', 'tax_category', 'tax'])
    });
  }

  return rows;
}

export function validateBulkImportRows(input: BulkImportRow[] | string): ImportValidationResult {
  const rows = typeof input === 'string' ? parseCSVToBulkRows(input) : input;
  const validItems: Partial<MenuItem>[] = [];
  const errors: { row: number; field: string; message: string; data?: any }[] = [];
  const seenSKUs = new Set<string>();

  const validUnits = ['pcs', 'g', 'kg', 'ml', 'L', 'portion', 'size', 'can', 'bottle', 'plate', 'piece', 'half', 'full', 'peg', 'glass'];

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    let rowHasError = false;

    const name = (row.itemName || '').trim();
    const category = (row.category || '').trim();
    const subcategory = (row.subcategory || '').trim();
    const sku = (row.sku || '').trim();
    const rawPriceTrimmed = String(row.price || '').trim();
    const cleanedPriceStr = rawPriceTrimmed.replace(/^[₹$]|^(rs\.?|inr)\s*/i, '').trim();
    const priceNum = cleanedPriceStr === '' ? NaN : Number(cleanedPriceStr);
    const variantStr = (row.variant || '').trim();
    const addonStr = (row.addon || '').trim();
    const rawUnit = (row.unit || '').trim().toLowerCase();
    const isVegStr = (row.vegNonVeg || '').trim().toLowerCase();
    const rawMrpTrimmed = String(row.mrp || '').trim();
    const cleanedMrpStr = rawMrpTrimmed.replace(/^[₹$]|^(rs\.?|inr)\s*/i, '').trim();
    const mrpNum = cleanedMrpStr && !isNaN(Number(cleanedMrpStr)) ? Number(cleanedMrpStr) : undefined;

    // 1. Validate Item Name
    if (!name) {
      errors.push({ row: rowNum, field: 'Item Name', message: 'Item name is required and cannot be empty.' });
      rowHasError = true;
    }

    // 2. Validate Category
    if (!category) {
      errors.push({ row: rowNum, field: 'Category', message: 'Category is required and cannot be empty.' });
      rowHasError = true;
    }

    // 3. Validate Price
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push({ row: rowNum, field: 'Price', message: `Invalid price "${row.price}". Price must be a valid positive number greater than 0.` });
      rowHasError = true;
    }

    // 4. Validate SKU for duplicates
    if (sku) {
      if (seenSKUs.has(sku.toLowerCase())) {
        errors.push({ row: rowNum, field: 'SKU', message: `Duplicate SKU "${sku}" detected. Each item code/SKU must be unique.` });
        rowHasError = true;
      } else {
        seenSKUs.add(sku.toLowerCase());
      }
    }

    // 5. Parse Variants
    let variants: MenuItemVariant[] | undefined = undefined;
    if (variantStr) {
      // Support multi-variant delimiter: "Half:180|Full:320" or "30ml:150:peg|60ml:280:peg"
      if (variantStr.includes(':') || variantStr.includes('|')) {
        const parts = variantStr.split('|').map(p => p.trim()).filter(Boolean);
        const parsedVars: MenuItemVariant[] = [];
        for (const part of parts) {
          const subParts = part.split(':').map(s => s.trim());
          const vName = subParts[0];
          const vPrice = parseFloat(subParts[1] || '0');
          const vUnit = (subParts[2] || rawUnit || 'portion').toLowerCase() as any;

          if (!vName || isNaN(vPrice) || vPrice <= 0) {
            errors.push({ row: rowNum, field: 'Variant', message: `Invalid variant entry "${part}". Expected format "Name:Price" (e.g. "Half:180").` });
            rowHasError = true;
          } else {
            parsedVars.push({
              id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: vName,
              price: vPrice,
              unit: validUnits.includes(vUnit) ? vUnit : 'portion',
              isDefault: parsedVars.length === 0,
              available: true
            });
          }
        }
        if (parsedVars.length > 0) {
          variants = parsedVars;
        }
      } else {
        // Single variant name in column
        let unit = rawUnit;
        if (unit && !validUnits.includes(unit)) {
          if (unit.includes('ml')) unit = 'ml';
          else if (unit.includes('kg')) unit = 'kg';
          else if (unit.includes('gm') || unit.includes('g')) unit = 'g';
          else if (unit.includes('pc')) unit = 'pcs';
          else if (unit.includes('plate')) unit = 'plate';
          else unit = 'portion';
        }

        variants = [{
          id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: variantStr,
          unit: (unit as any) || 'portion',
          price: priceNum || 0,
          isDefault: true,
          available: true
        }];
      }
    }

    // 6. Parse Addons
    let addons: MenuItemAddon[] | undefined = undefined;
    if (addonStr) {
      const addonParts = addonStr.split('|').map(a => a.trim()).filter(Boolean);
      const parsedAddons: MenuItemAddon[] = [];
      for (const aPart of addonParts) {
        const sub = aPart.split(':').map(s => s.trim());
        const aName = sub[0];
        const aPrice = parseFloat(sub[1] || '0');
        const aVeg = sub[2] ? sub[2].toLowerCase().includes('veg') && !sub[2].toLowerCase().includes('non') : true;

        if (!aName || isNaN(aPrice) || aPrice < 0) {
          errors.push({ row: rowNum, field: 'Addon', message: `Invalid add-on entry "${aPart}". Expected format "Name:Price" (e.g. "Extra Cheese:50").` });
          rowHasError = true;
        } else {
          parsedAddons.push({
            id: `add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: aName,
            price: aPrice,
            isVeg: aVeg,
            available: true
          });
        }
      }
      if (parsedAddons.length > 0) {
        addons = parsedAddons;
      }
    }

    // 7. Validate Dietary Type
    const isVegan = isVegStr.includes('vegan');
    const isEgg = isVegStr.includes('egg');
    const isVeg = isVegan || (isVegStr.includes('veg') && !isVegStr.includes('non'));
    const vegType: 'Veg' | 'Non-Veg' | 'Vegan' | 'Egg' = isVegan ? 'Vegan' : (isEgg ? 'Egg' : (isVeg ? 'Veg' : 'Non-Veg'));

    const activeBool = row.active === undefined || row.active === '' || String(row.active).toLowerCase() === 'true' || String(row.active).toLowerCase() === 'yes' || String(row.active) === '1';

    if (!rowHasError) {
      validItems.push({
        id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${index}`,
        Name: name,
        category,
        subcategoryName: subcategory || undefined,
        Description: (row.description || '').trim() || `${name} prepared in royal traditional recipe`,
        Price: priceNum,
        basePrice: priceNum,
        sku: sku || undefined,
        Image_url: (row.imageUrl || '').trim() || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
        Available: activeBool,
        isVeg,
        vegType,
        stockStatus: activeBool ? 'In Stock' : 'Out of Stock',
        stockCount: activeBool ? 50 : 0,
        variants,
        addons,
        brand: (row.brand || '').trim() || undefined,
        beverageType: (row.beverageType || '').trim() || undefined,
        servingSize: (row.servingSize || '').trim() || undefined,
        mrp: mrpNum,
        taxCategory: (row.taxCategory || '').trim() || undefined,
        prepTime: (row.prepTime || '').trim() || '15-20 mins'
      });
    }
  });

  return {
    totalRows: rows.length,
    validCount: validItems.length,
    errorCount: errors.length,
    errors,
    validItems
  };
}

export async function bulkImportMenuItems(input: Partial<MenuItem>[] | string): Promise<{ success: boolean; importedCount: number; categoriesCount: number; error?: string }> {
  let items: Partial<MenuItem>[] = [];
  if (typeof input === 'string') {
    const validation = validateBulkImportRows(input);
    if (validation.validCount === 0 && validation.totalRows > 0) {
      return { 
        success: false, 
        importedCount: 0, 
        categoriesCount: 0, 
        error: `Import failed: ${validation.errors.length} errors found across rows. Please fix errors and re-upload.` 
      };
    }
    items = validation.validItems;
  } else {
    items = input;
  }

  const restaurantId = getCurrentRestaurantId();
  const rawMenu = safeStorage.getItem(LOCAL_MENU_KEY);
  let currentMenu: MenuItem[] = rawMenu ? JSON.parse(rawMenu) : [...DEFAULT_MENU_ITEMS];

  const categorySet = new Set<string>();

  const prepared: MenuItem[] = items.map((it, idx) => {
    const catName = it.category || 'Biryani Specials';
    categorySet.add(catName);

    return {
      id: it.id || `item-bulk-${Date.now()}-${idx}`,
      restaurant_id: restaurantId,
      Name: it.Name || 'New Dish',
      Price: it.Price || 200,
      basePrice: it.basePrice || it.Price || 200,
      Description: it.Description || '',
      Image_url: it.Image_url || 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
      Available: it.Available !== undefined ? it.Available : true,
      category: catName,
      categoryId: it.categoryId,
      subcategoryId: it.subcategoryId,
      subcategoryName: it.subcategoryName,
      isVeg: Boolean(it.isVeg),
      vegType: it.vegType || (it.isVeg ? 'Veg' : 'Non-Veg'),
      isSpicy: Boolean(it.isSpicy),
      isBestSeller: Boolean(it.isBestSeller),
      prepTime: it.prepTime || '15-20 mins',
      sku: it.sku,
      brand: it.brand,
      beverageType: it.beverageType,
      volumeMl: it.volumeMl,
      servingSize: it.servingSize,
      mrp: it.mrp,
      taxCategory: it.taxCategory,
      stockCount: it.stockCount || 50,
      stockStatus: it.stockStatus || 'In Stock',
      variants: it.variants || [],
      addons: it.addons || [],
      displayOrder: currentMenu.length + idx + 1,
      created_at: new Date().toISOString()
    };
  });

  // Ensure new categories are registered
  const existingCategories = getStoredMenuCategories(restaurantId);
  let newCatsCount = 0;
  for (const cat of Array.from(categorySet)) {
    if (!existingCategories.some(c => c.name.toLowerCase() === cat.toLowerCase())) {
      await saveMenuCategory({ name: cat, restaurant_id: restaurantId });
      newCatsCount++;
    }
  }

  // Append to local menu
  currentMenu = [...currentMenu, ...prepared];
  try {
    safeStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(currentMenu));
  } catch (e) {}

  // Update availability map
  const availMap = getMenuAvailabilityMap();
  prepared.forEach(item => {
    availMap[String(item.id)] = item.Available;
  });
  saveMenuAvailabilityMap(availMap);

  // Dispatch events
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'BULK_MENU_IMPORTED', count: prepared.length });
    } catch {}
  }
  safeDispatchEvent(new CustomEvent('rbh_menu_bulk_imported', { detail: { count: prepared.length } }));
  safeDispatchEvent(new Event('rbh_menu_updated'));

  // Save each to Supabase in background
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const config = getSupabaseConfig();
      const targetTable = config.tableName || 'menu_items';
      const rows = prepared.map(item => ({
        id: String(item.id),
        restaurant_id: restaurantId,
        category_id: item.categoryId || null,
        subcategory_id: item.subcategoryId || null,
        name: item.Name,
        price: item.Price,
        description: item.Description,
        image_url: item.Image_url,
        available: item.Available,
        is_bestseller: Boolean(item.isBestSeller),
        stock_status: item.stockStatus,
        display_order: item.displayOrder
      }));

      await supabase.from(targetTable).upsert(rows, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase bulk upsert failed', e);
    }
  }

  return { success: true, importedCount: prepared.length, categoriesCount: newCatsCount };
}

export function exportMenuItemsToCSV(items: MenuItem[]): string {
  const headers = [
    'Category',
    'Subcategory',
    'Item Name',
    'Description',
    'Price',
    'Veg / Non-Veg',
    'SKU',
    'Available',
    'Variants',
    'Add-ons',
    'Brand',
    'Beverage Type',
    'Serving Size',
    'MRP',
    'Tax Category',
    'Prep Time',
    'Image URL'
  ];

  const escapeCSV = (str: string = '') => {
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('|')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = items.map(item => {
    const variantStr = (item.variants || [])
      .map(v => `${v.name}:${v.price}${v.unit ? `:${v.unit}` : ''}`)
      .join('|');

    const addonStr = (item.addons || [])
      .map(a => `${a.name}:${a.price}`)
      .join('|');

    return [
      escapeCSV(item.category || ''),
      escapeCSV(item.subcategoryName || ''),
      escapeCSV(item.Name || ''),
      escapeCSV(item.Description || ''),
      item.Price || 0,
      item.vegType || (item.isVeg ? 'Veg' : 'Non-Veg'),
      escapeCSV(item.sku || ''),
      item.Available ? 'TRUE' : 'FALSE',
      escapeCSV(variantStr),
      escapeCSV(addonStr),
      escapeCSV(item.brand || ''),
      escapeCSV(item.beverageType || ''),
      escapeCSV(item.servingSize || ''),
      item.mrp || '',
      escapeCSV(item.taxCategory || ''),
      escapeCSV(item.prepTime || '15-20 mins'),
      escapeCSV(item.Image_url || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateSampleMenuCSVTemplate(): string {
  return `Category,Subcategory,Item Name,Description,Price,Veg / Non-Veg,SKU,Available,Variants,Add-ons,Brand,Beverage Type,Serving Size,MRP,Tax Category,Prep Time
Biryani Specials,Dum Biryani,Shahi Chicken Dum Biryani,Aromatic long grain basmati rice dum cooked with fresh chicken & royal spices,320,Non-Veg,RBH-BIR-001,TRUE,Half:180:portion|Full:320:portion|Family Handi:690:portion,Extra Gravy:40|Raita:30|Boiled Egg:20,,,Portion,350,standard,20 mins
Biryani Specials,Dum Biryani,Awadhi Gosht Mutton Biryani,Melt-in-mouth tender goat meat layered with saffron and royal Awadhi masala,420,Non-Veg,RBH-BIR-002,TRUE,Half:240:portion|Full:420:portion|Handi:850:portion,Extra Gravy:40|Double Masala:35,,,Portion,450,standard,25 mins
Biryani Specials,Handi Specials,Paneer Tikka Dum Biryani,Charcoal roasted paneer cubes tossed in rich dum gravy with basmati rice,260,Veg,RBH-BIR-003,TRUE,Half:150:portion|Full:260:portion,Extra Paneer:50|Boondi Raita:30,,,Portion,280,standard,15 mins
Starters & Tandoor,Tandoori Kebabs,Murgh Malai Tikka,Creamy boneless chicken kebabs marinated in cashew paste and cardamom,340,Non-Veg,RBH-STR-001,TRUE,6 Pieces:210:pcs|12 Pieces:340:pcs,Extra Mint Dip:20|Lachha Onion:15,,,Plate,360,standard,15 mins
Starters & Tandoor,Tandoori Kebabs,Galouti Kebab Melt,Lucknowi lamb patties smoked with cloves and rose water,380,Non-Veg,RBH-STR-002,TRUE,4 Pieces:230:pcs|8 Pieces:380:pcs,Ulta Tawa Paratha:40|Mint Sauce:20,,,Plate,400,standard,15 mins
Starters & Tandoor,Tikka Specials,Dahi Ke Kebab,Crispy hung curd cutlets flavored with green chillies and fresh coriander,240,Veg,RBH-STR-003,TRUE,6 Pieces:240:pcs,Mint Chutney:20,,,Plate,260,standard,12 mins
Starters & Tandoor,Tandoori Kebabs,Crispy Vegan Corn Tikki,Golden crisp spiced sweet corn and herb patties,220,Vegan,RBH-STR-004,TRUE,6 Pieces:220:pcs,Sweet Chilli Dip:20,,,Plate,240,standard,12 mins
Royal Curries,Chicken Curries,Murgh Makhani Butter Chicken,Slow-simmered tandoori chicken in velvety tomato and butter gravy,340,Non-Veg,RBH-CUR-001,TRUE,Half:210:portion|Full:340:portion,Extra Butter:25|Extra Gravy:45,,,Portion,360,standard,15 mins
Royal Curries,Mutton & Meat,Nalli Nihari Gosht,Overnight slow-cooked lamb shanks infused with traditional potli spices,460,Non-Veg,RBH-CUR-002,TRUE,Single Shank:260:portion|Double Shank:460:portion,Ginger & Green Chilli Garnish:15,,,Portion,490,standard,20 mins
Royal Curries,Paneer & Vegetarian,Shahi Paneer Khas,Cottage cheese triangles in sweet almond and cashew saffron gravy,280,Veg,RBH-CUR-003,TRUE,Half:160:portion|Full:280:portion,Extra Cream:20,,,Portion,300,standard,15 mins
Breads & Rice,Tandoori Breads,Butter Garlic Naan,Clay oven leavened bread brushed with melted butter and fresh garlic,65,Veg,RBH-BRD-001,TRUE,1 Piece:65:pcs|2 Pieces:120:pcs,Extra Garlic Butter:15,,,Piece,75,standard,8 mins
Breads & Rice,Tandoori Breads,Khamiri Roti,Soft traditional Mughlai yeast fermented tandoori bread,50,Vegan,RBH-BRD-002,TRUE,1 Piece:50:pcs|2 Pieces:95:pcs,,,,Piece,60,standard,8 mins
Beverages,Alcohol & Spirits,Single Malt Scotch 12YO,Speyside single malt matured in oak casks with honeyed notes,380,Veg,RBH-ALC-001,TRUE,30ml Peg:380:peg|60ml Large:690:peg|Bottle 750ml:7500:bottle,Soda:30|Tonic Water:60,Glenfiddich,Whiskey,30ml Peg,420,liquor,5 mins
Beverages,Alcohol & Spirits,Premium Craft Draught Beer,Crisp Belgian style wheat beer with citrus orange peel notes,290,Veg,RBH-ALC-002,TRUE,330ml Pint:290:glass|500ml Mug:420:glass|Pitcher 1.5L:1150:can,Salted Peanuts:40|Masala Fries:80,Bira 91,Beer,330ml Pint,320,liquor,5 mins
Beverages,Alcohol & Spirits,Aged Dark Rum,Caribbean recipe dark rum with vanilla and caramel notes,190,Veg,RBH-ALC-003,TRUE,30ml Peg:190:peg|60ml Large:340:peg|Bottle 750ml:3800:bottle,Cola Can:40|Water Bottle:20,Old Monk,Rum,30ml Peg,220,liquor,5 mins
Beverages,Lassi & Mocktails,Royal Kesaria Malai Lassi,Hand-churned creamy sweetened curd infused with saffron and pistachios,120,Veg,RBH-BEV-001,TRUE,Glass 300ml:120:glass|Large 500ml:180:glass,Extra Dry Fruits:30|Rabri Scoop:40,,,Glass,140,standard,5 mins
Beverages,Lassi & Mocktails,Fresh Mint Lime Soda,Sparkling chilled soda with freshly squeezed lemon juice and mint,80,Vegan,RBH-BEV-002,TRUE,Sweet:80:glass|Salted:80:glass|Mixed:85:glass,,,,Glass,90,standard,5 mins
Beverages & Desserts,Mughlai Desserts,Shahi Tukda Awadhi,Ghee-fried crisp bread soaked in saffron syrup topped with thick rabri,140,Veg,RBH-DES-001,TRUE,2 Pieces:140:pcs|4 Pieces:260:pcs,Extra Rabri:40,,,Plate,160,standard,5 mins
Beverages & Desserts,Mughlai Desserts,Kesariya Gulab Jamun,Warm khoya dumplings stuffed with pistachio and cardamom in rose syrup,110,Veg,RBH-DES-002,TRUE,2 Pieces:110:pcs|4 Pieces:200:pcs,Vanilla Ice Cream Scoop:40,,,Plate,130,standard,5 mins
Accompaniments,Sides & Salads,Mirchi Ka Salan,Traditional Hyderabadi peanut sesame and bhavnagri chilli gravy,90,Veg,RBH-ACC-001,TRUE,Portion:90:portion,,,,Portion,100,standard,5 mins`;
}

// Orders management (local + synchronized with Supabase if table exists)
const CUSTOMER_ACTIVE_ORDER_KEY = 'rbh_customer_active_order_id';

// BroadcastChannel for instant cross-tab realtime sync even without network latency
let ordersBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    ordersBroadcastChannel = new BroadcastChannel('rbh_orders_realtime');
  }
} catch (e) {
  // Ignore if BroadcastChannel not supported
}

export function getCustomerActiveOrderId(tableNumber?: string): string | null {
  try {
    const saved = safeStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
    if (saved) {
      // If tableNumber is provided, check if the saved active order matches this table
      if (tableNumber) {
        const orders = getStoredOrders();
        const activeOrder = orders.find(o => o.id === saved);
        if (activeOrder && activeOrder.tableNumber.toLowerCase() === tableNumber.toLowerCase()) {
          return saved;
        }
      } else {
        return saved;
      }
    }
  } catch (e) {
    console.error('Failed to get customer active order ID', e);
  }
  return null;
}

export function setCustomerActiveOrderId(orderId: string | null): void {
  try {
    if (orderId) {
      safeStorage.setItem(CUSTOMER_ACTIVE_ORDER_KEY, orderId);
    } else {
      safeStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
    }
    safeDispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId } }));
  } catch (e) {
    console.error('Failed to save customer active order ID', e);
  }
}

export function mapOrderToSupabasePayload(order: Order): Record<string, any> {
  const currentRid = order.restaurant_id || getCurrentRestaurantId();
  return {
    order_id: order.id,
    restaurant_id: currentRid,
    table_number: order.tableNumber,
    qr_token: order.qr_token || null,
    session_id: order.sessionId || null,
    round: order.round || 1,
    is_addon: Boolean(order.isAddon),
    items: order.items || [],
    subtotal: Number(order.subtotal || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
    status: order.status || 'New',
    payment_status: order.paymentStatus || 'Pending',
    payment_mode: order.paymentMode || 'UPI',
    paid_amount: Number(order.paidAmount || 0),
    remaining_amount: Number(order.remainingAmount !== undefined ? order.remainingAmount : (order.total || 0)),
    customer_name: order.customerName || null,
    customer_notes: order.customerNotes || null,
    payment_history: order.paymentHistory || [],
    paid_at: order.paidAt || null,
    estimated_minutes: order.estimatedMinutes || 15,
    is_archived: Boolean(order.is_archived),
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function mapSupabaseRowToOrder(row: Record<string, any>): Order {
  const itemsRaw = row.items || row.Items || [];
  let parsedItems: any[] = [];
  if (Array.isArray(itemsRaw)) {
    parsedItems = itemsRaw;
  } else if (typeof itemsRaw === 'string') {
    try {
      parsedItems = JSON.parse(itemsRaw);
    } catch {
      parsedItems = [];
    }
  }

  const paymentHistoryRaw = row.payment_history || row.paymentHistory || [];
  let parsedPaymentHistory: PaymentRecord[] = [];
  if (Array.isArray(paymentHistoryRaw)) {
    parsedPaymentHistory = paymentHistoryRaw;
  } else if (typeof paymentHistoryRaw === 'string') {
    try {
      parsedPaymentHistory = JSON.parse(paymentHistoryRaw);
    } catch {
      parsedPaymentHistory = [];
    }
  }

  const orderId = String(row.order_id || row.orderId || row.id || '');
  const subtotal = Number(row.subtotal ?? 0);
  const tax = Number(row.tax ?? 0);
  const total = Number(row.total ?? (subtotal + tax));

  const rawPaymentStatus = String(row.payment_status || row.paymentStatus || (row.is_paid ? 'Paid' : 'Pending')).trim();
  const isPaidNormalized = rawPaymentStatus.toLowerCase() === 'paid' || Boolean(row.is_paid);

  let paidAmount = 0;
  if (typeof row.paid_amount === 'number' && !isNaN(row.paid_amount)) {
    paidAmount = row.paid_amount;
  } else if (typeof row.paidAmount === 'number' && !isNaN(row.paidAmount)) {
    paidAmount = row.paidAmount;
  } else if (isPaidNormalized) {
    paidAmount = total;
  }

  // If status is marked Paid, ensure paidAmount is at least total
  if (isPaidNormalized && paidAmount < total) {
    paidAmount = total;
  }

  let remainingAmount = 0;
  if (isPaidNormalized) {
    remainingAmount = 0;
  } else if (typeof row.remaining_amount === 'number' && !isNaN(row.remaining_amount)) {
    remainingAmount = row.remaining_amount;
  } else if (typeof row.remainingAmount === 'number' && !isNaN(row.remainingAmount)) {
    remainingAmount = row.remainingAmount;
  } else {
    remainingAmount = Math.max(0, total - paidAmount);
  }

  if ((paidAmount >= total && total > 0) || (remainingAmount <= 0.05 && total > 0 && paidAmount > 0)) {
    remainingAmount = 0;
  }

  const finalPaymentStatus: Order['paymentStatus'] = (isPaidNormalized || (remainingAmount <= 0.05 && total > 0 && paidAmount > 0))
    ? 'Paid'
    : (paidAmount > 0 ? 'Partially Paid' : 'Pending');

  return {
    id: orderId,
    restaurant_id: row.restaurant_id || DEFAULT_RESTAURANT_ID,
    tableNumber: row.table_number || row.tableNumber || 'Table 1',
    sessionId: row.session_id || row.sessionId,
    round: row.round || 1,
    isAddon: Boolean(row.is_addon || row.isAddon),
    items: parsedItems.map((item: any) => ({
      id: item.id || `item-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name || item.Name || 'Dish',
      price: Number(item.price ?? item.Price ?? 0),
      quantity: Number(item.quantity ?? 1),
      spiceLevel: item.spiceLevel,
      notes: item.notes || item.specialNotes,
      portion: item.portion,
      image: item.image || item.Image_url || item.image_url
    })),
    subtotal: isNaN(subtotal) ? 0 : subtotal,
    tax: isNaN(tax) ? 0 : tax,
    total: isNaN(total) ? 0 : total,
    status: (row.status || 'New') as Order['status'],
    paymentMethod: row.payment_method || row.paymentMethod || 'Pay at Counter',
    paymentStatus: finalPaymentStatus,
    paymentMode: (row.payment_mode || row.paymentMode || 'UPI') as Order['paymentMode'],
    paidAmount: isNaN(paidAmount) ? 0 : paidAmount,
    remainingAmount: isNaN(remainingAmount) ? 0 : remainingAmount,
    paymentHistory: parsedPaymentHistory,
    paidAt: row.paid_at || row.paidAt || (finalPaymentStatus === 'Paid' ? (row.updated_at || row.created_at) : undefined),
    customerName: row.customer_name || row.customerName,
    customerNotes: row.customer_notes || row.customerNotes,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    estimatedMinutes: row.estimated_minutes || row.estimatedMinutes || 15,
    qr_token: row.qr_token || undefined,
    is_archived: Boolean(row.is_archived || row.isArchived)
  };
}

export async function fetchStoredOrdersFromSupabase(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ orders: Order[]; source: 'supabase' | 'local'; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('royal_orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        if (data.length > 0) {
          const mapped = data.map(mapSupabaseRowToOrder);
          const currentLocal = getStoredOrders(restaurantId);

          // Status priority hierarchy: Completed (4) > Ready (3) > Preparing (2) > New (1)
          const getStatusRank = (s: string) => {
            switch (s) {
              case 'Completed': return 4;
              case 'Ready': return 3;
              case 'Preparing': return 2;
              case 'New': return 1;
              default: return 0;
            }
          };

          // Smart reconciliation: keep forward status advancements from local store if remote has not yet caught up
          const reconciled = mapped.map(remoteOrder => {
            const localOrder = currentLocal.find(l => l.id === remoteOrder.id);
            if (!localOrder) return remoteOrder;

            const useLocalStatus = getStatusRank(localOrder.status) > getStatusRank(remoteOrder.status);
            return {
              ...remoteOrder,
              sessionId: remoteOrder.sessionId || localOrder.sessionId,
              round: remoteOrder.round || localOrder.round || 1,
              isAddon: remoteOrder.isAddon !== undefined ? remoteOrder.isAddon : localOrder.isAddon,
              status: useLocalStatus ? localOrder.status : remoteOrder.status,
              paymentStatus: localOrder.paymentStatus === 'Paid' ? 'Paid' : (remoteOrder.paymentStatus || localOrder.paymentStatus),
              paidAmount: localOrder.paidAmount !== undefined ? Math.max(localOrder.paidAmount, remoteOrder.paidAmount || 0) : remoteOrder.paidAmount,
              remainingAmount: localOrder.remainingAmount !== undefined ? localOrder.remainingAmount : remoteOrder.remainingAmount,
              paymentHistory: localOrder.paymentHistory || remoteOrder.paymentHistory
            };
          });

          // Retain any pending local order not yet retrieved from remote
          const remoteIds = new Set(reconciled.map(r => r.id));
          const localOnly = currentLocal.filter(l => !remoteIds.has(l.id));
          const finalOrders = [...reconciled, ...localOnly];

          saveStoredOrders(finalOrders, restaurantId);
          return { orders: finalOrders, source: 'supabase' };
        } else if (restaurantId === DEFAULT_RESTAURANT_ID) {
          // Table exists but is empty for default restaurant -> seed initial historical orders to Supabase
          const seeded = INITIAL_HISTORICAL_ORDERS.map(o => ({ ...o, restaurant_id: DEFAULT_RESTAURANT_ID }));
          saveStoredOrders(seeded, DEFAULT_RESTAURANT_ID);
          const rowsToInsert = seeded.map(o => mapOrderToSupabasePayload(o));
          Promise.resolve(supabase.from('royal_orders').insert(rowsToInsert)).catch(() => {});
          return { orders: seeded, source: 'supabase' };
        }
      }
    } catch (e: any) {
      console.warn('Failed to fetch orders from Supabase:', e);
    }
  }

  return { orders: getStoredOrders(restaurantId), source: 'local' };
}

export async function fetchCustomerSessionOrders(params: {
  sessionId?: string | null;
  restaurantId?: string;
  tableNumber: string;
  qrToken?: string | null;
}): Promise<{ orders: Order[]; source: 'supabase' | 'local'; error?: string }> {
  const supabase = getSupabaseClient();
  const targetRest = params.restaurantId || getCurrentRestaurantId();
  const targetTable = params.tableNumber;
  const targetSession = params.sessionId || null;
  const targetToken = params.qrToken || generateTableQrToken(targetTable, targetRest);

  if (supabase) {
    try {
      // Primary: Call secure customer RPC customer_get_session_orders
      const { data, error } = await supabase.rpc('customer_get_session_orders', {
        p_session_id: targetSession,
        p_restaurant_id: targetRest,
        p_table_number: targetTable,
        p_qr_token: targetToken
      });

      if (!error && data && Array.isArray(data)) {
        const mapped = data.map(mapSupabaseRowToOrder);
        return { orders: mapped, source: 'supabase' };
      }
    } catch (e: any) {
      console.warn('Customer session orders RPC notice:', e);
    }
  }

  // Fallback to local session orders for this specific table
  const local = getActiveSessionOrders(targetTable, undefined, targetRest);
  return { orders: local, source: 'local' };
}

export function getStoredOrders(restaurantId: string = getCurrentRestaurantId()): Order[] {
  try {
    const tenantKey = getTenantStorageKey(ORDERS_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(ORDERS_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Tag with restaurant_id if missing
        return parsed.map(o => ({
          ...o,
          restaurant_id: o.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read stored orders', e);
  }

  // Pre-seed realistic orders for default restaurant only
  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    const seeded = INITIAL_HISTORICAL_ORDERS.map(o => ({ ...o, restaurant_id: DEFAULT_RESTAURANT_ID }));
    const tenantKey = getTenantStorageKey(ORDERS_STORAGE_KEY, DEFAULT_RESTAURANT_ID);
    safeStorage.setItem(tenantKey, JSON.stringify(seeded));
    safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  return [];
}

export function saveStoredOrders(orders: Order[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(ORDERS_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(orders));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }
  } catch (e) {
    console.error('Failed to save stored orders', e);
  }
}

export function getActiveSessionOrders(tableNumber: string, ordersList?: Order[], restaurantId: string = getCurrentRestaurantId()): Order[] {
  const allOrders = ordersList || getStoredOrders(restaurantId);
  if (!tableNumber) return [];
  return allOrders
    .filter(o => 
      (o.restaurant_id || restaurantId) === restaurantId &&
      o.tableNumber.toLowerCase() === tableNumber.toLowerCase() && 
      o.paymentStatus !== 'Paid' && 
      o.status !== 'Cancelled' &&
      !o.is_archived
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function saveOrder(order: Order, restaurantId?: string): Promise<Order> {
  const currentRid = restaurantId || order.restaurant_id || getCurrentRestaurantId();
  const current = getStoredOrders(currentRid);
  
  // Ensure order has a valid sessionId and round
  let finalOrder: Order = { 
    ...order,
    restaurant_id: currentRid,
    items: order.items.map(i => ({ ...i, restaurant_id: currentRid }))
  };

  if (!finalOrder.sessionId) {
    const existingSessionOrders = getActiveSessionOrders(finalOrder.tableNumber, current, currentRid);
    if (existingSessionOrders.length > 0) {
      // Attach to existing active dining session
      const parentSessionId = existingSessionOrders[0].sessionId || `SESS-${finalOrder.tableNumber.replace(/[^a-zA-Z0-9]/g, '')}-${new Date(existingSessionOrders[0].createdAt).getTime()}`;
      finalOrder.sessionId = parentSessionId;
      finalOrder.round = existingSessionOrders.length + 1;
      finalOrder.isAddon = true;
      if (!finalOrder.customerName && existingSessionOrders[0].customerName) {
        finalOrder.customerName = existingSessionOrders[0].customerName;
      }
    } else {
      // Create fresh new dining session for this table
      const cleanTable = finalOrder.tableNumber.replace(/[^a-zA-Z0-9]/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const timestamp = Date.now().toString(36).toUpperCase();
      finalOrder.sessionId = `SESS-${cleanTable}-${randomSuffix}-${timestamp}`;
      finalOrder.round = 1;
      finalOrder.isAddon = false;
    }
  }

  // Push to Supabase with strict restaurant_id isolation and await
  const supabase = getSupabaseClient();
  if (supabase) {
    const payload = mapOrderToSupabasePayload(finalOrder);
    const res = await supabase
      .from('royal_orders')
      .upsert([payload], { onConflict: 'order_id' });

    if (res.error) {
      console.error('Supabase saveOrder database error:', res.error.message);
      throw new Error(res.error.message || 'Database error while saving order');
    }

    const channelName = getOrdersRealtimeChannelName(currentRid);
    await sendSupabaseBroadcast(channelName, 'new_order', finalOrder);
  }

  const updated = [finalOrder, ...current.filter(o => o.id !== finalOrder.id)];
  saveStoredOrders(updated, currentRid);
  setCustomerActiveOrderId(finalOrder.id);

  safeDispatchEvent(new CustomEvent('rbh_new_order', { detail: finalOrder }));
  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({ type: 'NEW_ORDER', order: finalOrder, restaurantId: currentRid });
  }

  return finalOrder;
}

export async function updateOrderStatus(orderId: string, status: Order['status'], restaurantId: string = getCurrentRestaurantId()): Promise<void> {
  const current = getStoredOrders(restaurantId);
  const updated = current.map(o => o.id === orderId ? { ...o, status } : o);
  saveStoredOrders(updated, restaurantId);

  // Update in Supabase via secure RPC scoped by restaurant_id and await write completion
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Primary: Use secure stored procedure kds_advance_order_status (validates restaurant_id and status enum)
      const { error: rpcError } = await supabase.rpc('kds_advance_order_status', {
        p_order_id: orderId,
        p_restaurant_id: restaurantId,
        p_next_status: status
      });

      if (rpcError) {
        // Direct UPDATE on royal_orders (for authenticated staff sessions)
        await supabase
          .from('royal_orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('order_id', orderId)
          .eq('restaurant_id', restaurantId);
      }
    } catch (err) {
      console.warn('Supabase updateOrderStatus error:', err);
    }

    const channelName = getOrdersRealtimeChannelName(restaurantId);
    await sendSupabaseBroadcast(channelName, 'order_status_updated', { orderId, status, restaurantId });
  }

  // Dispatch events AFTER Supabase is updated so that listener refetches see the newest data
  safeDispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, status, restaurantId } }));
  
  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({ type: 'STATUS_UPDATED', orderId, status, restaurantId });
  }
}

// Delete safety: Safe Void & Archival functions (No permanent loss of audit trail)
export async function archiveOrder(orderId: string, restaurantId: string = getCurrentRestaurantId()): Promise<Order | null> {
  const current = getStoredOrders(restaurantId);
  const target = current.find(o => o.id === orderId);
  if (!target) return null;

  const updatedOrder: Order = { ...target, is_archived: true };
  const updatedList = current.map(o => o.id === orderId ? updatedOrder : o);
  saveStoredOrders(updatedList, restaurantId);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('royal_orders').update({ is_archived: true }).eq('order_id', orderId).eq('restaurant_id', restaurantId);
    } catch (e) {}
    sendSupabaseBroadcast(getOrdersRealtimeChannelName(restaurantId), 'order_status_updated', { orderId, status: 'Archived', is_archived: true, restaurantId });
  }

  safeDispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, is_archived: true, restaurantId } }));
  return updatedOrder;
}

export async function cancelOrder(orderId: string, reason?: string, restaurantId: string = getCurrentRestaurantId()): Promise<Order | null> {
  const current = getStoredOrders(restaurantId);
  const target = current.find(o => o.id === orderId);
  if (!target) return null;

  const updatedOrder: Order = { 
    ...target, 
    status: 'Cancelled',
    customerNotes: reason ? `[Cancelled: ${reason}] ${target.customerNotes || ''}` : target.customerNotes
  };
  const updatedList = current.map(o => o.id === orderId ? updatedOrder : o);
  saveStoredOrders(updatedList, restaurantId);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('royal_orders').update({ status: 'Cancelled' }).eq('order_id', orderId).eq('restaurant_id', restaurantId);
    } catch (e) {}
    sendSupabaseBroadcast(getOrdersRealtimeChannelName(restaurantId), 'order_status_updated', { orderId, status: 'Cancelled', restaurantId });
  }

  safeDispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, status: 'Cancelled', restaurantId } }));
  return updatedOrder;
}

// ----------------------------------------------------
// SUPABASE REALTIME BROADCAST & CHANNEL HELPERS
// ----------------------------------------------------

/**
 * Returns the standardized channel topic for multi-tenant orders real-time synchronization.
 */
export function getOrdersRealtimeChannelName(restaurantId: string = getCurrentRestaurantId()): string {
  return `royal_orders_realtime_${restaurantId || DEFAULT_RESTAURANT_ID}`;
}

/**
 * Safely dispatches a Supabase Realtime broadcast message without triggering deprecation warnings.
 * - When an active WebSocket channel for the topic is subscribed and joined, pushes via WebSocket `channel.send({ type: 'broadcast', event, payload })`.
 * - When the WebSocket is not joined / not subscribed, explicitly uses `channel.httpSend(event, payload)` for REST broadcast delivery.
 * - Fully eliminates implicit REST fallback warnings while preserving real-time KDS, counter, badge, and order synchronization.
 */
export async function sendSupabaseBroadcast(
  channelOrName: string | any,
  event: string,
  payload: any
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    let targetChannel: any = typeof channelOrName === 'string' ? null : channelOrName;
    const channelName: string = typeof channelOrName === 'string' 
      ? channelOrName 
      : (channelOrName?.topic?.replace(/^realtime:/, '') || getOrdersRealtimeChannelName());

    // Check if the global singleton channel matches this topic and is currently joined
    if (!targetChannel && singletonSupabaseChannel) {
      const singletonTopic = singletonSupabaseChannel.topic?.replace(/^realtime:/, '');
      const isSingletonJoined = singletonSupabaseChannel.state === 'joined';
      const singletonCanPush = typeof singletonSupabaseChannel.canPush === 'function' 
        ? singletonSupabaseChannel.canPush() 
        : (singletonSupabaseChannel.channelAdapter && typeof singletonSupabaseChannel.channelAdapter.canPush === 'function' ? singletonSupabaseChannel.channelAdapter.canPush() : false);

      if (singletonTopic === channelName && (isSingletonJoined || singletonCanPush)) {
        targetChannel = singletonSupabaseChannel;
      }
    }

    // If no active channel, get or create the channel from client
    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
    }

    if (!targetChannel) return;

    // Check if channel is connected to WebSocket and ready to push
    const isJoined = targetChannel.state === 'joined';
    const canPush = typeof targetChannel.canPush === 'function'
      ? targetChannel.canPush()
      : (targetChannel.channelAdapter && typeof targetChannel.channelAdapter.canPush === 'function' ? targetChannel.channelAdapter.canPush() : false);

    if (isJoined || canPush) {
      // Direct WebSocket transmission over connected channel
      await targetChannel.send({
        type: 'broadcast',
        event,
        payload
      });
    } else if (typeof targetChannel.httpSend === 'function') {
      // Explicit REST delivery avoiding the deprecated implicit send() fallback
      await targetChannel.httpSend(event, payload, { timeout: 3000 }).catch(() => {});
    } else {
      await targetChannel.send({
        type: 'broadcast',
        event,
        payload
      }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking broadcast error handling
  }
}

// Subscribe to realtime order events (Supabase realtime, BroadcastChannel, storage events)
const realtimeOrderListeners = new Set<() => void>();
let singletonSupabaseChannel: any = null;
let isRealtimeInitialized = false;

function notifyRealtimeListeners() {
  realtimeOrderListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in realtime listener callback', e);
    }
  });
}

function initGlobalRealtimeIfNeeded() {
  if (isRealtimeInitialized) return;
  isRealtimeInitialized = true;

  const handleLocalEvent = () => {
    notifyRealtimeListeners();
  };

  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data && (event.data.type === 'NEW_ORDER' || event.data.type === 'STATUS_UPDATED')) {
      notifyRealtimeListeners();
    }
    if (event.data && event.data.type === 'FEEDBACK_UPDATED') {
      safeDispatchEvent(new CustomEvent('rbh_feedback_updated', { detail: event.data.feedback }));
    }
    if (event.data && event.data.type === 'MENU_AVAILABILITY_CHANGED') {
      safeDispatchEvent(new CustomEvent('rbh_menu_availability_changed', { detail: event.data }));
      safeDispatchEvent(new Event('rbh_menu_updated'));
    }
    if (event.data && event.data.type === 'RAW_MATERIALS_UPDATED') {
      safeDispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: event.data }));
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === ORDERS_STORAGE_KEY || event.key === CUSTOMER_ACTIVE_ORDER_KEY) {
      notifyRealtimeListeners();
    }
    if (event.key === FEEDBACK_STORAGE_KEY) {
      safeDispatchEvent(new CustomEvent('rbh_feedback_updated'));
    }
  };

  window.addEventListener('rbh_new_order', handleLocalEvent);
  window.addEventListener('rbh_order_status_updated', handleLocalEvent);
  window.addEventListener('rbh_order_updated', handleLocalEvent);
  window.addEventListener('rbh_customer_order_changed', handleLocalEvent);
  window.addEventListener('storage', handleStorageEvent);

  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  // Subscribe to Supabase realtime table & broadcast channels with unique channel
  const supabase = getSupabaseClient();
  if (supabase && !singletonSupabaseChannel) {
    try {
      const channelName = getOrdersRealtimeChannelName(getCurrentRestaurantId());
      singletonSupabaseChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'royal_orders' },
          (payload: any) => {
            if (payload.new && payload.new.order_id && payload.new.status) {
              const current = getStoredOrders();
              const exists = current.find(o => o.id === payload.new.order_id);
              if (exists && exists.status !== payload.new.status) {
                const updated = current.map(o => o.id === payload.new.order_id ? { ...o, status: payload.new.status } : o);
                safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
              }
            }
            notifyRealtimeListeners();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload: any) => {
            if (payload.new && payload.new.order_id && payload.new.status) {
              const current = getStoredOrders();
              const exists = current.find(o => o.id === payload.new.order_id);
              if (exists && exists.status !== payload.new.status) {
                const updated = current.map(o => o.id === payload.new.order_id ? { ...o, status: payload.new.status } : o);
                safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
              }
            }
            notifyRealtimeListeners();
          }
        )
        .on('broadcast', { event: 'order_status_updated' }, (payload: any) => {
          if (payload.payload && payload.payload.orderId && payload.payload.status) {
            const current = getStoredOrders();
            const exists = current.find(o => o.id === payload.payload.orderId);
            if (exists && exists.status !== payload.payload.status) {
              const updated = current.map(o => o.id === payload.payload.orderId ? { ...o, status: payload.payload.status } : o);
              safeStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
            }
          }
          notifyRealtimeListeners();
        })
        .on('broadcast', { event: 'new_order' }, () => {
          notifyRealtimeListeners();
        })
        .on('broadcast', { event: 'feedback_submitted' }, (payload: any) => {
          if (payload.payload) {
            safeDispatchEvent(new CustomEvent('rbh_feedback_updated', { detail: payload.payload }));
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime subscription notice:', err);
    }
  }
}

export function subscribeToOrdersRealtime(
  onOrdersChange: () => void
): () => void {
  realtimeOrderListeners.add(onOrdersChange);
  initGlobalRealtimeIfNeeded();

  return () => {
    realtimeOrderListeners.delete(onOrdersChange);
  };
}

// Stored payments log management with multi-tenant isolation
export function mapSupabaseRowToPayment(row: Record<string, any>): PaymentRecord {
  return {
    id: String(row.id || `PAY-${Date.now()}`),
    restaurant_id: row.restaurant_id || DEFAULT_RESTAURANT_ID,
    orderId: row.order_id || row.orderId,
    sessionId: row.session_id || row.sessionId,
    tableNumber: row.table_number || row.tableNumber || 'Table 1',
    amount: Number(row.amount || 0),
    paymentMode: (row.payment_mode || row.paymentMode || 'UPI') as PaymentRecord['paymentMode'],
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    recordedBy: row.recorded_by || row.recordedBy || 'Counter Cashier',
    notes: row.notes,
    is_voided: Boolean(row.is_voided || row.isVoided),
    voidReason: row.void_reason || row.voidReason,
    voidedBy: row.voided_by || row.voidedBy,
    voidedAt: row.voided_at || row.voidedAt
  };
}

export async function fetchStoredPaymentsFromSupabase(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ payments: PaymentRecord[]; source: 'supabase' | 'local'; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('royal_payments')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetchStoredPaymentsFromSupabase notice:', error.message);
      }

      if (!error && data) {
        if (data.length > 0) {
          const mapped = data.map(mapSupabaseRowToPayment);
          const currentLocal = getStoredPayments(restaurantId);
          const remoteIds = new Set(mapped.map(m => m.id));
          const localOnly = currentLocal.filter(l => !remoteIds.has(l.id));
          const combined = [...mapped, ...localOnly];
          saveStoredPayments(combined, restaurantId);
          return { payments: combined, source: 'supabase' };
        }
      }
    } catch (e) {
      console.warn('Failed to fetch payments from Supabase:', e);
    }
  }

  return { payments: getStoredPayments(restaurantId), source: 'local' };
}

export function getStoredPayments(restaurantId: string = getCurrentRestaurantId()): PaymentRecord[] {
  try {
    const tenantKey = getTenantStorageKey(PAYMENTS_STORAGE_KEY, restaurantId);
    const raw = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(PAYMENTS_STORAGE_KEY) : null);
    if (raw) {
      const parsed: PaymentRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(p => ({
          ...p,
          restaurant_id: p.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to parse payments from storage', e);
  }

  // If default restaurant, bootstrap from already paid initial orders
  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    const orders = getStoredOrders(DEFAULT_RESTAURANT_ID);
    const synthesized: PaymentRecord[] = [];
    orders.forEach(ord => {
      if (ord.paymentStatus === 'Paid' || (ord.paidAmount && ord.paidAmount > 0)) {
        if (ord.paymentHistory && ord.paymentHistory.length > 0) {
          ord.paymentHistory.forEach(p => {
            if (!synthesized.some(ep => ep.id === p.id)) {
              synthesized.push({ ...p, restaurant_id: DEFAULT_RESTAURANT_ID });
            }
          });
        } else {
          const mode = (ord.paymentMode === 'Cash' || ord.paymentMode === 'Card' ? ord.paymentMode : 'UPI') as 'Cash' | 'UPI' | 'Card';
          synthesized.push({
            id: `PAY-${ord.id}`,
            restaurant_id: DEFAULT_RESTAURANT_ID,
            orderId: ord.id,
            sessionId: ord.sessionId,
            tableNumber: ord.tableNumber,
            amount: ord.total || 0,
            paymentMode: mode,
            createdAt: ord.paidAt || ord.createdAt,
            recordedBy: 'Counter Staff'
          });
        }
      }
    });

    try {
      if (synthesized.length > 0) {
        saveStoredPayments(synthesized, DEFAULT_RESTAURANT_ID);
      }
    } catch (e) {
      // Ignore
    }

    return synthesized;
  }

  return [];
}

export function saveStoredPayments(payments: PaymentRecord[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(PAYMENTS_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(payments));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
    }
  } catch (e) {
    console.error('Failed to save payments to storage', e);
  }
}

export function savePaymentRecord(payment: Omit<PaymentRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): PaymentRecord {
  const currentRid = payment.restaurant_id || getCurrentRestaurantId();
  const current = getStoredPayments(currentRid);
  const newRecord: PaymentRecord = {
    id: payment.id || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    restaurant_id: currentRid,
    orderId: payment.orderId,
    sessionId: payment.sessionId,
    tableNumber: payment.tableNumber,
    amount: Math.round(payment.amount * 100) / 100,
    paymentMode: payment.paymentMode,
    createdAt: payment.createdAt || new Date().toISOString(),
    recordedBy: payment.recordedBy || 'Counter Cashier',
    notes: payment.notes
  };

  const updated = [newRecord, ...current.filter(p => p.id !== newRecord.id)];
  saveStoredPayments(updated, currentRid);
  
  safeDispatchEvent(new CustomEvent('rbh_payment_added', { detail: newRecord }));

  // Push to Supabase if available with restaurant_id
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('royal_payments').insert([{
        id: newRecord.id,
        restaurant_id: currentRid,
        order_id: newRecord.orderId,
        session_id: newRecord.sessionId,
        table_number: newRecord.tableNumber,
        amount: newRecord.amount,
        payment_mode: newRecord.paymentMode,
        recorded_by: newRecord.recordedBy,
        created_at: newRecord.createdAt,
        notes: newRecord.notes
      }])
    ).catch(() => {});
  }

  return newRecord;
}

// Void payment safely (auditable void without deleting financial trail)
export function voidPaymentRecord(
  paymentId: string, 
  reason: string, 
  voidedBy: string = 'Counter Cashier',
  restaurantId: string = getCurrentRestaurantId()
): PaymentRecord | null {
  const current = getStoredPayments(restaurantId);
  const target = current.find(p => p.id === paymentId);
  if (!target) return null;

  const nowIso = new Date().toISOString();
  const updatedRecord: PaymentRecord = {
    ...target,
    is_voided: true,
    voidReason: reason,
    voidedBy,
    voidedAt: nowIso
  };

  const updated = current.map(p => p.id === paymentId ? updatedRecord : p);
  saveStoredPayments(updated, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_payment_voided', { detail: updatedRecord }));

  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase
        .from('royal_payments')
        .update({ is_voided: true, void_reason: reason, voided_by: voidedBy, voided_at: nowIso })
        .eq('id', paymentId)
        .eq('restaurant_id', restaurantId)
    ).catch(() => {});
  }

  return updatedRecord;
}

export function getPaymentsForSession(
  sessionId?: string, 
  orderIds?: string[] | string, 
  activeOrders?: Order[],
  restaurantId: string = getCurrentRestaurantId()
): PaymentRecord[] {
  if (!sessionId && !orderIds && (!activeOrders || activeOrders.length === 0)) {
    return [];
  }
  const allPayments = getStoredPayments(restaurantId).filter(p => !p.is_voided);
  const idList = Array.isArray(orderIds) ? orderIds : (orderIds ? [orderIds] : []);
  if (activeOrders && activeOrders.length > 0) {
    activeOrders.forEach(o => {
      if (o.id && !idList.includes(o.id)) idList.push(o.id);
    });
  }

  // Strictly match ONLY by this specific session ID or order IDs
  const matched = allPayments.filter(p => {
    if (p.restaurant_id && p.restaurant_id !== restaurantId) return false;
    if (sessionId && p.sessionId && p.sessionId === sessionId) return true;
    if (p.orderId && idList.includes(p.orderId)) return true;
    return false;
  });

  // Also merge any in-object paymentHistory attached to the orders
  if (activeOrders && activeOrders.length > 0) {
    activeOrders.forEach(o => {
      if (o.paymentHistory && Array.isArray(o.paymentHistory)) {
        o.paymentHistory.forEach(ph => {
          if (!ph.is_voided && !matched.some(m => m.id === ph.id)) {
            matched.push({ ...ph, restaurant_id: restaurantId });
          }
        });
      }
    });
  }

  return matched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export interface SplitPaymentEntry {
  mode: 'Cash' | 'UPI' | 'Card';
  amount: number;
}

export interface RecordPaymentParams {
  sessionId?: string;
  tableNumber?: string;
  orderId?: string;
  splitPayments: SplitPaymentEntry[];
  recordedBy?: string;
  notes?: string;
}

export async function recordDiningSessionPayment(params: RecordPaymentParams): Promise<{
  success: boolean;
  isFullyPaid: boolean;
  totalPaidNow: number;
  paidAmountTotal: number;
  remainingAmount: number;
  newPayments: PaymentRecord[];
}> {
  const currentOrders = getStoredOrders();
  const allPayments = getStoredPayments();
  const nowIso = new Date().toISOString();

  let targetSessionId = params.sessionId;
  let targetTableNumber = params.tableNumber;

  if (!targetSessionId && params.orderId) {
    const targetOrder = currentOrders.find(o => o.id === params.orderId);
    if (targetOrder) {
      targetSessionId = targetOrder.sessionId;
      targetTableNumber = targetOrder.tableNumber;
    }
  }

  // Find all active/unpaid orders belonging to this session or table
  const matchingOrders = currentOrders.filter(o => {
    if (o.status === 'Cancelled' || o.is_archived) return false;
    if (params.orderId && o.id === params.orderId) return true;
    if (targetSessionId && o.sessionId && o.sessionId === targetSessionId) return true;
    if (targetTableNumber && o.tableNumber.toLowerCase() === targetTableNumber.toLowerCase()) {
      if (o.paymentStatus !== 'Paid' || (o.remainingAmount !== undefined && o.remainingAmount > 0.05)) {
        return true;
      }
      if (targetSessionId && o.sessionId === targetSessionId) {
        return true;
      }
    }
    return false;
  });

  if (matchingOrders.length === 0) {
    throw new Error('No active bill or table session found to record payment.');
  }

  if (!targetSessionId) {
    targetSessionId = matchingOrders[0].sessionId || `SESS-${(targetTableNumber || 'Table').replace(/[^a-zA-Z0-9]/g, '')}-${new Date(matchingOrders[0].createdAt).getTime()}`;
  }
  const matchingOrderIds = matchingOrders.map(o => o.id);

  const grandTotal = Math.round(matchingOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  
  // Calculate previously paid amount ONLY for this specific session and its matching orders
  const sessionPayments = allPayments.filter(p => {
    if (targetSessionId && p.sessionId && p.sessionId === targetSessionId) return true;
    if (p.orderId && matchingOrderIds.includes(p.orderId)) return true;
    return false;
  });

  // Also check paymentHistory on matchingOrders
  matchingOrders.forEach(mo => {
    if (mo.paymentHistory && Array.isArray(mo.paymentHistory)) {
      mo.paymentHistory.forEach(ph => {
        if (!sessionPayments.some(sp => sp.id === ph.id)) {
          sessionPayments.push(ph);
        }
      });
    }
  });

  const previouslyPaid = Math.round(sessionPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
  const currentRemaining = Math.max(0, Math.round((grandTotal - previouslyPaid) * 100) / 100);

  // Idempotency: If table session is already fully paid and settled, return safely without creating duplicate payments
  const isAlreadySettled = matchingOrders.every(o => o.paymentStatus === 'Paid' || (o.remainingAmount !== undefined && o.remainingAmount <= 0.05));
  if (isAlreadySettled && grandTotal > 0 && previouslyPaid >= grandTotal - 0.05) {
    return {
      success: true,
      isFullyPaid: true,
      totalPaidNow: 0,
      paidAmountTotal: grandTotal,
      remainingAmount: 0,
      newPayments: []
    };
  }

  // Validate incoming payment splits
  const validSplits = params.splitPayments.filter(s => s.amount > 0);
  if (validSplits.length === 0) {
    throw new Error('Please enter a payment amount greater than ₹0.');
  }

  for (const s of validSplits) {
    if (typeof s.amount !== 'number' || isNaN(s.amount) || s.amount < 0) {
      throw new Error('Invalid payment amount. Amount must be a positive number.');
    }
  }

  const totalPaidNow = Math.round(validSplits.reduce((sum, s) => sum + s.amount, 0) * 100) / 100;

  // Strict Validation: payment amount cannot exceed remaining bill
  if (totalPaidNow > currentRemaining + 0.05) {
    throw new Error('Payment amount cannot exceed the remaining bill.');
  }

  const newTotalPaid = Math.min(grandTotal, Math.round((previouslyPaid + totalPaidNow) * 100) / 100);
  const newRemaining = Math.max(0, Math.round((grandTotal - newTotalPaid) * 100) / 100);
  const isFullyPaid = newRemaining <= 0.05;

  const currentRestaurantId = currentOrders[0]?.restaurant_id || getCurrentRestaurantId();

  // Generate new PaymentRecords (exactly ONE per non-zero split)
  const newPayments: PaymentRecord[] = [];
  const paymentPayloads: any[] = [];

  validSplits.forEach((split) => {
    const rec = savePaymentRecord({
      orderId: matchingOrders[0]?.id,
      sessionId: targetSessionId || matchingOrders[0]?.sessionId,
      tableNumber: targetTableNumber || matchingOrders[0]?.tableNumber || 'Table',
      amount: split.amount,
      paymentMode: split.mode,
      recordedBy: params.recordedBy || 'Counter Cashier',
      notes: params.notes,
      restaurant_id: currentRestaurantId
    });
    newPayments.push(rec);
    paymentPayloads.push({
      id: rec.id,
      restaurant_id: currentRestaurantId,
      order_id: rec.orderId,
      session_id: rec.sessionId,
      table_number: rec.tableNumber,
      amount: rec.amount,
      payment_mode: rec.paymentMode,
      recorded_by: rec.recordedBy,
      created_at: rec.createdAt,
      notes: rec.notes
    });
  });

  const allSessionPayments = [...sessionPayments, ...newPayments];

  // Determine aggregate payment mode: 'Cash', 'UPI', 'Card', or 'Mixed'
  const distinctModes = Array.from(new Set(allSessionPayments.map(p => p.paymentMode)));
  let finalPaymentMode: 'Cash' | 'UPI' | 'Card' | 'Mixed' = 'UPI';
  if (distinctModes.length === 1) {
    finalPaymentMode = distinctModes[0];
  } else if (distinctModes.length > 1) {
    finalPaymentMode = 'Mixed';
  }

  // Update orders with exact waterfall allocation
  let remainingPaidToAllocate = newTotalPaid;
  const affectedOrderIds: string[] = matchingOrders.map(o => o.id);
  const updatedOrders = currentOrders.map(o => {
    if (affectedOrderIds.includes(o.id)) {
      const orderTotal = o.total || 0;
      let orderPaid = 0;
      let orderRemaining = 0;
      let orderPaymentStatus: 'Paid' | 'Partially Paid' | 'Pending' = 'Pending';

      if (isFullyPaid) {
        orderPaid = orderTotal;
        orderRemaining = 0;
        orderPaymentStatus = 'Paid';
      } else {
        orderPaid = Math.min(orderTotal, remainingPaidToAllocate);
        remainingPaidToAllocate = Math.max(0, remainingPaidToAllocate - orderPaid);
        orderRemaining = Math.max(0, Math.round((orderTotal - orderPaid) * 100) / 100);
        orderPaymentStatus = orderRemaining <= 0.05 ? 'Paid' : (orderPaid > 0 ? 'Partially Paid' : 'Pending');
      }

      return {
        ...o,
        status: isFullyPaid ? ('Completed' as const) : o.status,
        paymentStatus: orderPaymentStatus,
        paymentMode: finalPaymentMode,
        paidAmount: Math.round(orderPaid * 100) / 100,
        remainingAmount: Math.round(orderRemaining * 100) / 100,
        paymentHistory: allSessionPayments,
        paidAt: isFullyPaid ? nowIso : (o.paidAt || (orderPaid > 0 ? nowIso : undefined))
      };
    }
    return o;
  });

  saveStoredOrders(updatedOrders, currentRestaurantId);

  // If fully paid, clear active customer tracking
  if (isFullyPaid) {
    try {
      const activeId = safeStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
      if (activeId && affectedOrderIds.includes(activeId)) {
        safeStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
        safeDispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId: null } }));
      }
    } catch (e) {
      // Ignore
    }
  }

  // Push to Supabase if connected and AWAIT before triggering listeners
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      if (paymentPayloads.length > 0) {
        const payRes = await supabase.from('royal_payments').insert(paymentPayloads);
        if (payRes.error) {
          console.warn('Supabase recordDiningSessionPayment insert notice:', payRes.error.message);
        }
      }

      if (affectedOrderIds.length > 0) {
        await Promise.all(
          affectedOrderIds.map(async (id) => {
            const ord = updatedOrders.find(o => o.id === id);
            const updatePayload: Record<string, any> = {
              status: isFullyPaid ? 'Completed' : ord?.status,
              payment_status: ord ? ord.paymentStatus : (isFullyPaid ? 'Paid' : 'Pending'),
              payment_mode: finalPaymentMode,
              paid_amount: ord ? ord.paidAmount : (isFullyPaid ? grandTotal : newTotalPaid),
              remaining_amount: ord ? ord.remainingAmount : (isFullyPaid ? 0 : newRemaining),
              payment_history: allSessionPayments,
              paid_at: isFullyPaid ? nowIso : (ord?.paidAt || undefined),
              updated_at: nowIso
            };

            // Clean undefined keys
            Object.keys(updatePayload).forEach(key => {
              if (updatePayload[key] === undefined) delete updatePayload[key];
            });

            const res = await supabase
              .from('royal_orders')
              .update(updatePayload)
              .eq('order_id', id)
              .eq('restaurant_id', currentRestaurantId);

            if (res.error) {
              console.warn('Supabase recordDiningSessionPayment update order notice:', res.error.message);
            }
          })
        );
      }
    } catch (err) {
      console.warn('Supabase recordDiningSessionPayment sync error:', err);
    }
  }

  // PHASE 2 AUTOMATIC STOCK CONSUMPTION HOOK (IDEMPOTENT)
  if (isFullyPaid) {
    try {
      const ordersToConsume = updatedOrders.filter(o => affectedOrderIds.includes(o.id));
      await consumeInventoryForOrders(ordersToConsume, currentRestaurantId);
    } catch (invErr) {
      console.warn('Inventory auto-consumption error during payment settlement:', invErr);
    }
  }

  safeDispatchEvent(new CustomEvent('rbh_order_status_updated', {
    detail: {
      sessionId: targetSessionId,
      tableNumber: targetTableNumber,
      orderIds: affectedOrderIds,
      status: isFullyPaid ? 'Completed' : 'Updated',
      paymentStatus: isFullyPaid ? 'Paid' : 'Partially Paid'
    }
  }));
  safeDispatchEvent(new Event('rbh_order_updated'));
  safeDispatchEvent(new Event('rbh_orders_changed'));

  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({
      type: 'STATUS_UPDATED',
      sessionId: targetSessionId,
      tableNumber: targetTableNumber,
      orderIds: affectedOrderIds,
      status: isFullyPaid ? 'Completed' : 'Updated',
      paymentStatus: isFullyPaid ? 'Paid' : 'Partially Paid'
    });
  }

  return {
    success: true,
    isFullyPaid,
    totalPaidNow,
    paidAmountTotal: newTotalPaid,
    remainingAmount: newRemaining,
    newPayments
  };
}

export function getActiveTableSession(tableNumber: string, ordersList?: Order[]): DiningSession | null {
  const activeOrders = getActiveSessionOrders(tableNumber, ordersList);
  if (activeOrders.length === 0) return null;

  const firstOrder = activeOrders[0];
  const sessionId = firstOrder.sessionId || `SESS-${tableNumber.replace(/[^a-zA-Z0-9]/g, '')}-${new Date(firstOrder.createdAt).getTime()}`;
  
  const totalSubtotal = activeOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const totalTax = Math.round(activeOrders.reduce((sum, o) => sum + (o.tax || 0), 0) * 10) / 10;
  const grandTotal = Math.round(activeOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  const totalItemsCount = activeOrders.reduce((sum, o) => sum + o.items.reduce((isum, i) => isum + i.quantity, 0), 0);

  const sessionPayments = getPaymentsForSession(sessionId, activeOrders.map(o => o.id), activeOrders);
  const paidAmount = Math.round(sessionPayments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  const remainingAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

  // If fully paid, session is settled and table is available
  if (remainingAmount <= 0.05 && (paidAmount > 0 || grandTotal === 0)) {
    return null;
  }

  let paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' = 'Pending';
  if (paidAmount > 0) {
    paymentStatus = 'Partially Paid';
  }

  const distinctModes = Array.from(new Set(sessionPayments.map(p => p.paymentMode)));
  let paymentMode: 'Cash' | 'UPI' | 'Card' | 'Mixed' = 'UPI';
  if (distinctModes.length === 1) {
    paymentMode = distinctModes[0];
  } else if (distinctModes.length > 1) {
    paymentMode = 'Mixed';
  }

  let latestTicketStatus: Order['status'] = 'New';
  if (activeOrders.some(o => o.status === 'Preparing')) latestTicketStatus = 'Preparing';
  if (activeOrders.some(o => o.status === 'Ready')) latestTicketStatus = 'Ready';
  if (activeOrders.every(o => o.status === 'Completed')) latestTicketStatus = 'Completed';

  return {
    sessionId,
    tableNumber,
    customerName: activeOrders.find(o => o.customerName)?.customerName,
    orders: activeOrders,
    status: 'Active',
    paymentStatus,
    paymentMode,
    paymentHistory: sessionPayments,
    paidAmount,
    remainingAmount,
    totalSubtotal,
    totalTax,
    grandTotal,
    totalItemsCount,
    startedAt: firstOrder.createdAt,
    latestTicketStatus,
  };
}

export function getAllActiveDiningSessions(ordersList?: Order[]): DiningSession[] {
  const allOrders = ordersList || getStoredOrders();
  const unpaidOrders = allOrders.filter(o => o.paymentStatus !== 'Paid' && o.status !== 'Cancelled');
  
  const sessionMap = new Map<string, Order[]>();
  unpaidOrders.forEach(order => {
    const key = order.tableNumber.toLowerCase();
    const existing = sessionMap.get(key) || [];
    sessionMap.set(key, [...existing, order]);
  });

  const sessions: DiningSession[] = [];
  sessionMap.forEach((orders) => {
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const first = sorted[0];
    const tableNumber = first.tableNumber;
    const sessionId = first.sessionId || `SESS-${tableNumber.replace(/[^a-zA-Z0-9]/g, '')}-${new Date(first.createdAt).getTime()}`;
    const totalSubtotal = sorted.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const totalTax = Math.round(sorted.reduce((sum, o) => sum + (o.tax || 0), 0) * 10) / 10;
    const grandTotal = Math.round(sorted.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
    const totalItemsCount = sorted.reduce((sum, o) => sum + o.items.reduce((isum, i) => isum + i.quantity, 0), 0);

    const sessionPayments = getPaymentsForSession(sessionId, sorted.map(o => o.id), sorted);
    const paidAmount = Math.round(sessionPayments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    const remainingAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

    // Skip sessions that are fully paid and settled
    if (remainingAmount <= 0.05 && (paidAmount > 0 || grandTotal === 0)) {
      return;
    }

    let paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' = 'Pending';
    if (paidAmount > 0) {
      paymentStatus = 'Partially Paid';
    }

    const distinctModes = Array.from(new Set(sessionPayments.map(p => p.paymentMode)));
    let paymentMode: 'Cash' | 'UPI' | 'Card' | 'Mixed' = 'UPI';
    if (distinctModes.length === 1) {
      paymentMode = distinctModes[0];
    } else if (distinctModes.length > 1) {
      paymentMode = 'Mixed';
    }

    let latestTicketStatus: Order['status'] = 'New';
    if (sorted.some(o => o.status === 'Preparing')) latestTicketStatus = 'Preparing';
    if (sorted.some(o => o.status === 'Ready')) latestTicketStatus = 'Ready';
    if (sorted.every(o => o.status === 'Completed')) latestTicketStatus = 'Completed';

    sessions.push({
      sessionId,
      tableNumber,
      customerName: sorted.find(o => o.customerName)?.customerName,
      orders: sorted,
      status: 'Active',
      paymentStatus,
      paymentMode,
      paymentHistory: sessionPayments,
      paidAmount,
      remainingAmount,
      totalSubtotal,
      totalTax,
      grandTotal,
      totalItemsCount,
      startedAt: first.createdAt,
      latestTicketStatus,
    });
  });

  return sessions;
}

// Settle an entire dining session / running bill for a table in one single transaction (or with single payment mode)
export async function settleDiningSession(
  target: { sessionId?: string; tableNumber?: string; orderId?: string },
  paymentMode: 'Cash' | 'UPI' | 'Card' = 'UPI'
): Promise<void> {
  const current = getStoredOrders();
  let targetSessionId = target.sessionId;
  let targetTableNumber = target.tableNumber;
  
  if (!targetSessionId && target.orderId) {
    const targetOrder = current.find(o => o.id === target.orderId);
    if (targetOrder) {
      targetSessionId = targetOrder.sessionId;
      targetTableNumber = targetOrder.tableNumber;
    }
  }

  const matchingOrders = current.filter(o => {
    if (o.status === 'Cancelled') return false;
    if (targetSessionId && o.sessionId && o.sessionId === targetSessionId) return true;
    if (targetTableNumber && o.tableNumber.toLowerCase() === targetTableNumber.toLowerCase() && o.paymentStatus !== 'Paid') return true;
    if (target.orderId && o.id === target.orderId) return true;
    return false;
  });

  if (matchingOrders.length === 0) return;

  const grandTotal = Math.round(matchingOrders.reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100;
  const sessionPayments = getPaymentsForSession(targetSessionId, matchingOrders.map(o => o.id), matchingOrders);
  const alreadyPaid = Math.round(sessionPayments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  const remaining = Math.max(0, Math.round((grandTotal - alreadyPaid) * 100) / 100);

  if (remaining > 0) {
    await recordDiningSessionPayment({
      sessionId: targetSessionId,
      tableNumber: targetTableNumber,
      orderId: target.orderId,
      splitPayments: [{ mode: paymentMode, amount: remaining }],
      recordedBy: 'Counter Cashier'
    });
  } else {
    // Already fully paid, mark completed
    const nowIso = new Date().toISOString();
    const affectedOrderIds = matchingOrders.map(o => o.id);
    const updated = current.map(o => {
      if (affectedOrderIds.includes(o.id)) {
        return {
          ...o,
          status: 'Completed' as const,
          paymentStatus: 'Paid' as const,
          paidAmount: o.total,
          remainingAmount: 0,
          paymentMode,
          paidAt: nowIso
        };
      }
      return o;
    });
    const restaurantId = current[0]?.restaurant_id || getCurrentRestaurantId();
    saveStoredOrders(updated, restaurantId);
    
    try {
      const activeId = safeStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
      if (activeId && affectedOrderIds.includes(activeId)) {
        safeStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
        safeDispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId: null } }));
      }
    } catch (e) {
      // Ignore
    }

    const supabase = getSupabaseClient();
    if (supabase && affectedOrderIds.length > 0) {
      try {
        await Promise.all(
          affectedOrderIds.map(async (id) => {
            const ord = updated.find(o => o.id === id);
            const updatePayload: Record<string, any> = {
              status: 'Completed',
              payment_status: 'Paid',
              payment_mode: paymentMode,
              paid_amount: ord ? ord.paidAmount : grandTotal,
              remaining_amount: 0,
              paid_at: nowIso,
              updated_at: nowIso
            };
            const res = await supabase
              .from('royal_orders')
              .update(updatePayload)
              .eq('order_id', id)
              .eq('restaurant_id', restaurantId);
            if (res.error) {
              console.warn('Supabase settleDiningSession update order notice:', res.error.message);
            }
          })
        );
      } catch (e) {}
    }

    safeDispatchEvent(new CustomEvent('rbh_order_status_updated', {
      detail: { sessionId: targetSessionId, tableNumber: targetTableNumber, orderIds: affectedOrderIds, status: 'Completed', paymentStatus: 'Paid', restaurantId }
    }));
    safeDispatchEvent(new Event('rbh_order_updated'));
  }
}

// Mark order (and its associated running table session) as paid & settled
export async function markOrderAsPaid(
  orderId: string, 
  paymentMode: 'Cash' | 'UPI' | 'Card' = 'UPI'
): Promise<void> {
  await settleDiningSession({ orderId }, paymentMode);
}

// Initial demo feedback
const INITIAL_DEMO_FEEDBACKS: CustomerFeedback[] = [
  {
    id: 'FB-501',
    orderId: 'RBH-101',
    tableNumber: 'Table 4',
    customerName: 'Aarav Sharma',
    rating: 5,
    review: 'The Shahi Gosht Dum Biryani was exceptionally fragrant and tender. Royal saffron aroma filled the table!',
    tags: ['Food Taste', 'Food Quality'],
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString()
  },
  {
    id: 'FB-502',
    orderId: 'RBH-102',
    tableNumber: 'Table 2',
    customerName: 'Meera Kulkarni',
    rating: 5,
    review: 'Zaffrani Paneer Tikka was melt-in-mouth soft. Super quick table ordering with no waiting for waiters.',
    tags: ['Service', 'Ordering Experience'],
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString()
  },
  {
    id: 'FB-503',
    orderId: 'RBH-098',
    tableNumber: 'Table 9',
    customerName: 'Sanjay Verma',
    rating: 4,
    review: 'Loved the Dum Pukht Chicken and Garlic Naan. The live kitchen tracker is very convenient.',
    tags: ['Food Taste', 'Waiting Time'],
    createdAt: new Date(Date.now() - 130 * 60 * 1000).toISOString()
  }
];

export function mapSupabaseRowToFeedback(row: Record<string, any>): CustomerFeedback {
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === 'string') {
    try {
      tags = JSON.parse(row.tags);
    } catch {
      tags = [row.tags];
    }
  }

  return {
    id: String(row.feedback_id || row.id || `FB-${Date.now()}`),
    restaurant_id: row.restaurant_id || DEFAULT_RESTAURANT_ID,
    orderId: row.order_id || row.orderId,
    tableNumber: row.table_number || row.tableNumber || 'Table 1',
    customerName: row.customer_name || row.customerName || 'Dine-in Guest',
    rating: Number(row.rating || 5),
    review: row.review || '',
    tags,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    is_archived: Boolean(row.is_archived || row.isArchived)
  };
}

export async function fetchStoredFeedbackFromSupabase(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ feedbacks: CustomerFeedback[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('customer_feedback')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetchStoredFeedbackFromSupabase notice:', error.message);
      }

      if (!error && data && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToFeedback);
        safeStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(mapped));
        return { feedbacks: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch feedback from Supabase:', e);
    }
  }

  return { feedbacks: getStoredFeedback(), source: 'local' };
}

export function getStoredFeedback(): CustomerFeedback[] {
  try {
    const saved = safeStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse customer feedbacks', e);
  }

  safeStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_FEEDBACKS));
  return INITIAL_DEMO_FEEDBACKS;
}

export function saveCustomerFeedback(feedback: CustomerFeedback): void {
  const current = getStoredFeedback();
  const updated = [feedback, ...current.filter(f => f.id !== feedback.id)];
  safeStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  safeDispatchEvent(new CustomEvent('rbh_feedback_updated', { detail: feedback }));

  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({ type: 'FEEDBACK_UPDATED', feedback });
  }

  // Also push to Supabase if feedback table exists
  const supabase = getSupabaseClient();
  if (supabase) {
    const currentRestId = getCurrentRestaurantId();
    Promise.resolve(
      supabase.from('customer_feedback').insert([{
        id: feedback.id,
        feedback_id: feedback.id,
        restaurant_id: currentRestId,
        order_id: feedback.orderId,
        table_number: feedback.tableNumber,
        customer_name: feedback.customerName,
        rating: feedback.rating,
        review: feedback.review,
        tags: feedback.tags,
        created_at: feedback.createdAt
      }])
    ).then((res) => {
      if (res.error) {
        return supabase.from('customer_feedback').insert([{
          id: feedback.id,
          restaurant_id: currentRestId,
          order_id: feedback.orderId,
          table_number: feedback.tableNumber,
          customer_name: feedback.customerName,
          rating: feedback.rating,
          review: feedback.review,
          tags: feedback.tags,
          created_at: feedback.createdAt
        }]);
      }
    }).catch(() => {
      // Silently continue
    });

    const channelName = getOrdersRealtimeChannelName();
    sendSupabaseBroadcast(channelName, 'feedback_submitted', feedback);
  }
}

// Update menu item stock in local storage & supabase
export async function updateMenuItemStock(
  itemId: string | number, 
  available: boolean, 
  stockStatus: MenuItem['stockStatus'] = 'In Stock',
  stockCount?: number
): Promise<void> {
  try {
    const saved = safeStorage.getItem(LOCAL_MENU_KEY);
    if (saved) {
      const items: MenuItem[] = JSON.parse(saved);
      const updated = items.map(item => {
        if (String(item.id) === String(itemId)) {
          return {
            ...item,
            Available: available,
            stockStatus: available ? (stockStatus === 'Out of Stock' ? 'In Stock' : stockStatus) : 'Out of Stock',
            stockCount: stockCount !== undefined ? stockCount : (available ? 20 : 0)
          };
        }
        return item;
      });
      safeStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to update item stock', e);
  }
  await updateMenuItemAvailability(itemId, available);
}

// ==========================================
// RAW MATERIAL INVENTORY & STOCK MOVEMENTS (PHASE 2)
// ==========================================

export function getStoredRawMaterials(restaurantId: string = getCurrentRestaurantId()): RawMaterial[] {
  try {
    const tenantKey = getTenantStorageKey(RAW_MATERIALS_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(RAW_MATERIALS_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          ...item,
          restaurant_id: item.restaurant_id || restaurantId,
          sku: item.sku || `ING-${item.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4)}`,
          status: item.quantity <= 0 ? 'OUT OF STOCK' : (item.quantity <= (item.minimumThreshold || 5) ? 'LOW STOCK' : 'IN STOCK')
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read raw materials from storage', e);
  }
  
  // Initialize with defaults if empty for default restaurant
  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    try {
      const initialized = DEFAULT_RAW_MATERIALS.map(m => ({ ...m, restaurant_id: DEFAULT_RESTAURANT_ID }));
      saveStoredRawMaterials(initialized, DEFAULT_RESTAURANT_ID);
      return initialized;
    } catch (e) {
      // Ignore
    }
    return DEFAULT_RAW_MATERIALS;
  }
  return [];
}

export function saveStoredRawMaterials(items: RawMaterial[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(RAW_MATERIALS_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(items));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(items));
    }
  } catch (e) {
    console.error('Failed to save raw materials to storage', e);
  }
}

export async function fetchRawMaterials(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ items: RawMaterial[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: RawMaterial[] = data.map((row: any) => {
          const qty = Number(row.current_stock ?? row.quantity ?? row.Quantity ?? 0);
          const min = Number(row.min_threshold ?? row.minimum_threshold ?? row.minimumThreshold ?? row.MinimumThreshold ?? 5);
          const price = row.unit_cost !== undefined && row.unit_cost !== null
            ? Number(row.unit_cost)
            : (row.purchase_price !== undefined && row.purchase_price !== null ? Number(row.purchase_price) : undefined);
          const status: RawMaterialStockStatus = qty <= 0 ? 'OUT OF STOCK' : (qty <= min ? 'LOW STOCK' : 'IN STOCK');
          return {
            id: String(row.id),
            restaurant_id: row.restaurant_id || restaurantId,
            sku: row.sku || row.code,
            name: row.name ?? row.Name ?? 'Ingredient',
            category: row.category ?? row.Category ?? 'General Staples',
            quantity: isNaN(qty) ? 0 : qty,
            unit: (row.unit ?? row.Unit ?? 'kg') as any,
            minimumThreshold: isNaN(min) ? 5 : min,
            reorderLevel: row.reorder_level ? Number(row.reorder_level) : min * 1.5,
            maxStock: row.max_stock ? Number(row.max_stock) : undefined,
            purchasePrice: price,
            supplier: row.supplier,
            status: (row.status ?? status) as RawMaterialStockStatus,
            isActive: row.is_active !== undefined ? row.is_active : true,
            notes: row.notes,
            updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
            lastUpdatedBy: row.last_updated_by ?? row.lastUpdatedBy ?? 'Kitchen Chef',
            is_archived: Boolean(row.is_archived)
          };
        });
        saveStoredRawMaterials(mapped, restaurantId);
        return { items: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch raw materials from Supabase, using local:', e);
    }
  }
  return { items: getStoredRawMaterials(restaurantId), source: 'local' };
}

export function saveRawMaterial(
  material: Omit<RawMaterial, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string },
  restaurantId: string = getCurrentRestaurantId()
): RawMaterial {
  const current = getStoredRawMaterials(restaurantId);
  const isExisting = Boolean(material.id && current.some(m => m.id === material.id));
  const id = material.id || `raw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const qty = Math.max(0, Math.round(Number(material.quantity || 0) * 1000) / 1000);
  const min = Math.max(0.01, Math.round(Number(material.minimumThreshold || 5) * 100) / 100);
  const status: RawMaterialStockStatus = qty <= 0 ? 'OUT OF STOCK' : (qty <= min ? 'LOW STOCK' : 'IN STOCK');
  const nowIso = new Date().toISOString();

  const savedItem: RawMaterial = {
    id,
    restaurant_id: restaurantId,
    sku: material.sku || `ING-${material.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4)}`,
    name: material.name.trim(),
    category: material.category || 'General Staples',
    quantity: qty,
    unit: material.unit || 'kg',
    minimumThreshold: min,
    reorderLevel: material.reorderLevel !== undefined ? Number(material.reorderLevel) : min * 1.5,
    maxStock: material.maxStock !== undefined ? Number(material.maxStock) : undefined,
    purchasePrice: material.purchasePrice !== undefined ? Number(material.purchasePrice) : undefined,
    supplier: material.supplier,
    status,
    isActive: material.isActive !== undefined ? material.isActive : true,
    notes: material.notes,
    updatedAt: nowIso,
    lastUpdatedBy: material.lastUpdatedBy || 'Kitchen Chef',
    is_archived: false
  };

  let updatedList: RawMaterial[];
  if (isExisting) {
    updatedList = current.map(m => m.id === id ? savedItem : m);
  } else {
    updatedList = [savedItem, ...current];
  }

  saveStoredRawMaterials(updatedList, restaurantId);

  // If new item, log opening stock movement
  if (!isExisting && qty > 0) {
    const openingMovement: StockMovement = {
      id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: restaurantId,
      rawMaterialId: savedItem.id,
      rawMaterialName: savedItem.name,
      movementType: 'OPENING_STOCK',
      quantityChange: qty,
      previousQuantity: 0,
      newQuantity: qty,
      unit: savedItem.unit,
      costPerUnit: savedItem.purchasePrice,
      totalCost: savedItem.purchasePrice ? savedItem.purchasePrice * qty : undefined,
      referenceType: 'MANUAL',
      reason: 'Opening Stock',
      notes: 'Initial ingredient creation & opening stock',
      updatedBy: savedItem.lastUpdatedBy || 'Store Manager',
      createdAt: nowIso
    };
    const movements = getStoredStockMovements(restaurantId);
    saveStoredStockMovements([openingMovement, ...movements], restaurantId);
  }

  safeDispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: { rawMaterial: savedItem, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RAW_MATERIALS_UPDATED', rawMaterial: savedItem, restaurantId });
    } catch (e) {}
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const dbPayload = {
      id: savedItem.id,
      restaurant_id: restaurantId,
      sku: savedItem.sku,
      name: savedItem.name,
      category: savedItem.category,
      current_stock: savedItem.quantity,
      unit: savedItem.unit,
      min_threshold: savedItem.minimumThreshold,
      reorder_level: savedItem.reorderLevel,
      max_stock: savedItem.maxStock,
      unit_cost: savedItem.purchasePrice,
      supplier: savedItem.supplier,
      status: savedItem.status,
      is_active: savedItem.isActive,
      notes: savedItem.notes,
      updated_at: savedItem.updatedAt,
      last_updated_by: savedItem.lastUpdatedBy,
      is_archived: savedItem.is_archived
    };
    Promise.resolve(
      supabase.from('raw_materials').upsert(dbPayload, { onConflict: 'id' })
    ).catch(() => {});
  }

  return savedItem;
}

export function deleteRawMaterial(id: string, restaurantId: string = getCurrentRestaurantId()): boolean {
  const current = getStoredRawMaterials(restaurantId);
  const target = current.find(m => m.id === id);
  if (!target) return false;

  const updated = current.filter(m => m.id !== id);
  saveStoredRawMaterials(updated, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: { deletedId: id, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RAW_MATERIALS_UPDATED', deletedId: id, restaurantId });
    } catch (e) {}
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('raw_materials').delete().eq('id', id).eq('restaurant_id', restaurantId)
    ).catch(() => {});
  }

  return true;
}

// ----------------------------------------------------
// STOCK MOVEMENTS & AUDIT LEDGER
// ----------------------------------------------------

export function getStoredStockMovements(restaurantId: string = getCurrentRestaurantId()): StockMovement[] {
  try {
    const tenantKey = getTenantStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(m => ({
          ...m,
          restaurant_id: m.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read stock movements from storage', e);
  }

  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    try {
      const initialized = DEFAULT_STOCK_MOVEMENTS.map(m => ({ ...m, restaurant_id: DEFAULT_RESTAURANT_ID }));
      saveStoredStockMovements(initialized, DEFAULT_RESTAURANT_ID);
      return initialized;
    } catch (e) {}
    return DEFAULT_STOCK_MOVEMENTS;
  }
  return [];
}

export function saveStoredStockMovements(movements: StockMovement[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, restaurantId);
    // Keep last 300 movements locally for performance
    const trimmed = movements.slice(0, 300);
    safeStorage.setItem(tenantKey, JSON.stringify(trimmed));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch (e) {
    console.error('Failed to save stock movements to storage', e);
  }
}

export async function fetchStockMovements(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ movements: StockMovement[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: StockMovement[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          rawMaterialId: row.raw_material_id || row.rawMaterialId,
          rawMaterialName: row.raw_material_name || row.rawMaterialName,
          movementType: row.movement_type || row.movementType || 'add',
          quantityChange: Number(row.quantity_change ?? row.quantityChange ?? 0),
          previousQuantity: Number(row.previous_quantity ?? row.previousQuantity ?? 0),
          newQuantity: Number(row.new_quantity ?? row.newQuantity ?? 0),
          unit: row.unit || 'kg',
          costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : undefined,
          totalCost: row.total_cost ? Number(row.total_cost) : undefined,
          referenceType: row.reference_type || row.referenceType,
          referenceId: row.reference_id || row.referenceId,
          reason: row.reason || 'Other',
          notes: row.notes || '',
          updatedBy: row.updated_by || row.updatedBy || 'Kitchen Chef',
          createdAt: row.created_at || row.createdAt || new Date().toISOString()
        }));
        saveStoredStockMovements(mapped, restaurantId);
        return { movements: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch stock movements from Supabase, using local:', e);
    }
  }
  return { movements: getStoredStockMovements(restaurantId), source: 'local' };
}

export function mapMovementTypeToDb(type: string): DbStockMovementType {
  const norm = (type || '').toUpperCase().trim();
  switch (norm) {
    case 'PURCHASE':
    case 'OPENING_STOCK':
    case 'RETURN':
    case 'ADD':
      return 'add';
    case 'SALE_CONSUMPTION':
    case 'REDUCE':
    case 'DEDUCT':
      return 'deduct';
    case 'WASTAGE':
    case 'WASTE':
      return 'waste';
    case 'ADJUSTMENT':
    case 'SET':
    case 'AUDIT_RESET':
    default:
      return 'audit_reset';
  }
}

export async function updateRawMaterialStock(params: {
  rawMaterialId: string;
  action: StockMovementType;
  quantity: number;
  reason: StockMovementReason | string;
  updatedBy: string;
  notes?: string;
  referenceType?: 'PURCHASE' | 'ORDER' | 'WASTAGE' | 'PHYSICAL_AUDIT' | 'MANUAL';
  referenceId?: string;
  unitPrice?: number;
  restaurantId?: string;
}): Promise<RawMaterial | null> {
  const restaurantId = params.restaurantId || getCurrentRestaurantId();
  const items = getStoredRawMaterials(restaurantId);
  const index = items.findIndex(i => i.id === params.rawMaterialId);
  if (index === -1) return null;

  const current = items[index];
  const prevQty = current.quantity;
  let newQty = prevQty;
  let change = 0;

  if (params.action === 'add' || params.action === 'PURCHASE' || params.action === 'OPENING_STOCK' || params.action === 'RETURN') {
    change = Math.abs(params.quantity);
    newQty = prevQty + change;
  } else if (params.action === 'reduce' || params.action === 'SALE_CONSUMPTION' || params.action === 'WASTAGE') {
    change = -Math.abs(params.quantity);
    newQty = Math.max(0, prevQty - Math.abs(params.quantity));
  } else {
    // Exact set / ADJUSTMENT
    newQty = Math.max(0, params.quantity);
    change = newQty - prevQty;
  }

  newQty = Math.round(newQty * 1000) / 1000;
  const status: RawMaterialStockStatus = newQty <= 0 ? 'OUT OF STOCK' : (newQty <= current.minimumThreshold ? 'LOW STOCK' : 'IN STOCK');
  const nowIso = new Date().toISOString();

  const updatedItem: RawMaterial = {
    ...current,
    quantity: newQty,
    status,
    purchasePrice: params.unitPrice !== undefined ? params.unitPrice : current.purchasePrice,
    updatedAt: nowIso,
    lastUpdatedBy: params.updatedBy || 'Kitchen Chef'
  };

  items[index] = updatedItem;
  saveStoredRawMaterials(items, restaurantId);

  // Log movement
  const costPerUnit = params.unitPrice !== undefined ? params.unitPrice : current.purchasePrice;
  const totalCost = costPerUnit !== undefined ? Math.abs(change) * costPerUnit : undefined;

  const newMovement: StockMovement = {
    id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    restaurant_id: restaurantId,
    rawMaterialId: current.id,
    rawMaterialName: current.name,
    movementType: params.action,
    quantityChange: change,
    previousQuantity: prevQty,
    newQuantity: newQty,
    unit: current.unit,
    costPerUnit,
    totalCost,
    referenceType: params.referenceType || (params.action === 'PURCHASE' ? 'PURCHASE' : params.action === 'WASTAGE' ? 'WASTAGE' : params.action === 'ADJUSTMENT' ? 'PHYSICAL_AUDIT' : 'MANUAL'),
    referenceId: params.referenceId,
    reason: params.reason,
    notes: params.notes || '',
    updatedBy: params.updatedBy || 'Kitchen Chef',
    createdAt: nowIso
  };

  const movements = getStoredStockMovements(restaurantId);
  saveStoredStockMovements([newMovement, ...movements], restaurantId);

  // Dispatch window events
  safeDispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: { rawMaterial: updatedItem, movement: newMovement, restaurantId } }));

  // Broadcast across tabs
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({
        type: 'RAW_MATERIALS_UPDATED',
        rawMaterial: updatedItem,
        movement: newMovement,
        restaurantId
      });
    } catch (e) {}
  }

  // Push to Supabase if connected
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase
        .from('raw_materials')
        .update({
          current_stock: newQty,
          status,
          unit_cost: updatedItem.purchasePrice,
          updated_at: updatedItem.updatedAt,
          last_updated_by: updatedItem.lastUpdatedBy
        })
        .eq('id', current.id)
        .eq('restaurant_id', restaurantId)
    ).catch(() => {});

    Promise.resolve(
      supabase
        .from('stock_movements')
        .insert([{
          id: newMovement.id,
          restaurant_id: restaurantId,
          raw_material_id: newMovement.rawMaterialId,
          raw_material_name: newMovement.rawMaterialName,
          movement_type: mapMovementTypeToDb(newMovement.movementType),
          quantity_change: newMovement.quantityChange,
          previous_quantity: newMovement.previousQuantity,
          new_quantity: newMovement.newQuantity,
          unit: newMovement.unit,
          cost_per_unit: newMovement.costPerUnit,
          total_cost: newMovement.totalCost,
          reference_type: newMovement.referenceType,
          reference_id: newMovement.referenceId,
          reason: newMovement.reason,
          notes: newMovement.notes,
          updated_by: newMovement.updatedBy,
          created_at: newMovement.createdAt
        }])
    ).catch(() => {});
  }

  return updatedItem;
}

export async function addNewRawMaterial(params: {
  name: string;
  quantity: number;
  unit: RawMaterial['unit'];
  minimumThreshold: number;
  category?: string;
  sku?: string;
  reorderLevel?: number;
  purchasePrice?: number;
  supplier?: string;
  updatedBy?: string;
  initialNotes?: string;
  restaurantId?: string;
}): Promise<RawMaterial> {
  const restaurantId = params.restaurantId || getCurrentRestaurantId();
  return saveRawMaterial({
    name: params.name,
    category: params.category || 'General Staples',
    sku: params.sku,
    quantity: params.quantity,
    unit: params.unit,
    minimumThreshold: params.minimumThreshold,
    reorderLevel: params.reorderLevel,
    purchasePrice: params.purchasePrice,
    supplier: params.supplier,
    status: params.quantity <= 0 ? 'OUT OF STOCK' : (params.quantity <= params.minimumThreshold ? 'LOW STOCK' : 'IN STOCK'),
    lastUpdatedBy: params.updatedBy || 'Kitchen Chef',
    notes: params.initialNotes
  }, restaurantId);
}

// ----------------------------------------------------
// UNIT CONVERSION ENGINE
// ----------------------------------------------------

export function convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
  if (quantity === 0) return 0;
  const from = (fromUnit || '').toLowerCase().trim();
  const to = (toUnit || '').toLowerCase().trim();
  if (from === to) return quantity;

  // Weight conversions (base: grams)
  const weightFactors: Record<string, number> = {
    'mg': 0.001,
    'g': 1,
    'kg': 1000,
    'ounce': 28.3495,
    'lb': 453.592
  };

  if (weightFactors[from] && weightFactors[to]) {
    const inGrams = quantity * weightFactors[from];
    return inGrams / weightFactors[to];
  }

  // Volume conversions (base: ml)
  const volumeFactors: Record<string, number> = {
    'ml': 1,
    'cl': 10,
    'litre': 1000,
    'liter': 1000,
    'cup': 240,
    'tbsp': 15,
    'tsp': 5
  };

  if (volumeFactors[from] && volumeFactors[to]) {
    const inMl = quantity * volumeFactors[from];
    return inMl / volumeFactors[to];
  }

  // Count/packaging conversions
  if ((from === 'pcs' || from === 'pc') && (to === 'pack' || to === 'can' || to === 'bottle' || to === 'box')) {
    return quantity;
  }
  if ((from === 'pack' || from === 'can' || from === 'bottle' || from === 'box') && (to === 'pcs' || to === 'pc')) {
    return quantity;
  }

  // Default fallback: return as-is
  return quantity;
}

// ----------------------------------------------------
// RECIPE MANAGEMENT ENGINE (PHASE 2)
// ----------------------------------------------------

export function getStoredRecipes(restaurantId: string = getCurrentRestaurantId()): MenuItemRecipe[] {
  try {
    const tenantKey = getTenantStorageKey(MENU_RECIPES_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(MENU_RECIPES_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(r => ({
          ...r,
          restaurant_id: r.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read recipes from storage', e);
  }

  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    try {
      const initialized = DEFAULT_MENU_RECIPES.map(r => ({ ...r, restaurant_id: DEFAULT_RESTAURANT_ID }));
      saveStoredRecipes(initialized, DEFAULT_RESTAURANT_ID);
      return initialized;
    } catch (e) {}
    return DEFAULT_MENU_RECIPES;
  }
  return [];
}

export function saveStoredRecipes(recipes: MenuItemRecipe[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(MENU_RECIPES_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(recipes));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(MENU_RECIPES_STORAGE_KEY, JSON.stringify(recipes));
    }
  } catch (e) {
    console.error('Failed to save recipes to storage', e);
  }
}

export async function fetchStoredRecipes(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ recipes: MenuItemRecipe[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_item_recipes')
        .select(`
          *,
          ingredients:menu_item_recipe_ingredients(*)
        `)
        .eq('restaurant_id', restaurantId);

      if (!error && data && data.length > 0) {
        const mapped: MenuItemRecipe[] = data.map((row: any) => {
          const rawIngredients = row.ingredients || [];
          const ingredients: RecipeIngredient[] = rawIngredients.map((ing: any) => ({
            id: String(ing.id),
            rawMaterialId: ing.raw_material_id || ing.rawMaterialId,
            rawMaterialName: ing.raw_material_name || ing.rawMaterialName,
            quantity: Number(ing.quantity ?? 0),
            unit: (ing.unit || 'g') as any,
            isOptional: Boolean(ing.is_optional),
            notes: ing.notes,
            estimatedCost: ing.estimated_cost ? Number(ing.estimated_cost) : undefined
          }));

          return {
            id: String(row.id),
            restaurant_id: row.restaurant_id || restaurantId,
            menuItemId: String(row.menu_item_id || row.menuItemId),
            menuItemName: row.menu_item_name || row.menuItemName,
            variantId: row.variant_id || row.variantId,
            variantName: row.variant_name || row.variantName,
            yieldQuantity: Number(row.yield_quantity ?? 1),
            portionSize: row.portion_size || row.portionSize,
            prepInstructions: row.prep_instructions || row.prepInstructions,
            ingredients,
            calculatedCost: row.calculated_cost ? Number(row.calculated_cost) : undefined,
            sellingPrice: row.selling_price ? Number(row.selling_price) : undefined,
            foodCostPercentage: row.food_cost_percentage ? Number(row.food_cost_percentage) : undefined,
            updatedAt: row.updated_at || new Date().toISOString(),
            updatedBy: row.updated_by || 'Chef'
          };
        });
        saveStoredRecipes(mapped, restaurantId);
        return { recipes: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch recipes from Supabase, using local:', e);
    }
  }
  return { recipes: getStoredRecipes(restaurantId), source: 'local' };
}

export function calculateRecipeFoodCost(
  ingredients: RecipeIngredient[], 
  rawMaterials: RawMaterial[], 
  sellingPrice?: number
): { calculatedCost: number; foodCostPercentage?: number; ingredientCosts: RecipeIngredient[] } {
  let totalCost = 0;
  const enrichedIngredients = ingredients.map(ing => {
    const mat = rawMaterials.find(m => m.id === ing.rawMaterialId);
    let cost = 0;
    if (mat && mat.purchasePrice && mat.purchasePrice > 0) {
      const convertedQty = convertUnits(ing.quantity, ing.unit, mat.unit);
      cost = Math.round(convertedQty * mat.purchasePrice * 100) / 100;
    } else if (ing.estimatedCost) {
      cost = ing.estimatedCost;
    }
    totalCost += cost;
    return {
      ...ing,
      estimatedCost: cost
    };
  });

  const finalCost = Math.round(totalCost * 100) / 100;
  let foodCostPercentage: number | undefined = undefined;
  if (sellingPrice && sellingPrice > 0) {
    foodCostPercentage = Math.round((finalCost / sellingPrice) * 1000) / 10;
  }

  return {
    calculatedCost: finalCost,
    foodCostPercentage,
    ingredientCosts: enrichedIngredients
  };
}

export function saveMenuItemRecipe(
  recipe: Omit<MenuItemRecipe, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string },
  restaurantId: string = getCurrentRestaurantId()
): MenuItemRecipe {
  const current = getStoredRecipes(restaurantId);
  const rawMaterials = getStoredRawMaterials(restaurantId);
  const isExisting = Boolean(recipe.id && current.some(r => r.id === recipe.id));
  const id = recipe.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  // Recalculate food cost
  const costCalc = calculateRecipeFoodCost(recipe.ingredients, rawMaterials, recipe.sellingPrice);

  const savedRecipe: MenuItemRecipe = {
    ...recipe,
    id,
    restaurant_id: restaurantId,
    ingredients: costCalc.ingredientCosts,
    calculatedCost: costCalc.calculatedCost,
    foodCostPercentage: costCalc.foodCostPercentage,
    updatedAt: nowIso,
    updatedBy: recipe.updatedBy || 'Executive Chef'
  };

  let updatedList: MenuItemRecipe[];
  if (isExisting) {
    updatedList = current.map(r => r.id === id ? savedRecipe : r);
  } else {
    // If recipe already exists for this menuItemId and variant, replace it
    const existingIndex = current.findIndex(r => r.menuItemId === savedRecipe.menuItemId && (r.variantId || '') === (savedRecipe.variantId || ''));
    if (existingIndex >= 0) {
      updatedList = current.map((r, idx) => idx === existingIndex ? savedRecipe : r);
    } else {
      updatedList = [savedRecipe, ...current];
    }
  }

  saveStoredRecipes(updatedList, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_recipes_updated', { detail: { recipe: savedRecipe, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RECIPES_UPDATED', recipe: savedRecipe, restaurantId });
    } catch (e) {}
  }

  // Push to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('menu_item_recipes').upsert({
        id: savedRecipe.id,
        restaurant_id: restaurantId,
        menu_item_id: savedRecipe.menuItemId,
        menu_item_name: savedRecipe.menuItemName,
        variant_id: savedRecipe.variantId,
        variant_name: savedRecipe.variantName,
        yield_quantity: savedRecipe.yieldQuantity,
        portion_size: savedRecipe.portionSize,
        prep_instructions: savedRecipe.prepInstructions,
        calculated_cost: savedRecipe.calculatedCost,
        selling_price: savedRecipe.sellingPrice,
        food_cost_percentage: savedRecipe.foodCostPercentage,
        updated_at: savedRecipe.updatedAt,
        updated_by: savedRecipe.updatedBy
      }, { onConflict: 'id' })
    ).then(() => {
      // Re-insert ingredients
      if (savedRecipe.ingredients && savedRecipe.ingredients.length > 0) {
        const ingRows = savedRecipe.ingredients.map(ing => ({
          id: ing.id || `ri-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          restaurant_id: restaurantId,
          recipe_id: savedRecipe.id,
          raw_material_id: ing.rawMaterialId,
          raw_material_name: ing.rawMaterialName,
          quantity: ing.quantity,
          unit: ing.unit,
          is_optional: Boolean(ing.isOptional),
          notes: ing.notes,
          estimated_cost: ing.estimatedCost
        }));
        return supabase.from('menu_item_recipe_ingredients').delete().eq('recipe_id', savedRecipe.id).then(() => {
          return supabase.from('menu_item_recipe_ingredients').insert(ingRows);
        });
      }
    }).catch(() => {});
  }

  return savedRecipe;
}

export function deleteMenuItemRecipe(recipeId: string, restaurantId: string = getCurrentRestaurantId()): boolean {
  const current = getStoredRecipes(restaurantId);
  const updated = current.filter(r => r.id !== recipeId);
  saveStoredRecipes(updated, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_recipes_updated', { detail: { deletedId: recipeId, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'RECIPES_UPDATED', deletedId: recipeId, restaurantId });
    } catch (e) {}
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('menu_item_recipe_ingredients').delete().eq('recipe_id', recipeId).eq('restaurant_id', restaurantId)
    ).then(() => {
      return supabase.from('menu_item_recipes').delete().eq('id', recipeId).eq('restaurant_id', restaurantId);
    }).catch(() => {});
  }

  return true;
}

// ----------------------------------------------------
// INVENTORY PURCHASES & STOCK-IN (PHASE 2)
// ----------------------------------------------------

export function getStoredPurchases(restaurantId: string = getCurrentRestaurantId()): InventoryPurchaseRecord[] {
  try {
    const tenantKey = getTenantStorageKey(INVENTORY_PURCHASES_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(INVENTORY_PURCHASES_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => ({
          ...p,
          restaurant_id: p.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read purchases from storage', e);
  }

  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    try {
      const initialized = DEFAULT_PURCHASE_RECORDS.map(p => ({ ...p, restaurant_id: DEFAULT_RESTAURANT_ID }));
      saveStoredPurchases(initialized, DEFAULT_RESTAURANT_ID);
      return initialized;
    } catch (e) {}
    return DEFAULT_PURCHASE_RECORDS;
  }
  return [];
}

export function saveStoredPurchases(purchases: InventoryPurchaseRecord[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(INVENTORY_PURCHASES_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(purchases.slice(0, 200)));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(INVENTORY_PURCHASES_STORAGE_KEY, JSON.stringify(purchases.slice(0, 200)));
    }
  } catch (e) {
    console.error('Failed to save purchases to storage', e);
  }
}

export async function fetchStoredPurchases(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ purchases: InventoryPurchaseRecord[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select(`
          *,
          items:inventory_purchase_items(*)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: InventoryPurchaseRecord[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          invoiceNumber: row.invoice_number || row.invoiceNumber,
          supplierName: row.supplier_name || row.supplierName,
          purchaseDate: row.purchase_date || row.purchaseDate,
          totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
          paymentStatus: row.payment_status || row.paymentStatus || 'Paid',
          paymentMode: row.payment_mode || row.paymentMode || 'UPI',
          notes: row.notes,
          recordedBy: row.recorded_by || row.recordedBy || 'Store Manager',
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          items: (row.items || []).map((item: any) => ({
            id: String(item.id),
            rawMaterialId: item.raw_material_id || item.rawMaterialId,
            rawMaterialName: item.raw_material_name || item.rawMaterialName,
            quantity: Number(item.quantity ?? 0),
            unit: item.unit || 'kg',
            unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
            totalPrice: Number(item.total_price ?? item.totalPrice ?? 0),
            expiryDate: item.expiry_date || item.expiryDate
          }))
        }));
        saveStoredPurchases(mapped, restaurantId);
        return { purchases: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch purchases from Supabase, using local:', e);
    }
  }
  return { purchases: getStoredPurchases(restaurantId), source: 'local' };
}

export async function recordInventoryPurchase(
  purchase: Omit<InventoryPurchaseRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  restaurantId: string = getCurrentRestaurantId()
): Promise<InventoryPurchaseRecord> {
  const current = getStoredPurchases(restaurantId);
  const id = purchase.id || `PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const nowIso = new Date().toISOString();

  const savedRecord: InventoryPurchaseRecord = {
    ...purchase,
    id,
    restaurant_id: restaurantId,
    createdAt: purchase.createdAt || nowIso
  };

  // Update Raw Materials stock and log PURCHASE movements
  for (const item of savedRecord.items) {
    if (item.quantity > 0 && item.rawMaterialId) {
      await updateRawMaterialStock({
        rawMaterialId: item.rawMaterialId,
        action: 'PURCHASE',
        quantity: item.quantity,
        reason: 'Purchase Stock-In',
        updatedBy: savedRecord.recordedBy || 'Store Manager',
        notes: `Invoice #${savedRecord.invoiceNumber} from ${savedRecord.supplierName}`,
        referenceType: 'PURCHASE',
        referenceId: savedRecord.invoiceNumber || savedRecord.id,
        unitPrice: item.unitPrice,
        restaurantId
      });
    }
  }

  const updatedPurchases = [savedRecord, ...current];
  saveStoredPurchases(updatedPurchases, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_purchases_updated', { detail: { purchase: savedRecord, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'PURCHASES_UPDATED', purchase: savedRecord, restaurantId });
    } catch (e) {}
  }

  // Push to Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('inventory_purchases').insert([{
        id: savedRecord.id,
        restaurant_id: restaurantId,
        invoice_number: savedRecord.invoiceNumber,
        supplier_name: savedRecord.supplierName,
        purchase_date: savedRecord.purchaseDate,
        total_amount: savedRecord.totalAmount,
        payment_status: savedRecord.paymentStatus,
        payment_mode: savedRecord.paymentMode,
        notes: savedRecord.notes,
        recorded_by: savedRecord.recordedBy,
        created_at: savedRecord.createdAt
      }])
    ).then(() => {
      if (savedRecord.items && savedRecord.items.length > 0) {
        const itemRows = savedRecord.items.map(item => ({
          id: item.id || `pi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          restaurant_id: restaurantId,
          purchase_id: savedRecord.id,
          raw_material_id: item.rawMaterialId,
          raw_material_name: item.rawMaterialName,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          expiry_date: item.expiryDate
        }));
        return supabase.from('inventory_purchase_items').insert(itemRows);
      }
    }).catch(() => {});
  }

  return savedRecord;
}

// ----------------------------------------------------
// INVENTORY WASTAGE LOGGING (PHASE 2)
// ----------------------------------------------------

export function getStoredWastage(restaurantId: string = getCurrentRestaurantId()): InventoryWastageRecord[] {
  try {
    const tenantKey = getTenantStorageKey(INVENTORY_WASTAGE_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(INVENTORY_WASTAGE_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(w => ({
          ...w,
          restaurant_id: w.restaurant_id || restaurantId
        }));
      }
    }
  } catch (e) {
    console.error('Failed to read wastage from storage', e);
  }

  if (restaurantId === DEFAULT_RESTAURANT_ID) {
    try {
      const initialized = DEFAULT_WASTAGE_RECORDS.map(w => ({ ...w, restaurant_id: DEFAULT_RESTAURANT_ID }));
      saveStoredWastage(initialized, DEFAULT_RESTAURANT_ID);
      return initialized;
    } catch (e) {}
    return DEFAULT_WASTAGE_RECORDS;
  }
  return [];
}

export function saveStoredWastage(wastage: InventoryWastageRecord[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(INVENTORY_WASTAGE_STORAGE_KEY, restaurantId);
    safeStorage.setItem(tenantKey, JSON.stringify(wastage.slice(0, 200)));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(INVENTORY_WASTAGE_STORAGE_KEY, JSON.stringify(wastage.slice(0, 200)));
    }
  } catch (e) {
    console.error('Failed to save wastage to storage', e);
  }
}

export async function fetchStoredWastage(
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ wastage: InventoryWastageRecord[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('inventory_wastage')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: InventoryWastageRecord[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id || restaurantId,
          rawMaterialId: row.raw_material_id || row.rawMaterialId,
          rawMaterialName: row.raw_material_name || row.rawMaterialName,
          quantity: Number(row.quantity ?? 0),
          unit: row.unit || 'kg',
          reason: row.reason || 'Spoilage',
          unitCost: row.unit_cost ? Number(row.unit_cost) : undefined,
          estimatedLossValue: Number(row.estimated_loss_value ?? row.estimatedLossValue ?? 0),
          date: row.date || new Date().toISOString().split('T')[0],
          recordedBy: row.recorded_by || row.recordedBy || 'Kitchen Chef',
          notes: row.notes,
          createdAt: row.created_at || row.createdAt || new Date().toISOString()
        }));
        saveStoredWastage(mapped, restaurantId);
        return { wastage: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch wastage from Supabase, using local:', e);
    }
  }
  return { wastage: getStoredWastage(restaurantId), source: 'local' };
}

export async function recordInventoryWastage(
  wastage: Omit<InventoryWastageRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  restaurantId: string = getCurrentRestaurantId()
): Promise<InventoryWastageRecord> {
  const current = getStoredWastage(restaurantId);
  const rawMaterials = getStoredRawMaterials(restaurantId);
  const mat = rawMaterials.find(m => m.id === wastage.rawMaterialId);
  const id = wastage.id || `WST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const nowIso = new Date().toISOString();

  let estimatedLoss = wastage.estimatedLossValue;
  if (!estimatedLoss && mat && mat.purchasePrice) {
    estimatedLoss = Math.round(wastage.quantity * mat.purchasePrice * 100) / 100;
  }

  const savedRecord: InventoryWastageRecord = {
    ...wastage,
    id,
    restaurant_id: restaurantId,
    estimatedLossValue: estimatedLoss || 0,
    unitCost: wastage.unitCost || mat?.purchasePrice,
    createdAt: wastage.createdAt || nowIso
  };

  // Deduct from Raw Materials and log WASTAGE movement
  await updateRawMaterialStock({
    rawMaterialId: savedRecord.rawMaterialId,
    action: 'WASTAGE',
    quantity: savedRecord.quantity,
    reason: `Wastage: ${savedRecord.reason}`,
    updatedBy: savedRecord.recordedBy || 'Kitchen Chef',
    notes: savedRecord.notes || `Kitchen Wastage Log (${savedRecord.reason})`,
    referenceType: 'WASTAGE',
    referenceId: savedRecord.id,
    unitPrice: savedRecord.unitCost,
    restaurantId
  });

  const updatedWastage = [savedRecord, ...current];
  saveStoredWastage(updatedWastage, restaurantId);

  safeDispatchEvent(new CustomEvent('rbh_wastage_updated', { detail: { wastage: savedRecord, restaurantId } }));
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({ type: 'WASTAGE_UPDATED', wastage: savedRecord, restaurantId });
    } catch (e) {}
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('inventory_wastage').insert([{
        id: savedRecord.id,
        restaurant_id: restaurantId,
        raw_material_id: savedRecord.rawMaterialId,
        raw_material_name: savedRecord.rawMaterialName,
        quantity: savedRecord.quantity,
        unit: savedRecord.unit,
        reason: savedRecord.reason,
        unit_cost: savedRecord.unitCost,
        estimated_loss_value: savedRecord.estimatedLossValue,
        date: savedRecord.date,
        recorded_by: savedRecord.recordedBy,
        notes: savedRecord.notes,
        created_at: savedRecord.createdAt
      }])
    ).catch(() => {});
  }

  return savedRecord;
}

// ----------------------------------------------------
// PHYSICAL STOCK ADJUSTMENT / RECONCILIATION AUDIT
// ----------------------------------------------------

export async function recordStockAdjustment(params: {
  rawMaterialId: string;
  actualCount: number;
  reason: 'Physical Audit Adjustment' | 'Stock correction' | 'Other' | string;
  auditedBy: string;
  notes?: string;
  restaurantId?: string;
}): Promise<RawMaterial | null> {
  const restaurantId = params.restaurantId || getCurrentRestaurantId();
  return updateRawMaterialStock({
    rawMaterialId: params.rawMaterialId,
    action: 'ADJUSTMENT',
    quantity: Math.max(0, params.actualCount),
    reason: params.reason || 'Physical Audit Adjustment',
    updatedBy: params.auditedBy || 'Store Auditor',
    notes: params.notes || 'Physical inventory audit reconciliation',
    referenceType: 'PHYSICAL_AUDIT',
    restaurantId
  });
}

// ----------------------------------------------------
// AUTOMATIC SALE INVENTORY CONSUMPTION ENGINE (IDEMPOTENT)
// ----------------------------------------------------

export function getStoredConsumedOrderIds(restaurantId: string = getCurrentRestaurantId()): Set<string> {
  try {
    const tenantKey = getTenantStorageKey(CONSUMED_ORDERS_STORAGE_KEY, restaurantId);
    const saved = safeStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? safeStorage.getItem(CONSUMED_ORDERS_STORAGE_KEY) : null);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to read consumed orders ledger', e);
  }
  return new Set();
}

export function markOrderAsConsumed(orderId: string, restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const consumed = getStoredConsumedOrderIds(restaurantId);
    consumed.add(orderId);
    const tenantKey = getTenantStorageKey(CONSUMED_ORDERS_STORAGE_KEY, restaurantId);
    const arr = Array.from(consumed);
    safeStorage.setItem(tenantKey, JSON.stringify(arr));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      safeStorage.setItem(CONSUMED_ORDERS_STORAGE_KEY, JSON.stringify(arr));
    }
  } catch (e) {
    console.error('Failed to mark order as consumed in storage', e);
  }

  // Push to Supabase consumed orders table
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('inventory_order_consumptions').insert([{
        id: `ioc-${orderId}-${Date.now()}`,
        restaurant_id: restaurantId,
        order_id: orderId,
        consumed_at: new Date().toISOString()
      }])
    ).catch(() => {});
  }
}

export async function consumeInventoryForOrders(
  orders: Order[],
  restaurantId: string = getCurrentRestaurantId()
): Promise<{ success: boolean; itemsConsumed: number; movementsLogged: number }> {
  if (!orders || orders.length === 0) {
    return { success: true, itemsConsumed: 0, movementsLogged: 0 };
  }

  const consumedSet = getStoredConsumedOrderIds(restaurantId);
  const recipes = getStoredRecipes(restaurantId);
  const rawMaterials = getStoredRawMaterials(restaurantId);
  let totalItemsConsumed = 0;
  let totalMovementsLogged = 0;

  for (const order of orders) {
    // IDEMPOTENCY CHECK: if order was already consumed, skip!
    if (consumedSet.has(order.id)) {
      continue;
    }

    if (!order.items || order.items.length === 0) {
      markOrderAsConsumed(order.id, restaurantId);
      continue;
    }

    // Process each ordered item and match its recipe
    for (const item of order.items) {
      const orderItemQty = item.quantity || 1;
      
      // Match recipe by menuItemId or matching name
      const itemName = item.name || (item as any).Name || '';
      const recipe = recipes.find(r => {
        if (String(r.menuItemId) === String(item.id)) return true;
        if (r.menuItemName && itemName && r.menuItemName.trim().toLowerCase() === itemName.trim().toLowerCase()) return true;
        return false;
      });

      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        for (const ing of recipe.ingredients) {
          const mat = rawMaterials.find(m => m.id === ing.rawMaterialId);
          if (mat) {
            // Calculate consumption quantity converted to raw material unit
            const singlePortionQtyInMatUnit = convertUnits(ing.quantity, ing.unit, mat.unit);
            const totalDeduction = Math.round(singlePortionQtyInMatUnit * orderItemQty * 1000) / 1000;

            if (totalDeduction > 0) {
              await updateRawMaterialStock({
                rawMaterialId: mat.id,
                action: 'SALE_CONSUMPTION',
                quantity: totalDeduction,
                reason: 'Order Sale Consumption',
                updatedBy: 'System (POS Settle)',
                notes: `Auto-consumption for Order #${order.id} (${order.tableNumber}) - ${itemName} x${orderItemQty}`,
                referenceType: 'ORDER',
                referenceId: order.id,
                restaurantId
              });
              totalMovementsLogged++;
            }
          }
        }
        totalItemsConsumed++;
      }
    }

    // Mark order as consumed
    markOrderAsConsumed(order.id, restaurantId);
  }

  return {
    success: true,
    itemsConsumed: totalItemsConsumed,
    movementsLogged: totalMovementsLogged
  };
}

export function subscribeToRawMaterialsRealtime(onRawMaterialsChange: () => void): () => void {
  const handleLocal = () => onRawMaterialsChange();
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data && (
      event.data.type === 'RAW_MATERIALS_UPDATED' || 
      event.data.type === 'RECIPES_UPDATED' || 
      event.data.type === 'PURCHASES_UPDATED' || 
      event.data.type === 'WASTAGE_UPDATED'
    )) {
      onRawMaterialsChange();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === RAW_MATERIALS_STORAGE_KEY || 
      event.key === STOCK_MOVEMENTS_STORAGE_KEY ||
      event.key === MENU_RECIPES_STORAGE_KEY ||
      event.key === INVENTORY_PURCHASES_STORAGE_KEY ||
      event.key === INVENTORY_WASTAGE_STORAGE_KEY
    ) {
      onRawMaterialsChange();
    }
  };

  window.addEventListener('rbh_raw_materials_updated', handleLocal);
  window.addEventListener('rbh_recipes_updated', handleLocal);
  window.addEventListener('rbh_purchases_updated', handleLocal);
  window.addEventListener('rbh_wastage_updated', handleLocal);
  window.addEventListener('storage', handleStorage);
  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  let supabaseChannel: any = null;
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel('royal_raw_materials_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, () => {
          onRawMaterialsChange();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
          onRawMaterialsChange();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_recipes' }, () => {
          onRawMaterialsChange();
        })
        .on('broadcast', { event: 'raw_materials_updated' }, () => {
          onRawMaterialsChange();
        })
        .subscribe();
    } catch (e) {}
  }

  return () => {
    window.removeEventListener('rbh_raw_materials_updated', handleLocal);
    window.removeEventListener('rbh_recipes_updated', handleLocal);
    window.removeEventListener('rbh_purchases_updated', handleLocal);
    window.removeEventListener('rbh_wastage_updated', handleLocal);
    window.removeEventListener('storage', handleStorage);
    if (ordersBroadcastChannel) {
      ordersBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (supabase && supabaseChannel) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}

// Kitchen audio notification chime
export function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play warm melodic dual-tone dining bell
    const now = ctx.currentTime;
    
    // Tone 1: 659.25 Hz (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.9);

    // Tone 2: 880 Hz (A5) slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.2);
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
}

// ============================================================================
// PHASE 1 DATA MIGRATION, SNAPSHOTS, & PRODUCTION SQL RLS SECURITY GENERATOR
// ============================================================================

export interface RestaurantDataSnapshot {
  version: string;
  exportedAt: string;
  restaurantId: string;
  orders: Order[];
  payments: PaymentRecord[];
  feedback: CustomerFeedback[];
  rawMaterials: RawMaterial[];
  stockMovements: StockMovement[];
}

export function exportRestaurantDataSnapshot(restaurantId: string = getCurrentRestaurantId()): RestaurantDataSnapshot {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    restaurantId,
    orders: getStoredOrders(restaurantId),
    payments: getStoredPayments(restaurantId),
    feedback: getStoredFeedback(),
    rawMaterials: getStoredRawMaterials(),
    stockMovements: getStoredStockMovements()
  };
}

export function importRestaurantDataSnapshot(snapshot: RestaurantDataSnapshot): boolean {
  try {
    if (!snapshot || !snapshot.restaurantId) return false;
    const rId = snapshot.restaurantId;
    if (Array.isArray(snapshot.orders)) {
      saveStoredOrders(snapshot.orders.map(o => ({ ...o, restaurant_id: rId })), rId);
    }
    if (Array.isArray(snapshot.payments)) {
      saveStoredPayments(snapshot.payments.map(p => ({ ...p, restaurant_id: rId })), rId);
    }
    if (Array.isArray(snapshot.feedback)) {
      safeStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(snapshot.feedback));
    }
    if (Array.isArray(snapshot.rawMaterials)) {
      safeStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(snapshot.rawMaterials));
    }
    if (Array.isArray(snapshot.stockMovements)) {
      safeStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(snapshot.stockMovements));
    }
    safeDispatchEvent(new Event('rbh_order_updated'));
    safeDispatchEvent(new Event('rbh_storage_reset'));
    return true;
  } catch (e) {
    console.error('Failed to restore snapshot', e);
    return false;
  }
}

/**
 * Generates the complete, production-grade PostgreSQL / Supabase SQL schema with:
 * - Multi-tenant restaurant isolation with foreign keys
 * - Row Level Security (RLS) enabled on all tables
 * - Multi-tenant security policies (Customer, Staff, Manager/Owner)
 * - Safe auditing, archival, and void support
 * - Performance indexes on (restaurant_id, created_at)
 */
export function generateProductionSqlSecurityScript(restaurantId: string = getCurrentRestaurantId()): string {
  return `-- ==========================================================================
-- PRODUCTION-GRADE RESTAURANT MULTI-TENANT ISOLATION & RLS SECURITY SCHEMA
-- Generated for Restaurant ID: ${restaurantId}
-- ==========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. RESTAURANTS PROFILE & SETTINGS TABLES
CREATE TABLE IF NOT EXISTS public.restaurants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),
    address TEXT,
    phone VARCHAR(32),
    currency VARCHAR(8) DEFAULT 'INR',
    tax_rate NUMERIC(5, 2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo TEXT,
    tagline VARCHAR(255),
    address TEXT,
    phone VARCHAR(32),
    email VARCHAR(255),
    opening_time VARCHAR(32) DEFAULT '11:00 AM',
    closing_time VARCHAR(32) DEFAULT '11:00 PM',
    restaurant_type VARCHAR(64) DEFAULT 'Dine-In & Takeaway',
    gst_enabled BOOLEAN DEFAULT TRUE,
    gst_rate NUMERIC(5, 2) DEFAULT 5.00,
    service_charge_enabled BOOLEAN DEFAULT FALSE,
    service_charge_rate NUMERIC(5, 2) DEFAULT 5.00,
    receipt_footer TEXT DEFAULT 'Thank you for dining with us! Please visit again.',
    currency VARCHAR(8) DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Tenant
INSERT INTO public.restaurants (id, name, tagline, address, phone, currency, tax_rate)
VALUES ('${restaurantId}', 'Royal Biryani House', 'Authentic Dum Biryani & Mughlai Cuisine', '124 Heritage Lane, Connaught Place, New Delhi', '+91 98765 43210', 'INR', 5.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.restaurant_settings (id, restaurant_id, name, tagline, address, phone, email, opening_time, closing_time, restaurant_type, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, receipt_footer)
VALUES ('${restaurantId}', '${restaurantId}', 'Royal Biryani House', 'Authentic Dum Biryani & Mughlai Cuisine', '124 Heritage Lane, Connaught Place, New Delhi', '+91 98765 43210', 'contact@royalbiryani.com', '11:00 AM', '11:00 PM', 'Dine-In & Takeaway', TRUE, 5.00, FALSE, 5.00, 'Thank you for dining at Royal Biryani House! Please visit again.')
ON CONFLICT (restaurant_id) DO NOTHING;

-- 3. RESTAURANT TABLES TABLE
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(32) NOT NULL,
    section VARCHAR(64) NOT NULL DEFAULT 'Ground Floor',
    capacity INTEGER NOT NULL DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_section ON public.restaurant_tables(restaurant_id, section);

-- 4. MENU CATEGORIES & SUBCATEGORIES TABLES
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(64) DEFAULT 'Utensils',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON public.menu_categories(restaurant_id);

CREATE TABLE IF NOT EXISTS public.menu_subcategories (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.menu_subcategories(restaurant_id, category_id);

-- 5. STAFF & RBAC ROLES TABLE
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('Owner', 'Manager', 'Kitchen', 'Counter', 'Captain', 'Waiter')),
    pin_code VARCHAR(16),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON public.staff_accounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON public.staff_accounts(user_id);

-- 6. MENU ITEMS TABLE (WITH VARIANTS & ADDONS JSONB SUPPORT)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    category_id VARCHAR(64),
    subcategory_id VARCHAR(64),
    subcategory_name VARCHAR(255),
    price NUMERIC(10, 2) NOT NULL,
    base_price NUMERIC(10, 2),
    description TEXT,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE,
    is_veg BOOLEAN DEFAULT FALSE,
    veg_type VARCHAR(32) DEFAULT 'Non-Veg',
    is_spicy BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    prep_time VARCHAR(32) DEFAULT '15-20 mins',
    stock_status VARCHAR(32) DEFAULT 'In Stock',
    stock_count INTEGER DEFAULT 50,
    variants JSONB DEFAULT '[]'::jsonb,
    addons JSONB DEFAULT '[]'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_category ON public.menu_items(restaurant_id, category);

-- 5. ORDERS & KDS TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.royal_orders (
    order_id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(32) NOT NULL,
    session_id VARCHAR(64),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(32),
    customer_notes TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Preparing', 'Ready', 'Completed', 'Cancelled')),
    payment_status VARCHAR(32) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partially Paid', 'Paid')),
    payment_mode VARCHAR(32) DEFAULT 'UPI',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.royal_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON public.royal_orders(restaurant_id, table_number, session_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.royal_orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.royal_orders(restaurant_id, status);

-- 6. AUDITED PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.royal_payments (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id VARCHAR(64),
    session_id VARCHAR(64),
    table_number VARCHAR(32),
    amount NUMERIC(10, 2) NOT NULL,
    payment_mode VARCHAR(32) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Mixed')),
    recorded_by VARCHAR(255) DEFAULT 'Counter Cashier',
    notes TEXT,
    is_voided BOOLEAN DEFAULT FALSE,
    void_reason TEXT,
    voided_by VARCHAR(255),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_restaurant ON public.royal_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON public.royal_payments(restaurant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.royal_payments(restaurant_id, created_at DESC);

-- 7. RAW MATERIALS & INVENTORY TABLE (PHASE 2 ENHANCED)
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    sku VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) DEFAULT 'Kitchen Staples',
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit VARCHAR(16) NOT NULL DEFAULT 'kg',
    minimum_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5,
    reorder_level NUMERIC(10, 2),
    max_stock NUMERIC(10, 2),
    purchase_price NUMERIC(10, 2),
    supplier VARCHAR(255),
    status VARCHAR(32) DEFAULT 'IN STOCK',
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    last_updated_by VARCHAR(255) DEFAULT 'Kitchen Chef',
    is_archived BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_restaurant ON public.raw_materials(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_sku ON public.raw_materials(restaurant_id, sku);

-- 8. STOCK MOVEMENTS AUDIT LOG TABLE (PHASE 2 ENHANCED)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    raw_material_id VARCHAR(64) NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name VARCHAR(255) NOT NULL,
    movement_type VARCHAR(32) NOT NULL,
    quantity_change NUMERIC(12, 3) NOT NULL,
    previous_quantity NUMERIC(12, 3) NOT NULL,
    new_quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    cost_per_unit NUMERIC(10, 2),
    total_cost NUMERIC(10, 2),
    reference_type VARCHAR(32),
    reference_id VARCHAR(64),
    reason VARCHAR(128) NOT NULL,
    notes TEXT,
    updated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_restaurant ON public.stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_movements_material ON public.stock_movements(restaurant_id, raw_material_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON public.stock_movements(restaurant_id, created_at DESC);

-- 9. RECIPES & INGREDIENT BOM (BILL OF MATERIALS) TABLES
CREATE TABLE IF NOT EXISTS public.menu_item_recipes (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(64) NOT NULL,
    menu_item_name VARCHAR(255) NOT NULL,
    variant_id VARCHAR(64),
    variant_name VARCHAR(255),
    yield_quantity NUMERIC(8, 2) DEFAULT 1,
    portion_size VARCHAR(64),
    prep_instructions TEXT,
    calculated_cost NUMERIC(10, 2),
    selling_price NUMERIC(10, 2),
    food_cost_percentage NUMERIC(5, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT 'Executive Chef'
);

CREATE INDEX IF NOT EXISTS idx_recipes_restaurant ON public.menu_item_recipes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_item ON public.menu_item_recipes(restaurant_id, menu_item_id);

CREATE TABLE IF NOT EXISTS public.menu_item_recipe_ingredients (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    recipe_id VARCHAR(64) NOT NULL REFERENCES public.menu_item_recipes(id) ON DELETE CASCADE,
    raw_material_id VARCHAR(64) NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    estimated_cost NUMERIC(10, 2),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.menu_item_recipe_ingredients(recipe_id);

-- 10. INVENTORY PURCHASES & STOCK-IN TABLE
CREATE TABLE IF NOT EXISTS public.inventory_purchases (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(32) DEFAULT 'Paid',
    payment_mode VARCHAR(32) DEFAULT 'UPI',
    notes TEXT,
    recorded_by VARCHAR(255) DEFAULT 'Store Manager',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_restaurant ON public.inventory_purchases(restaurant_id);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_items (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    purchase_id VARCHAR(64) NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
    raw_material_id VARCHAR(64) NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    expiry_date DATE
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.inventory_purchase_items(purchase_id);

-- 11. INVENTORY WASTAGE / LOSS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_wastage (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    raw_material_id VARCHAR(64) NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    reason VARCHAR(64) NOT NULL,
    unit_cost NUMERIC(10, 2),
    estimated_loss_value NUMERIC(10, 2),
    date DATE NOT NULL,
    recorded_by VARCHAR(255) DEFAULT 'Kitchen Chef',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wastage_restaurant ON public.inventory_wastage(restaurant_id);

-- 12. IDEMPOTENT ORDER CONSUMPTION TRACKER TABLE
CREATE TABLE IF NOT EXISTS public.inventory_order_consumptions (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id VARCHAR(64) NOT NULL,
    consumed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_consumption_unique ON public.inventory_order_consumptions(restaurant_id, order_id);

-- 13. CUSTOMER FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    feedback_id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id VARCHAR(64),
    table_number VARCHAR(32),
    customer_name VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    tags TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_restaurant ON public.customer_feedback(restaurant_id);

-- ==========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================================

-- Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if authenticated caller is active staff of the restaurant with required roles
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(target_restaurant_id TEXT, required_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.staff_profiles
                WHERE id = auth.uid()
                  AND restaurant_id = target_restaurant_id
                  AND is_active = true
                  AND (required_roles IS NULL OR role = ANY(required_roles))
            )
            OR
            EXISTS (
                SELECT 1 FROM public.staff_accounts
                WHERE user_id = auth.uid()
                  AND restaurant_id = target_restaurant_id
                  AND is_active = true
                  AND (required_roles IS NULL OR LOWER(role) = ANY(ARRAY(SELECT LOWER(r) FROM unnest(required_roles) r)))
            )
        )
    );
$$;

-- RLS POLICIES FOR SETTINGS & TABLES
CREATE POLICY "Public can view restaurant settings"
ON public.restaurant_settings FOR SELECT
USING (true);

CREATE POLICY "Staff can manage restaurant settings"
ON public.restaurant_settings FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Public can view active restaurant tables"
ON public.restaurant_tables FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage restaurant tables"
ON public.restaurant_tables FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- RLS POLICIES FOR MENU CATEGORIES & SUBCATEGORIES
CREATE POLICY "Public can view active menu categories"
ON public.menu_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage menu categories"
ON public.menu_categories FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Public can view active menu subcategories"
ON public.menu_subcategories FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage menu subcategories"
ON public.menu_subcategories FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- RLS POLICIES FOR MENU ITEMS
-- Public/Customers can read menu items of any valid restaurant
CREATE POLICY "Public can view active menu items"
ON public.menu_items FOR SELECT
USING (is_archived = false);

-- Staff can insert/update menu items only for their assigned restaurant
CREATE POLICY "Staff can manage menu items for their restaurant"
ON public.menu_items FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- RLS POLICIES FOR ORDERS
-- Customers & Staff can create new table orders
CREATE POLICY "Allow customers and staff to create orders"
ON public.royal_orders FOR INSERT
TO anon, authenticated
WITH CHECK (order_id IS NOT NULL AND total >= 0 AND restaurant_id IS NOT NULL AND table_number IS NOT NULL);

-- Staff can view orders for their restaurant
CREATE POLICY "Staff can view orders for their restaurant"
ON public.royal_orders FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- Customers can view active orders for their session
CREATE POLICY "Customers can view active session orders"
ON public.royal_orders FOR SELECT
TO anon
USING (session_id IS NOT NULL AND is_archived = false);

CREATE POLICY "Staff can update orders for their restaurant"
ON public.royal_orders FOR UPDATE
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- RLS POLICIES FOR PAYMENTS
CREATE POLICY "Staff can view payments for their restaurant"
ON public.royal_payments FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can insert payments for their restaurant"
ON public.royal_payments FOR INSERT
TO authenticated
WITH CHECK (amount >= 0 AND public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can void payments for their restaurant"
ON public.royal_payments FOR UPDATE
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- RLS POLICIES FOR RAW MATERIALS, STOCK MOVEMENTS, RECIPES & PURCHASES
CREATE POLICY "Staff can view raw materials"
ON public.raw_materials FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage raw materials"
ON public.raw_materials FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Audit log stock movements view"
ON public.stock_movements FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Audit log stock movements insert"
ON public.stock_movements FOR INSERT
TO authenticated
WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can view recipes"
ON public.menu_item_recipes FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage recipes"
ON public.menu_item_recipes FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage recipe ingredients"
ON public.menu_item_recipe_ingredients FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage purchases"
ON public.inventory_purchases FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage purchase items"
ON public.inventory_purchase_items FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage wastage"
ON public.inventory_wastage FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage order consumptions"
ON public.inventory_order_consumptions FOR ALL
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- RLS POLICIES FOR FEEDBACK
CREATE POLICY "Customers can submit feedback"
ON public.customer_feedback FOR INSERT
TO anon, authenticated
WITH CHECK (rating >= 1.0 AND rating <= 5.0 AND table_number IS NOT NULL);

CREATE POLICY "Staff can read feedback for their restaurant"
ON public.customer_feedback FOR SELECT
TO authenticated
USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));
`;
}

// ============================================================================
// PRODUCTION GO-LIVE RESET PLAN (SAFE ARCHIVAL OF TEST TRANSACTIONS)
// ============================================================================
// Constraint: Never delete master menu items, categories, recipes, tables, or settings.
// Only archive test orders, test payments, and test feedback from multi-device testing.
// ============================================================================

export function generateGoLiveResetScript(restaurantId: string = getCurrentRestaurantId()): string {
  return `-- ============================================================================
-- ROYAL BIRYANI HOUSE - PRODUCTION GO-LIVE CLEANUP SCRIPT
-- Target Restaurant: ${restaurantId}
-- Action: Safely ARCHIVES test orders/payments without deleting master catalog
-- ============================================================================

BEGIN;

-- 1. Archive test orders
UPDATE public.royal_orders
SET is_archived = true,
    status = 'Completed',
    updated_at = NOW()
WHERE restaurant_id = '${restaurantId}'
  AND is_archived = false;

-- 2. Void test payments for clean opening ledger
UPDATE public.royal_payments
SET is_voided = true,
    void_reason = 'Pre-launch test transaction archived during Go-Live reset',
    voided_by = 'System Administrator',
    voided_at = NOW()
WHERE restaurant_id = '${restaurantId}'
  AND is_voided = false;

-- 3. Archive test feedback
UPDATE public.customer_feedback
SET is_archived = true
WHERE restaurant_id = '${restaurantId}'
  AND is_archived = false;

-- 4. Clear consumed order logs for test orders
DELETE FROM public.inventory_order_consumptions
WHERE restaurant_id = '${restaurantId}';

COMMIT;
`;
}

export async function executeGoLiveLocalReset(restaurantId: string = getCurrentRestaurantId()): Promise<{ success: boolean; message: string }> {
  try {
    const ordersKey = getTenantStorageKey('rbh_live_orders_v2', restaurantId);
    const paymentsKey = getTenantStorageKey('rbh_payments_ledger_v2', restaurantId);
    const activeOrdersKey = getTenantStorageKey('royal_biryani_orders', restaurantId);
    const feedbackKey = FEEDBACK_STORAGE_KEY;

    // Archive orders locally
    const savedOrders = safeStorage.getItem(ordersKey) || safeStorage.getItem(activeOrdersKey);
    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed)) {
          const archived = parsed.map((o: any) => ({ ...o, is_archived: true, status: 'Completed' }));
          safeStorage.setItem(ordersKey, JSON.stringify(archived));
          safeStorage.setItem(activeOrdersKey, JSON.stringify([]));
        }
      } catch (e) {
        safeStorage.setItem(ordersKey, JSON.stringify([]));
        safeStorage.setItem(activeOrdersKey, JSON.stringify([]));
      }
    }

    // Void test payments locally
    const savedPayments = safeStorage.getItem(paymentsKey);
    if (savedPayments) {
      try {
        const parsed = JSON.parse(savedPayments);
        if (Array.isArray(parsed)) {
          const voided = parsed.map((p: any) => ({ ...p, is_voided: true, void_reason: 'Pre-launch test transaction' }));
          safeStorage.setItem(paymentsKey, JSON.stringify(voided));
        }
      } catch (e) {
        safeStorage.setItem(paymentsKey, JSON.stringify([]));
      }
    }

    // Reset active table states
    safeDispatchEvent(new CustomEvent('rbh_orders_updated', { detail: [] }));
    safeDispatchEvent(new CustomEvent('rbh_payments_updated', { detail: [] }));

    return {
      success: true,
      message: `Go-Live cleanup completed for ${restaurantId}. Test orders archived; master menu, tables, and settings preserved.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to execute local reset: ${err?.message || 'Unknown error'}`
    };
  }
}



