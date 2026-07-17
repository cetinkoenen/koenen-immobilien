-- Normalize finance categories according to the private landlord category list.
-- finance_entry remains the single source of truth for finance, rent and reports.

UPDATE public.finance_entry
SET category = CASE
  WHEN lower(trim(coalesce(category, ''))) = 'hausverwaltung' THEN 'Verwaltungskosten'
  WHEN lower(trim(coalesce(category, ''))) = 'monatsrate' THEN 'Kreditrate'
  WHEN lower(trim(coalesce(category, ''))) IN ('mietbestandteil nk', 'mietbestandteil_nk') THEN 'Mietbestandteil-NK'
  WHEN lower(trim(coalesce(category, ''))) IN ('abfallgebuehr', 'abfallgebühr', 'müllgebühren', 'muellgebuehren') THEN 'Abfallgebühr'
  WHEN lower(trim(coalesce(category, ''))) IN ('kontofuehrungsgebuehr', 'kontoführungsgebühr', 'bankgebühren', 'bankgebuehren') THEN 'Kontoführungsgebühr'
  WHEN lower(trim(coalesce(category, ''))) IN ('schornsteinfeger', 'schonsteinfeger') THEN 'Schonsteinfeger'
  WHEN lower(trim(coalesce(category, ''))) IN ('kreditrate', 'darlehensrate') THEN 'Kreditrate'
  WHEN lower(trim(coalesce(category, ''))) IN ('miete garage', 'garage', 'stellplatz') THEN 'Miete Garage'
  ELSE category
END
WHERE category IS NOT NULL
  AND booking_date <= CURRENT_DATE
  AND lower(trim(coalesce(category, ''))) IN (
    'hausverwaltung',
    'monatsrate',
    'mietbestandteil nk',
    'mietbestandteil_nk',
    'abfallgebuehr',
    'abfallgebühr',
    'müllgebühren',
    'muellgebuehren',
    'kontofuehrungsgebuehr',
    'kontoführungsgebühr',
    'bankgebühren',
    'bankgebuehren',
    'schornsteinfeger',
    'schonsteinfeger',
    'kreditrate',
    'darlehensrate',
    'miete garage',
    'garage',
    'stellplatz'
  );

DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.categories
  SET name = CASE
    WHEN lower(trim(name)) = 'hausverwaltung' THEN 'Verwaltungskosten'
    WHEN lower(trim(name)) = 'monatsrate' THEN 'Kreditrate'
    ELSE name
  END
  WHERE lower(trim(name)) IN ('hausverwaltung', 'monatsrate');
END $$;
