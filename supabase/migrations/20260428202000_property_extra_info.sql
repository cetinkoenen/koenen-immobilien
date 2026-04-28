create extension if not exists "pgcrypto";

create table if not exists public.property_extra_info (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,
  living_area text default '',
  rooms text default '',
  cold_rent text default '',
  operating_costs text default '',
  total_rent text default '',
  market_value text default '',
  equipment text default '',
  first_name text default '',
  last_name text default '',
  phone text default '',
  email text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, property_id)
);

alter table public.property_extra_info enable row level security;

drop policy if exists "property_extra_info_select_own" on public.property_extra_info;
drop policy if exists "property_extra_info_insert_own" on public.property_extra_info;
drop policy if exists "property_extra_info_update_own" on public.property_extra_info;
drop policy if exists "property_extra_info_delete_own" on public.property_extra_info;

create policy "property_extra_info_select_own"
on public.property_extra_info
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "property_extra_info_insert_own"
on public.property_extra_info
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "property_extra_info_update_own"
on public.property_extra_info
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "property_extra_info_delete_own"
on public.property_extra_info
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists idx_property_extra_info_user_id on public.property_extra_info(user_id);
create index if not exists idx_property_extra_info_property_id on public.property_extra_info(property_id);
