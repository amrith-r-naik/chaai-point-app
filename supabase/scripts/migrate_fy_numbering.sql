-- Migrate server-side numbering to Indian financial year (Apr–Mar, IST)
-- Safe to run multiple times.

begin;

-- Update helper functions to use IST fiscal year (3-month shift)
create or replace function public.next_bill_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  v_year int := extract(year from ((p_ts at time zone 'Asia/Kolkata') - interval '3 months'))::int;
  v_next integer;
begin
  insert into public.counters_bill_yearly (shop_id, year, last_value)
  values (p_shop_id, v_year, 0)
  on conflict do nothing;

  update public.counters_bill_yearly
    set last_value = last_value + 1
  where shop_id = p_shop_id and year = v_year
  returning last_value into v_next;

  return v_next;
end;
$$;

create or replace function public.next_receipt_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  v_year int := extract(year from ((p_ts at time zone 'Asia/Kolkata') - interval '3 months'))::int;
  v_next integer;
begin
  insert into public.counters_receipt_yearly (shop_id, year, last_value)
  values (p_shop_id, v_year, 0)
  on conflict do nothing;

  update public.counters_receipt_yearly
    set last_value = last_value + 1
  where shop_id = p_shop_id and year = v_year
  returning last_value into v_next;

  return v_next;
end;
$$;

create or replace function public.next_voucher_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  v_year int := extract(year from ((p_ts at time zone 'Asia/Kolkata') - interval '3 months'))::int;
  v_next integer;
begin
  insert into public.counters_voucher_yearly (shop_id, year, last_value)
  values (p_shop_id, v_year, 0)
  on conflict do nothing;

  update public.counters_voucher_yearly
    set last_value = last_value + 1
  where shop_id = p_shop_id and year = v_year
  returning last_value into v_next;

  return v_next;
end;
$$;

-- Recreate uniqueness indexes to use IST FY partitioning keys
drop index if exists uniq_kot_shop_day_number;
create unique index if not exists uniq_kot_shop_day_number
  on public.kot_orders (shop_id, ((created_at at time zone 'Asia/Kolkata')::date), kot_number)
  where deleted_at is null;

drop index if exists uniq_bills_shop_year_number;
create unique index if not exists uniq_bills_shop_year_number
  on public.bills (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), bill_number)
  where deleted_at is null;

drop index if exists uniq_receipts_shop_year_number;
create unique index if not exists uniq_receipts_shop_year_number
  on public.receipts (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), receipt_no)
  where deleted_at is null;

drop index if exists uniq_expenses_shop_year_voucher;
create unique index if not exists uniq_expenses_shop_year_voucher
  on public.expenses (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), voucher_no)
  where deleted_at is null;

commit;

-- Note:
-- 1) This migration changes only the partitioning logic; it does not renumber historical records.
-- 2) From the next insert, counters will use FY buckets. If you need to realign Jan–Mar numbers, do a manual review.
-- 3) Local app already uses IST FY in lib/db.ts nextLocalNumber().
