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

-- Triggers to maintain updated_at on update
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','menu_items','bills','kot_orders','kot_items','payments','receipts','expenses','split_payments'
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
