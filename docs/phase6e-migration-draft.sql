-- ============================================================================
-- ROYAL BIRYANI HOUSE RMS — PHASE 6E DATABASE SECURITY HARDENING
-- DRAFT MIGRATION PACKAGE (READ-ONLY / PRE-FLIGHT DESIGN SPECIFICATION)
--
-- DRAFT ONLY — DO NOT EXECUTE AGAINST PRODUCTION!
-- MUST BE APPLIED TO A DEDICATED STAGING BRANCH / PROJECT FIRST.
-- TARGET SUPABASE REF: minbtrzsdlompvaoglzn
-- ============================================================================

-- ============================================================================
-- STAGE A: ADDITIVE SCHEMA PREPARATION & DUAL-TOKEN BRIDGE
-- Reversible: YES | Customer Impact: ZERO | Standee Downtime: ZERO
-- ============================================================================

BEGIN;

-- 1. Add legacy QR token column to preserve printed standee compatibility
ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS qr_token_legacy text;

COMMENT ON COLUMN public.restaurant_tables.qr_token_legacy IS
  'Preserves legacy deterministic QR tokens during physical standee migration';

-- 2. Populate qr_token_legacy with current tokens if not already populated
UPDATE public.restaurant_tables
SET qr_token_legacy = qr_token
WHERE qr_token_legacy IS NULL
  AND qr_token IS NOT NULL;

-- 3. Transition active tokens to cryptographically random 128-bit CSPRNG tokens
-- Prefixed with rbh_sec_ to distinguish from legacy rbh_tok_
UPDATE public.restaurant_tables
SET qr_token = 'rbh_sec_' || encode(gen_random_bytes(16), 'hex')
WHERE qr_token NOT LIKE 'rbh_sec_%';

-- 4. Create performance and uniqueness indexes on tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token
  ON public.restaurant_tables (restaurant_id, qr_token)
  WHERE is_active = true AND qr_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_qr_legacy
  ON public.restaurant_tables (restaurant_id, qr_token_legacy)
  WHERE is_active = true AND qr_token_legacy IS NOT NULL;

-- 5. Create hardened dedicated atomic settlement attempts table
CREATE TABLE IF NOT EXISTS public.settlement_attempts (
  id text NOT NULL, -- attempt_id / idempotency_key
  restaurant_id text NOT NULL,
  session_id text NOT NULL,
  table_number text NOT NULL,
  split_payments jsonb NOT NULL, -- canonical normalized split array
  total_amount numeric(10,2) NOT NULL,
  request_fingerprint text NOT NULL, -- sha256 hash of canonical request parameters
  status text NOT NULL DEFAULT 'completed', -- 'completed' | 'failed'
  staff_user_id uuid, -- authoritative auth.uid()
  recorded_by text NOT NULL, -- authoritative staff name & role
  client_recorded_by text, -- client-supplied string preserved for debugging
  response_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT settlement_attempts_pkey PRIMARY KEY (restaurant_id, id)
);

COMMENT ON TABLE public.settlement_attempts IS
  'Exact idempotency ledger for atomic dining session settlements with canonical fingerprinting';

CREATE INDEX IF NOT EXISTS idx_settlement_attempts_session
  ON public.settlement_attempts (restaurant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_settlement_attempts_created
  ON public.settlement_attempts (restaurant_id, created_at DESC);

ALTER TABLE public.settlement_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;


-- ============================================================================
-- STAGE B: STORED RPC IMPLEMENTATIONS
-- Reversible: YES | Customer Impact: ZERO | Staff Impact: ZERO
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- B.1 Update private.customer_qr_matches to support dual-token bridge
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.customer_qr_matches(
  p_restaurant_id text,
  p_table_number text,
  p_qr_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_table text := trim(p_table_number);
  v_token text := trim(p_qr_token);
BEGIN
  IF p_restaurant_id IS NULL OR v_clean_table = '' OR v_token = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.restaurant_tables
    WHERE restaurant_id = p_restaurant_id
      AND lower(table_number) = lower(v_clean_table)
      AND is_active = true
      AND (
        qr_token = v_token
        OR qr_token_legacy = v_token
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.customer_qr_matches(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.customer_qr_matches(text, text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- B.2 Server-Authoritative Order Creation (create_order_secure)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_restaurant_id text,
  p_table_number text,
  p_qr_token text,
  p_items jsonb,
  p_customer_name text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_table text := trim(p_table_number);
  v_clean_rest text := trim(p_restaurant_id);
  v_clean_cust_name text := NULLIF(trim(p_customer_name), '');
  v_clean_cust_notes text := NULLIF(trim(p_customer_notes), '');
  v_gst_rate numeric := 5.0;
  v_gst_enabled boolean := true;
  v_subtotal numeric := 0.00;
  v_tax numeric := 0.00;
  v_total numeric := 0.00;
  v_session_id text;
  v_round integer := 1;
  v_is_addon boolean := false;
  v_order_id text;
  v_sanitized_items jsonb := '[]'::jsonb;
  v_item_record record;
  v_elem jsonb;
  v_item_id text;
  v_quantity integer;
  v_item_subtotal numeric;
  v_active_sessions text[];
  v_max_round integer;
  v_existing_cust_name text;
BEGIN
  -- 1. Validate mandatory parameters
  IF v_clean_rest = '' OR v_clean_table = '' OR trim(p_qr_token) = '' THEN
    RAISE EXCEPTION 'Missing mandatory parameters: restaurant_id, table_number, and qr_token are required'
      USING ERRCODE = '22000';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items array cannot be empty'
      USING ERRCODE = '22000';
  END IF;

  -- 2. Verify Table QR Context
  IF NOT private.customer_qr_matches(v_clean_rest, v_clean_table, trim(p_qr_token)) THEN
    RAISE EXCEPTION 'Access denied: Invalid or unverified table QR context for table "%"', v_clean_table
      USING ERRCODE = '42501';
  END IF;

  -- 3. Transactional Advisory Lock on (restaurant_id, table_number)
  -- Serializes simultaneous order submissions for the same table to prevent race conditions & round collisions
  PERFORM pg_advisory_xact_lock(hashtext(v_clean_rest || ':' || lower(v_clean_table)));

  -- 4. Authoritative Tax & Restaurant Settings Resolution
  SELECT
    COALESCE(gst_percentage, 5.0),
    COALESCE(gst_enabled, true)
  INTO v_gst_rate, v_gst_enabled
  FROM public.restaurant_settings
  WHERE restaurant_id = v_clean_rest;

  IF NOT FOUND THEN
    v_gst_rate := 5.0;
    v_gst_enabled := true;
  END IF;

  -- 5. Validate Menu Items & Calculate Authoritative Financials
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := trim(v_elem->>'id');
    v_quantity := GREATEST(1, COALESCE((v_elem->>'quantity')::integer, 1));

    IF v_item_id IS NULL OR v_item_id = '' THEN
      RAISE EXCEPTION 'Each order item must specify a valid menu item id'
        USING ERRCODE = '22000';
    END IF;

    -- Fetch active menu item directly from authoritative table
    SELECT
      id,
      name,
      COALESCE(base_price, price, 0.00) AS resolved_price,
      available,
      is_archived,
      stock_status,
      image_url
    INTO v_item_record
    FROM public.menu_items
    WHERE id = v_item_id
      AND restaurant_id = v_clean_rest;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item "%" does not exist for restaurant "%"', v_item_id, v_clean_rest
        USING ERRCODE = '22000';
    END IF;

    IF v_item_record.is_archived = true OR v_item_record.available = false OR v_item_record.stock_status = 'Out of Stock' THEN
      RAISE EXCEPTION 'Item "%" (%) is currently unavailable or out of stock', v_item_record.name, v_item_id
        USING ERRCODE = '22000';
    END IF;

    v_item_subtotal := round(v_item_record.resolved_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_item_subtotal;

    -- Build verified item record (stripping any client-supplied prices)
    v_sanitized_items := v_sanitized_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_item_record.id,
        'name', v_item_record.name,
        'price', v_item_record.resolved_price,
        'quantity', v_quantity,
        'spiceLevel', NULLIF(trim(v_elem->>'spiceLevel'), ''),
        'notes', NULLIF(trim(v_elem->>'notes'), ''),
        'image', v_item_record.image_url
      )
    );
  END LOOP;

  -- 6. Compute GST & Total
  IF v_gst_enabled THEN
    v_tax := round(v_subtotal * (v_gst_rate / 100.0), 1);
  ELSE
    v_tax := 0.00;
  END IF;
  v_total := v_subtotal + v_tax;

  -- 7. Multiple Active Session Detection & Assignment (Under Advisory Lock)
  SELECT array_agg(DISTINCT session_id)
  INTO v_active_sessions
  FROM public.royal_orders
  WHERE restaurant_id = v_clean_rest
    AND lower(table_number) = lower(v_clean_table)
    AND payment_status != 'Paid'
    AND status != 'Cancelled'
    AND is_archived = false;

  IF v_active_sessions IS NOT NULL AND array_length(v_active_sessions, 1) > 1 THEN
    RAISE EXCEPTION 'ACTIVE_SESSION_CONFLICT: Table "%" has % concurrent active sessions (%). Requires manual staff resolution.',
      v_clean_table, array_length(v_active_sessions, 1), array_to_string(v_active_sessions, ', ')
      USING ERRCODE = '22000';
  ELSIF v_active_sessions IS NOT NULL AND array_length(v_active_sessions, 1) = 1 THEN
    -- Exactly one active session: attach as add-on
    v_session_id := v_active_sessions[1];
    SELECT
      MAX(round),
      COALESCE(MAX(customer_name), v_clean_cust_name)
    INTO v_max_round, v_existing_cust_name
    FROM public.royal_orders
    WHERE restaurant_id = v_clean_rest
      AND session_id = v_session_id
      AND is_archived = false;

    v_round := COALESCE(v_max_round, 1) + 1;
    v_is_addon := true;
    IF v_clean_cust_name IS NULL THEN
      v_clean_cust_name := v_existing_cust_name;
    END IF;
  ELSE
    -- Zero active sessions: create new session
    -- If client passed an old session ID that is already paid, start a fresh session
    IF p_session_id IS NOT NULL AND trim(p_session_id) != '' THEN
      IF EXISTS (
        SELECT 1 FROM public.royal_orders
        WHERE restaurant_id = v_clean_rest
          AND session_id = trim(p_session_id)
          AND (payment_status = 'Paid' OR remaining_amount <= 0.05)
      ) THEN
        v_session_id := 'SESS-' || regexp_replace(v_clean_table, '[^a-zA-Z0-9]', '', 'g') || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || lpad(to_hex(trunc(random()*4095)::int), 3, '0');
      ELSE
        v_session_id := trim(p_session_id);
      END IF;
    ELSE
      v_session_id := 'SESS-' || regexp_replace(v_clean_table, '[^a-zA-Z0-9]', '', 'g') || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || lpad(to_hex(trunc(random()*4095)::int), 3, '0');
    END IF;
    v_round := 1;
    v_is_addon := false;
  END IF;

  -- 8. Generate Collision-Resistant Order ID
  v_order_id := 'RBH-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || lpad(to_hex(trunc(random() * 65535)::int), 4, '0');

  -- 9. Insert Verified Order Row
  INSERT INTO public.royal_orders (
    order_id,
    restaurant_id,
    table_number,
    session_id,
    round,
    is_addon,
    items,
    subtotal,
    tax,
    total,
    status,
    payment_method,
    payment_status,
    payment_mode,
    paid_amount,
    remaining_amount,
    payment_history,
    customer_name,
    customer_notes,
    qr_token,
    is_archived,
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    v_clean_rest,
    v_clean_table,
    v_session_id,
    v_round,
    v_is_addon,
    v_sanitized_items,
    v_subtotal,
    v_tax,
    v_total,
    'New',
    'Pay at Counter',
    'Pending',
    'UPI',
    0.00,
    v_total,
    '[]'::jsonb,
    v_clean_cust_name,
    v_clean_cust_notes,
    trim(p_qr_token),
    false,
    clock_timestamp(),
    clock_timestamp()
  );

  -- 10. Return Sanitized Order Object Projection
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'restaurant_id', v_clean_rest,
    'table_number', v_clean_table,
    'session_id', v_session_id,
    'round', v_round,
    'is_addon', v_is_addon,
    'items', v_sanitized_items,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total,
    'status', 'New',
    'payment_method', 'Pay at Counter',
    'payment_status', 'Pending',
    'paid_amount', 0.00,
    'remaining_amount', v_total,
    'customer_name', v_clean_cust_name,
    'customer_notes', v_clean_cust_notes,
    'created_at', clock_timestamp()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_secure(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_secure(text, text, text, jsonb, text, text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- B.3 Atomic Dining Session Settlement (settle_dining_session_atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_dining_session_atomic(
  p_restaurant_id text,
  p_session_id text,
  p_table_number text,
  p_split_payments jsonb,
  p_recorded_by text DEFAULT 'Counter Cashier',
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_rest text := trim(p_restaurant_id);
  v_clean_sess text := trim(p_session_id);
  v_clean_table text := trim(p_table_number);
  v_idempotency_key text := NULLIF(trim(p_idempotency_key), '');
  v_normalized_splits jsonb := '[]'::jsonb;
  v_request_fingerprint text;
  v_existing_attempt record;
  v_total_paid_now numeric := 0.00;
  v_unpaid_balance numeric := 0.00;
  v_grand_total numeric := 0.00;
  v_previously_paid numeric := 0.00;
  v_new_paid_total numeric := 0.00;
  v_remaining_amount numeric := 0.00;
  v_is_fully_paid boolean := false;
  v_elem jsonb;
  v_mode text;
  v_amount numeric;
  v_order record;
  v_payment_id text;
  v_allocated_payment numeric;
  v_remaining_to_allocate numeric;
  v_new_order_paid numeric;
  v_new_order_rem numeric;
  v_order_is_paid boolean;
  v_inserted_payments jsonb := '[]'::jsonb;
  v_primary_order_id text := NULL;
  v_response jsonb;
  v_staff_uid uuid;
  v_staff_profile record;
  v_authoritative_recorder text;
BEGIN
  -- 1. Validate inputs
  IF v_clean_rest = '' OR v_clean_sess = '' OR v_clean_table = '' THEN
    RAISE EXCEPTION 'Missing mandatory parameters: restaurant_id, session_id, and table_number are required'
      USING ERRCODE = '22000';
  END IF;

  IF p_split_payments IS NULL OR jsonb_array_length(p_split_payments) = 0 THEN
    RAISE EXCEPTION 'split_payments array must contain at least one payment split'
      USING ERRCODE = '22000';
  END IF;

  -- 2. Authoritative Staff Audit Identity Resolution
  v_staff_uid := auth.uid();
  IF v_staff_uid IS NOT NULL THEN
    SELECT full_name, role
    INTO v_staff_profile
    FROM public.staff_profiles
    WHERE id = v_staff_uid
      AND restaurant_id = v_clean_rest
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STAFF: User "%" is not an active staff member of restaurant "%"',
        v_staff_uid, v_clean_rest
        USING ERRCODE = '42501';
    END IF;

    v_authoritative_recorder := v_staff_profile.full_name || ' (' || v_staff_profile.role || ')';
  ELSE
    -- Unauthenticated / internal caller fallback
    v_authoritative_recorder := COALESCE(NULLIF(trim(p_recorded_by), ''), 'Counter Cashier');
  END IF;

  -- 3. Validate and normalize split payment entries
  FOR v_elem IN
    SELECT value FROM jsonb_array_elements(p_split_payments) ORDER BY value->>'mode' ASC, (value->>'amount')::numeric ASC
  LOOP
    v_mode := trim(v_elem->>'mode');
    v_amount := round(COALESCE((v_elem->>'amount')::numeric, 0.00), 2);

    IF v_mode NOT IN ('Cash', 'UPI', 'Card') THEN
      RAISE EXCEPTION 'Invalid payment mode "%". Must be exactly Cash, UPI, or Card', v_mode
        USING ERRCODE = '22000';
    END IF;

    IF v_amount <= 0.00 THEN
      RAISE EXCEPTION 'Payment split amount must be strictly greater than zero (received %)', v_amount
        USING ERRCODE = '22000';
    END IF;

    v_total_paid_now := v_total_paid_now + v_amount;
    v_normalized_splits := v_normalized_splits || jsonb_build_array(
      jsonb_build_object('mode', v_mode, 'amount', v_amount)
    );
  END LOOP;

  IF v_total_paid_now <= 0.00 THEN
    RAISE EXCEPTION 'Total payment amount must be greater than zero' USING ERRCODE = '22000';
  END IF;

  -- Compute canonical fingerprint over normalized parameters
  v_request_fingerprint := encode(sha256((
    v_clean_rest || '|' || v_clean_sess || '|' || lower(v_clean_table) || '|' ||
    v_total_paid_now::text || '|' || v_normalized_splits::text
  )::bytea), 'hex');

  -- 4. Exact Idempotency Check
  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_attempt
    FROM public.settlement_attempts
    WHERE restaurant_id = v_clean_rest
      AND id = v_idempotency_key;

    IF FOUND THEN
      IF v_existing_attempt.request_fingerprint = v_request_fingerprint AND v_existing_attempt.status = 'completed' THEN
        -- Exactly identical retry: return cached response safely
        RETURN v_existing_attempt.response_payload;
      ELSE
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE_CONFLICT: Attempt key "%" was already used for session "%" with different parameters (previous total: ₹%, new total: ₹%)',
          v_idempotency_key, v_existing_attempt.session_id, v_existing_attempt.total_amount, v_total_paid_now
          USING ERRCODE = '23505';
      END IF;
    END IF;
  ELSE
    v_idempotency_key := 'settle_' || v_clean_rest || '_' || v_clean_sess || '_' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');
  END IF;

  -- 5. Validate Session / Table Relationship & Lock Orders FOR UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM public.royal_orders
    WHERE restaurant_id = v_clean_rest
      AND session_id = v_clean_sess
      AND status != 'Cancelled'
      AND is_archived = false
  ) THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND: No active orders found for session "%" in restaurant "%"',
      v_clean_sess, v_clean_rest
      USING ERRCODE = '22000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.royal_orders
    WHERE restaurant_id = v_clean_rest
      AND session_id = v_clean_sess
      AND status != 'Cancelled'
      AND is_archived = false
      AND lower(table_number) != lower(v_clean_table)
  ) THEN
    RAISE EXCEPTION 'MISMATCHED_SESSION_TABLE: Session "%" is registered to a different table than "%"',
      v_clean_sess, v_clean_table
      USING ERRCODE = '22000';
  END IF;

  -- Lock orders for session to serialize concurrent settlements
  PERFORM 1
  FROM public.royal_orders
  WHERE restaurant_id = v_clean_rest
    AND session_id = v_clean_sess
    AND status != 'Cancelled'
    AND is_archived = false
  FOR UPDATE;

  -- 6. Authoritative balance calculation across session orders
  SELECT
    COALESCE(SUM(total), 0.00),
    COALESCE(SUM(paid_amount), 0.00),
    COALESCE(SUM(remaining_amount), 0.00),
    MIN(order_id)
  INTO v_grand_total, v_previously_paid, v_unpaid_balance, v_primary_order_id
  FROM public.royal_orders
  WHERE restaurant_id = v_clean_rest
    AND session_id = v_clean_sess
    AND status != 'Cancelled'
    AND is_archived = false;

  -- 7. Validate Overpayment
  IF v_total_paid_now > (v_unpaid_balance + 0.01) THEN
    RAISE EXCEPTION 'OVERPAYMENT_REJECTED: Submitted payment (₹%) exceeds remaining unpaid session balance (₹%)',
      v_total_paid_now, v_unpaid_balance
      USING ERRCODE = '22000';
  END IF;

  v_new_paid_total := round(v_previously_paid + v_total_paid_now, 2);
  v_remaining_amount := GREATEST(0.00, round(v_grand_total - v_new_paid_total, 2));
  v_is_fully_paid := (v_remaining_amount <= 0.01);

  -- 8. Waterfall Allocate Payment Across Open Orders
  v_remaining_to_allocate := v_total_paid_now;

  FOR v_order IN
    SELECT order_id, total, paid_amount, remaining_amount, status
    FROM public.royal_orders
    WHERE restaurant_id = v_clean_rest
      AND session_id = v_clean_sess
      AND status != 'Cancelled'
      AND is_archived = false
      AND remaining_amount > 0.01
    ORDER BY round ASC, created_at ASC
  LOOP
    IF v_remaining_to_allocate <= 0.00 THEN
      EXIT;
    END IF;

    v_allocated_payment := LEAST(v_remaining_to_allocate, v_order.remaining_amount);
    v_remaining_to_allocate := round(v_remaining_to_allocate - v_allocated_payment, 2);

    v_new_order_paid := round(v_order.paid_amount + v_allocated_payment, 2);
    v_new_order_rem := GREATEST(0.00, round(v_order.total - v_new_order_paid, 2));
    v_order_is_paid := (v_new_order_rem <= 0.01);

    UPDATE public.royal_orders
    SET
      paid_amount = v_new_order_paid,
      remaining_amount = v_new_order_rem,
      payment_status = CASE WHEN v_order_is_paid THEN 'Paid' ELSE 'Partially Paid' END,
      status = CASE WHEN v_order_is_paid AND status != 'Cancelled' THEN 'Completed' ELSE status END,
      paid_at = CASE WHEN v_order_is_paid THEN clock_timestamp() ELSE paid_at END,
      updated_at = clock_timestamp()
    WHERE order_id = v_order.order_id
      AND restaurant_id = v_clean_rest;
  END LOOP;

  -- 9. Insert Split Payments into royal_payments
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_normalized_splits)
  LOOP
    v_mode := trim(v_elem->>'mode');
    v_amount := round((v_elem->>'amount')::numeric, 2);
    v_payment_id := 'PAY-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || lpad(to_hex(trunc(random()*65535)::int), 4, '0');

    INSERT INTO public.royal_payments (
      id,
      restaurant_id,
      order_id,
      session_id,
      table_number,
      amount,
      payment_mode,
      recorded_by,
      notes,
      is_voided,
      created_at
    ) VALUES (
      v_payment_id,
      v_clean_rest,
      v_primary_order_id,
      v_clean_sess,
      v_clean_table,
      v_amount,
      v_mode,
      v_authoritative_recorder,
      p_notes,
      false,
      clock_timestamp()
    );

    v_inserted_payments := v_inserted_payments || jsonb_build_array(
      jsonb_build_object(
        'id', v_payment_id,
        'restaurant_id', v_clean_rest,
        'order_id', v_primary_order_id,
        'session_id', v_clean_sess,
        'table_number', v_clean_table,
        'amount', v_amount,
        'payment_mode', v_mode,
        'recorded_by', v_authoritative_recorder,
        'created_at', clock_timestamp()
      )
    );
  END LOOP;

  -- 10. Construct Deterministic Response Payload
  v_response := jsonb_build_object(
    'success', true,
    'is_fully_paid', v_is_fully_paid,
    'grand_total', v_grand_total,
    'total_paid_now', v_total_paid_now,
    'paid_amount_total', v_new_paid_total,
    'remaining_amount', v_remaining_amount,
    'new_payments', v_inserted_payments
  );

  -- 11. Record Attempt in settlement_attempts
  INSERT INTO public.settlement_attempts (
    id,
    restaurant_id,
    session_id,
    table_number,
    split_payments,
    total_amount,
    request_fingerprint,
    status,
    staff_user_id,
    recorded_by,
    client_recorded_by,
    response_payload,
    created_at,
    completed_at
  ) VALUES (
    v_idempotency_key,
    v_clean_rest,
    v_clean_sess,
    v_clean_table,
    v_normalized_splits,
    v_total_paid_now,
    v_request_fingerprint,
    'completed',
    v_staff_uid,
    v_authoritative_recorder,
    NULLIF(trim(p_recorded_by), ''),
    v_response,
    clock_timestamp(),
    clock_timestamp()
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_dining_session_atomic(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_dining_session_atomic(text, text, text, jsonb, text, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- B.4 QR-Verified Customer Menu Access (customer_get_menu_by_qr & customer_get_menu)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_get_menu_by_qr(
  p_restaurant_id text,
  p_table_number text,
  p_qr_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_rest text := trim(p_restaurant_id);
  v_clean_table text := trim(p_table_number);
  v_categories jsonb := '[]'::jsonb;
  v_subcategories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
BEGIN
  -- 1. Verify QR Context
  IF NOT private.customer_qr_matches(v_clean_rest, v_clean_table, trim(p_qr_token)) THEN
    RAISE EXCEPTION 'Access denied: Invalid or unverified table QR context'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch Active Menu Categories
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'restaurant_id', restaurant_id,
      'name', name,
      'description', description,
      'icon', icon,
      'display_order', display_order,
      'is_active', is_active,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM public.menu_categories
  WHERE restaurant_id = v_clean_rest
    AND is_active = true;

  -- 3. Fetch Active Menu Subcategories
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'restaurant_id', restaurant_id,
      'category_id', category_id,
      'name', name,
      'description', description,
      'display_order', display_order,
      'is_active', is_active,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY display_order ASC
  ), '[]'::jsonb)
  INTO v_subcategories
  FROM public.menu_subcategories
  WHERE restaurant_id = v_clean_rest
    AND is_active = true;

  -- 4. Fetch Active, Non-Archived Menu Items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'restaurant_id', restaurant_id,
      'category_id', category_id,
      'subcategory_id', subcategory_id,
      'name', name,
      'price', price,
      'base_price', base_price,
      'description', description,
      'image_url', image_url,
      'available', available,
      'is_veg', is_veg,
      'veg_type', veg_type,
      'is_spicy', is_spicy,
      'is_bestseller', is_bestseller,
      'prep_time', prep_time,
      'stock_status', stock_status,
      'variants', variants,
      'addons', addons,
      'display_order', display_order
    ) ORDER BY display_order ASC
  ), '[]'::jsonb)
  INTO v_items
  FROM public.menu_items
  WHERE restaurant_id = v_clean_rest
    AND is_archived = false
    AND available = true;

  RETURN jsonb_build_object(
    'categories', v_categories,
    'subcategories', v_subcategories,
    'items', v_items
  );
END;
$$;

-- Compatibility alias matching Phase 6D frontend adapter call: customer_get_menu
CREATE OR REPLACE FUNCTION public.customer_get_menu(
  p_restaurant_id text,
  p_table_number text,
  p_qr_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.customer_get_menu_by_qr(p_restaurant_id, p_table_number, p_qr_token);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_get_menu_by_qr(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_get_menu(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_get_menu_by_qr(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_get_menu(text, text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- B.5 QR-Verified Customer Feedback (customer_submit_feedback)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_submit_feedback(
  p_restaurant_id text,
  p_table_number text,
  p_qr_token text,
  p_order_id text DEFAULT NULL,
  p_customer_name text DEFAULT 'Valued Guest',
  p_rating numeric DEFAULT 5,
  p_review text DEFAULT '',
  p_tags jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_rest text := trim(p_restaurant_id);
  v_clean_table text := trim(p_table_number);
  v_rating_clamped integer;
  v_feedback_id text;
BEGIN
  -- 1. Validate QR Context
  IF NOT private.customer_qr_matches(v_clean_rest, v_clean_table, trim(p_qr_token)) THEN
    RAISE EXCEPTION 'Access denied: Invalid or unverified table QR context'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validate & Clamp Rating (1 to 5)
  v_rating_clamped := GREATEST(1, LEAST(5, round(COALESCE(p_rating, 5))::integer));

  -- 3. If Order ID provided, verify it belongs to same restaurant & table
  IF p_order_id IS NOT NULL AND trim(p_order_id) != '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.royal_orders
      WHERE order_id = trim(p_order_id)
        AND restaurant_id = v_clean_rest
    ) THEN
      RAISE EXCEPTION 'Order "%" not found for restaurant "%"', p_order_id, v_clean_rest
        USING ERRCODE = '22000';
    END IF;
  END IF;

  v_feedback_id := 'FB-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || lpad(to_hex(trunc(random()*4095)::int), 3, '0');

  INSERT INTO public.customer_feedback (
    id,
    restaurant_id,
    order_id,
    table_number,
    customer_name,
    rating,
    review,
    tags,
    is_archived,
    created_at
  ) VALUES (
    v_feedback_id,
    v_clean_rest,
    NULLIF(trim(p_order_id), ''),
    v_clean_table,
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Valued Guest'),
    v_rating_clamped,
    COALESCE(trim(p_review), ''),
    COALESCE(p_tags, '[]'::jsonb),
    false,
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'feedback_id', v_feedback_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_submit_feedback(text, text, text, text, text, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_submit_feedback(text, text, text, text, text, numeric, text, jsonb) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- B.6 Staff-Only Table QR Rotation (rotate_table_qr_token)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_table_qr_token(
  p_table_id text,
  p_restaurant_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_table_id text := trim(p_table_id);
  v_clean_rest text := trim(p_restaurant_id);
  v_new_token text;
BEGIN
  -- Validate Manager / Admin / Owner Role
  IF NOT public.is_restaurant_staff(v_clean_rest, ARRAY['owner', 'manager', 'admin']) THEN
    RAISE EXCEPTION 'Access denied: Table QR rotation requires manager or administrator privileges'
      USING ERRCODE = '42501';
  END IF;

  v_new_token := 'rbh_sec_' || encode(gen_random_bytes(16), 'hex');

  UPDATE public.restaurant_tables
  SET
    qr_token_legacy = qr_token,
    qr_token = v_new_token,
    updated_at = clock_timestamp()
  WHERE id = v_clean_table_id
    AND restaurant_id = v_clean_rest;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table "%" not found in restaurant "%"', v_clean_table_id, v_clean_rest
      USING ERRCODE = '22000';
  END IF;

  RETURN v_new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_table_qr_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_table_qr_token(text, text) TO authenticated;

COMMIT;


-- ============================================================================
-- STAGE C: FRONTEND CUTOVER
-- PREREQUISITE: STAGE A & B DEPLOYED AND VERIFIED ON STAGING.
-- Code-only change: Switch UI components to call Phase 6D adapters.
-- No SQL is executed in Stage C.
-- ============================================================================


-- ============================================================================
-- STAGE D: STRICT TENANT RLS ENFORCEMENT
-- PREREQUISITE: STAGE C MUST BE DEPLOYED TO PRODUCTION BEFORE EXECUTING STAGE D!
-- DO NOT EXECUTE STAGE D PREMATURELY!
-- Reversible: YES | Customer Impact: Mediated via RPCs | Staff Impact: Preserved
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- D.1 restaurant_tables: Revoke public SELECT, enforce staff-only direct access
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Public can view active tables" ON public.restaurant_tables;

CREATE POLICY "Staff can view own restaurant tables"
  ON public.restaurant_tables
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can manage own restaurant tables"
  ON public.restaurant_tables
  FOR ALL
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']))
  WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']));

-- ----------------------------------------------------------------------------
-- D.2 restaurant_settings: Revoke public SELECT, enforce staff-only direct access
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view restaurant settings" ON public.restaurant_settings;

CREATE POLICY "Staff can view own restaurant settings"
  ON public.restaurant_settings
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can update own restaurant settings"
  ON public.restaurant_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']))
  WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']));

-- ----------------------------------------------------------------------------
-- D.3 menu_items & Taxonomy: Revoke public SELECT, enforce staff-only direct access
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view active menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Public can view active menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Public can view active menu subcategories" ON public.menu_subcategories;

CREATE POLICY "Staff can view own menu items"
  ON public.menu_items
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can manage own menu items"
  ON public.menu_items
  FOR ALL
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']))
  WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']));

CREATE POLICY "Staff can view own menu categories"
  ON public.menu_categories
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can manage own menu categories"
  ON public.menu_categories
  FOR ALL
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']))
  WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']));

CREATE POLICY "Staff can view own menu subcategories"
  ON public.menu_subcategories
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can manage own menu subcategories"
  ON public.menu_subcategories
  FOR ALL
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']))
  WITH CHECK (public.is_restaurant_staff(restaurant_id, ARRAY['owner', 'manager', 'admin']));

-- ----------------------------------------------------------------------------
-- D.4 royal_orders: Revoke permissive public INSERT and unrestricted SELECT
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can place new orders" ON public.royal_orders;
DROP POLICY IF EXISTS "Customers can view own session orders" ON public.royal_orders;

CREATE POLICY "Staff can view own restaurant orders"
  ON public.royal_orders
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can update own restaurant orders"
  ON public.royal_orders
  FOR UPDATE
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id))
  WITH CHECK (public.is_restaurant_staff(restaurant_id));

-- ----------------------------------------------------------------------------
-- D.5 customer_feedback: Revoke direct anonymous INSERT
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit customer feedback" ON public.customer_feedback;

CREATE POLICY "Staff can view own customer feedback"
  ON public.customer_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

-- ----------------------------------------------------------------------------
-- D.6 settlement_attempts: Staff-only direct read policy
-- ----------------------------------------------------------------------------
CREATE POLICY "Staff can view own settlement attempts"
  ON public.settlement_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_restaurant_staff(restaurant_id));

COMMIT;


-- ============================================================================
-- STAGE E: LEGACY QR DEPRECATION (Post-Standee Replacement)
-- ============================================================================
-- Apply this stage ONLY after 100% of physical table QR standees have been
-- reprinted and deployed across all restaurant dining areas.

-- UPDATE public.restaurant_tables
-- SET qr_token_legacy = NULL
-- WHERE restaurant_id = 'rbh-main-branch';

-- DROP INDEX IF EXISTS idx_restaurant_tables_qr_legacy;
-- ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_token_legacy;


-- ============================================================================
-- VERIFICATION TEST SUITE (13 STAGING SQL SCENARIOS)
-- Execute these queries in a test environment to validate security & constraints.
-- ============================================================================

/*
-- 1. Same idempotency key + identical payload -> cached response
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":100}]'::jsonb, 'Cashier', 't1', 'idemp_key_01');
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":100}]'::jsonb, 'Cashier', 't1', 'idemp_key_01');
-- Expected: Exact same response payload returned; exactly one row inserted in royal_payments.

-- 2. Same idempotency key + different amount -> conflict
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":200}]'::jsonb, 'Cashier', 't2', 'idemp_key_01');
-- Expected: EXCEPTION 23505: IDEMPOTENCY_KEY_REUSE_CONFLICT.

-- 3. Same idempotency key + different payment mode -> conflict
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"UPI","amount":100}]'::jsonb, 'Cashier', 't3', 'idemp_key_01');
-- Expected: EXCEPTION 23505: IDEMPOTENCY_KEY_REUSE_CONFLICT.

-- 4. Negative payment -> reject
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":-50}]'::jsonb, 'Cashier', 't4', 'idemp_key_02');
-- Expected: EXCEPTION: Payment split amount must be strictly greater than zero.

-- 5. Zero payment -> reject
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":0}]'::jsonb, 'Cashier', 't5', 'idemp_key_03');
-- Expected: EXCEPTION: Payment split amount must be strictly greater than zero.

-- 6. Wrong table for session -> reject
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 2', '[{"mode":"Cash","amount":100}]'::jsonb, 'Cashier', 't6', 'idemp_key_04');
-- Expected: EXCEPTION: MISMATCHED_SESSION_TABLE.

-- 7. Wrong restaurant for session -> reject
SELECT public.settle_dining_session_atomic('other-tenant', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":100}]'::jsonb, 'Cashier', 't7', 'idemp_key_05');
-- Expected: EXCEPTION: SESSION_NOT_FOUND.

-- 8. Multiple active sessions on table -> reject
-- Expected: create_order_secure raises ACTIVE_SESSION_CONFLICT if data has multiple open sessions on same table.

-- 9. Simultaneous first orders -> exactly one session
-- Expected: pg_advisory_xact_lock serializes callers; Round 1 is created, second caller receives Round 2.

-- 10. Concurrent settlement -> no duplicate payment
-- Expected: Row-level lock FOR UPDATE serializes workers; only one proceeds with remaining balance.

-- 11. Overpayment -> reject
SELECT public.settle_dining_session_atomic('rbh-main-branch', 'SESS-101', 'Table 1', '[{"mode":"Cash","amount":999999}]'::jsonb, 'Cashier', 't11', 'idemp_key_06');
-- Expected: EXCEPTION: OVERPAYMENT_REJECTED.

-- 12. Unauthorized staff -> reject
-- Expected: If auth.uid() is not active in staff_profiles for restaurant, raises UNAUTHORIZED_STAFF.

-- 13. Cross-tenant access -> reject
SELECT public.create_order_secure('foreign-tenant', 'Table 1', 'rbh_sec_test', '[{"id":"item-1","quantity":1}]'::jsonb);
-- Expected: EXCEPTION 42501: Access denied.
*/


-- ============================================================================
-- ROLLBACK SCRIPTS (Emergency Rollback Procedures)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ROLLBACK STAGE D: Restore permissive public access
-- ----------------------------------------------------------------------------
/*
BEGIN;
DROP POLICY IF EXISTS "Staff can view own restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Staff can manage own restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Public can view active restaurant tables" ON public.restaurant_tables FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can view own restaurant settings" ON public.restaurant_settings;
DROP POLICY IF EXISTS "Staff can update own restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Public can view restaurant settings" ON public.restaurant_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can view own menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Staff can manage own menu items" ON public.menu_items;
CREATE POLICY "Public can view active menu items" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can view own menu categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Staff can manage own menu categories" ON public.menu_categories;
CREATE POLICY "Public can view active menu categories" ON public.menu_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can view own menu subcategories" ON public.menu_subcategories;
DROP POLICY IF EXISTS "Staff can manage own menu subcategories" ON public.menu_subcategories;
CREATE POLICY "Public can view active menu subcategories" ON public.menu_subcategories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can view own restaurant orders" ON public.royal_orders;
DROP POLICY IF EXISTS "Staff can update own restaurant orders" ON public.royal_orders;
CREATE POLICY "Public can place new orders" ON public.royal_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers can view own session orders" ON public.royal_orders FOR SELECT USING (session_id IS NOT NULL);

DROP POLICY IF EXISTS "Staff can view own customer feedback" ON public.customer_feedback;
CREATE POLICY "Public can submit customer feedback" ON public.customer_feedback FOR INSERT WITH CHECK (true);
COMMIT;
*/

-- ----------------------------------------------------------------------------
-- ROLLBACK STAGE B: Drop RPCs
-- ----------------------------------------------------------------------------
/*
BEGIN;
DROP FUNCTION IF EXISTS public.create_order_secure(text, text, text, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.settle_dining_session_atomic(text, text, text, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.customer_get_menu_by_qr(text, text, text);
DROP FUNCTION IF EXISTS public.customer_get_menu(text, text, text);
DROP FUNCTION IF EXISTS public.customer_submit_feedback(text, text, text, text, text, numeric, text, jsonb);
DROP FUNCTION IF EXISTS public.rotate_table_qr_token(text, text);
COMMIT;
*/

-- ----------------------------------------------------------------------------
-- ROLLBACK STAGE A: Remove settlement_attempts and drop legacy index
-- ----------------------------------------------------------------------------
/*
BEGIN;
DROP TABLE IF EXISTS public.settlement_attempts;
DROP INDEX IF EXISTS idx_restaurant_tables_qr_token;
DROP INDEX IF EXISTS idx_restaurant_tables_qr_legacy;
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_token_legacy;
COMMIT;
*/
