-- Persistent editable portfolio/tenant fields per authenticated user.
-- Safe to run multiple times.

create extension if not exists "pgcrypto";

create table if not exists public.property_extra_info (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text not null,

  living_area text,
  rooms text,
  cold_rent text,
  operating_costs text,
  total_rent text,
  market_value text,
  equipment text,

  first_name text,
  last_name text,
  phone text,
  email text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint property_extra_info_user_property_unique unique (user_id, property_id)
);

create index if not exists idx_property_extra_info_user_id on public.property_extra_info(user_id);
create index if not exists idx_property_extra_info_property_id on public.property_extra_info(property_id);

create or replace function public.set_property_extra_info_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_property_extra_info_updated_at on public.property_extra_info;
create trigger trg_property_extra_info_updated_at
before update on public.property_extra_info
for each row
execute function public.set_property_extra_info_updated_at();

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
