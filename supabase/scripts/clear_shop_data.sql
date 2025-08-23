-- Clear business data for a single shop while preserving users/auth
-- Default shop_id: change as needed

-- =============================
-- CONFIG
-- =============================
DO $$
DECLARE
  v_shop_id text := 'shop_1';
  v_now timestamptz := now();
BEGIN
  RAISE NOTICE 'Using shop_id=%', v_shop_id;
END $$;

-- =============================
-- DRY RUN: counts per table
-- =============================
WITH t(name, cnt) AS (
  SELECT 'split_payments', count(*) FROM split_payments WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'receipts',       count(*) FROM receipts       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'payments',       count(*) FROM payments       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'kot_items',      count(*) FROM kot_items      WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'kot_orders',     count(*) FROM kot_orders     WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'bills',          count(*) FROM bills          WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'expenses',       count(*) FROM expenses       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'menu_items',     count(*) FROM menu_items     WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'customers',      count(*) FROM customers      WHERE shop_id = 'shop_1'
)
SELECT * FROM t ORDER BY name;

-- =============================
-- SOFT DELETE (default): mark rows deleted_at and bump updated_at
-- Safe with RLS
-- =============================
BEGIN;

UPDATE split_payments SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE receipts       SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE payments       SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE kot_items      SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE kot_orders     SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE bills          SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE expenses       SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE menu_items     SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;
UPDATE customers      SET deleted_at = now(), updated_at = now() WHERE shop_id = 'shop_1' AND deleted_at IS NULL;

COMMIT;

-- =============================
-- HARD DELETE (optional): FK-safe order
-- Requires delete privileges; if RLS enforced, run as service role or skip.
-- Uncomment to use.
-- =============================
-- BEGIN;
-- DELETE FROM split_payments WHERE shop_id = 'shop_1';
-- DELETE FROM receipts       WHERE shop_id = 'shop_1';
-- DELETE FROM payments       WHERE shop_id = 'shop_1';
-- DELETE FROM kot_items      WHERE shop_id = 'shop_1';
-- DELETE FROM kot_orders     WHERE shop_id = 'shop_1';
-- DELETE FROM bills          WHERE shop_id = 'shop_1';
-- DELETE FROM expenses       WHERE shop_id = 'shop_1';
-- DELETE FROM menu_items     WHERE shop_id = 'shop_1';
-- DELETE FROM customers      WHERE shop_id = 'shop_1';
-- COMMIT;

-- =============================
-- OPTIONAL: reset counters (if your schema has these tables)
-- Uncomment the lines that exist in your DB.
-- =============================
-- BEGIN;
-- DELETE FROM counters_kot_daily      WHERE shop_id = 'shop_1';
-- DELETE FROM counters_bill_yearly    WHERE shop_id = 'shop_1';
-- DELETE FROM counters_receipt_yearly WHERE shop_id = 'shop_1';
-- DELETE FROM counters_voucher_yearly WHERE shop_id = 'shop_1';
-- COMMIT;

-- =============================
-- VERIFY
-- For hard delete: expect counts=0
-- For soft delete: expect cnt_not_deleted=0 but rows may remain with deleted_at NOT NULL
-- =============================
WITH t(name, cnt_remaining, cnt_not_deleted) AS (
  SELECT 'split_payments', count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM split_payments WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'receipts',       count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM receipts       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'payments',       count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM payments       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'kot_items',      count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM kot_items      WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'kot_orders',     count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM kot_orders     WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'bills',          count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM bills          WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'expenses',       count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM expenses       WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'menu_items',     count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM menu_items     WHERE shop_id = 'shop_1' UNION ALL
  SELECT 'customers',      count(*), count(*) FILTER (WHERE deleted_at IS NULL) FROM customers      WHERE shop_id = 'shop_1'
)
SELECT * FROM t ORDER BY name;

-- NOTE: Storage bucket cleanup (backups) cannot be done via SQL. Use the Storage UI or API.
