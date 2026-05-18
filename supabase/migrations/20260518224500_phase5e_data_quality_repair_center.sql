-- Koenen App – Phase 5E
-- Datenprüfung & Reparatur-Center
-- Ziel: serverseitige Qualitätschecks, Dubletten-/Testobjekt-Erkennung und konkrete Reparaturhinweise.

create or replace function public.get_koenen_data_quality_checks(p_year integer default extract(year from now())::integer)
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
    select *
    from public.v_property_finance_master_yearly
    where year = p_year
  ), consistency as (
    select * from public.get_property_finance_consistency(p_year)
  ), raw_objects as (
    select
      value::uuid as property_id,
      coalesce(label, objekt_code, value::text) as property_name,
      public.koenen_normalize_object_name(coalesce(label, objekt_code, value::text)) as normalized_name
    from public.v_object_dropdown
    where value is not null
  ), duplicate_names as (
    select
      normalized_name,
      count(*) as duplicate_count,
      string_agg(property_name, ' | ' order by property_name) as names
    from raw_objects
    where normalized_name <> ''
      and normalized_name !~ '\y(rls|test|trigger|debug|dummy|sample)\y'
    group by normalized_name
    having count(*) > 1
  ), test_objects as (
    select *
    from raw_objects
    where normalized_name ~ '\y(rls|test|trigger|debug|dummy|sample)\y'
  ), document_counts as (
    select property_id, count(*)::numeric as document_count
    from public.property_documents
    group by property_id
  ), ledger_counts as (
    select property_id, count(*)::numeric as ledger_count, max(year)::numeric as max_ledger_year
    from public.property_loan_ledger
    group by property_id
  )
  select
    c.severity,
    c.area,
    c.property_id,
    c.property_name,
    lower(regexp_replace(c.area, '[^a-zA-Z0-9]+', '_', 'g'))::text as issue_code,
    c.detail,
    case
      when c.area ilike '%Restschuld%' then 'Darlehens-Ledger und Portfolio-Verknüpfung prüfen; danach Materialized Views aktualisieren.'
      when c.area ilike '%Einnahmen%' then 'Buchungen/Monate prüfen und ggf. Kategorie Miete/Income oder object_id korrigieren.'
      when c.area ilike '%Ausgaben%' then 'Buchungen/Monate prüfen und ggf. Kategorie/Ausgabentyp oder object_id korrigieren.'
      when c.area ilike '%Doppelte%' then 'Objektstammdaten bereinigen: doppelte Namen/IDs zusammenführen oder Testobjekte entfernen.'
      else 'Datenquelle prüfen und nach Korrektur neu prüfen.'
    end as repair_hint,
    c.expected_value,
    c.actual_value,
    c.delta
  from consistency c

  union all

  select
    'critical'::text,
    'Darlehensdaten'::text,
    m.property_id,
    m.property_name,
    'missing_loan_ledger'::text,
    'Keine Darlehens-Ledgerdaten bzw. keine aktuelle Restschuld im Backend-Finanzmaster gefunden.'::text,
    'Darlehensübersicht für dieses Objekt öffnen und mindestens eine Jahreszeile im property_loan_ledger erfassen.'::text,
    null::numeric,
    coalesce(l.ledger_count, 0)::numeric,
    null::numeric
  from master m
  left join ledger_counts l on l.property_id = m.property_id or l.property_id = m.portfolio_property_id
  where coalesce(l.ledger_count, 0) = 0 or m.latest_balance is null

  union all

  select
    'warning'::text,
    'Income/Buchungen'::text,
    m.property_id,
    m.property_name,
    'missing_income_current_year'::text,
    ('Keine Einnahmen/Mieten im Backend-Finanzmaster für ' || p_year || ' gefunden.')::text,
    'Monate/Buchungen prüfen: entry_type income, Kategorie Miete, object_id und Jahr müssen korrekt sein.'::text,
    1::numeric,
    coalesce(m.income, 0)::numeric,
    null::numeric
  from master m
  where coalesce(m.income, 0) = 0 and coalesce(m.rent_income, 0) = 0

  union all

  select
    case when m.net_cashflow < 0 then 'critical' else 'warning' end,
    'Liquidität'::text,
    m.property_id,
    m.property_name,
    'negative_cashflow'::text,
    ('Negativer Netto-Cashflow im Jahr ' || p_year || '.')::text,
    'Ausgaben/Capex prüfen oder Finanzierung/Vermietung analysieren. Ggf. Objektbericht generieren.'::text,
    0::numeric,
    m.net_cashflow::numeric,
    m.net_cashflow::numeric
  from master m
  where coalesce(m.net_cashflow, 0) < 0

  union all

  select
    'warning'::text,
    'Capex'::text,
    m.property_id,
    m.property_name,
    'high_capex_ratio'::text,
    'Capex ist höher als 75 % der Jahreseinnahmen.'::text,
    'Capex-Kategorien in Monate/Buchungen prüfen; Sanierung/Reparatur ggf. sauber zuordnen.'::text,
    round(m.income * 0.75, 2),
    m.capex,
    round(m.capex - (m.income * 0.75), 2)
  from master m
  where coalesce(m.income, 0) > 0 and coalesce(m.capex, 0) > (m.income * 0.75)

  union all

  select
    'warning'::text,
    'Dokumente'::text,
    m.property_id,
    m.property_name,
    'missing_documents'::text,
    'Im Dokumentenarchiv sind für dieses Objekt noch keine Dokumente gespeichert.'::text,
    'Objektakte → Dokumente öffnen und Mietvertrag, Energieausweis, Darlehensunterlagen oder Rechnungen hochladen.'::text,
    1::numeric,
    coalesce(d.document_count, 0)::numeric,
    null::numeric
  from master m
  left join document_counts d on d.property_id = m.property_id or d.property_id = m.portfolio_property_id
  where coalesce(d.document_count, 0) = 0

  union all

  select
    'warning'::text,
    'Doppelte Objekte'::text,
    null::uuid,
    d.names::text,
    'duplicate_normalized_object_name'::text,
    'Mehrere Objektquellen normalisieren auf denselben Namen.'::text,
    'Objektstammdaten zusammenführen bzw. doppelte Portfolio-/Core-Objekte bereinigen.'::text,
    d.duplicate_count::numeric,
    null::numeric,
    null::numeric
  from duplicate_names d

  union all

  select
    'warning'::text,
    'Testdaten'::text,
    t.property_id,
    t.property_name,
    'test_or_debug_object_visible'::text,
    'Test-/Trigger-/RLS-/Dummy-Objekt ist noch in den Rohdaten vorhanden.'::text,
    'Wenn nicht benötigt: in Supabase löschen oder mit is_test_data markieren; Frontend blendet diese Objekte aus.'::text,
    null::numeric,
    null::numeric,
    null::numeric
  from test_objects t
  order by
    case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
    area,
    property_name nulls last;
$$;

grant execute on function public.get_koenen_data_quality_checks(integer) to authenticated;
