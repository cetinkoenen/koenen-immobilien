alter table public.finance_entry
add column if not exists nk_relevant boolean null;

update public.finance_entry
set nk_relevant = true
where coalesce(is_deleted, false) = false
  and booking_date >= date '2024-01-01'
  and booking_date <= date '2026-06-07'
  and nk_relevant is distinct from true
  and not (
    lower(coalesce(category, '') || ' ' || coalesce(note, '')) ~
    '(ruecklage|rücklage|instandhaltungsruecklage|instandhaltungsrücklage|erhaltungsruecklage|erhaltungsrücklage|reparatur|instandsetzung|sanierung|modernisierung|verwaltung|verwalter|bankgebuehr|bankgebühr|porto|tilgung)'
  )
  and (
    (
      lower(entry_type::text) = 'expense'
      and lower(coalesce(category, '') || ' ' || coalesce(note, '')) ~
      '(grundsteuer|wasser|wasserversorgung|abwasser|entwaesserung|entwässerung|kanal|heizung|warmwasser|brennstoff|aufzug|strassenreinigung|straßenreinigung|winterdienst|muell|müll|reinigung|gebaeudereinigung|gebäudereinigung|garten|gartenpflege|beleuchtung|hausstrom|allgemeinstrom|schornstein|versicherung|gebaeudeversicherung|gebäudeversicherung|haftpflicht|glas|hauswart|hausmeister|kabel|antenne|wascheinrichtung|rauchwarn|dachrinnenreinigung|betriebskosten|nebenkosten|kalo|techem)'
    )
    or
    (
      lower(entry_type::text) = 'income'
      and lower(coalesce(category, '') || ' ' || coalesce(note, '')) ~
      '(nebenkosten|betriebskosten|vorauszahlung|abschlag|(^|[^a-z])nk([^a-z]|$)|erstattung|guthaben|rueckzahlung|rückzahlung)'
    )
  );

update public.finance_entry
set nk_relevant = false
where coalesce(is_deleted, false) = false
  and booking_date >= date '2024-01-01'
  and booking_date <= date '2026-06-07'
  and nk_relevant is null;

create index if not exists idx_finance_entry_nk_relevant
on public.finance_entry(nk_relevant, booking_date)
where coalesce(is_deleted, false) = false;
