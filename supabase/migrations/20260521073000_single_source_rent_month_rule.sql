-- Phase 5H: Einheitliche Mietmonatslogik für Hausverwaltung
-- Ziel: Mieteingänge überall gleich auswerten.
-- Regel: Einnahmen mit Miet-/Pachtbezug zählen ab dem 25. eines Monats zum Folgemonat.

create or replace view public.v_mieteingaenge_monat as
select
  fe.object_id,
  nullif(fe.objekt_code, '') as objekt_code,
  fe.user_id,
  extract(year from case
    when extract(day from fe.booking_date)::int >= 25 then (fe.booking_date + interval '1 month')
    else fe.booking_date
  end)::int as jahr,
  extract(month from case
    when extract(day from fe.booking_date)::int >= 25 then (fe.booking_date + interval '1 month')
    else fe.booking_date
  end)::int as monat,
  sum(coalesce(fe.amount, 0))::numeric as mieteingang_summe
from public.finance_entry fe
where fe.entry_type = 'income'
  and fe.booking_date is not null
  and fe.object_id is not null
  and (
    coalesce(fe.category, '') ilike '%miet%'
    or coalesce(fe.category, '') ilike '%pacht%'
    or coalesce(fe.note, '') ilike '%miet%'
    or coalesce(fe.note, '') ilike '%pacht%'
  )
group by
  fe.object_id,
  nullif(fe.objekt_code, ''),
  fe.user_id,
  extract(year from case
    when extract(day from fe.booking_date)::int >= 25 then (fe.booking_date + interval '1 month')
    else fe.booking_date
  end),
  extract(month from case
    when extract(day from fe.booking_date)::int >= 25 then (fe.booking_date + interval '1 month')
    else fe.booking_date
  end);

grant select on public.v_mieteingaenge_monat to authenticated;
