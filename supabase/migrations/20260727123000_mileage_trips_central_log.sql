alter table public.property_mileage_trips
  alter column property_id drop not null;

alter table public.property_mileage_trips
  add column if not exists trip_scope text not null default 'property'
    check (trip_scope in ('property', 'investment'));

alter table public.property_mileage_trips
  add column if not exists investment_address text null;

create index if not exists idx_property_mileage_trips_scope_year
on public.property_mileage_trips(trip_scope, steuerjahr, datum desc);
