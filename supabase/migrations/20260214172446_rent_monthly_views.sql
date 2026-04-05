-- =========================================
-- RENT MONTHLY VIEWS
-- =========================================

-- 1) Monthly rent time series per unit_id (generate_series)
create or replace view public.v_unit_monthly_rent as
with bounds as (
  select
    unit_id,
    date_trunc('month', min(start_date))::date as min_month,
    date_trunc('month', max(coalesce(end_date, current_date)))::date as max_month
  from public.unit_rent_periods
  group by unit_id
),
months as (
  select
    b.unit_id,
    generate_series(b.min_month, b.max_month, interval '1 month')::date as month
  from bounds b
),
resolved as (
  select
    m.unit_id,
    m.month,
    rp.rent_cents,
    rp.start_date,
    rp.end_date
  from months m
  left join public.unit_rent_periods rp
    on rp.unit_id = m.unit_id
   and rp.start_date <= (m.month + interval '1 month' - interval '1 day')::date
   and (rp.end_date is null or rp.end_date >= m.month)
),
dedup as (
  -- If overlaps exist: for (unit_id, month) take the period with the newest start_date
  select distinct on (unit_id, month)
    unit_id,
    month,
    rent_cents
  from resolved
  order by unit_id, month, start_date desc nulls last
),
with_mom as (
  select
    unit_id,
    month,
    rent_cents,
    lag(rent_cents) over (partition by unit_id order by month) as prev_rent_cents
  from dedup
)
select
  unit_id,
  month,
  rent_cents,
  case
    when prev_rent_cents is null or prev_rent_cents = 0 then null
    else ((rent_cents - prev_rent_cents)::numeric / prev_rent_cents::numeric) * 100
  end as mom_pct
from with_mom
order by unit_id, month;


-- 2) Monthly rent series mapped to portfolio_unit_id (for UI)
create or replace view public.v_portfolio_unit_monthly_rent_full as
select
  pu.property_id,
  pu.id as portfolio_unit_id,
  pu.name as portfolio_unit_name,
  vmr.month,
  vmr.rent_cents,
  vmr.mom_pct
from public.portfolio_units pu
join public.portfolio_unit_map pum
  on pum.portfolio_unit_id = pu.id
join public.v_unit_monthly_rent vmr
  on vmr.unit_id = pum.unit_id
where pu.is_active = true;


-- 3) Indexes for performance
create index if not exists idx_unit_rent_periods_unit_start_end
on public.unit_rent_periods (unit_id, start_date, end_date);

create index if not exists idx_portfolio_units_property_active
on public.portfolio_units (property_id, is_active);

create index if not exists idx_portfolio_unit_map_pu
on public.portfolio_unit_map (portfolio_unit_id);

create index if not exists idx_portfolio_unit_map_unit
on public.portfolio_unit_map (unit_id);

