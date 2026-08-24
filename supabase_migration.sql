-- ============================================================================
-- ROYAL BIRYANI HOUSE - PRODUCTION GRADE SCHEMA & SECURITY MIGRATION
-- ============================================================================
-- Target Database: PostgreSQL / Supabase
-- Target Tenant: rbh-main-branch (Royal Biryani House)
-- Architecture: Role-Based Access Control (RBAC) + Tenant Isolation + Cryptographic QR
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. RESTAURANTS MASTER & SETTINGS
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    address TEXT,
    phone TEXT,
    currency TEXT DEFAULT 'INR',
    tax_rate NUMERIC(5, 2) DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT UNIQUE NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo TEXT,
    tagline TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    opening_time TEXT DEFAULT '11:00 AM',
    closing_time TEXT DEFAULT '11:00 PM',
    restaurant_type TEXT DEFAULT 'Dine-In & Takeaway',
    gst_enabled BOOLEAN DEFAULT TRUE,
    gst_rate NUMERIC(5, 2) DEFAULT 5.00,
    service_charge_enabled BOOLEAN DEFAULT FALSE,
    service_charge_rate NUMERIC(5, 2) DEFAULT 5.00,
    receipt_footer TEXT DEFAULT 'Thank you for dining at Royal Biryani House! Please visit again.',
    currency TEXT DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Default Production Tenant & Profile
INSERT INTO public.restaurants (id, name, tagline, address, phone, currency, tax_rate)
VALUES ('rbh-main-branch', 'Royal Biryani House', 'Authentic Dum Biryani & Mughlai Cuisine', '124 Heritage Lane, Connaught Place, New Delhi', '+91 98765 43210', 'INR', 5.00)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, address = EXCLUDED.address, phone = EXCLUDED.phone;

INSERT INTO public.restaurant_settings (id, restaurant_id, name, tagline, address, phone, email, opening_time, closing_time, restaurant_type, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, receipt_footer)
VALUES ('rbh-main-branch', 'rbh-main-branch', 'Royal Biryani House', 'Authentic Dum Biryani & Mughlai Cuisine', '124 Heritage Lane, Connaught Place, New Delhi', '+91 98765 43210', 'contact@royalbiryani.com', '11:00 AM', '11:00 PM', 'Dine-In & Takeaway', TRUE, 5.00, FALSE, 0.00, 'Thank you for dining at Royal Biryani House! Please visit again.')
ON CONFLICT (restaurant_id) DO UPDATE 
SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, address = EXCLUDED.address, phone = EXCLUDED.phone, email = EXCLUDED.email;

-- 3. RESTAURANT TABLES (10 DINE-IN TABLES + PATIO & TAKEAWAY)
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'Ground Floor',
    capacity INTEGER NOT NULL DEFAULT 4,
    qr_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_section ON public.restaurant_tables(restaurant_id, section);

-- Seed 10 Default Tables with Unique QR Tokens
INSERT INTO public.restaurant_tables (id, restaurant_id, table_number, section, capacity, is_active, display_order, qr_token)
VALUES 
    ('tbl-1', 'rbh-main-branch', 'Table 1', 'Ground Floor', 4, true, 1, 'rbh_tok_t1_d14f8a29'),
    ('tbl-2', 'rbh-main-branch', 'Table 2', 'Ground Floor', 4, true, 2, 'rbh_tok_t2_e25a9b38'),
    ('tbl-3', 'rbh-main-branch', 'Table 3', 'Ground Floor', 6, true, 3, 'rbh_tok_t3_f36b0c47'),
    ('tbl-4', 'rbh-main-branch', 'Table 4', 'Ground Floor', 4, true, 4, 'rbh_tok_t4_a47c1d56'),
    ('tbl-5', 'rbh-main-branch', 'Table 5', 'First Floor', 4, true, 5, 'rbh_tok_t5_b58d2e65'),
    ('tbl-6', 'rbh-main-branch', 'Table 6', 'First Floor', 6, true, 6, 'rbh_tok_t6_c69e3f74'),
    ('tbl-7', 'rbh-main-branch', 'Table 7', 'First Floor', 8, true, 7, 'rbh_tok_t7_d7af4083'),
    ('tbl-8', 'rbh-main-branch', 'Table 8', 'First Floor', 2, true, 8, 'rbh_tok_t8_e8ba5192'),
    ('tbl-9', 'rbh-main-branch', 'Table 9', 'First Floor', 4, true, 9, 'rbh_tok_t9_f9cb62a1'),
    ('tbl-10', 'rbh-main-branch', 'Table 10', 'First Floor', 6, true, 10, 'rbh_tok_t10_0adc73b0'),
    ('tbl-o1', 'rbh-main-branch', 'Table O1', 'Outdoor Patio', 4, true, 11, 'rbh_tok_to1_1bed84c9'),
    ('tbl-o2', 'rbh-main-branch', 'Table O2', 'Outdoor Patio', 4, true, 12, 'rbh_tok_to2_2cfe95d8'),
    ('tbl-tk1', 'rbh-main-branch', 'Takeaway Counter', 'Takeaway', 1, true, 13, 'rbh_tok_ttk1_3d0fa6e7')
ON CONFLICT (id) DO UPDATE 
SET table_number = EXCLUDED.table_number, section = EXCLUDED.section, capacity = EXCLUDED.capacity, is_active = EXCLUDED.is_active, qr_token = EXCLUDED.qr_token;

-- 4. STAFF PROFILES & ACCESS CONTROL
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kitchen' CHECK (role IN ('kitchen', 'counter', 'manager', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_restaurant ON public.staff_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON public.staff_profiles(id);

-- Legacy staff_accounts table compatibility
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Kitchen', 'Counter', 'Captain', 'Waiter', 'admin', 'manager', 'kitchen', 'counter')),
    pin_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_accounts_restaurant ON public.staff_accounts(restaurant_id);

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

-- 5. MENU CATEGORIES & SUBCATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Utensils',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_subcategories (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    category_id TEXT,
    subcategory_id TEXT,
    subcategory_name TEXT,
    price NUMERIC(10, 2) NOT NULL,
    base_price NUMERIC(10, 2),
    description TEXT,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE,
    is_veg BOOLEAN DEFAULT FALSE,
    veg_type TEXT DEFAULT 'Non-Veg',
    is_spicy BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    prep_time TEXT DEFAULT '15-20 mins',
    stock_status TEXT DEFAULT 'In Stock',
    stock_count INTEGER DEFAULT 50,
    variants JSONB DEFAULT '[]'::jsonb,
    addons JSONB DEFAULT '[]'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(restaurant_id, category);

-- Backward compatibility menu table
CREATE TABLE IF NOT EXISTS public."Royal biryani house demo" (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
    name TEXT,
    "Name" TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    "Price" NUMERIC(10,2) DEFAULT 0,
    description TEXT,
    "Description" TEXT,
    image_url TEXT,
    "Image_url" TEXT,
    available BOOLEAN DEFAULT TRUE,
    "Available" BOOLEAN DEFAULT TRUE,
    category TEXT DEFAULT 'Biryani & Rice',
    is_bestseller BOOLEAN DEFAULT FALSE,
    stock_status TEXT DEFAULT 'In Stock',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ORDERS TABLE (royal_orders)
CREATE TABLE IF NOT EXISTS public.royal_orders (
    order_id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL DEFAULT 'Table 1',
    session_id TEXT,
    round INTEGER NOT NULL DEFAULT 1,
    is_addon BOOLEAN NOT NULL DEFAULT FALSE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled')),
    payment_method TEXT NOT NULL DEFAULT 'Pay at Counter',
    payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partially Paid', 'Paid', 'Refunded')),
    payment_mode TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Mixed')),
    paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    remaining_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (remaining_amount >= 0),
    customer_name TEXT,
    customer_notes TEXT,
    payment_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    paid_at TIMESTAMPTZ,
    estimated_minutes INTEGER NOT NULL DEFAULT 15,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_royal_orders_restaurant ON public.royal_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_royal_orders_session ON public.royal_orders(restaurant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_royal_orders_table ON public.royal_orders(restaurant_id, table_number);
CREATE INDEX IF NOT EXISTS idx_royal_orders_status ON public.royal_orders(status, is_archived);
CREATE INDEX IF NOT EXISTS idx_royal_orders_created ON public.royal_orders(created_at DESC);

-- 8. PAYMENTS & SETTLEMENTS LEDGER (royal_payments)
CREATE TABLE IF NOT EXISTS public.royal_payments (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id TEXT,
    session_id TEXT,
    table_number TEXT NOT NULL DEFAULT 'Table 1',
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0.00),
    payment_mode TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_mode IN ('Cash', 'UPI', 'Card', 'Mixed')),
    recorded_by TEXT NOT NULL DEFAULT 'Counter Cashier',
    notes TEXT,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    voided_by TEXT,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_royal_payments_restaurant ON public.royal_payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_royal_payments_session ON public.royal_payments(restaurant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_royal_payments_created ON public.royal_payments(created_at DESC);

-- 9. IDEMPOTENT ORDER CONSUMPTION TRACKER (inventory_order_consumptions)
CREATE TABLE IF NOT EXISTS public.inventory_order_consumptions (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_consumption_unique ON public.inventory_order_consumptions(restaurant_id, order_id);

-- 10. RAW MATERIALS INVENTORY & MOVEMENTS
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Spices & Seasoning',
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (current_stock >= 0),
    min_threshold NUMERIC(10,2) NOT NULL DEFAULT 5.00 CHECK (min_threshold >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    supplier TEXT,
    last_restocked TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_restaurant ON public.raw_materials(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON public.raw_materials(name);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    raw_material_id TEXT NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name TEXT NOT NULL,
    movement_type TEXT NOT NULL DEFAULT 'add' CHECK (movement_type IN ('add', 'deduct', 'waste', 'audit_reset')),
    quantity_change NUMERIC(10,2) NOT NULL,
    previous_quantity NUMERIC(10,2) NOT NULL,
    new_quantity NUMERIC(10,2) NOT NULL CHECK (new_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    reason TEXT NOT NULL DEFAULT 'Purchase / Restock',
    notes TEXT,
    updated_by TEXT NOT NULL DEFAULT 'Kitchen Chef',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_restaurant ON public.stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON public.stock_movements(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 11. RECIPES & INGREDIENT BOM (BILL OF MATERIALS)
CREATE TABLE IF NOT EXISTS public.menu_item_recipes (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL,
    menu_item_name TEXT NOT NULL,
    variant_id TEXT,
    variant_name TEXT,
    yield_quantity NUMERIC(8, 2) DEFAULT 1,
    portion_size TEXT,
    prep_instructions TEXT,
    calculated_cost NUMERIC(10, 2),
    selling_price NUMERIC(10, 2),
    food_cost_percentage NUMERIC(5, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'Executive Chef'
);

CREATE TABLE IF NOT EXISTS public.menu_item_recipe_ingredients (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL REFERENCES public.menu_item_recipes(id) ON DELETE CASCADE,
    raw_material_id TEXT NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    raw_material_name TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit TEXT NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    estimated_cost NUMERIC(10, 2),
    notes TEXT
);

-- 12. CUSTOMER FEEDBACK
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch' REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id TEXT,
    table_number TEXT NOT NULL DEFAULT 'Table 1',
    customer_name TEXT NOT NULL DEFAULT 'Dine-in Guest',
    rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    review TEXT DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_restaurant ON public.customer_feedback(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.customer_feedback(created_at DESC);

-- ============================================================================
-- 13. HARDENED SECURITY DEFINER FUNCTION: kds_advance_order_status
-- ============================================================================
-- Enforces:
-- 1. Authenticated user check
-- 2. Staff membership in target restaurant
-- 3. Staff active status
-- 4. Role transition constraints (kitchen can only advance New -> Preparing -> Ready -> Served)
-- 5. Strict restaurant_id tenant isolation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kds_advance_order_status(
    p_order_id TEXT,
    p_restaurant_id TEXT,
    p_next_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_uid UUID;
    v_staff_role TEXT;
    v_is_active BOOLEAN;
    v_current_status TEXT;
    v_updated_row RECORD;
BEGIN
    -- 1. Validate inputs
    IF p_order_id IS NULL OR TRIM(p_order_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ORDER_ID', 'message', 'Order ID is required');
    END IF;

    IF p_restaurant_id IS NULL OR TRIM(p_restaurant_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_RESTAURANT_ID', 'message', 'Restaurant ID is required');
    END IF;

    IF p_next_status NOT IN ('New', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Invalid order status: ' || p_next_status);
    END IF;

    -- 2. Verify Authenticated Caller & Retrieve Staff Role
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Authentication required for KDS status advancement');
    END IF;

    -- Query staff profile
    SELECT role, is_active INTO v_staff_role, v_is_active
    FROM public.staff_profiles
    WHERE id = v_caller_uid AND restaurant_id = p_restaurant_id;

    -- Fallback to staff_accounts
    IF v_staff_role IS NULL THEN
        SELECT LOWER(role), is_active INTO v_staff_role, v_is_active
        FROM public.staff_accounts
        WHERE user_id = v_caller_uid AND restaurant_id = p_restaurant_id;
    END IF;

    IF v_staff_role IS NULL OR v_is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_STAFF', 'message', 'Caller is not an active staff member of this restaurant');
    END IF;

    -- 3. Role-Based Workflow Constraints
    -- Kitchen staff can only advance orders to kitchen workflow states (Preparing, Ready, Served)
    IF v_staff_role = 'kitchen' AND p_next_status NOT IN ('Preparing', 'Ready', 'Served') THEN
        RETURN jsonb_build_object('success', false, 'error', 'ROLE_RESTRICTION', 'message', 'Kitchen role is restricted from advancing orders to ' || p_next_status);
    END IF;

    -- 4. Check existing order
    SELECT status INTO v_current_status
    FROM public.royal_orders
    WHERE order_id = p_order_id AND restaurant_id = p_restaurant_id AND is_archived = false;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Target order was not found for this restaurant');
    END IF;

    -- 5. Perform Status Transition
    UPDATE public.royal_orders
    SET status = p_next_status,
        updated_at = NOW()
    WHERE order_id = p_order_id
      AND restaurant_id = p_restaurant_id
      AND is_archived = false
    RETURNING order_id, restaurant_id, status, table_number, updated_at INTO v_updated_row;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_updated_row.order_id,
        'restaurant_id', v_updated_row.restaurant_id,
        'table_number', v_updated_row.table_number,
        'previous_status', v_current_status,
        'status', v_updated_row.status,
        'updated_at', v_updated_row.updated_at
    );
END;
$$;

-- Revoke anonymous access; Grant only to authenticated staff
REVOKE ALL ON FUNCTION public.kds_advance_order_status(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kds_advance_order_status(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all public tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Royal biryani house demo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_order_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
    DROP POLICY IF EXISTS "Public can view restaurant settings" ON public.restaurant_settings;
    DROP POLICY IF EXISTS "Staff can manage restaurant settings" ON public.restaurant_settings;
    DROP POLICY IF EXISTS "Public can view active restaurant tables" ON public.restaurant_tables;
    DROP POLICY IF EXISTS "Staff can manage restaurant tables" ON public.restaurant_tables;

    DROP POLICY IF EXISTS "Public can view active menu categories" ON public.menu_categories;
    DROP POLICY IF EXISTS "Staff can manage menu categories" ON public.menu_categories;
    DROP POLICY IF EXISTS "Public can view active menu subcategories" ON public.menu_subcategories;
    DROP POLICY IF EXISTS "Staff can manage menu subcategories" ON public.menu_subcategories;

    DROP POLICY IF EXISTS "Public can view active menu items" ON public.menu_items;
    DROP POLICY IF EXISTS "Staff can manage menu items" ON public.menu_items;
    DROP POLICY IF EXISTS "Public can view menu items" ON public."Royal biryani house demo";
    DROP POLICY IF EXISTS "Staff can insert menu items" ON public."Royal biryani house demo";
    DROP POLICY IF EXISTS "Staff can update menu items" ON public."Royal biryani house demo";

    DROP POLICY IF EXISTS "Public can place new orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Public can view active orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Customers can view own session orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Staff can view all orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Staff can update and manage orders" ON public.royal_orders;

    DROP POLICY IF EXISTS "Staff can view all payments" ON public.royal_payments;
    DROP POLICY IF EXISTS "Staff can record payments" ON public.royal_payments;
    DROP POLICY IF EXISTS "Staff can void payments" ON public.royal_payments;

    DROP POLICY IF EXISTS "Staff can view order consumptions" ON public.inventory_order_consumptions;
    DROP POLICY IF EXISTS "Staff can insert order consumptions" ON public.inventory_order_consumptions;

    DROP POLICY IF EXISTS "Staff can view inventory" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can insert inventory items" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can update inventory items" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can view stock movements" ON public.stock_movements;
    DROP POLICY IF EXISTS "Staff can record stock movements" ON public.stock_movements;

    DROP POLICY IF EXISTS "Staff can view recipes" ON public.menu_item_recipes;
    DROP POLICY IF EXISTS "Staff can manage recipes" ON public.menu_item_recipes;
    DROP POLICY IF EXISTS "Staff can manage recipe ingredients" ON public.menu_item_recipe_ingredients;

    DROP POLICY IF EXISTS "Public can submit customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Public can view customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Staff can view customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Staff can archive customer feedback" ON public.customer_feedback;

    DROP POLICY IF EXISTS "Staff can view their own profile" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Managers can insert staff profiles" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Managers can update staff profiles" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Staff can view staff accounts" ON public.staff_accounts;
    DROP POLICY IF EXISTS "Managers can manage staff accounts" ON public.staff_accounts;
END $$;

-- 14.1 Restaurants Master & Settings
CREATE POLICY "Public can view restaurants" ON public.restaurants
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can view restaurant settings" ON public.restaurant_settings
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Staff can manage restaurant settings" ON public.restaurant_settings
    FOR ALL TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- 14.2 Tables
CREATE POLICY "Public can view active restaurant tables" ON public.restaurant_tables
    FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Staff can manage restaurant tables" ON public.restaurant_tables
    FOR ALL TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- 14.3 Categories & Subcategories
CREATE POLICY "Public can view active menu categories" ON public.menu_categories
    FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Staff can manage menu categories" ON public.menu_categories
    FOR ALL TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Public can view active menu subcategories" ON public.menu_subcategories
    FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Staff can manage menu subcategories" ON public.menu_subcategories
    FOR ALL TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- 14.4 Menu Items
CREATE POLICY "Public can view active menu items" ON public.menu_items
    FOR SELECT TO anon, authenticated USING (is_archived = false);

CREATE POLICY "Staff can manage menu items" ON public.menu_items
    FOR ALL TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Public can view menu items" ON public."Royal biryani house demo"
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Staff can insert menu items" ON public."Royal biryani house demo"
    FOR INSERT TO authenticated WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can update menu items" ON public."Royal biryani house demo"
    FOR UPDATE TO authenticated USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- 14.5 Orders Security
-- Customers can place new orders
CREATE POLICY "Public can place new orders" ON public.royal_orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (order_id IS NOT NULL AND total >= 0 AND restaurant_id IS NOT NULL AND table_number IS NOT NULL);

-- Staff can view all orders for their assigned restaurant
CREATE POLICY "Staff can view all orders" ON public.royal_orders
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- Customers can only read active orders for their own session
CREATE POLICY "Customers can view own session orders" ON public.royal_orders
    FOR SELECT TO anon
    USING (session_id IS NOT NULL AND is_archived = false);

-- Staff can update and manage orders
CREATE POLICY "Staff can update and manage orders" ON public.royal_orders
    FOR UPDATE TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 14.6 Payments Security (Zero anonymous access; only counter/manager/admin)
CREATE POLICY "Staff can view all payments" ON public.royal_payments
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can record payments" ON public.royal_payments
    FOR INSERT TO authenticated
    WITH CHECK (amount >= 0 AND public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can void payments" ON public.royal_payments
    FOR UPDATE TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- 14.7 Inventory Order Consumptions Security
CREATE POLICY "Staff can view order consumptions" ON public.inventory_order_consumptions
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can insert order consumptions" ON public.inventory_order_consumptions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 14.8 Raw Materials & Stock Movements Security
CREATE POLICY "Staff can view inventory" ON public.raw_materials
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can insert inventory items" ON public.raw_materials
    FOR INSERT TO authenticated
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can update inventory items" ON public.raw_materials
    FOR UPDATE TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can view stock movements" ON public.stock_movements
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can record stock movements" ON public.stock_movements
    FOR INSERT TO authenticated
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 14.9 Recipes & BOM Security
CREATE POLICY "Staff can view recipes" ON public.menu_item_recipes
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage recipes" ON public.menu_item_recipes
    FOR ALL TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can manage recipe ingredients" ON public.menu_item_recipe_ingredients
    FOR ALL TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 14.10 Customer Feedback Security
-- Customers can submit feedback
CREATE POLICY "Public can submit customer feedback" ON public.customer_feedback
    FOR INSERT TO anon, authenticated
    WITH CHECK (rating >= 1.0 AND rating <= 5.0 AND table_number IS NOT NULL);

-- Only authenticated staff can view and archive customer feedback
CREATE POLICY "Staff can view customer feedback" ON public.customer_feedback
    FOR SELECT TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can archive customer feedback" ON public.customer_feedback
    FOR UPDATE TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- 14.11 Staff Profiles Security
CREATE POLICY "Staff can view their own profile" ON public.staff_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Managers can insert staff profiles" ON public.staff_profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Managers can update staff profiles" ON public.staff_profiles
    FOR UPDATE TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Staff can view staff accounts" ON public.staff_accounts
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Managers can manage staff accounts" ON public.staff_accounts
    FOR ALL TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- ============================================================================
-- 15. REALTIME REPLICATION CONFIGURATION
-- ============================================================================
ALTER TABLE public.royal_orders REPLICA IDENTITY FULL;
ALTER TABLE public.royal_payments REPLICA IDENTITY FULL;
ALTER TABLE public.raw_materials REPLICA IDENTITY FULL;
ALTER TABLE public.customer_feedback REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'royal_orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.royal_orders;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'royal_payments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.royal_payments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'raw_materials') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_materials;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customer_feedback') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_feedback;
    END IF;
END $$;
