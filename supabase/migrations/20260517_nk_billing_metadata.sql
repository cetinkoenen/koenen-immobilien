-- Koenen App: dauerhafte Nebenkosten-Zuordnung je Buchung
-- In Supabase SQL Editor ausführen, bevor die neue ZIP deployed wird.

create extension if not exists pgcrypto;

create table if not exists public.finance_entry_billing_metadata (
  id uuid primary key default gen_random_uuid(),
  finance_entry_id text not null,
  object_id uuid null,
  objekt_code text null,
  billing_year integer not null,
  billing_period_from date not null,
  billing_period_to date not null,
  booking_date date null,
  source_category text null,
  source_note text null,
  amount numeric not null default 0,
  is_recoverable boolean not null default false,
  recoverable_percent numeric not null default 0 check (recoverable_percent >= 0 and recoverable_percent <= 100),
  nk_cost_type text null,
  allocation_type text null check (allocation_type is null or allocation_type in ('allocationKey','persons','directAmount','heatingDirect')),
  total_key numeric null,
  apartment_key numeric null,
  direct_amount numeric null,
  classification_status text not null default 'auto_detected',
  confidence text null,
  reason text null,
  ignored_reason text null,
  reviewed boolean not null default false,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_entry_billing_metadata_unique unique (finance_entry_id, billing_period_from, billing_period_to)
);

create index if not exists idx_finance_entry_billing_metadata_objekt_year
  on public.finance_entry_billing_metadata (objekt_code, billing_year);

create index if not exists idx_finance_entry_billing_metadata_period
  on public.finance_entry_billing_metadata (billing_period_from, billing_period_to);

create index if not exists idx_finance_entry_billing_metadata_status
  on public.finance_entry_billing_metadata (classification_status, reviewed);

create or replace function public.set_finance_entry_billing_metadata_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_finance_entry_billing_metadata_updated_at on public.finance_entry_billing_metadata;
create trigger trg_finance_entry_billing_metadata_updated_at
before update on public.finance_entry_billing_metadata
for each row execute function public.set_finance_entry_billing_metadata_updated_at();

alter table public.finance_entry_billing_metadata enable row level security;

drop policy if exists admin_only_info_koenen_finance_entry_billing_metadata on public.finance_entry_billing_metadata;
create policy admin_only_info_koenen_finance_entry_billing_metadata
on public.finance_entry_billing_metadata
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com');

grant select, insert, update, delete on public.finance_entry_billing_metadata to authenticated;
revoke all on public.finance_entry_billing_metadata from anon;
