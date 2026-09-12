-- ============================================================================
-- ROYAL BIRYANI HOUSE RMS — PHASE 7A MULTI-TENANT SAAS FOUNDATION
-- STAGING MIGRATION PACKAGE (READ-ONLY / PRE-FLIGHT SPECIFICATION)
--
-- DRAFT ONLY — DO NOT EXECUTE DIRECTLY AGAINST PRODUCTION!
-- MUST BE APPLIED TO STAGING PROJECT (abebghdacipeanmtlghz) FIRST.
-- TARGET PRODUCTION REF: minbtrzsdlompvaoglzn
-- ============================================================================

-- ============================================================================
-- 1. CANONICAL TENANT REGISTRY TABLE: public.restaurants
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurants (
  id text PRIMARY KEY, -- canonical identifier e.g. 'rbh-main-branch', 'urban-tadka-delhi'
  slug text UNIQUE NOT NULL, -- URL-safe slug e.g. 'rbh-main-branch', 'urban-tadka'
  name text NOT NULL,
  cuisine_type text DEFAULT 'Multi-Cuisine',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'suspended')),
  is_active boolean NOT NULL DEFAULT true,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.restaurants IS
  'Master tenant registry table for multi-restaurant RMS SaaS';

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- 1. Public SELECT: Anyone (anon or authenticated) can view active restaurants
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
CREATE POLICY "Public can view active restaurants"
  ON public.restaurants
  FOR SELECT
  USING (is_active = true);

-- 2. Staff Management: Only authorized managers/admins of that restaurant can update
DROP POLICY IF EXISTS "Staff can update own restaurant" ON public.restaurants;
CREATE POLICY "Staff can update own restaurant"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_staff(id, ARRAY['owner', 'admin', 'manager']))
  WITH CHECK (public.is_restaurant_staff(id, ARRAY['owner', 'admin', 'manager']));

COMMIT;


-- ============================================================================
-- 2. STAGING-ONLY INITIAL SEED DATA
-- (DO NOT EXECUTE AGAINST PRODUCTION WITHOUT STAGING SIGN-OFF)
-- ============================================================================

BEGIN;

-- Canonical Tenant: Royal Biryani House
INSERT INTO public.restaurants (id, slug, name, cuisine_type, status, is_active, contact_email, contact_phone)
VALUES (
  'rbh-main-branch',
  'rbh-main-branch',
  'Royal Biryani House',
  'Awadhi & Hyderabadi',
  'active',
  true,
  'contact@royalbiryani.com',
  '+91 98765 43210'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  cuisine_type = EXCLUDED.cuisine_type,
  status = EXCLUDED.status,
  is_active = true,
  updated_at = clock_timestamp();

-- Staging Test Tenant B: Urban Tadka Curry House (Used exclusively for multi-tenant isolation tests)
INSERT INTO public.restaurants (id, slug, name, cuisine_type, status, is_active, contact_email, contact_phone)
VALUES (
  'urban-tadka-curry',
  'urban-tadka',
  'Urban Tadka Curry House',
  'North Indian & Tandoor',
  'active',
  true,
  'hello@urbantadka.com',
  '+91 98111 22334'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  cuisine_type = EXCLUDED.cuisine_type,
  status = EXCLUDED.status,
  is_active = true,
  updated_at = clock_timestamp();

-- Staging Test Settings for Tenant B
INSERT INTO public.restaurant_settings (
  restaurant_id,
  restaurant_name,
  logo_url,
  tagline,
  address,
  phone,
  email,
  gstin,
  gst_enabled,
  gst_percentage,
  service_charge_enabled,
  service_charge_percentage,
  receipt_footer,
  currency_symbol
) VALUES (
  'urban-tadka-curry',
  'Urban Tadka Curry House',
  '',
  'Sizzling Tandoor & Highway Curries',
  '45 Ring Road, Sector 18, Noida',
  '+91 98111 22334',
  'hello@urbantadka.com',
  '07AAACU1234F1Z8',
  true,
  12.0, -- Different GST rate to verify dynamic tax resolution
  true,
  5.0,
  'Thank you for dining at Urban Tadka!',
  '₹'
)
ON CONFLICT (restaurant_id) DO NOTHING;

COMMIT;


-- ============================================================================
-- 3. SECURE TENANT METADATA DISCOVERY RPC: public.get_restaurant_metadata
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_restaurant_metadata(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_slug text := lower(trim(p_slug));
  v_res record;
BEGIN
  IF v_clean_slug IS NULL OR v_clean_slug = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RESTAURANT_NOT_FOUND'
    );
  END IF;

  SELECT
    r.id,
    r.name,
    r.slug,
    r.cuisine_type,
    r.status,
    s.logo_url,
    s.tagline,
    s.address,
    s.phone,
    COALESCE(s.gst_enabled, true) AS gst_enabled,
    COALESCE(s.gst_percentage, 5.0) AS gst_rate,
    COALESCE(s.service_charge_enabled, false) AS service_charge_enabled,
    COALESCE(s.service_charge_percentage, 0.0) AS service_charge_rate,
    COALESCE(s.currency_symbol, '₹') AS currency_symbol,
    s.opening_time,
    s.closing_time
  INTO v_res
  FROM public.restaurants r
  LEFT JOIN public.restaurant_settings s ON s.restaurant_id = r.id
  WHERE (r.slug = v_clean_slug OR r.id = v_clean_slug)
    AND r.is_active = true
    AND r.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RESTAURANT_NOT_FOUND'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'restaurant', jsonb_build_object(
      'id', v_res.id,
      'name', v_res.name,
      'slug', v_res.slug,
      'cuisine_type', v_res.cuisine_type,
      'status', v_res.status,
      'logo', COALESCE(v_res.logo_url, ''),
      'tagline', COALESCE(v_res.tagline, ''),
      'address', COALESCE(v_res.address, ''),
      'phone', COALESCE(v_res.phone, ''),
      'gstEnabled', v_res.gst_enabled,
      'gstRate', v_res.gst_rate,
      'serviceChargeEnabled', v_res.service_charge_enabled,
      'serviceChargeRate', v_res.service_charge_rate,
      'currencySymbol', v_res.currency_symbol,
      'openingTime', v_res.opening_time,
      'closingTime', v_res.closing_time
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_metadata(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_metadata(text) TO anon, authenticated;

COMMIT;


-- ============================================================================
-- 4. ADDITIVE COMPOSITE UNIQUE INDEXES FOR ID-COLLISION HARDENING
-- (Non-destructive: Does NOT alter existing tables or primary keys)
-- ============================================================================

BEGIN;

-- Composite uniqueness per tenant for menu items
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_tenant_id
  ON public.menu_items (restaurant_id, id);

-- Composite uniqueness per tenant for tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_tenant_num
  ON public.restaurant_tables (restaurant_id, lower(table_number))
  WHERE is_active = true;

-- Composite uniqueness per tenant for menu categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_categories_tenant_name
  ON public.menu_categories (restaurant_id, lower(name))
  WHERE is_active = true;

-- Composite uniqueness per tenant for subcategories
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_subcategories_tenant_name
  ON public.menu_subcategories (restaurant_id, category_id, lower(name))
  WHERE is_active = true;

-- Composite uniqueness per tenant for raw materials SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_materials_tenant_sku
  ON public.raw_materials (restaurant_id, lower(sku))
  WHERE is_active = true AND sku IS NOT NULL;

COMMIT;


-- ============================================================================
-- 5. MULTI-TENANT STAFF PROFILES FOUNDATION (PHASE 7I STAGING PREPARATION)
-- ============================================================================

-- Future transition plan for staff accounts:
-- A single auth.users identity will be able to belong to multiple restaurants with independent roles.
-- Schema adjustment:
-- ALTER TABLE public.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_pkey;
-- ALTER TABLE public.staff_profiles ADD CONSTRAINT staff_profiles_pkey PRIMARY KEY (restaurant_id, id);
