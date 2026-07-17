create extension if not exists pgcrypto;

create table if not exists public.rent_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id text null,
  object_label text not null,
  tenant_name text null,
  effective_date date not null,
  reason text not null default 'Anpassung an ortsübliche Vergleichsmiete',
  status text not null default 'planned'
    check (status in ('active', 'planned', 'consent_open', 'check')),
  old_cold_rent numeric(12,2) null,
  old_operating_costs numeric(12,2) null,
  old_total_rent numeric(12,2) null,
  new_cold_rent numeric(12,2) null,
  new_operating_costs numeric(12,2) null,
  new_total_rent numeric(12,2) null,
  note text null,
  document_name text null,
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_rent_adjustments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_rent_adjustments_updated_at on public.rent_adjustments;
create trigger set_rent_adjustments_updated_at
before update on public.rent_adjustments
for each row execute function public.set_rent_adjustments_updated_at();

alter table public.rent_adjustments enable row level security;

drop policy if exists rent_adjustments_select_own on public.rent_adjustments;
drop policy if exists rent_adjustments_insert_own on public.rent_adjustments;
drop policy if exists rent_adjustments_update_own on public.rent_adjustments;
drop policy if exists rent_adjustments_readonly_select_all on public.rent_adjustments;

create policy rent_adjustments_select_own
on public.rent_adjustments
for select to authenticated
using ((select auth.uid()) = user_id);

create policy rent_adjustments_insert_own
on public.rent_adjustments
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy rent_adjustments_update_own
on public.rent_adjustments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy rent_adjustments_readonly_select_all
on public.rent_adjustments
for select to authenticated
using (public.koenen_is_readonly_user());

grant select, insert, update on public.rent_adjustments to authenticated;

do $$
begin
  if to_regproc('public.koenen_block_readonly_write()') is not null then
    drop trigger if exists koenen_block_readonly_write on public.rent_adjustments;
    create trigger koenen_block_readonly_write
    before insert or update or delete on public.rent_adjustments
    for each row execute function public.koenen_block_readonly_write();
  end if;
end $$;

create index if not exists idx_rent_adjustments_user_property
on public.rent_adjustments(user_id, property_id, effective_date desc)
where is_deleted = false;

create index if not exists idx_rent_adjustments_object_label
on public.rent_adjustments(object_label, effective_date desc)
where is_deleted = false;
