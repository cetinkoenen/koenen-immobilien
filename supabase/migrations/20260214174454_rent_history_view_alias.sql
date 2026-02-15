-- View expected by src/components/RentDevelopmentChart.tsx
-- Keep column names compatible with existing view (period).

create or replace view public.v_portfolio_unit_rent_history_monthly as
select
  portfolio_unit_id,
  month as period,
  rent_cents,
  (mom_pct::double precision) as mom_pct
from public.v_portfolio_unit_monthly_rent_full
order by portfolio_unit_id, period;


