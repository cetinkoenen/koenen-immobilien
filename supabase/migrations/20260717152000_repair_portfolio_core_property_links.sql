-- Repair portfolio_properties -> properties mapping used by portfolio subpages
-- (Finanzen, Energie, Details, Adresse). The UI routes through
-- portfolio_properties.id, while detail tables use properties.id.

CREATE OR REPLACE FUNCTION public.koenen_clean_property_match_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(input, ''),
              'ÄÖÜäöüß',
              'AOUaouss'
            )
          ),
          '\(?\s*core[\W_]*shadow\s*\)?',
          ' ',
          'gi'
        ),
        '\(?\s*shadow\s*\)?',
        ' ',
        'gi'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

WITH property_candidates AS (
  SELECT
    p.id,
    public.koenen_clean_property_match_name(p.name) AS match_name
  FROM public.properties p
  WHERE p.id IS NOT NULL
    AND public.koenen_clean_property_match_name(p.name) <> ''
    AND lower(coalesce(p.name, '')) NOT LIKE '%shadow%'
),
portfolio_candidates AS (
  SELECT
    pp.id,
    public.koenen_clean_property_match_name(pp.name) AS match_name
  FROM public.portfolio_properties pp
  WHERE pp.id IS NOT NULL
    AND public.koenen_clean_property_match_name(pp.name) <> ''
),
unique_matches AS (
  SELECT
    pp.id AS portfolio_property_id,
    (array_agg(p.id))[1] AS core_property_id,
    count(*) AS match_count
  FROM portfolio_candidates pp
  JOIN property_candidates p ON p.match_name = pp.match_name
  GROUP BY pp.id
  HAVING count(*) = 1
),
target_unique_matches AS (
  SELECT unique_matches.*
  FROM unique_matches
  JOIN (
    SELECT core_property_id
    FROM unique_matches
    GROUP BY core_property_id
    HAVING count(*) = 1
  ) target_counts ON target_counts.core_property_id = unique_matches.core_property_id
)
UPDATE public.portfolio_properties pp
SET core_property_id = target_unique_matches.core_property_id
FROM target_unique_matches
WHERE pp.id = target_unique_matches.portfolio_property_id
  AND (
    pp.core_property_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.properties existing
      WHERE existing.id = pp.core_property_id
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.portfolio_properties taken
    WHERE taken.id <> pp.id
      AND taken.core_property_id = target_unique_matches.core_property_id
  );

WITH dashboard_raw_matches AS (
  SELECT DISTINCT ON (pp.id)
    pp.id AS portfolio_property_id,
    dashboard.property_id AS core_property_id
  FROM public.portfolio_properties pp
  JOIN public.vw_property_loan_dashboard_portfolio_v2 dashboard
    ON dashboard.portfolio_property_id = pp.id
  JOIN public.properties p
    ON p.id = dashboard.property_id
  WHERE dashboard.property_id IS NOT NULL
  ORDER BY pp.id, dashboard.property_id
),
dashboard_matches AS (
  SELECT dashboard_raw_matches.*
  FROM dashboard_raw_matches
  JOIN (
    SELECT core_property_id
    FROM dashboard_raw_matches
    GROUP BY core_property_id
    HAVING count(*) = 1
  ) target_counts ON target_counts.core_property_id = dashboard_raw_matches.core_property_id
)
UPDATE public.portfolio_properties pp
SET core_property_id = dashboard_matches.core_property_id
FROM dashboard_matches
WHERE pp.id = dashboard_matches.portfolio_property_id
  AND (
    pp.core_property_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.properties existing
      WHERE existing.id = pp.core_property_id
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.portfolio_properties taken
    WHERE taken.id <> pp.id
      AND taken.core_property_id = dashboard_matches.core_property_id
  );

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*)
  INTO missing_count
  FROM public.portfolio_properties pp
  WHERE pp.core_property_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = pp.core_property_id
    );

  RAISE NOTICE 'portfolio_properties without valid core_property_id after repair: %', missing_count;
END $$;

DROP FUNCTION IF EXISTS public.koenen_clean_property_match_name(text);
