-- ============================================================================
-- ROYAL BIRYANI HOUSE - PRODUCTION HARDENED MIGRATION
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. EXISTING MENU ITEMS TABLE ("Royal biryani house demo")
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Royal biryani house demo' AND column_name='restaurant_id') THEN
        ALTER TABLE public."Royal biryani house demo" ADD COLUMN restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Royal biryani house demo' AND column_name='is_bestseller') THEN
        ALTER TABLE public."Royal biryani house demo" ADD COLUMN is_bestseller BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Royal biryani house demo' AND column_name='stock_status') THEN
        ALTER TABLE public."Royal biryani house demo" ADD COLUMN stock_status TEXT DEFAULT 'In Stock';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Royal biryani house demo' AND column_name='updated_at') THEN
        ALTER TABLE public."Royal biryani house demo" ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rbh_demo_restaurant ON public."Royal biryani house demo"(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rbh_demo_available ON public."Royal biryani house demo"("Available", available);

-- 3. ORDERS TABLE (royal_orders)
CREATE TABLE IF NOT EXISTS public.royal_orders (
    order_id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
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

-- 4. PAYMENTS & SETTLEMENTS LEDGER (royal_payments)
CREATE TABLE IF NOT EXISTS public.royal_payments (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
    order_id TEXT,
    session_id TEXT,
    table_number TEXT NOT NULL DEFAULT 'Table 1',
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0.00),
    payment_mode TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_mode IN ('Cash', 'UPI', 'Card')),
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

-- 5. CUSTOMER FEEDBACK TABLE (customer_feedback)
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
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

-- 6. RAW MATERIALS INVENTORY TABLE (raw_materials)
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
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

-- 7. STOCK MOVEMENTS AUDIT LOG (stock_movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
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

-- 8. STAFF ALLOWLIST & PROFILES (staff_profiles)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL DEFAULT 'rbh-main-branch',
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kitchen' CHECK (role IN ('kitchen', 'counter', 'manager', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_restaurant ON public.staff_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON public.staff_profiles(id);

-- Helper security function: Check if authenticated user is active staff of the restaurant
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(target_restaurant_id TEXT, required_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid()
          AND restaurant_id = target_restaurant_id
          AND is_active = true
          AND (required_roles IS NULL OR role = ANY(required_roles))
    );
$$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public."Royal biryani house demo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view menu items" ON public."Royal biryani house demo";
    DROP POLICY IF EXISTS "Staff can manage menu items" ON public."Royal biryani house demo";
    DROP POLICY IF EXISTS "Staff can insert menu items" ON public."Royal biryani house demo";
    DROP POLICY IF EXISTS "Staff can update menu items" ON public."Royal biryani house demo";

    DROP POLICY IF EXISTS "Public can place new orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Public can view active orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Staff can update and manage orders" ON public.royal_orders;
    DROP POLICY IF EXISTS "Staff can delete orders" ON public.royal_orders;

    DROP POLICY IF EXISTS "Staff can view all payments" ON public.royal_payments;
    DROP POLICY IF EXISTS "Staff can record and void payments" ON public.royal_payments;
    DROP POLICY IF EXISTS "Staff can record payments" ON public.royal_payments;
    DROP POLICY IF EXISTS "Staff can void payments" ON public.royal_payments;

    DROP POLICY IF EXISTS "Public can submit customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Public can view customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Staff can manage customer feedback" ON public.customer_feedback;
    DROP POLICY IF EXISTS "Staff can archive customer feedback" ON public.customer_feedback;

    DROP POLICY IF EXISTS "Staff can view inventory" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can modify inventory items" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can insert inventory items" ON public.raw_materials;
    DROP POLICY IF EXISTS "Staff can update inventory items" ON public.raw_materials;

    DROP POLICY IF EXISTS "Staff can view and record stock movements" ON public.stock_movements;
    DROP POLICY IF EXISTS "Staff can view stock movements" ON public.stock_movements;
    DROP POLICY IF EXISTS "Staff can record stock movements" ON public.stock_movements;

    DROP POLICY IF EXISTS "Staff can view their own profile" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Managers can manage staff profiles" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Managers can insert staff profiles" ON public.staff_profiles;
    DROP POLICY IF EXISTS "Managers can update staff profiles" ON public.staff_profiles;
END $$;

-- 9.1 Staff Profiles Policies (Self-read for authenticated staff; Manager/Admin management)
CREATE POLICY "Staff can view their own profile"
    ON public.staff_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Managers can insert staff profiles"
    ON public.staff_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

CREATE POLICY "Managers can update staff profiles"
    ON public.staff_profiles
    FOR UPDATE
    TO authenticated
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['manager', 'admin']));

-- 9.2 Menu Policies (Public read; Authorized Staff insert & update; No hard DELETE)
CREATE POLICY "Public can view menu items" 
    ON public."Royal biryani house demo" 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Staff can insert menu items" 
    ON public."Royal biryani house demo" 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can update menu items" 
    ON public."Royal biryani house demo" 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 9.3 Orders Policies (Public QR place & view status; Authorized Staff manage; No hard DELETE)
CREATE POLICY "Public can place new orders" 
    ON public.royal_orders 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (order_id IS NOT NULL AND total >= 0);

CREATE POLICY "Public can view active orders" 
    ON public.royal_orders 
    FOR SELECT 
    TO anon, authenticated 
    USING (is_archived = false);

CREATE POLICY "Staff can update and manage orders" 
    ON public.royal_orders 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 9.3.1 Secure KDS RPC Function (Allows advancing order status with strict parameter validation & restaurant isolation)
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
    v_updated_row RECORD;
BEGIN
    -- 1. Validate inputs
    IF p_order_id IS NULL OR TRIM(p_order_id) = '' THEN
        RAISE EXCEPTION 'Order ID is required';
    END IF;

    IF p_restaurant_id IS NULL OR TRIM(p_restaurant_id) = '' THEN
        RAISE EXCEPTION 'Restaurant ID is required';
    END IF;

    IF p_next_status NOT IN ('New', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled') THEN
        RAISE EXCEPTION 'Invalid order status: %', p_next_status;
    END IF;

    -- 2. Update ONLY the target order within the specified restaurant
    UPDATE public.royal_orders
    SET status = p_next_status,
        updated_at = NOW()
    WHERE order_id = p_order_id
      AND restaurant_id = p_restaurant_id
      AND is_archived = false
    RETURNING order_id, restaurant_id, status, updated_at INTO v_updated_row;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Order not found for the specified restaurant or is archived'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_updated_row.order_id,
        'restaurant_id', v_updated_row.restaurant_id,
        'status', v_updated_row.status,
        'updated_at', v_updated_row.updated_at
    );
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.kds_advance_order_status(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 9.4 Payments Policies (Authorized Staff only; Anon is NEVER granted access; No hard DELETE)
CREATE POLICY "Staff can view all payments" 
    ON public.royal_payments 
    FOR SELECT 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can record payments" 
    ON public.royal_payments 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (amount >= 0 AND public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

CREATE POLICY "Staff can void payments" 
    ON public.royal_payments 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- 9.5 Feedback Policies (Public submit & view non-archived; Authorized Staff archive)
CREATE POLICY "Public can view customer feedback" 
    ON public.customer_feedback 
    FOR SELECT 
    TO anon, authenticated 
    USING (is_archived = false);

CREATE POLICY "Public can submit customer feedback" 
    ON public.customer_feedback 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (rating >= 1.0 AND rating <= 5.0);

CREATE POLICY "Staff can archive customer feedback" 
    ON public.customer_feedback 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['counter', 'manager', 'admin']));

-- 9.6 Inventory Policies (Authorized Staff only; Anon is NEVER granted access; No hard DELETE)
CREATE POLICY "Staff can view inventory" 
    ON public.raw_materials 
    FOR SELECT 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can insert inventory items" 
    ON public.raw_materials 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can update inventory items" 
    ON public.raw_materials 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']))
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 9.7 Stock Movements Policies (Strictly Append-Only: SELECT & INSERT only; No UPDATE, No DELETE; Anon NEVER granted access)
CREATE POLICY "Staff can view stock movements" 
    ON public.stock_movements 
    FOR SELECT 
    TO authenticated 
    USING (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

CREATE POLICY "Staff can record stock movements" 
    ON public.stock_movements 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['kitchen', 'counter', 'manager', 'admin']));

-- 10. SUPABASE REALTIME CONFIGURATION
ALTER TABLE public.royal_orders REPLICA IDENTITY FULL;
ALTER TABLE public.royal_payments REPLICA IDENTITY FULL;
ALTER TABLE public.raw_materials REPLICA IDENTITY FULL;

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
END $$;
