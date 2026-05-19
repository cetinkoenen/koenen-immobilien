-- =====================================================
-- PHASE 5G · BI / Auswertung Zahlen-Fix
-- Zweck: get_property_finance_master(2026) liefert vollständige Zahlen
-- für Business Intelligence 4C, Single Source 3A, Stabilität 3B,
-- Automatisierung 2B, Archiv 2C und Objekt-Jahresübersicht.
-- Wichtig:
-- finance_entry.object_id  -> objects.id
-- entries.property_id      -> objects.id
-- property_* Tabellen      -> properties.id
-- =====================================================

-- 1) Bridge zwischen objects.id und properties.id

drop view if exists public.v_koenen_object_bridge cascade;

create view public.v_koenen_object_bridge as
select *
from (
  values
    ('Lilienthaler Str. 54', 'Objekt_1', '4e866825-b3bf-4a2e-9cec-c19c8eb6208b'::uuid, '92576004-0753-4775-850a-e2e47c1b3cb5'::uuid),
    ('Elsasser Str. 52',     'Objekt_2', '5db6fcc3-6419-4fb1-a03f-087dc16383cc'::uuid, 'f8a86965-07e4-4b6a-a97a-779dbe97a3fd'::uuid),
    ('Colmarer Str. 45',     'Objekt_3', 'b82595e7-bf6d-4303-a693-775f490e0283'::uuid, '7840e179-1972-4e74-b0a6-e1e352604ef5'::uuid),
    ('Fürther Str. 74',      'Objekt_4', '50ec410b-1489-4ef2-a885-d6d8c508bdc0'::uuid, '32762b8b-e205-486f-af7b-909dc1c90a8d'::uuid),
    ('Hohenloher Str. 78',   'Objekt_5', '6b3098ff-5b26-4ccb-b6b5-3fb008f47be9'::uuid, '89c29135-d3ab-43dd-9743-3f7fba284d93'::uuid),
    ('Rosenstein Str. 25',   'Objekt_6', 'd982b7f2-6fa7-408a-8ce7-6ccc43ff6f59'::uuid, '3b6df919-fdf2-439d-abab-9646b2ad1d76'::uuid)
) as x(property_name, objekt_code, object_id, property_id);

-- 2) Dropdown bleibt kompatibel für alte Frontend-Stellen, die objekt_code erwarten.

drop view if exists public.v_object_dropdown cascade;

create view public.v_object_dropdown as
select
  b.property_id::text as value,
  b.property_name as label,
  b.objekt_code,
  b.objekt_code as object_code,
  b.object_id,
  b.property_id
from public.v_koenen_object_bridge b
order by b.property_name;

-- 3) Backend-Finanzmaster-View mit vollständigen Zahlen.

drop view if exists public.v_property_finance_master_yearly cascade;

create view public.v_property_finance_master_yearly as
with finance as (
  select
    b.property_id,
    b.property_name,
    b.objekt_code,
    extract(year from f.booking_date)::integer as year,

    sum(
      case
        when lower(coalesce(f.entry_type::text, '')) in ('income', 'einnahme')
          or lower(coalesce(f.category, '')) like '%miete%'
          or lower(coalesce(f.category, '')) like '%garage%'
        then abs(coalesce(f.amount, 0))
        else 0
      end
    )::numeric as income,

    sum(
      case
        when lower(coalesce(f.entry_type::text, '')) in ('income', 'einnahme')
          or lower(coalesce(f.category, '')) like '%miete%'
          or lower(coalesce(f.category, '')) like '%garage%'
        then abs(coalesce(f.amount, 0))
        else 0
      end
    )::numeric as rent_income,

    sum(
      case
        when lower(coalesce(f.entry_type::text, '')) in ('expense', 'ausgabe')
          or coalesce(f.amount, 0) < 0
        then abs(coalesce(f.amount, 0))
        else 0
      end
    )::numeric as expenses,

    sum(
      case
        when lower(coalesce(f.category, '')) similar to '%(capex|sanierung|modernisierung|reparatur|instandhaltung)%'
          or lower(coalesce(f.note, '')) similar to '%(capex|sanierung|modernisierung|reparatur|instandhaltung)%'
        then abs(coalesce(f.amount, 0))
        else 0
      end
    )::numeric as capex

  from public.finance_entry f
  join public.v_koenen_object_bridge b
    on b.object_id = f.object_id
  where f.booking_date is not null
  group by
    b.property_id,
    b.property_name,
    b.objekt_code,
    extract(year from f.booking_date)
),
loan_yearly as (
  select
    l.property_id,
    l.year,
    sum(coalesce(l.interest, 0))::numeric as interest_total,
    sum(coalesce(l.principal, 0))::numeric as principal_total,
    sum(coalesce(l.interest, 0) + coalesce(l.principal, 0))::numeric as debt_service,
    max(coalesce(l.balance, 0))::numeric as balance_at_year
  from public.property_loan_ledger l
  group by l.property_id, l.year
),
latest_loan as (
  select distinct on (l.property_id)
    l.property_id,
    l.balance::numeric as latest_balance,
    l.year::integer as latest_balance_year
  from public.property_loan_ledger l
  order by l.property_id, l.year desc
),
years as (
  select distinct year from finance
  union
  select distinct year from loan_yearly
  union
  select extract(year from current_date)::integer
)
select
  b.property_id,
  b.property_id as portfolio_property_id,
  b.objekt_code,
  b.property_name,
  lower(regexp_replace(b.property_name, '[^a-zA-Z0-9]+', '-', 'g')) as normalized_name,
  y.year,

  coalesce(f.income, 0)::numeric as income,
  coalesce(f.expenses, 0)::numeric as expenses,
  coalesce(f.capex, 0)::numeric as capex,
  greatest(coalesce(f.expenses, 0) - coalesce(f.capex, 0), 0)::numeric as operating_expenses,
  (coalesce(f.income, 0) - coalesce(f.expenses, 0))::numeric as net_cashflow,
  coalesce(f.rent_income, 0)::numeric as rent_income,

  coalesce(ly.interest_total, 0)::numeric as interest_total,
  coalesce(ly.principal_total, 0)::numeric as principal_total,
  coalesce(ly.debt_service, 0)::numeric as debt_service,
  case
    when coalesce(ly.debt_service, 0) > 0
      then round((coalesce(f.income, 0) - coalesce(f.expenses, 0)) / ly.debt_service, 4)
    else null::numeric
  end as dscr,
  ly.balance_at_year::numeric as balance_at_year,
  ll.latest_balance::numeric as latest_balance,
  ll.latest_balance_year::integer as latest_balance_year,
  now()::timestamptz as refreshed_at

from public.v_koenen_object_bridge b
cross join years y
left join finance f
  on f.property_id = b.property_id
 and f.year = y.year
left join loan_yearly ly
  on ly.property_id = b.property_id
 and ly.year = y.year
left join latest_loan ll
  on ll.property_id = b.property_id;

-- 4) RPC, die das Frontend tatsächlich lädt.

drop function if exists public.get_property_finance_master(integer);

create function public.get_property_finance_master(p_year integer)
returns table (
  property_id uuid,
  portfolio_property_id uuid,
  objekt_code text,
  property_name text,
  normalized_name text,
  year integer,
  income numeric,
  expenses numeric,
  capex numeric,
  operating_expenses numeric,
  net_cashflow numeric,
  rent_income numeric,
  interest_total numeric,
  principal_total numeric,
  debt_service numeric,
  dscr numeric,
  balance_at_year numeric,
  latest_balance numeric,
  latest_balance_year integer,
  refreshed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.property_id,
    v.portfolio_property_id,
    v.objekt_code,
    v.property_name,
    v.normalized_name,
    v.year,
    v.income,
    v.expenses,
    v.capex,
    v.operating_expenses,
    v.net_cashflow,
    v.rent_income,
    v.interest_total,
    v.principal_total,
    v.debt_service,
    v.dscr,
    v.balance_at_year,
    v.latest_balance,
    v.latest_balance_year,
    v.refreshed_at
  from public.v_property_finance_master_yearly v
  where v.year = p_year
  order by v.property_name;
$$;

grant execute on function public.get_property_finance_master(integer) to authenticated;

-- 5) Quality Check bleibt kompatibel.

drop function if exists public.get_koenen_data_quality_checks(integer);

create function public.get_koenen_data_quality_checks(p_year integer)
returns table (
  severity text,
  area text,
  property_id uuid,
  property_name text,
  issue_code text,
  detail text,
  repair_hint text,
  expected_value numeric,
  actual_value numeric,
  delta numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with master as (
    select * from public.v_property_finance_master_yearly where year = p_year
  ),
  document_counts as (
    select property_id, count(*)::numeric as document_count
    from property_documents
    group by property_id
  ),
  loan_counts as (
    select property_id, count(*)::numeric as loan_count
    from property_loan_ledger
    group by property_id
  )
  select
    'warning'::text,
    'Dokumente'::text,
    m.property_id,
    m.property_name,
    'missing_documents'::text,
    'Keine Dokumente gefunden.'::text,
    'Dokumente hochladen.'::text,
    1::numeric,
    coalesce(d.document_count, 0)::numeric,
    null::numeric
  from master m
  left join document_counts d on d.property_id = m.property_id
  where coalesce(d.document_count, 0) = 0

  union all

  select
    'warning'::text,
    'Darlehen'::text,
    m.property_id,
    m.property_name,
    'missing_loan_ledger'::text,
    'Keine Darlehensdaten gefunden.'::text,
    'property_loan_ledger prüfen.'::text,
    1::numeric,
    coalesce(l.loan_count, 0)::numeric,
    null::numeric
  from master m
  left join loan_counts l on l.property_id = m.property_id
  where coalesce(l.loan_count, 0) = 0

  union all

  select
    'info'::text,
    'System'::text,
    m.property_id,
    m.property_name,
    'finance_master_loaded'::text,
    'Finanzmaster erfolgreich geladen.'::text,
    'Keine Aktion erforderlich.'::text,
    null::numeric,
    null::numeric,
    null::numeric
  from master m

  order by 2, 4;
$$;

grant execute on function public.get_koenen_data_quality_checks(integer) to authenticated;

-- 6) Tests

select * from public.get_property_finance_master(2026);
select * from public.get_koenen_data_quality_checks(2026);
