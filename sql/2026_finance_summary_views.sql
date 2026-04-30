create or replace view public.v_mieteingaenge_monat as
select
  object_id,
  objekt_code,
  user_id,
  extract(year from booking_date)::int as jahr,
  extract(month from booking_date)::int as monat,
  sum(amount)::numeric(12,2) as mieteingang_summe
from public.finance_entry
where entry_type = 'income'
  and category = 'Miete'
group by
  object_id,
  objekt_code,
  user_id,
  extract(year from booking_date),
  extract(month from booking_date);

create or replace view public.v_objekt_finanz_summary_jahr as
select
  object_id,
  objekt_code,
  user_id,
  extract(year from booking_date)::int as jahr,
  sum(case when entry_type = 'income' then amount else 0 end)::numeric(12,2) as einnahmen,
  sum(case when entry_type = 'expense' then amount else 0 end)::numeric(12,2) as ausgaben,
  sum(case when entry_type = 'income' and category = 'Miete' then amount else 0 end)::numeric(12,2) as mieteingaenge
from public.finance_entry
group by
  object_id,
  objekt_code,
  user_id,
  extract(year from booking_date);
