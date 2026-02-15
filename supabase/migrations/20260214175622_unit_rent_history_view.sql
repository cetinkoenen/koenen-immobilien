-- Monthly rent series per unit_id (for unit pages that only know unit_id)
create or replace view public.v_unit_rent_history_monthly as
select
  unit_id,
  month as period,
  rent_cents
from public.v_unit_monthly_rent
order by unit_id, period;


