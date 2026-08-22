export interface MenuItem {
  id: string | number;
  restaurant_id?: string;
  created_at?: string;
  Name: string;
  Price: number;
  Description: string;
  Image_url: string;
  Available: boolean;
  category?: 'Biryani Specials' | 'Starters & Tandoor' | 'Royal Curries' | 'Breads & Rice' | 'Beverages & Desserts' | 'Accompaniments';
  isVeg?: boolean;
  isSpicy?: boolean;
  isBestSeller?: boolean;
  prepTime?: string;
  stockCount?: number;
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  is_archived?: boolean;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  spiceLevel?: 'Mild' | 'Medium' | 'Royal Spicy';
  specialNotes?: string;
}

export type OrderStatus = 'New' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';

export interface OrderItem {
  id: string | number;
  restaurant_id?: string;
  name: string;
  price: number;
  quantity: number;
  spiceLevel?: string;
  notes?: string;
  portion?: string;
  image?: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Mixed';

export interface PaymentRecord {
  id: string;
  restaurant_id?: string;
  orderId?: string;
  sessionId?: string;
  tableNumber: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  createdAt: string;
  recordedBy?: string;
  notes?: string;
  is_voided?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

export interface Order {
  id: string;
  restaurant_id?: string;
  tableNumber: string;
  sessionId?: string; // Stable active dining session ID
  round?: number; // Round / ticket sequence in the session (1 = initial, 2+ = add-on)
  isAddon?: boolean; // Flag indicating if this was added to an existing session
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus?: 'Pending' | 'Partially Paid' | 'Paid';
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Mixed';
  paidAmount?: number;
  remainingAmount?: number;
  paymentHistory?: PaymentRecord[];
  paidAt?: string;
  customerName?: string;
  customerNotes?: string;
  createdAt: string;
  estimatedMinutes: number;
  is_archived?: boolean;
}

export interface DiningSession {
  sessionId: string;
  restaurant_id?: string;
  tableNumber: string;
  customerName?: string;
  orders: Order[];
  status: 'Active' | 'Completed' | 'Cancelled';
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid';
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Mixed';
  paymentHistory?: PaymentRecord[];
  paidAmount: number;
  remainingAmount: number;
  totalSubtotal: number;
  totalTax: number;
  grandTotal: number;
  totalItemsCount: number;
  startedAt: string;
  closedAt?: string;
  latestTicketStatus?: OrderStatus;
  is_archived?: boolean;
}

export interface CustomerFeedback {
  id: string;
  restaurant_id?: string;
  orderId?: string;
  tableNumber: string;
  customerName: string;
  rating: number; // 1 - 5
  review: string;
  tags?: string[];
  createdAt: string;
  is_archived?: boolean;
}

export interface RestaurantProfile {
  id: string; // unique restaurant_id e.g. rest_rbh_royal_biryani
  name: string;
  tagline?: string;
  address?: string;
  gstNumber?: string;
  phone?: string;
  currencySymbol: string;
  ownerName?: string;
  created_at?: string;
}

export type StaffRole = 'none' | 'customer' | 'kitchen' | 'counter' | 'manager' | 'admin';

export interface StaffProfile {
  id: string; // auth.users UUID
  restaurant_id: string;
  email: string;
  role: 'kitchen' | 'counter' | 'manager' | 'admin';
  is_active: boolean;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  restaurantId?: string;
}

export type RawMaterialUnit = 'kg' | 'g' | 'litre' | 'ml' | 'pcs' | 'pack' | 'can';

export type RawMaterialStockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';

export interface RawMaterial {
  id: string;
  restaurant_id?: string;
  name: string;
  category?: string;
  quantity: number;
  unit: RawMaterialUnit;
  minimumThreshold: number;
  status: RawMaterialStockStatus;
  updatedAt: string;
  lastUpdatedBy?: string;
  is_archived?: boolean;
}

export type StockMovementType = 'add' | 'reduce' | 'set';
export type StockMovementReason = 'New delivery' | 'Used in kitchen' | 'Wastage' | 'Stock correction' | 'Other';

export interface StockMovement {
  id: string;
  restaurant_id?: string;
  rawMaterialId: string;
  rawMaterialName: string;
  movementType: StockMovementType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  unit: RawMaterialUnit;
  reason: StockMovementReason;
  notes?: string;
  updatedBy: string;
  createdAt: string;
}

export interface RestaurantBackupSnapshot {
  version: string;
  exportedAt: string;
  restaurantId: string;
  restaurantName: string;
  data: {
    menuItems: MenuItem[];
    orders: Order[];
    payments: PaymentRecord[];
    rawMaterials: RawMaterial[];
    stockMovements: StockMovement[];
    feedbacks: CustomerFeedback[];
  };
}

