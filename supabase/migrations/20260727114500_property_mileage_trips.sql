create extension if not exists pgcrypto;

create table if not exists public.property_mileage_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  portfolio_property_id uuid null references public.portfolio_properties(id) on delete set null,
  property_label text not null,
  datum date not null,
  grund text not null check (
    grund in (
      'Handwerkertermin',
      'Eigentümerversammlung',
      'Mieterwechsel/Besichtigung',
      'Kontrollfahrt',
      'Bank-/Notartermin'
    )
  ),
  start_adresse text not null,
  zieladresse text not null,
  distanz_km numeric(10,2) not null check (distanz_km >= 0),
  hin_und_rueckfahrt boolean not null default true,
  berechneter_betrag numeric(12,2) generated always as (
    round((distanz_km * case when hin_und_rueckfahrt then 2 else 1 end * 0.30)::numeric, 2)
  ) stored,
  beleg_url text null,
  steuerjahr integer generated always as (extract(year from datum)::integer) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_property_mileage_trips_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_property_mileage_trips_updated_at on public.property_mileage_trips;
create trigger set_property_mileage_trips_updated_at
before update on public.property_mileage_trips
for each row execute function public.set_property_mileage_trips_updated_at();

alter table public.property_mileage_trips enable row level security;

drop policy if exists property_mileage_trips_select_own on public.property_mileage_trips;
drop policy if exists property_mileage_trips_insert_own on public.property_mileage_trips;
drop policy if exists property_mileage_trips_update_own on public.property_mileage_trips;
drop policy if exists property_mileage_trips_delete_own on public.property_mileage_trips;
drop policy if exists property_mileage_trips_readonly_select_all on public.property_mileage_trips;

create policy property_mileage_trips_select_own
on public.property_mileage_trips
for select to authenticated
using ((select auth.uid()) = user_id);

create policy property_mileage_trips_insert_own
on public.property_mileage_trips
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy property_mileage_trips_update_own
on public.property_mileage_trips
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy property_mileage_trips_delete_own
on public.property_mileage_trips
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy property_mileage_trips_readonly_select_all
on public.property_mileage_trips
for select to authenticated
using (public.koenen_is_readonly_user());

grant select, insert, update, delete on public.property_mileage_trips to authenticated;

do $$
begin
  if to_regproc('public.koenen_block_readonly_write()') is not null then
    drop trigger if exists koenen_block_readonly_write on public.property_mileage_trips;
    create trigger koenen_block_readonly_write
    before insert or update or delete on public.property_mileage_trips
    for each row execute function public.koenen_block_readonly_write();
  end if;
end $$;

create index if not exists idx_property_mileage_trips_property_date
on public.property_mileage_trips(property_id, datum desc);

create index if not exists idx_property_mileage_trips_tax_year
on public.property_mileage_trips(steuerjahr, property_label);

insert into storage.buckets (id, name, public)
values ('property-mileage-receipts', 'property-mileage-receipts', false)
on conflict (id) do nothing;

drop policy if exists property_mileage_receipts_select_own on storage.objects;
drop policy if exists property_mileage_receipts_insert_own on storage.objects;
drop policy if exists property_mileage_receipts_update_own on storage.objects;
drop policy if exists property_mileage_receipts_delete_own on storage.objects;
drop policy if exists property_mileage_receipts_readonly_select_all on storage.objects;

create policy property_mileage_receipts_select_own
on storage.objects
for select to authenticated
using (
  bucket_id = 'property-mileage-receipts'
  and owner = (select auth.uid())
);

create policy property_mileage_receipts_insert_own
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'property-mileage-receipts'
  and owner = (select auth.uid())
);

create policy property_mileage_receipts_update_own
on storage.objects
for update to authenticated
using (
  bucket_id = 'property-mileage-receipts'
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'property-mileage-receipts'
  and owner = (select auth.uid())
);

create policy property_mileage_receipts_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'property-mileage-receipts'
  and owner = (select auth.uid())
);

create policy property_mileage_receipts_readonly_select_all
on storage.objects
for select to authenticated
using (
  bucket_id = 'property-mileage-receipts'
  and public.koenen_is_readonly_user()
);
