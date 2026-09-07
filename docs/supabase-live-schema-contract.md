# Verified Supabase live schema contract

> Audit date: 2026-09-07. Source: read-only audit of the connected **Royal biryani demo** Supabase project (`minbtrzsdlompvaoglzn`). This document describes the live database contract, not the repository's historical `supabase_migration.sql`.

## Scope and source of truth

- The live database, its applied migration list, and its RLS/RPC metadata are the production contract.
- `supabase_migration.sql` is materially divergent and must not be applied to the live project as-is.
- No staging branch exists. Validate every database or security change against a newly provisioned staging project/branch before production.

## Tenant and identity model

- Tenant scope is represented by `restaurant_id` text fields. There is no live `public.restaurants` table.
- Current data includes `rbh-main-branch` and legacy `rest_rbh_royal_biryani` records. The latter has menu/order/payment data but no corresponding settings, tables, or staff profiles.
- Staff membership is `public.staff_profiles(id uuid references auth.users(id), restaurant_id, role, is_active, ...)`.
- `public.staff_accounts` does not exist in the live database.

## Canonical live tables

| Area | Table | Important columns |
|---|---|---|
| Customer menu | `menu_items` | `id`, `restaurant_id`, `category_id`, `subcategory_id`, `name`, `price`, `description`, `image_url`, `available`, `is_bestseller`, `stock_status`, `display_order` |
| Menu taxonomy | `menu_categories`, `menu_subcategories` | Tenant, name, ordering, active flag; subcategories also have `category_id` |
| Restaurant setup | `restaurant_settings` | `restaurant_id` PK, `restaurant_name`, `logo_url`, `address`, `phone`, `whatsapp`, `email`, `gstin`, percentages, opening/closing times, footer, tagline |
| Customer tables | `restaurant_tables` | `id`, `restaurant_id`, `table_number`, `display_order`, `capacity`, `qr_token`, `is_active`, timestamps |
| Orders | `royal_orders` | `order_id`, tenant/table/session, JSONB `items`, prices/tax/payment fields, customer fields, `is_archived`, and live-only `qr_token` |
| Payments | `royal_payments` | `id`, tenant/order/session/table, amount, payment mode, recorder, void fields |
| Inventory | `raw_materials`, `stock_movements` | `raw_materials` uses `current_stock`, `min_threshold`, `unit_cost`; movements allow only `add`, `deduct`, `waste`, `audit_reset` |
| Recipes | `menu_item_recipes`, `menu_item_recipe_ingredients` | Minimal recipe/ingredient structures; both have `id` primary keys |
| Procurement | `inventory_purchases`, `inventory_purchase_items`, `inventory_wastage` | These tables exist live but are empty at audit time |
| Other | `customer_feedback`, `inventory_order_consumptions`, legacy `Royal biryani house demo` | See the live audit for full detail |

`orders`, `payments`, `feedback`, `restaurants`, and `staff_accounts` are not live tables.

## RLS and RPC contract relevant to the frontend

All live public tables have RLS enabled.

- Public menu/taxonomy reads are currently unrestricted by tenant (`USING (true)`). Do not rely on this as a client-side fallback for tenant data.
- Direct `royal_orders` reads are staff-only.
- Customer order inserts require a non-null row `qr_token` that matches an active `restaurant_tables` record through `private.customer_qr_matches`.
- Client-supplied prices and totals are still accepted by the current insert policy; server-calculated order totals require future staging-backed work.

### Public RPCs

| RPC | Arguments | Intended use |
|---|---|---|
| `customer_get_restaurant_settings` | `p_restaurant_id text` | Public-safe restaurant settings |
| `customer_get_tables` | `p_restaurant_id text` | Active tables without QR tokens |
| `customer_get_session_orders` | `p_session_id text`, `p_restaurant_id text`, `p_table_number text`, `p_qr_token text` | A single valid table/session order set |
| `kds_advance_order_status` | `p_order_id text`, `p_restaurant_id text`, `p_next_status text` | Authenticated staff workflow transition |
| `is_restaurant_staff` | tenant and roles | Authenticated role predicate |

The public RPC wrappers delegate to security-definer functions in `private`; the private implementations use explicit search paths.

## Realtime contract

`supabase_realtime` publishes only:

- `royal_orders`
- `royal_payments`
- `raw_materials`

Do not assume realtime support for customer feedback, taxonomy, settings, tables, recipes, purchases, or wastage.

## Frontend compatibility rules

1. Always pass `p_restaurant_id` to `customer_get_tables`.
2. Map settings RPC fields: `restaurant_name -> name`, `logo_url -> logo`, `gst_percentage -> gstRate`, and `service_charge_percentage -> serviceChargeRate`.
3. Map inventory fields: `current_stock -> quantity`, `min_threshold -> minimumThreshold`, and `unit_cost -> purchasePrice`; write those same live column names.
4. Translate the UI movement vocabulary to the live `stock_movements.movement_type` constraint values before writing.
5. Keep fallbacks for now. Do not use absent legacy tables (`orders`, `payments`, `feedback`) as a live fallback once a verified replacement is available.
6. Do not alter QR generation, RLS, staff authorization, or the tenant model without staging and backup.

## Known live/repository divergence

- The checked-in migration expects a `restaurants` table and multiple foreign keys that do not exist live.
- Live settings, tables, menu, recipe, and inventory schemas differ from the migration and from several current frontend payloads.
- The three customer RPCs and the procurement/wastage tables do exist live even though they were absent from the checked-in migration.
- `royal_orders.qr_token` exists live but is absent from the checked-in migration.
- Live realtime omits `customer_feedback`, unlike the checked-in migration.
