-- Supabase Schema (Phase 2)
-- Create profiles for auth mapping, business tables, triggers, and indexes

-- Profiles: one row per auth user, with role and shop mapping
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff','admin')) default 'staff',
  shop_id text not null default 'shop_1',
  created_at timestamptz not null default now()
);

-- Helper trigger to auto-create profile on new user sign-up (default role=staff)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, shop_id)
  values (new.id, 'staff', 'shop_1')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Business tables (mirror of local schema, with sync metadata)
create table if not exists public.customers (
  id text primary key,
  name text not null,
  contact text unique,
  credit_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category text,
  price integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.bills (
  id text primary key,
  bill_number integer not null,
  customer_id text not null references public.customers(id),
  total integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.kot_orders (
  id text primary key,
  kot_number integer not null,
  customer_id text not null references public.customers(id),
  bill_id text references public.bills(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.kot_items (
  id text primary key,
  kot_id text not null references public.kot_orders(id) on delete cascade,
  item_id text not null references public.menu_items(id),
  quantity integer not null,
  price_at_time integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.payments (
  id text primary key,
  bill_id text references public.bills(id),
  customer_id text not null references public.customers(id),
  amount integer not null,
  mode text not null,
  sub_type text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.receipts (
  id text primary key,
  receipt_no integer not null,
  customer_id text not null references public.customers(id),
  bill_id text references public.bills(id),
  amount integer not null,
  mode text not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.expenses (
  id text primary key,
  voucher_no integer not null,
  amount integer not null,
  towards text not null,
  mode text not null,
  remarks text,
  created_at timestamptz not null default now(),
  expense_date date not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

create table if not exists public.split_payments (
  id text primary key,
  receipt_id text not null references public.receipts(id) on delete cascade,
  payment_type text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

-- Expense settlements: detailed payments/credit for expenses
create table if not exists public.expense_settlements (
  id text primary key,
  expense_id text not null references public.expenses(id) on delete cascade,
  payment_type text not null,
  sub_type text,
  amount integer not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

-- Customer advances: ledger of advance add/apply/refund entries
create table if not exists public.customer_advances (
  id text primary key,
  customer_id text not null references public.customers(id),
  entry_type text not null check (entry_type in ('Add','Apply','Refund')),
  amount integer not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shop_id text not null
);

-- Triggers to maintain updated_at on update
do $$
declare
  t text;
begin
  foreach t in array array[
  'customers','menu_items','bills','kot_orders','kot_items','payments','receipts','expenses','split_payments','expense_settlements','customer_advances'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- Indexes for efficient pulls
create index if not exists idx_customers_shop_updated on public.customers(shop_id, updated_at);
create index if not exists idx_menu_items_shop_updated on public.menu_items(shop_id, updated_at);
create index if not exists idx_bills_shop_updated on public.bills(shop_id, updated_at);
create index if not exists idx_kot_orders_shop_updated on public.kot_orders(shop_id, updated_at);
create index if not exists idx_kot_items_shop_updated on public.kot_items(shop_id, updated_at);
create index if not exists idx_payments_shop_updated on public.payments(shop_id, updated_at);
create index if not exists idx_receipts_shop_updated on public.receipts(shop_id, updated_at);
create index if not exists idx_expenses_shop_updated on public.expenses(shop_id, updated_at);
create index if not exists idx_split_payments_shop_updated on public.split_payments(shop_id, updated_at);
create index if not exists idx_expense_settlements_shop_updated on public.expense_settlements(shop_id, updated_at);
create index if not exists idx_expense_settlements_expense on public.expense_settlements(expense_id);
create index if not exists idx_expense_settlements_created on public.expense_settlements(created_at);
create index if not exists idx_customer_advances_shop_updated on public.customer_advances(shop_id, updated_at);
create index if not exists idx_customer_advances_customer on public.customer_advances(customer_id);
create index if not exists idx_customer_advances_created on public.customer_advances(created_at);

-- Backward-compat: drop payment_date if present from earlier iterations
do $$ begin
  begin alter table public.customer_advances drop column if exists payment_date; exception when others then end;
end $$;

-- Ensure expense_date exists and is populated on existing databases (idempotent)
do $$
begin
  -- Add column if it doesn't exist
  begin
    alter table public.expenses add column if not exists expense_date date;
  exception when others then
    -- ignore
  end;

  -- Set default to today (date only)
  begin
    alter table public.expenses alter column expense_date set default (now()::date);
  exception when others then
    -- ignore
  end;

  -- Backfill any NULLs using created_at day
  update public.expenses
    set expense_date = date_trunc('day', created_at)::date
  where expense_date is null;

  -- Enforce NOT NULL
  begin
    alter table public.expenses alter column expense_date set not null;
  exception when others then
    -- ignore (e.g., if any legacy NULLs remain)
  end;
end $$;

-- =============================
-- Phase 2: Server-assigned numbering
-- KOT numbers reset daily per shop (IST)
-- Bill, Receipt, and Expense voucher numbers reset every Indian financial year (Apr 1–Mar 31, IST)
-- =============================

-- Counter tables
create table if not exists public.counters_kot_daily (
  shop_id text not null,
  day date not null,
  last_value integer not null default 0,
  primary key (shop_id, day)
);

create table if not exists public.counters_bill_yearly (
  shop_id text not null,
  year int not null,
  last_value integer not null default 0,
  primary key (shop_id, year)
);

create table if not exists public.counters_receipt_yearly (
  shop_id text not null,
  year int not null,
  last_value integer not null default 0,
  primary key (shop_id, year)
);

create table if not exists public.counters_voucher_yearly (
  shop_id text not null,
  year int not null,
  last_value integer not null default 0,
  primary key (shop_id, year)
);

-- Helper: get next daily counter (KOT)
create or replace function public.next_kot_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  -- Use IST shop-local date for daily reset
  v_day date := (p_ts at time zone 'Asia/Kolkata')::date;
  v_next integer;
begin
  -- Ensure row exists
  insert into public.counters_kot_daily (shop_id, day, last_value)
  values (p_shop_id, v_day, 0)
  on conflict do nothing;

  -- Increment atomically
  update public.counters_kot_daily
    set last_value = last_value + 1
  where shop_id = p_shop_id and day = v_day
  returning last_value into v_next;

  return v_next;
end;
$$;

-- Helper: get next yearly counter (Bills)
create or replace function public.next_bill_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  -- Compute Indian fiscal year (Apr–Mar) using IST by shifting minus 3 months
  -- Example: 2025-09 -> (minus 3 months) 2025-06 -> year 2025 (FY 2025–26)
  --          2025-01 -> (minus 3 months) 2024-10 -> year 2024 (FY 2024–25)
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

-- Helper: get next yearly counter (Receipts)
create or replace function public.next_receipt_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  -- Use IST fiscal year (Apr–Mar) via 3-month shift
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

-- Helper: get next yearly counter (Expenses voucher)
create or replace function public.next_voucher_number(p_shop_id text, p_ts timestamptz)
returns integer
language plpgsql
as $$
declare
  -- Use IST fiscal year (Apr–Mar) via 3-month shift
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

-- Triggers to assign numbers on insert (server-assigned)
create or replace function public.assign_kot_number()
returns trigger
language plpgsql
as $$
declare
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if new.kot_number is null or new.kot_number <= 0 then
    new.kot_number := public.next_kot_number(new.shop_id, v_ts);
  end if;
  return new;
end;
$$;

create or replace function public.assign_bill_number()
returns trigger
language plpgsql
as $$
declare
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if new.bill_number is null or new.bill_number <= 0 then
    new.bill_number := public.next_bill_number(new.shop_id, v_ts);
  end if;
  return new;
end;
$$;

create or replace function public.assign_receipt_number()
returns trigger
language plpgsql
as $$
declare
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if new.receipt_no is null or new.receipt_no <= 0 then
    new.receipt_no := public.next_receipt_number(new.shop_id, v_ts);
  end if;
  return new;
end;
$$;

create or replace function public.assign_voucher_number()
returns trigger
language plpgsql
as $$
declare
  v_ts timestamptz := coalesce(new.created_at, now());
begin
  if new.voucher_no is null or new.voucher_no <= 0 then
    new.voucher_no := public.next_voucher_number(new.shop_id, v_ts);
  end if;
  return new;
end;
$$;

-- Drop and create triggers
drop trigger if exists trg_assign_kot_number on public.kot_orders;
create trigger trg_assign_kot_number
  before insert on public.kot_orders
  for each row execute function public.assign_kot_number();

drop trigger if exists trg_assign_bill_number on public.bills;
create trigger trg_assign_bill_number
  before insert on public.bills
  for each row execute function public.assign_bill_number();

drop trigger if exists trg_assign_receipt_number on public.receipts;
create trigger trg_assign_receipt_number
  before insert on public.receipts
  for each row execute function public.assign_receipt_number();

drop trigger if exists trg_assign_voucher_number on public.expenses;
create trigger trg_assign_voucher_number
  before insert on public.expenses
  for each row execute function public.assign_voucher_number();

-- Uniqueness per shop and period
-- KOT: unique per day (IST)
create unique index if not exists uniq_kot_shop_day_number
  on public.kot_orders (shop_id, ((created_at at time zone 'Asia/Kolkata')::date), kot_number)
  where deleted_at is null;

-- Bills: unique per Indian fiscal year (Apr–Mar, IST)
create unique index if not exists uniq_bills_shop_year_number
  on public.bills (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), bill_number)
  where deleted_at is null;

-- Receipts: unique per Indian fiscal year (Apr–Mar, IST)
create unique index if not exists uniq_receipts_shop_year_number
  on public.receipts (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), receipt_no)
  where deleted_at is null;

-- Expenses vouchers: unique per Indian fiscal year (Apr–Mar, IST)
create unique index if not exists uniq_expenses_shop_year_voucher
  on public.expenses (shop_id, (date_trunc('year', ((created_at at time zone 'Asia/Kolkata') - interval '3 months'))), voucher_no)
  where deleted_at is null;
