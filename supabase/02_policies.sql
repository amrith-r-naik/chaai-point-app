-- Supabase RLS policies (Phase 2)
-- Enable RLS and restrict access by role and shop

alter table public.profiles enable row level security;

-- Allow each authenticated user to read their own profile (to get role/shop)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using ( id = auth.uid() );

-- Policy helpers
create or replace function public.current_role()
returns text language sql stable as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'staff')
$$;

create or replace function public.current_shop()
returns text language sql stable as $$
  select coalesce((select shop_id from public.profiles where id = auth.uid()), 'shop_1')
$$;

-- List of business tables we protect
-- We'll enable RLS and (re)create policies for each
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
  'customers','menu_items','bills','kot_orders','kot_items','payments','receipts','expenses','split_payments','expense_settlements','customer_advances'
  ];
BEGIN
  -- Enable RLS on each table
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('alter table public.%I enable row level security;', t);
  END LOOP;

  -- Drop existing policies if any, then create fresh ones
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', t || '_select', t);
    EXECUTE format('drop policy if exists %I on public.%I;', t || '_insert', t);
    EXECUTE format('drop policy if exists %I on public.%I;', t || '_update', t);

    -- Read allowed for both roles within same shop
    EXECUTE format(
      'create policy %I on public.%I for select using (shop_id = public.current_shop());',
      t || '_select', t
    );

    -- Allow writes for both admin and staff within same shop
    EXECUTE format(
      'create policy %I on public.%I for insert with check (shop_id = public.current_shop() and public.current_role() in (''staff'',''admin''));',
      t || '_insert', t
    );
    EXECUTE format(
      'create policy %I on public.%I for update using (shop_id = public.current_shop() and public.current_role() in (''staff'',''admin'')) with check (shop_id = public.current_shop() and public.current_role() in (''staff'',''admin''));',
      t || '_update', t
    );
  END LOOP;
END $$;
