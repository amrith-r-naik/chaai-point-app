-- (If Storage extension isn't available via SQL in your project, create the bucket via Dashboard.)

-- Create bucket (idempotent); some projects require both id and name
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Example RLS policy: allow authenticated users to read their shop's backups, and staff/admin to write
-- Adjust to your auth strategy; assumes JWT has claim 'shop_id' and 'role'
-- Note: Storage policies use auth.uid() and storage.object access API

-- Helper: extract JWT shop_id and role
create or replace function public.jwt_shop_id() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'shop_id', ''), 'shop_1')
$$;

create or replace function public.jwt_role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''), 'staff')
$$;

-- Read policy
drop policy if exists "read_own_shop_backups" on storage.objects;
create policy "read_own_shop_backups" on storage.objects for select
  using (
    bucket_id = 'backups'
  and (public.jwt_shop_id() || '/') = substring(name from 1 for length(public.jwt_shop_id()) + 1)
  );

-- Write policy for staff/admin
drop policy if exists "write_own_shop_backups" on storage.objects;
create policy "write_own_shop_backups" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'backups'
  and (public.jwt_role() in ('staff','admin'))
  and (public.jwt_shop_id() || '/') = substring(name from 1 for length(public.jwt_shop_id()) + 1)
  );

-- TEMP fallback policies to allow anon uploads for shop_1 prefix (remove when auth is wired)
drop policy if exists "read_shop1_anon_backups" on storage.objects;
create policy "read_shop1_anon_backups" on storage.objects for select to public
  using (
    bucket_id = 'backups' and name like 'shop_1/%'
  );

drop policy if exists "write_shop1_anon_backups" on storage.objects;
create policy "write_shop1_anon_backups" on storage.objects for insert to public
  with check (
    bucket_id = 'backups' and name like 'shop_1/%'
  );
