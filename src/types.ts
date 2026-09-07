export type VariantUnit = 'pcs' | 'g' | 'kg' | 'ml' | 'L' | 'portion' | 'size' | 'can' | 'bottle' | 'plate' | 'piece' | 'half' | 'full' | 'peg' | 'glass';

export interface MenuItemVariant {
  id: string;
  name: string; // e.g. "Half", "Full", "Small", "Medium", "Large", "30ml", "60ml", "250ml", "500ml", "750ml", "1L", "Plate", "Piece", "Kg"
  unit: VariantUnit;
  unitValue?: number | string; // e.g. 30, 60, 90, 250, 500, 750, 1000, 0.5, 1
  price: number; // e.g. 120, 220, 320
  isDefault?: boolean;
  stockCount?: number;
  available?: boolean;
  sku?: string;
}

export type ItemVariant = MenuItemVariant;

export interface MenuItemAddon {
  id: string;
  name: string; // e.g. "Extra cheese", "Extra chicken", "Raita", "Onion", "Sauce", "Extra Gravy"
  price: number; // e.g. 30, 50
  isVeg?: boolean;
  available?: boolean;
}

export type ItemAddon = MenuItemAddon;

export interface MenuSubcategory {
  id: string;
  restaurant_id?: string;
  categoryId: string; // Parent category ID or name
  name: string; // e.g. "Soft Drinks", "Alcohol", "Mocktails", "Dum Biryani", "Tandoori Starters"
  description?: string;
  displayOrder?: number;
  isActive: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id?: string;
  name: string; // e.g. "Beverages", "Biryani Specials", "Starters & Tandoor", "Royal Curries"
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
  subcategories?: MenuSubcategory[];
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string | number;
  restaurant_id?: string;
  created_at?: string;
  Name: string;
  Price: number;
  basePrice?: number;
  Description: string;
  Image_url: string;
  Available: boolean;
  category?: 'Biryani Specials' | 'Starters & Tandoor' | 'Royal Curries' | 'Breads & Rice' | 'Beverages & Desserts' | 'Accompaniments' | string;
  categoryId?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  isVeg?: boolean;
  vegType?: 'Veg' | 'Non-Veg' | 'Vegan' | 'Egg';
  isSpicy?: boolean;
  isBestSeller?: boolean;
  prepTime?: string;
  sku?: string; // Unique item SKU / item code
  stockCount?: number;
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
  // Alcohol / Beverage configurable fields
  brand?: string;
  beverageType?: string; // e.g. 'Beer', 'Whiskey', 'Vodka', 'Wine', 'Mocktail', 'Soft Drink', 'Juice', 'Hot Beverage', etc.
  volumeMl?: number; // Volume in ml (e.g. 330, 650, 750)
  servingSize?: string; // e.g. "30ml Peg", "60ml Large", "330ml Pint", "750ml Bottle"
  mrp?: number; // MRP if required
  taxCategory?: 'standard' | 'liquor' | 'exempt' | 'special' | string;
  displayOrder?: number;
  is_archived?: boolean;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  tableNumber: string; // e.g. "Table 1", "Table O1", "Bar 1", "Takeaway Counter"
  section: string; // e.g. "Ground Floor", "First Floor", "Outdoor", "Rooftop", "Bar Area", "Takeaway"
  capacity: number; // e.g. 2, 4, 6, 8
  isActive: boolean;
  displayOrder?: number;
  qrCodeUrl?: string;
  qr_token?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantSettings {
  id: string;
  restaurant_id?: string;
  name: string;
  restaurant_name?: string;
  logo?: string;
  logo_url?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  gstin?: string;
  gstNumber?: string;
  openingTime?: string; // e.g. "11:00 AM" or "11:00"
  closingTime?: string; // e.g. "11:00 PM" or "23:00"
  restaurantType?: string; // e.g. 'Dine-In & Takeaway', 'Fine Dining', 'Bar & Kitchen', 'QSR / Fast Casual', 'Cafe'
  gstEnabled?: boolean;
  gstRate?: number; // e.g. 5.0
  gst_percentage?: number;
  serviceChargeEnabled?: boolean;
  serviceChargeRate?: number; // e.g. 5.0 or 10.0
  service_charge_percentage?: number;
  receiptFooter?: string; // e.g. "Thank you for dining with us! Please visit again."
  currencySymbol?: string; // '₹'
  created_at?: string;
  updated_at?: string;
}

export interface BulkImportRow {
  category: string;
  subcategory?: string;
  itemName: string;
  variant?: string;
  unit?: string;
  price: string | number;
  vegNonVeg?: string;
  description?: string;
  sku?: string;
  active?: string | boolean;
  imageUrl?: string;
  prepTime?: string;
  addon?: string;
  brand?: string;
  beverageType?: string;
  servingSize?: string;
  mrp?: string | number;
  taxCategory?: string;
}

export interface ImportValidationResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: { row: number; field: string; message: string; data?: any }[];
  validItems: Partial<MenuItem>[];
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  selectedVariant?: MenuItemVariant;
  selectedAddons?: MenuItemAddon[];
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
  selectedVariant?: MenuItemVariant;
  variantName?: string;
  variantUnit?: string;
  selectedAddons?: MenuItemAddon[];
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
  qr_token?: string;
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

export type RawMaterialUnit = 'kg' | 'g' | 'litre' | 'ml' | 'pcs' | 'pack' | 'can' | 'bottle' | 'box';

export type RawMaterialStockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';

export interface RawMaterial {
  id: string;
  restaurant_id?: string;
  sku?: string;
  name: string;
  category?: string;
  quantity: number;
  unit: RawMaterialUnit;
  minimumThreshold: number;
  reorderLevel?: number;
  maxStock?: number;
  purchasePrice?: number; // Cost price per standard unit (e.g. ₹ per kg / litre / pcs)
  supplier?: string;
  status: RawMaterialStockStatus;
  isActive?: boolean;
  notes?: string;
  updatedAt: string;
  lastUpdatedBy?: string;
  is_archived?: boolean;
}

export type StockMovementType = 
  | 'PURCHASE' 
  | 'SALE_CONSUMPTION' 
  | 'WASTAGE' 
  | 'ADJUSTMENT' 
  | 'RETURN' 
  | 'OPENING_STOCK'
  | 'add' 
  | 'reduce' 
  | 'set'
  | 'deduct'
  | 'waste'
  | 'audit_reset';

export type DbStockMovementType = 'add' | 'deduct' | 'waste' | 'audit_reset';

export type StockMovementReason = 
  | 'New delivery' 
  | 'Purchase Stock-In'
  | 'Used in kitchen' 
  | 'Order Sale Consumption'
  | 'Wastage' 
  | 'Spoilage'
  | 'Prep Loss'
  | 'Expired'
  | 'Stock correction' 
  | 'Physical Audit Adjustment'
  | 'Customer Return'
  | 'Opening Stock'
  | 'Other';

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
  costPerUnit?: number;
  totalCost?: number;
  referenceType?: 'PURCHASE' | 'ORDER' | 'WASTAGE' | 'PHYSICAL_AUDIT' | 'MANUAL';
  referenceId?: string;
  reason: StockMovementReason | string;
  notes?: string;
  updatedBy: string;
  createdAt: string;
}

export interface PurchaseItemEntry {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  unit: RawMaterialUnit;
  unitPrice: number;
  totalPrice: number;
  expiryDate?: string;
}

export interface InventoryPurchaseRecord {
  id: string;
  restaurant_id?: string;
  invoiceNumber: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Pending' | 'Credit';
  paymentMode?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit';
  items: PurchaseItemEntry[];
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface InventoryWastageRecord {
  id: string;
  restaurant_id?: string;
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  unit: RawMaterialUnit;
  reason: 'Spoilage' | 'Kitchen Prep Loss' | 'Damaged / Dropped' | 'Expired' | 'Overcooking' | 'Other';
  unitCost?: number;
  estimatedLossValue: number;
  date: string;
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface RecipeIngredient {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number; // Consumption quantity (e.g. 250 for 250g)
  unit: RawMaterialUnit; // Unit consumed in (e.g. 'g', 'kg', 'ml', 'pcs')
  isOptional?: boolean;
  notes?: string;
  estimatedCost?: number;
}

export interface MenuItemRecipe {
  id: string;
  restaurant_id?: string;
  menuItemId: string;
  menuItemName: string;
  variantId?: string;
  variantName?: string;
  yieldQuantity: number; // e.g. 1 portion
  portionSize?: string;
  prepInstructions?: string;
  ingredients: RecipeIngredient[];
  calculatedCost?: number; // Total calculated food cost
  sellingPrice?: number;
  foodCostPercentage?: number; // (calculatedCost / sellingPrice) * 100
  updatedAt: string;
  updatedBy?: string;
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
    recipes?: MenuItemRecipe[];
    purchases?: InventoryPurchaseRecord[];
    wastage?: InventoryWastageRecord[];
    feedbacks: CustomerFeedback[];
  };
}

