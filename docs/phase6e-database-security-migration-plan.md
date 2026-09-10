# Phase 6E — Database Security Migration Plan & Production SQL Specifications (Revised)

> **Document Status:** Revised & Hardened Design (Review Corrections Applied)  
> **Target Repository:** `royal-biryani-house` (branch: `main` @ `96c9871`)  
> **Connected Supabase Ref:** `minbtrzsdlompvaoglzn`  
> **Execution Status:** **DRAFT ONLY — DO NOT EXECUTE AGAINST PRODUCTION**  
> **Production Migration Verdict:** **NO-GO**  
> **Staging Execution Verdict:** **WAITING FOR FINAL REVIEW**

---

## Executive Summary of Review Corrections

Following pre-flight design review, the Phase 6E database security migration specification has been updated with strict transactional, financial, and multi-tenant guardrails:

1. **Deterministic Idempotency Fingerprinting**: `settle_dining_session_atomic` now validates canonical request parameters (`restaurant_id`, `session_id`, `table_number`, `total_paid_now`, and sorted normalized splits). If an attempt ID is reused with altered parameters, it raises an explicit `IDEMPOTENCY_KEY_REUSE_CONFLICT` instead of returning stale cached data.
2. **Strict Payment Split Validation**: Rejects non-positive (`<= 0`), negative, non-numeric, or unrecognized payment modes (`Cash`, `UPI`, `Card` only).
3. **Session / Table Integrity Check**: Prohibits settling a session against a table number that does not match the active session orders (`MISMATCHED_SESSION_TABLE`).
4. **Multiple Active Session Conflict Prevention**: `create_order_secure` verifies the number of active sessions for a table. If multiple open sessions exist, it raises `ACTIVE_SESSION_CONFLICT` rather than arbitrarily picking one.
5. **Authoritative Staff Identity**: Audit tracking in `settlement_attempts` and `royal_payments` binds directly to `auth.uid()` and verified `staff_profiles` rows, preventing client-side staff impersonation.
6. **Waterfall Financial Precision**: Orders are updated strictly by round and creation order; already-settled orders are skipped; `paid_amount + remaining_amount = total` is strictly maintained for every individual ticket.

---

## A. Current Live Schema Facts

Based on live Supabase preflight inspection (`minbtrzsdlompvaoglzn`):

| Table | Primary Key | Key Columns & Constraints | Current Live Observations |
|---|---|---|---|
| `restaurant_tables` | `id text` | `restaurant_id text`, `table_number text`, `section text`, `capacity integer`, `is_active boolean`, `display_order integer`, `qr_code_url text`, `qr_token text` | `qr_token` contains deterministic hash string (`rbh_tok_...`). No `qr_token_legacy` column exists yet. |
| `restaurant_settings` | `restaurant_id text` | `restaurant_name text`, `logo_url text`, `tagline text`, `address text`, `phone text`, `whatsapp text`, `email text`, `gstin text`, `gst_percentage numeric(5,2)`, `service_charge_percentage numeric(5,2)` | Single-row-per-tenant settings table. Column naming uses `restaurant_name` and `logo_url`. |
| `menu_items` | `id text` | `restaurant_id text`, `category_id text`, `subcategory_id text`, `name text`, `price numeric(10,2)`, `base_price numeric(10,2)`, `available boolean`, `is_archived boolean`, `variants jsonb`, `addons jsonb` | Publicly queryable without tenant restriction (`USING (true)`). |
| `menu_categories` | `id text` | `restaurant_id text`, `name text`, `icon text`, `display_order integer`, `is_active boolean` | Publicly queryable without tenant restriction. |
| `menu_subcategories` | `id text` | `restaurant_id text`, `category_id text`, `name text`, `display_order integer`, `is_active boolean` | Publicly queryable without tenant restriction. |
| `royal_orders` | `order_id text` | `restaurant_id text`, `table_number text`, `session_id text`, `round integer`, `is_addon boolean`, `items jsonb`, `subtotal numeric`, `tax numeric`, `total numeric`, `status text`, `payment_status text`, `paid_amount numeric`, `remaining_amount numeric`, `payment_history jsonb`, `qr_token text` | Direct client insert policy allows client to supply `subtotal`, `tax`, `total`, and `paid_amount`. |
| `royal_payments` | `id text` | `restaurant_id text`, `order_id text`, `session_id text`, `table_number text`, `amount numeric(10,2)`, `payment_mode text`, `recorded_by text`, `is_voided boolean` | No `idempotency_key` column exists. Multi-split payments insert separate rows with arbitrary client-generated IDs. |
| `customer_feedback` | `id text` | `restaurant_id text`, `order_id text`, `table_number text`, `customer_name text`, `rating integer`, `review text`, `tags jsonb`, `is_archived boolean` | Anonymous direct insert permitted without active QR proof. |
| `staff_profiles` | `id uuid references auth.users` | `restaurant_id text`, `role text`, `full_name text`, `email text`, `is_active boolean` | Authoritative staff role directory used by `public.is_restaurant_staff`. |

---

## B. Current Security & RLS Facts

1. **`private.customer_qr_matches`**:
   - Signature: `(p_restaurant_id text, p_table_number text, p_qr_token text) RETURNS boolean`
   - Defined with `SECURITY DEFINER` and `SET search_path = public, pg_temp`.
   - Checks: `qr_token = p_qr_token` and `is_active = true` on `restaurant_tables`.
2. **`public.is_restaurant_staff`**:
   - Signature: `(p_restaurant_id text, p_roles text[] DEFAULT NULL) RETURNS boolean`
   - Defined with `SECURITY DEFINER` and `SET search_path = public, pg_temp`.
   - Queries `public.staff_profiles` matching `auth.uid() = id`, `restaurant_id = p_restaurant_id`, and `is_active = true`.
3. **Current Vulnerabilities**:
   - Client-controlled financial attributes during order insert.
   - Permissive read on `royal_orders` where `session_id IS NOT NULL`.
   - Public unauthenticated table scraping on `menu_items`, `menu_categories`, `menu_subcategories`, `restaurant_tables`.
   - Predictable QR tokens (`rbh_tok_...`).

---

## C. Threat Model & Mitigation Matrix

| Threat Vector | Severity | Vulnerability Description | Phase 6E Mitigation |
|---|---|---|---|
| **Price Tampering** | **CRITICAL** | Diner client sends modified JSON (`total: 1.00`, `price: 1.00`) during `saveOrder`. | `create_order_secure` looks up menu prices authoritatively in `menu_items` and computes subtotal and GST server-side. |
| **Payment Status Spoofing** | **CRITICAL** | Diner client sends `payment_status: 'Paid'` and `paid_amount: total` in order payload. | `create_order_secure` strictly forces `payment_status = 'Pending'` and `paid_amount = 0.00`. |
| **Table Impersonation / Forged QR** | **CRITICAL** | Malicious actor computes predictable token `rbh_tok_t1_<hash>` and places phantom orders from outside restaurant. | Tables migrate to 128-bit CSPRNG tokens (`rbh_sec_<hex>`). Tokens are not exposed in public table listings. |
| **Session Race Conditions / Round Collisions** | **HIGH** | Concurrent diners at same table submit add-on orders simultaneously, producing duplicate round numbers or split sessions. | PostgreSQL transaction advisory lock `pg_advisory_xact_lock(hashtext(p_restaurant_id || ':' || lower(p_table_number)))` serializes orders per table. |
| **Payment Settlement Duplication / Network Retries** | **HIGH** | POS cashier clicks "Settle" twice during slow connectivity, double-charging or corrupting payment ledger. | Exact idempotency key tracked in `public.settlement_attempts`. Replays return cached settlement payload without re-charging. |
| **Idempotency Key Conflict Tampering** | **HIGH** | Attacker or buggy client repeats an attempt ID with different amounts. | Fingerprint verification raises `IDEMPOTENCY_KEY_REUSE_CONFLICT`. |
| **Multi-Tenant Menu & Table Scraping** | **HIGH** | Competitor queries `menu_items` or `restaurant_tables` directly with anon key to dump proprietary recipes, pricing, and seating layouts. | Direct anon SELECT revoked. Access mediated strictly by `customer_get_menu_by_qr` with valid table QR proof. |
| **Feedback Flooding** | **MEDIUM** | Bot submits thousands of negative feedback rows with fake order IDs. | `customer_submit_feedback` verifies active QR context and validates order linkage. |

---

## D. Exact Proposed Database Objects

### 1. Hardened Table: `public.settlement_attempts`
```sql
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

CREATE INDEX IF NOT EXISTS idx_settlement_attempts_session
  ON public.settlement_attempts (restaurant_id, session_id);

CREATE INDEX IF NOT EXISTS idx_settlement_attempts_created
  ON public.settlement_attempts (restaurant_id, created_at DESC);

ALTER TABLE public.settlement_attempts ENABLE ROW LEVEL SECURITY;
```

### 2. Schema Alterations on Existing Tables
- `restaurant_tables`:
  - `ADD COLUMN IF NOT EXISTS qr_token_legacy text;`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token ON public.restaurant_tables (restaurant_id, qr_token) WHERE is_active = true AND qr_token IS NOT NULL;`
  - `CREATE INDEX IF NOT EXISTS idx_restaurant_tables_qr_legacy ON public.restaurant_tables (restaurant_id, qr_token_legacy) WHERE is_active = true AND qr_token_legacy IS NOT NULL;`

### 3. Stored Functions / RPCs (Signatures & Roles)
1. `private.customer_qr_matches(p_restaurant_id text, p_table_number text, p_qr_token text) RETURNS boolean`
   - *Updated:* Supports both active `qr_token` and `qr_token_legacy`.
2. `public.create_order_secure(p_restaurant_id text, p_table_number text, p_qr_token text, p_items jsonb, p_customer_name text, p_customer_notes text, p_session_id text) RETURNS jsonb`
   - *Updated:* Validates single active session (`ACTIVE_SESSION_CONFLICT` on multiples), acquires advisory lock, calculates authoritative pricing & GST.
3. `public.settle_dining_session_atomic(p_restaurant_id text, p_session_id text, p_table_number text, p_split_payments jsonb, p_recorded_by text, p_notes text, p_idempotency_key text) RETURNS jsonb`
   - *Updated:* Validates canonical fingerprint against attempt history, verifies session-table consistency (`MISMATCHED_SESSION_TABLE`), enforces strict split mode and amount bounds, binds authoritative staff audit identity, and runs waterfall allocation.
4. `public.customer_get_menu_by_qr(p_restaurant_id text, p_table_number text, p_qr_token text) RETURNS jsonb`
   - *New:* QR-verified menu retrieval returning categorized menu items.
   - *Compatibility alias:* `public.customer_get_menu(p_restaurant_id text, p_table_number text, p_qr_token text)` provided for Phase 6D frontend adapter.
5. `public.customer_submit_feedback(p_restaurant_id text, p_table_number text, p_qr_token text, p_order_id text, p_customer_name text, p_rating numeric, p_review text, p_tags jsonb) RETURNS jsonb`
   - *New:* QR-verified feedback submission.
6. `public.rotate_table_qr_token(p_table_id text, p_restaurant_id text) RETURNS text`
   - *New:* Staff-only function to rotate a table's QR token to a fresh CSPRNG string while archiving current token to legacy.

---

## E. Staged Migration Plan

### Stage A — Additive / Non-Breaking Preparation
- **Actions**:
  1. Add `qr_token_legacy text` to `restaurant_tables`.
  2. Create `public.settlement_attempts` table.
  3. Populate `qr_token_legacy = qr_token` on `restaurant_tables`.
  4. Generate fresh 128-bit CSPRNG tokens for `qr_token` using `gen_random_bytes(16)`.
- **Safety**: Fully reversible; zero customer impact; existing printed QR codes match `qr_token_legacy`.

### Stage B — Create & Test New RPCs
- **Actions**:
  1. Update `private.customer_qr_matches` to check `qr_token OR qr_token_legacy`.
  2. Deploy hardened `create_order_secure`, `settle_dining_session_atomic`, `customer_get_menu_by_qr`, `customer_submit_feedback`, and `rotate_table_qr_token`.
  3. Grant `EXECUTE` on customer RPCs to `anon, authenticated`.
  4. Grant `EXECUTE` on staff RPCs to `authenticated`.
- **Safety**: Purely additive RPCs; does not alter existing policies or remove legacy access.

### Stage C — Frontend Cutover (Phase 6D Activation)
- **Actions**:
  1. Update frontend callers in `CartDrawer.tsx` to call `createOrderSecure`.
  2. Update settlement submit in `CounterDashboard.tsx` to call `settleDiningSessionAtomic`.
  3. Update menu fetching in `App.tsx` to call `customerGetMenuByQr`.
  4. Update feedback submission in `CustomerFeedbackCard.tsx` to call `customerSubmitFeedback`.
- **Safety**: Verified via automated test suites before deploying to production.

### Stage D — Strict Tenant RLS Enforcement
- **CRITICAL PREREQUISITE**: **STAGE C MUST BE LIVE BEFORE APPLYING STAGE D!**
- **Actions**:
  1. Drop permissive public `SELECT` policies on `menu_items`, `menu_categories`, `menu_subcategories`, `restaurant_tables`, and `restaurant_settings`.
  2. Drop permissive public `INSERT` policies on `royal_orders` and `customer_feedback`.
  3. Drop permissive `"Customers can view own session orders"` on `royal_orders`.
  4. Enforce strict `public.is_restaurant_staff(restaurant_id)` across all operational tables.
- **Safety**: Customers access data exclusively through verified `SECURITY DEFINER` RPCs.

### Stage E — Legacy QR Deprecation
- **Actions**:
  1. Once all physical table standees have been reprinted and deployed in the restaurant, clear `qr_token_legacy`.
  2. Drop column `qr_token_legacy`.

---

## F. Verification Test Scenarios (13 Staging Tests)

1. **Same Idempotency Key + Identical Payload**: Returns cached response immediately; no duplicate row in `royal_payments`.
2. **Same Idempotency Key + Different Amount**: Raises `IDEMPOTENCY_KEY_REUSE_CONFLICT`.
3. **Same Idempotency Key + Different Payment Mode**: Raises `IDEMPOTENCY_KEY_REUSE_CONFLICT`.
4. **Negative Payment Amount**: Raises exception (`Payment split amount must be greater than zero`).
5. **Zero Payment Amount**: Raises exception.
6. **Wrong Table for Session**: Raises `MISMATCHED_SESSION_TABLE`.
7. **Wrong Restaurant for Session**: Raises `SESSION_NOT_FOUND`.
8. **Multiple Active Sessions on Table**: Raises `ACTIVE_SESSION_CONFLICT`.
9. **Simultaneous First Orders on Table**: Serialized by `pg_advisory_xact_lock`; results in exactly one session with sequential rounds.
10. **Concurrent Settlements on Session**: Serialized by row-level order lock (`FOR UPDATE`); no duplicate payment recording.
11. **Overpayment Attempt**: Raises `OVERPAYMENT_REJECTED` if total exceeds remote unpaid balance.
12. **Unauthorized Staff Attempt**: Raises `UNAUTHORIZED_STAFF` if caller is not an active staff member of the restaurant.
13. **Cross-Tenant Access Attempt**: Rejects attempts to query or mutate another restaurant's data.

---

## G. Final Sign-Off & Safe Execution Status

- **Production Migration Status:** **NO-GO**
- **Staging Execution Status:** **WAITING FOR FINAL REVIEW**
- **Immediate Next Step:** Provision an isolated Supabase staging database or branch, apply Stage A and Stage B from `docs/phase6e-migration-draft.sql`, and run the 13 automated verification scenarios.
