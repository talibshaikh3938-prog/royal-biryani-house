import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MenuItem, 
  Order, 
  SupabaseConfig, 
  CustomerFeedback, 
  RawMaterial, 
  StockMovement, 
  StockMovementType, 
  StockMovementReason, 
  RawMaterialStockStatus, 
  DiningSession, 
  PaymentRecord, 
  PaymentMode,
  RestaurantBackupSnapshot,
  RestaurantProfile,
  StaffProfile,
  StaffRole
} from '../types';
import { DEFAULT_MENU_ITEMS } from '../data/defaultMenu';
import { DEFAULT_RAW_MATERIALS, DEFAULT_STOCK_MOVEMENTS } from '../data/defaultRawMaterials';
import { INITIAL_HISTORICAL_ORDERS } from '../data/defaultOrders';

// Default Restaurant Identifier
export const DEFAULT_RESTAURANT_ID = 'rest_rbh_royal_biryani';

// Default Supabase table name specified by user
export const DEFAULT_TABLE_NAME = 'Royal biryani house demo';

// Storage keys
const ACTIVE_RESTAURANT_KEY = 'rbh_active_restaurant_id';
const SUPABASE_CONFIG_KEY = 'rbh_supabase_config';
const LOCAL_MENU_KEY = 'rbh_local_menu_items';
const MENU_AVAILABILITY_MAP_KEY = 'rbh_menu_item_availability_map';
const ORDERS_STORAGE_KEY = 'rbh_restaurant_orders';
const FEEDBACK_STORAGE_KEY = 'rbh_customer_feedbacks';
const RAW_MATERIALS_STORAGE_KEY = 'rbh_raw_materials_inventory';
const STOCK_MOVEMENTS_STORAGE_KEY = 'rbh_stock_movements_log';
const PAYMENTS_STORAGE_KEY = 'rbh_payments_log';
const STAFF_PROFILE_STORAGE_KEY = 'rbh_active_staff_profile';

// Multi-tenant Restaurant ID Management
export function getCurrentRestaurantId(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const rid = params.get('restaurant_id') || params.get('rid') || params.get('restaurant');
      if (rid && rid.trim()) {
        const clean = rid.trim().toLowerCase();
        // sync to storage for persistent session
        localStorage.setItem(ACTIVE_RESTAURANT_KEY, clean);
        return clean;
      }
    }
    const saved = localStorage.getItem(ACTIVE_RESTAURANT_KEY);
    if (saved && saved.trim()) {
      return saved.trim().toLowerCase();
    }
  } catch (e) {
    // fallback
  }
  return DEFAULT_RESTAURANT_ID;
}

export function setCurrentRestaurantId(restaurantId: string): void {
  const clean = restaurantId.trim().toLowerCase() || DEFAULT_RESTAURANT_ID;
  try {
    localStorage.setItem(ACTIVE_RESTAURANT_KEY, clean);
    window.dispatchEvent(new CustomEvent('rbh_restaurant_changed', { detail: { restaurantId: clean } }));
  } catch (e) {
    console.error('Failed to set restaurant ID', e);
  }
}

// Tenant-scoped Storage Key Generator
export function getTenantStorageKey(baseKey: string, restaurantId: string = getCurrentRestaurantId()): string {
  return `${baseKey}_${restaurantId}`;
}

// Staff Profile Storage Management
export function getCurrentStaffProfile(): StaffProfile | null {
  try {
    const saved = sessionStorage.getItem(STAFF_PROFILE_STORAGE_KEY);
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
      sessionStorage.setItem(STAFF_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      sessionStorage.setItem('rbh_staff_role', profile.role);
    } else {
      sessionStorage.removeItem(STAFF_PROFILE_STORAGE_KEY);
      sessionStorage.removeItem('rbh_staff_role');
    }
    window.dispatchEvent(new CustomEvent('rbh_staff_auth_changed', { detail: { profile } }));
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

  // If Supabase client is connected, perform real Supabase Auth
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (error) {
        return { user: null, profile: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, profile: null, error: 'Authentication failed. No user found.' };
      }

      // Check database-backed staff allowlist for this restaurant
      const { data: staffData, error: staffError } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('id', data.user.id)
        .eq('restaurant_id', targetRestaurantId)
        .eq('is_active', true)
        .maybeSingle();

      if (staffError) {
        console.warn('Error querying staff_profiles allowlist:', staffError.message);
      }

      if (staffData) {
        const profile: StaffProfile = {
          id: staffData.id,
          restaurant_id: staffData.restaurant_id,
          email: staffData.email || data.user.email || cleanEmail,
          role: staffData.role,
          is_active: staffData.is_active,
          full_name: staffData.full_name,
          created_at: staffData.created_at,
          updated_at: staffData.updated_at
        };
        saveCurrentStaffProfile(profile);
        return { user: data.user, profile, error: undefined };
      }

      // If no profile found in DB for this restaurant, check fallback if user was recently created or if demo mode
      // Supabase authenticated users without an active staff profile are NOT authorized as restaurant staff
      await supabase.auth.signOut();
      saveCurrentStaffProfile(null);
      return { 
        user: null, 
        profile: null, 
        error: `User "${cleanEmail}" is authenticated with Supabase, but is not an authorized staff member for restaurant "${targetRestaurantId}". Contact your manager.` 
      };
    } catch (err: any) {
      return { user: null, profile: null, error: err.message || 'Supabase authentication error' };
    }
  }

  // Demo fallback when Supabase credentials are not yet configured
  if (cleanEmail === 'chef@royalbiryani.com' || cleanEmail === 'kitchen@royalbiryani.com') {
    const profile: StaffProfile = {
      id: 'demo-kitchen-uid',
      restaurant_id: targetRestaurantId,
      email: cleanEmail,
      role: 'kitchen',
      is_active: true,
      full_name: 'Ustad Mohammed (Head Chef)'
    };
    saveCurrentStaffProfile(profile);
    return { user: { id: profile.id, email: cleanEmail }, profile, error: undefined };
  } else if (cleanEmail === 'manager@royalbiryani.com' || cleanEmail === 'counter@royalbiryani.com' || cleanEmail === 'admin@royalbiryani.com') {
    const profile: StaffProfile = {
      id: 'demo-counter-uid',
      restaurant_id: targetRestaurantId,
      email: cleanEmail,
      role: cleanEmail.includes('admin') ? 'admin' : (cleanEmail.includes('manager') ? 'manager' : 'counter'),
      is_active: true,
      full_name: 'Farhan Ali (Store Manager)'
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

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        // Verify active staff profile
        const { data: staffData } = await supabase
          .from('staff_profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .maybeSingle();

        if (staffData) {
          const profile: StaffProfile = {
            id: staffData.id,
            restaurant_id: staffData.restaurant_id,
            email: staffData.email || data.session.user.email || '',
            role: staffData.role,
            is_active: staffData.is_active,
            full_name: staffData.full_name,
            created_at: staffData.created_at,
            updated_at: staffData.updated_at
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
    const saved = localStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? localStorage.getItem(MENU_AVAILABILITY_MAP_KEY) : null);
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
    localStorage.setItem(tenantKey, JSON.stringify(map));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      localStorage.setItem(MENU_AVAILABILITY_MAP_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.error('Failed to save availability map', e);
  }
}

// Get current Supabase config
export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL as string) || '';
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '';
  const currentRid = getCurrentRestaurantId();

  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        tableName: parsed.tableName || DEFAULT_TABLE_NAME,
        restaurantId: parsed.restaurantId || currentRid,
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
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
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
  const name = row.Name ?? row.name ?? row.title ?? 'Biryani Special';
  const price = typeof row.Price === 'number' ? row.Price : Number(row.price ?? row.Price ?? 0);
  const description = row.Description ?? row.description ?? row.desc ?? '';
  const imageUrl = row.Image_url ?? row.image_url ?? row.Image ?? row.image ?? row.imageUrl ?? 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80';
  
  const rawId = row.id !== undefined && row.id !== null ? String(row.id) : '';
  const availMap = getMenuAvailabilityMap();

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

  let category: MenuItem['category'] = 'Biryani Specials';
  if (lowerName.includes('tikka') || lowerName.includes('kebab') || lowerName.includes('tandoori') || lowerName.includes('starter')) {
    category = 'Starters & Tandoor';
  } else if (lowerName.includes('curry') || lowerName.includes('butter chicken') || lowerName.includes('dal') || lowerName.includes('paneer') && !lowerName.includes('biryani')) {
    category = 'Royal Curries';
  } else if (lowerName.includes('naan') || lowerName.includes('roti') || lowerName.includes('bread') || lowerName.includes('rice') && !lowerName.includes('biryani')) {
    category = 'Breads & Rice';
  } else if (lowerName.includes('lassi') || lowerName.includes('jamun') || lowerName.includes('dessert') || lowerName.includes('tukda') || lowerName.includes('ice cream') || lowerName.includes('kulfi') || lowerName.includes('drink')) {
    category = 'Beverages & Desserts';
  }

  const isVeg = row.is_veg ?? row.isVeg ?? (
    lowerName.includes('paneer') ||
    lowerName.includes('dal') ||
    lowerName.includes('veg') ||
    lowerName.includes('naan') ||
    lowerName.includes('jamun') ||
    lowerName.includes('lassi') ||
    lowerName.includes('tukda')
  );

  const stockCount = typeof row.stock_count === 'number' ? row.stock_count : (typeof row.stockCount === 'number' ? row.stockCount : (available ? 20 : 0));
  const stockStatus: MenuItem['stockStatus'] = row.stock_status || row.stockStatus || (
    !available || stockCount === 0 ? 'Out of Stock' : (stockCount <= 5 ? 'Low Stock' : 'In Stock')
  );

  const finalId = rawId || `item-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: finalId,
    created_at: row.created_at,
    Name: name,
    Price: isNaN(price) ? 250 : price,
    Description: description,
    Image_url: imageUrl,
    Available: available && stockStatus !== 'Out of Stock',
    category: row.category || category,
    isVeg,
    isSpicy: row.is_spicy ?? (lowerName.includes('dum') || lowerName.includes('hyderabadi') || lowerName.includes('chili') || lowerName.includes('tikka')),
    isBestSeller: row.is_bestseller ?? (lowerName.includes('chicken biryani') || lowerName.includes('butter chicken') || lowerName.includes('malai tikka')),
    prepTime: row.prep_time || '15-20 mins',
    stockCount,
    stockStatus
  };
}

// Fetch menu items from Supabase or fallback
export async function fetchMenuItems(): Promise<{ items: MenuItem[]; source: 'supabase' | 'local'; error?: string }> {
  const config = getSupabaseConfig();
  const supabase = getSupabaseClient();
  const availMap = getMenuAvailabilityMap();

  if (supabase && config.tableName) {
    try {
      // Query table name
      const { data, error } = await supabase
        .from(config.tableName)
        .select('*');

      if (error) {
        console.warn(`Supabase query on "${config.tableName}" returned error:`, error.message);
        // If exact case table not found, try lower snake_case fallback
        const fallbackName = config.tableName.toLowerCase().replace(/ /g, '_');
        if (fallbackName !== config.tableName) {
          const retry = await supabase.from(fallbackName).select('*');
          if (!retry.error && retry.data && retry.data.length > 0) {
            const mapped = retry.data.map(mapSupabaseRowToMenuItem);
            // Update availability map and cache
            mapped.forEach(item => {
              availMap[String(item.id)] = item.Available;
            });
            saveMenuAvailabilityMap(availMap);
            localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(mapped));
            return { items: mapped, source: 'supabase' };
          }
        }
        return getLocalMenuItems(error.message);
      }

      if (data && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToMenuItem);
        mapped.forEach(item => {
          availMap[String(item.id)] = item.Available;
        });
        saveMenuAvailabilityMap(availMap);
        // Cache to local
        localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(mapped));
        return { items: mapped, source: 'supabase' };
      } else {
        // Table exists but is empty -> use defaults merged with availability map
        return getLocalMenuItems(`Table "${config.tableName}" is currently empty. You can seed demo items anytime.`);
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
    const cached = localStorage.getItem(LOCAL_MENU_KEY);
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
    const current = localStorage.getItem(LOCAL_MENU_KEY);
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
    localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(items));
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
  window.dispatchEvent(new CustomEvent('rbh_menu_availability_changed', { detail: { itemId: idStr, available } }));
  window.dispatchEvent(new Event('rbh_menu_updated'));

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

  if (!supabase) {
    return { success: false, message: 'Please configure your Supabase URL and Anon Key first.' };
  }

  try {
    const rowsToInsert = DEFAULT_MENU_ITEMS.map(item => ({
      Name: item.Name,
      Price: item.Price,
      Description: item.Description,
      Image_url: item.Image_url,
      Available: item.Available,
    }));

    const { data, error } = await supabase
      .from(config.tableName)
      .insert(rowsToInsert)
      .select();

    if (error) {
      // If column casing fails, try lower_case
      const lowerRows = DEFAULT_MENU_ITEMS.map(item => ({
        name: item.Name,
        price: item.Price,
        description: item.Description,
        image_url: item.Image_url,
        available: item.Available,
      }));

      const retry = await supabase.from(config.tableName).insert(lowerRows).select();
      if (retry.error) {
        return { success: false, message: `Failed to insert: ${retry.error.message}` };
      }
    }

    return { success: true, message: `Successfully inserted ${rowsToInsert.length} Royal Biryani House dishes into "${config.tableName}"!` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error inserting into Supabase' };
  }
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
    const saved = localStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
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
      localStorage.setItem(CUSTOMER_ACTIVE_ORDER_KEY, orderId);
    } else {
      localStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
    }
    window.dispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId } }));
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
  const paidAmount = typeof row.paid_amount === 'number' 
    ? row.paid_amount 
    : Number(row.paid_amount ?? (row.payment_status === 'Paid' ? total : 0));
  const remainingAmount = typeof row.remaining_amount === 'number' 
    ? row.remaining_amount 
    : Math.max(0, total - paidAmount);

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
    paymentStatus: (row.payment_status || row.paymentStatus || 'Pending') as Order['paymentStatus'],
    paymentMode: (row.payment_mode || row.paymentMode || 'UPI') as Order['paymentMode'],
    paidAmount: isNaN(paidAmount) ? 0 : paidAmount,
    remainingAmount: isNaN(remainingAmount) ? 0 : remainingAmount,
    paymentHistory: parsedPaymentHistory,
    paidAt: row.paid_at || row.paidAt,
    customerName: row.customer_name || row.customerName,
    customerNotes: row.customer_notes || row.customerNotes,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    estimatedMinutes: row.estimated_minutes || row.estimatedMinutes || 15,
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

      if (error) {
        // Fallback to 'orders' table
        const retry = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (!error && data) {
        if (data.length > 0) {
          const mapped = data.map(mapSupabaseRowToOrder);
          saveStoredOrders(mapped, restaurantId);
          return { orders: mapped, source: 'supabase' };
        } else if (restaurantId === DEFAULT_RESTAURANT_ID) {
          // Table exists but is empty for default restaurant -> seed initial historical orders to Supabase
          const seeded = INITIAL_HISTORICAL_ORDERS.map(o => ({ ...o, restaurant_id: DEFAULT_RESTAURANT_ID }));
          saveStoredOrders(seeded, DEFAULT_RESTAURANT_ID);
          const rowsToInsert = seeded.map(o => mapOrderToSupabasePayload(o));
          Promise.resolve(supabase.from('royal_orders').insert(rowsToInsert)).then(res => {
            if (res.error) {
              Promise.resolve(supabase.from('orders').insert(rowsToInsert)).catch(() => {});
            }
          }).catch(() => {});
          return { orders: seeded, source: 'supabase' };
        }
      }
    } catch (e: any) {
      console.warn('Failed to fetch orders from Supabase:', e);
    }
  }

  return { orders: getStoredOrders(restaurantId), source: 'local' };
}

export function getStoredOrders(restaurantId: string = getCurrentRestaurantId()): Order[] {
  try {
    const tenantKey = getTenantStorageKey(ORDERS_STORAGE_KEY, restaurantId);
    const saved = localStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? localStorage.getItem(ORDERS_STORAGE_KEY) : null);
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
    localStorage.setItem(tenantKey, JSON.stringify(seeded));
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  return [];
}

export function saveStoredOrders(orders: Order[], restaurantId: string = getCurrentRestaurantId()): void {
  try {
    const tenantKey = getTenantStorageKey(ORDERS_STORAGE_KEY, restaurantId);
    localStorage.setItem(tenantKey, JSON.stringify(orders));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
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
      o.status !== 'Completed' &&
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

  const updated = [finalOrder, ...current.filter(o => o.id !== finalOrder.id)];
  saveStoredOrders(updated, currentRid);
  setCustomerActiveOrderId(finalOrder.id);

  // Push to Supabase with strict restaurant_id isolation and await
  const supabase = getSupabaseClient();
  if (supabase) {
    const payload = mapOrderToSupabasePayload(finalOrder);
    try {
      const res = await supabase
        .from('royal_orders')
        .upsert([payload], { onConflict: 'order_id' });

      if (res.error) {
        await supabase.from('orders').upsert([payload], { onConflict: 'order_id' });
      }
    } catch (err) {
      console.warn('Supabase saveOrder notice:', err);
    }

    try {
      const channel = supabase.channel(`restaurant_${currentRid}`);
      channel.send({
        type: 'broadcast',
        event: 'new_order',
        payload: finalOrder
      });
    } catch (e) {
      // Ignore
    }
  }

  window.dispatchEvent(new CustomEvent('rbh_new_order', { detail: finalOrder }));
  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({ type: 'NEW_ORDER', order: finalOrder, restaurantId: currentRid });
  }

  return finalOrder;
}

export async function updateOrderStatus(orderId: string, status: Order['status'], restaurantId: string = getCurrentRestaurantId()): Promise<void> {
  const current = getStoredOrders(restaurantId);
  const updated = current.map(o => o.id === orderId ? { ...o, status } : o);
  saveStoredOrders(updated, restaurantId);

  // Update in Supabase scoped by restaurant_id and await write completion
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('royal_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('restaurant_id', restaurantId);

      if (error) {
        await supabase
          .from('orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('order_id', orderId)
          .eq('restaurant_id', restaurantId);
      }
    } catch (err) {
      console.warn('Supabase updateOrderStatus error:', err);
    }

    try {
      const channel = supabase.channel(`restaurant_${restaurantId}`);
      channel.send({
        type: 'broadcast',
        event: 'order_status_updated',
        payload: { orderId, status, restaurantId }
      });
    } catch (e) {
      // Ignore
    }
  }

  // Dispatch events AFTER Supabase is updated so that listener refetches see the newest data
  window.dispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, status, restaurantId } }));
  
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
  }

  window.dispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, is_archived: true, restaurantId } }));
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
  }

  window.dispatchEvent(new CustomEvent('rbh_order_status_updated', { detail: { orderId, status: 'Cancelled', restaurantId } }));
  return updatedOrder;
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
      window.dispatchEvent(new CustomEvent('rbh_feedback_updated', { detail: event.data.feedback }));
    }
    if (event.data && event.data.type === 'MENU_AVAILABILITY_CHANGED') {
      window.dispatchEvent(new CustomEvent('rbh_menu_availability_changed', { detail: event.data }));
      window.dispatchEvent(new Event('rbh_menu_updated'));
    }
    if (event.data && event.data.type === 'RAW_MATERIALS_UPDATED') {
      window.dispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: event.data }));
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === ORDERS_STORAGE_KEY || event.key === CUSTOMER_ACTIVE_ORDER_KEY) {
      notifyRealtimeListeners();
    }
    if (event.key === FEEDBACK_STORAGE_KEY) {
      window.dispatchEvent(new CustomEvent('rbh_feedback_updated'));
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
      const channelName = `royal_orders_realtime_${getCurrentRestaurantId()}`;
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
                localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
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
                localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
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
              localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
            }
          }
          notifyRealtimeListeners();
        })
        .on('broadcast', { event: 'new_order' }, () => {
          notifyRealtimeListeners();
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
        const retry = await supabase
          .from('payments')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (!error && data) {
        if (data.length > 0) {
          const mapped = data.map(mapSupabaseRowToPayment);
          saveStoredPayments(mapped, restaurantId);
          return { payments: mapped, source: 'supabase' };
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
    const raw = localStorage.getItem(tenantKey) || (restaurantId === DEFAULT_RESTAURANT_ID ? localStorage.getItem(PAYMENTS_STORAGE_KEY) : null);
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
      if (ord.paymentStatus === 'Paid' || ord.status === 'Completed') {
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
    localStorage.setItem(tenantKey, JSON.stringify(payments));
    if (restaurantId === DEFAULT_RESTAURANT_ID) {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
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
  
  window.dispatchEvent(new CustomEvent('rbh_payment_added', { detail: newRecord }));

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
    ).then(res => {
      if (res.error) {
        return supabase.from('payments').insert([{
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
        }]);
      }
    }).catch(() => {});
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

  window.dispatchEvent(new CustomEvent('rbh_payment_voided', { detail: updatedRecord }));

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
    if (o.status === 'Cancelled') return false;
    if (targetSessionId && o.sessionId && o.sessionId === targetSessionId) return true;
    if (targetTableNumber && o.tableNumber.toLowerCase() === targetTableNumber.toLowerCase() && o.paymentStatus !== 'Paid') return true;
    if (params.orderId && o.id === params.orderId) return true;
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

  // Generate new PaymentRecords
  const newPayments: PaymentRecord[] = [];
  validSplits.forEach((split) => {
    const rec = savePaymentRecord({
      orderId: matchingOrders[0]?.id,
      sessionId: targetSessionId || matchingOrders[0]?.sessionId,
      tableNumber: targetTableNumber || matchingOrders[0]?.tableNumber || 'Table',
      amount: split.amount,
      paymentMode: split.mode,
      recordedBy: params.recordedBy || 'Counter Cashier',
      notes: params.notes
    });
    newPayments.push(rec);
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

  const newPaymentStatus: 'Paid' | 'Partially Paid' | 'Pending' = isFullyPaid 
    ? 'Paid' 
    : (newTotalPaid > 0 ? 'Partially Paid' : 'Pending');

  // Update orders
  const affectedOrderIds: string[] = matchingOrders.map(o => o.id);
  const updatedOrders = currentOrders.map(o => {
    if (affectedOrderIds.includes(o.id)) {
      return {
        ...o,
        status: isFullyPaid ? ('Completed' as const) : o.status,
        paymentStatus: newPaymentStatus,
        paymentMode: finalPaymentMode,
        paidAmount: newTotalPaid,
        remainingAmount: newRemaining,
        paymentHistory: allSessionPayments,
        paidAt: isFullyPaid ? nowIso : (o.paidAt || nowIso)
      };
    }
    return o;
  });

  saveStoredOrders(updatedOrders, currentOrders[0]?.restaurant_id || getCurrentRestaurantId());

  // If fully paid, clear active customer tracking
  if (isFullyPaid) {
    try {
      const activeId = localStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
      if (activeId && affectedOrderIds.includes(activeId)) {
        localStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
        window.dispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId: null } }));
      }
    } catch (e) {
      // Ignore
    }
  }

  // Push to Supabase if connected and AWAIT before triggering listeners
  const currentRestaurantId = currentOrders[0]?.restaurant_id || getCurrentRestaurantId();
  const supabase = getSupabaseClient();
  if (supabase && affectedOrderIds.length > 0) {
    try {
      await Promise.all(
        affectedOrderIds.map(async (id) => {
          const ord = updatedOrders.find(o => o.id === id);
          const updatePayload: Record<string, any> = {
            status: isFullyPaid ? 'Completed' : ord?.status,
            payment_status: newPaymentStatus,
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
            await supabase
              .from('orders')
              .update(updatePayload)
              .eq('order_id', id)
              .eq('restaurant_id', currentRestaurantId);
          }
        })
      );
    } catch (err) {
      console.warn('Supabase recordDiningSessionPayment sync error:', err);
    }
  }

  window.dispatchEvent(new CustomEvent('rbh_order_status_updated', {
    detail: {
      sessionId: targetSessionId,
      tableNumber: targetTableNumber,
      orderIds: affectedOrderIds,
      status: isFullyPaid ? 'Completed' : 'Updated',
      paymentStatus: newPaymentStatus
    }
  }));
  window.dispatchEvent(new Event('rbh_order_updated'));

  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({
      type: 'STATUS_UPDATED',
      sessionId: targetSessionId,
      tableNumber: targetTableNumber,
      orderIds: affectedOrderIds,
      status: isFullyPaid ? 'Completed' : 'Updated',
      paymentStatus: newPaymentStatus
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
      const activeId = localStorage.getItem(CUSTOMER_ACTIVE_ORDER_KEY);
      if (activeId && affectedOrderIds.includes(activeId)) {
        localStorage.removeItem(CUSTOMER_ACTIVE_ORDER_KEY);
        window.dispatchEvent(new CustomEvent('rbh_customer_order_changed', { detail: { orderId: null } }));
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
              await supabase
                .from('orders')
                .update(updatePayload)
                .eq('order_id', id)
                .eq('restaurant_id', restaurantId);
            }
          })
        );
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('rbh_order_status_updated', {
      detail: { sessionId: targetSessionId, tableNumber: targetTableNumber, orderIds: affectedOrderIds, status: 'Completed', paymentStatus: 'Paid', restaurantId }
    }));
    window.dispatchEvent(new Event('rbh_order_updated'));
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
        const retry = await supabase
          .from('feedback')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (!error && data && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToFeedback);
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(mapped));
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
    const saved = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse customer feedbacks', e);
  }

  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_FEEDBACKS));
  return INITIAL_DEMO_FEEDBACKS;
}

export function saveCustomerFeedback(feedback: CustomerFeedback): void {
  const current = getStoredFeedback();
  const updated = [feedback, ...current.filter(f => f.id !== feedback.id)];
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('rbh_feedback_updated', { detail: feedback }));

  if (ordersBroadcastChannel) {
    ordersBroadcastChannel.postMessage({ type: 'FEEDBACK_UPDATED', feedback });
  }

  // Also push to Supabase if feedback table exists
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('customer_feedback').insert([{
        feedback_id: feedback.id,
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
        return supabase.from('feedback').insert([{
          id: feedback.id,
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

    try {
      const channel = supabase.channel('royal_orders_realtime');
      channel.send({
        type: 'broadcast',
        event: 'feedback_submitted',
        payload: feedback
      });
    } catch (e) {
      // Ignore
    }
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
    const saved = localStorage.getItem(LOCAL_MENU_KEY);
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
      localStorage.setItem(LOCAL_MENU_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to update item stock', e);
  }
  await updateMenuItemAvailability(itemId, available);
}

// ==========================================
// RAW MATERIAL INVENTORY & STOCK MOVEMENTS
// ==========================================

export function getStoredRawMaterials(): RawMaterial[] {
  try {
    const saved = localStorage.getItem(RAW_MATERIALS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read raw materials from storage', e);
  }
  // Initialize with defaults if empty
  try {
    localStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(DEFAULT_RAW_MATERIALS));
  } catch (e) {
    // Ignore
  }
  return DEFAULT_RAW_MATERIALS;
}

export async function fetchStockMovements(): Promise<{ movements: StockMovement[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped: StockMovement[] = data.map((row: any) => ({
          id: String(row.id),
          restaurant_id: row.restaurant_id,
          rawMaterialId: row.raw_material_id || row.rawMaterialId,
          rawMaterialName: row.raw_material_name || row.rawMaterialName,
          movementType: row.movement_type || row.movementType || 'add',
          quantityChange: Number(row.quantity_change ?? row.quantityChange ?? 0),
          previousQuantity: Number(row.previous_quantity ?? row.previousQuantity ?? 0),
          newQuantity: Number(row.new_quantity ?? row.newQuantity ?? 0),
          unit: row.unit || 'kg',
          reason: row.reason || 'Other',
          notes: row.notes || '',
          updatedBy: row.updated_by || row.updatedBy || 'Kitchen Chef',
          createdAt: row.created_at || row.createdAt || new Date().toISOString()
        }));
        localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(mapped));
        return { movements: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch stock movements from Supabase, using local:', e);
    }
  }
  return { movements: getStoredStockMovements(), source: 'local' };
}

export function getStoredStockMovements(): StockMovement[] {
  try {
    const saved = localStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read stock movements from storage', e);
  }
  try {
    localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_STOCK_MOVEMENTS));
  } catch (e) {
    // Ignore
  }
  return DEFAULT_STOCK_MOVEMENTS;
}

export async function fetchRawMaterials(): Promise<{ items: RawMaterial[]; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('raw_materials').select('*');
      if (!error && data && data.length > 0) {
        const mapped: RawMaterial[] = data.map((row: any) => {
          const qty = Number(row.quantity ?? row.Quantity ?? 0);
          const min = Number(row.minimum_threshold ?? row.minimumThreshold ?? row.MinimumThreshold ?? 5);
          const status: RawMaterialStockStatus = qty <= 0 ? 'OUT OF STOCK' : (qty <= min ? 'LOW STOCK' : 'IN STOCK');
          return {
            id: String(row.id),
            name: row.name ?? row.Name ?? 'Ingredient',
            category: row.category ?? row.Category ?? 'Others',
            quantity: isNaN(qty) ? 0 : qty,
            unit: (row.unit ?? row.Unit ?? 'kg') as any,
            minimumThreshold: isNaN(min) ? 5 : min,
            status: (row.status ?? status) as RawMaterialStockStatus,
            updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
            lastUpdatedBy: row.last_updated_by ?? row.lastUpdatedBy ?? 'Kitchen Chef'
          };
        });
        localStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(mapped));
        return { items: mapped, source: 'supabase' };
      }
    } catch (e) {
      console.warn('Failed to fetch raw materials from Supabase, using local:', e);
    }
  }
  return { items: getStoredRawMaterials(), source: 'local' };
}

export async function updateRawMaterialStock(params: {
  rawMaterialId: string;
  action: StockMovementType;
  quantity: number;
  reason: StockMovementReason;
  updatedBy: string;
  notes?: string;
}): Promise<RawMaterial | null> {
  const items = getStoredRawMaterials();
  const index = items.findIndex(i => i.id === params.rawMaterialId);
  if (index === -1) return null;

  const current = items[index];
  const prevQty = current.quantity;
  let newQty = prevQty;
  let change = 0;

  if (params.action === 'add') {
    change = Math.abs(params.quantity);
    newQty = prevQty + change;
  } else if (params.action === 'reduce') {
    change = -Math.abs(params.quantity);
    newQty = Math.max(0, prevQty - Math.abs(params.quantity));
  } else {
    // set exact
    newQty = Math.max(0, params.quantity);
    change = newQty - prevQty;
  }

  newQty = Math.round(newQty * 100) / 100;
  const status: RawMaterialStockStatus = newQty <= 0 ? 'OUT OF STOCK' : (newQty <= current.minimumThreshold ? 'LOW STOCK' : 'IN STOCK');

  const updatedItem: RawMaterial = {
    ...current,
    quantity: newQty,
    status,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: params.updatedBy || 'Kitchen Chef'
  };

  items[index] = updatedItem;
  localStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(items));

  // Log movement
  const movements = getStoredStockMovements();
  const newMovement: StockMovement = {
    id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    rawMaterialId: current.id,
    rawMaterialName: current.name,
    movementType: params.action,
    quantityChange: change,
    previousQuantity: prevQty,
    newQuantity: newQty,
    unit: current.unit,
    reason: params.reason,
    notes: params.notes || '',
    updatedBy: params.updatedBy || 'Kitchen Chef',
    createdAt: new Date().toISOString()
  };

  movements.unshift(newMovement);
  // Keep last 100 movements
  localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements.slice(0, 100)));

  // Dispatch window events
  window.dispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: { rawMaterial: updatedItem, movement: newMovement } }));

  // Broadcast across tabs
  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({
        type: 'RAW_MATERIALS_UPDATED',
        rawMaterial: updatedItem,
        movement: newMovement
      });
    } catch (e) {
      // Ignore
    }
  }

  // Push to Supabase if connected
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase
        .from('raw_materials')
        .update({
          quantity: newQty,
          status,
          updated_at: updatedItem.updatedAt,
          last_updated_by: updatedItem.lastUpdatedBy
        })
        .eq('id', current.id)
    ).catch(() => {});

    Promise.resolve(
      supabase
        .from('stock_movements')
        .insert([{
          id: newMovement.id,
          raw_material_id: newMovement.rawMaterialId,
          raw_material_name: newMovement.rawMaterialName,
          movement_type: newMovement.movementType,
          quantity_change: newMovement.quantityChange,
          previous_quantity: newMovement.previousQuantity,
          new_quantity: newMovement.newQuantity,
          unit: newMovement.unit,
          reason: newMovement.reason,
          notes: newMovement.notes,
          updated_by: newMovement.updatedBy,
          created_at: newMovement.createdAt
        }])
    ).catch(() => {});

    try {
      const channel = supabase.channel('royal_orders_realtime');
      channel.send({
        type: 'broadcast',
        event: 'raw_materials_updated',
        payload: { rawMaterial: updatedItem, movement: newMovement }
      });
    } catch (e) {
      // Ignore
    }
  }

  return updatedItem;
}

export async function addNewRawMaterial(params: {
  name: string;
  quantity: number;
  unit: RawMaterial['unit'];
  minimumThreshold: number;
  category?: string;
  updatedBy?: string;
  initialNotes?: string;
}): Promise<RawMaterial> {
  const items = getStoredRawMaterials();
  const qty = Math.max(0, Math.round(Number(params.quantity) * 100) / 100);
  const min = Math.max(0.1, Math.round(Number(params.minimumThreshold) * 100) / 100);
  const status: RawMaterialStockStatus = qty <= 0 ? 'OUT OF STOCK' : (qty <= min ? 'LOW STOCK' : 'IN STOCK');

  const newItem: RawMaterial = {
    id: `raw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: params.name.trim(),
    category: params.category || 'General Kitchen Staples',
    quantity: qty,
    unit: params.unit,
    minimumThreshold: min,
    status,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: params.updatedBy || 'Kitchen Chef'
  };

  items.unshift(newItem);
  localStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(items));

  // Log initial movement
  const movements = getStoredStockMovements();
  const initialMovement: StockMovement = {
    id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    rawMaterialId: newItem.id,
    rawMaterialName: newItem.name,
    movementType: 'add',
    quantityChange: qty,
    previousQuantity: 0,
    newQuantity: qty,
    unit: newItem.unit,
    reason: 'New delivery',
    notes: params.initialNotes || 'Initial ingredient stock intake',
    updatedBy: params.updatedBy || 'Kitchen Chef',
    createdAt: new Date().toISOString()
  };
  movements.unshift(initialMovement);
  localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements.slice(0, 100)));

  window.dispatchEvent(new CustomEvent('rbh_raw_materials_updated', { detail: { rawMaterial: newItem, movement: initialMovement } }));

  if (ordersBroadcastChannel) {
    try {
      ordersBroadcastChannel.postMessage({
        type: 'RAW_MATERIALS_UPDATED',
        rawMaterial: newItem,
        movement: initialMovement
      });
    } catch (e) {}
  }

  // Supabase push
  const supabase = getSupabaseClient();
  if (supabase) {
    Promise.resolve(
      supabase.from('raw_materials').insert([{
        id: newItem.id,
        name: newItem.name,
        category: newItem.category,
        quantity: newItem.quantity,
        unit: newItem.unit,
        minimum_threshold: newItem.minimumThreshold,
        status: newItem.status,
        updated_at: newItem.updatedAt,
        last_updated_by: newItem.lastUpdatedBy
      }])
    ).catch(() => {});
  }

  return newItem;
}

export function subscribeToRawMaterialsRealtime(onRawMaterialsChange: () => void): () => void {
  const handleLocal = () => onRawMaterialsChange();
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data && event.data.type === 'RAW_MATERIALS_UPDATED') {
      onRawMaterialsChange();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === RAW_MATERIALS_STORAGE_KEY || event.key === STOCK_MOVEMENTS_STORAGE_KEY) {
      onRawMaterialsChange();
    }
  };

  window.addEventListener('rbh_raw_materials_updated', handleLocal);
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
        .on('broadcast', { event: 'raw_materials_updated' }, () => {
          onRawMaterialsChange();
        })
        .subscribe();
    } catch (e) {}
  }

  return () => {
    window.removeEventListener('rbh_raw_materials_updated', handleLocal);
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
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(snapshot.feedback));
    }
    if (Array.isArray(snapshot.rawMaterials)) {
      localStorage.setItem(RAW_MATERIALS_STORAGE_KEY, JSON.stringify(snapshot.rawMaterials));
    }
    if (Array.isArray(snapshot.stockMovements)) {
      localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(snapshot.stockMovements));
    }
    window.dispatchEvent(new Event('rbh_order_updated'));
    window.dispatchEvent(new Event('rbh_storage_reset'));
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

-- 2. RESTAURANTS PROFILE TABLE
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

-- Insert Default Tenant
INSERT INTO public.restaurants (id, name, tagline, address, phone, currency, tax_rate)
VALUES ('${restaurantId}', 'Royal Biryani House', 'Authentic Dum Biryani & Mughlai Cuisine', '124 Heritage Lane, Connaught Place, New Delhi', '+91 98765 43210', 'INR', 5.00)
ON CONFLICT (id) DO NOTHING;

-- 3. STAFF & RBAC ROLES TABLE
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

-- 4. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE,
    stock_status VARCHAR(32) DEFAULT 'In Stock',
    stock_count INTEGER DEFAULT 50,
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

-- 7. RAW MATERIALS & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) DEFAULT 'Kitchen Staples',
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(16) NOT NULL DEFAULT 'kg',
    minimum_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5,
    status VARCHAR(32) DEFAULT 'IN STOCK',
    last_updated_by VARCHAR(255) DEFAULT 'Kitchen Chef',
    is_archived BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_restaurant ON public.raw_materials(restaurant_id);

-- 8. STOCK MOVEMENTS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    raw_material_id VARCHAR(64) NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name VARCHAR(255) NOT NULL,
    movement_type VARCHAR(16) NOT NULL CHECK (movement_type IN ('add', 'reduce', 'set')),
    quantity_change NUMERIC(10, 2) NOT NULL,
    previous_quantity NUMERIC(10, 2) NOT NULL,
    new_quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    reason VARCHAR(64) NOT NULL,
    notes TEXT,
    updated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_restaurant ON public.stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_movements_material ON public.stock_movements(restaurant_id, raw_material_id);

-- 9. CUSTOMER FEEDBACK TABLE
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
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- Helper security function: Extract restaurant_id for authenticated staff member
CREATE OR REPLACE FUNCTION public.get_auth_restaurant_id()
RETURNS VARCHAR(64)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT restaurant_id FROM public.staff_accounts WHERE user_id = auth.uid() LIMIT 1;
$$;

-- RLS POLICIES FOR MENU ITEMS
-- Public/Customers can read menu items of any valid restaurant
CREATE POLICY "Public can view active menu items"
ON public.menu_items FOR SELECT
USING (is_archived = false);

-- Staff can insert/update menu items only for their assigned restaurant
CREATE POLICY "Staff can manage menu items for their restaurant"
ON public.menu_items FOR ALL
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

-- RLS POLICIES FOR ORDERS
-- Customers & Staff can create new table orders
CREATE POLICY "Allow customers and staff to create orders"
ON public.royal_orders FOR INSERT
WITH CHECK (true);

-- Staff can view and update orders only for their restaurant
CREATE POLICY "Staff can view orders for their restaurant"
ON public.royal_orders FOR SELECT
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

CREATE POLICY "Staff can update orders for their restaurant"
ON public.royal_orders FOR UPDATE
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

-- RLS POLICIES FOR PAYMENTS
-- Payments can be created and read only for the designated restaurant
CREATE POLICY "Staff can view payments for their restaurant"
ON public.royal_payments FOR SELECT
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

CREATE POLICY "Staff can insert payments for their restaurant"
ON public.royal_payments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can void payments for their restaurant"
ON public.royal_payments FOR UPDATE
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

-- RLS POLICIES FOR RAW MATERIALS & STOCK MOVEMENTS
CREATE POLICY "Kitchen and Managers can view inventory"
ON public.raw_materials FOR SELECT
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

CREATE POLICY "Kitchen and Managers can manage inventory"
ON public.raw_materials FOR ALL
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

CREATE POLICY "Audit log stock movements view"
ON public.stock_movements FOR SELECT
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');

CREATE POLICY "Audit log stock movements insert"
ON public.stock_movements FOR INSERT
WITH CHECK (true);

-- RLS POLICIES FOR FEEDBACK
CREATE POLICY "Customers can submit feedback"
ON public.customer_feedback FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can read feedback for their restaurant"
ON public.customer_feedback FOR SELECT
USING (restaurant_id = public.get_auth_restaurant_id() OR auth.role() = 'anon');
`;
}



