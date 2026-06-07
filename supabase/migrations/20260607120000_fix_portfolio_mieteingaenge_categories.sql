-- Align portfolio rent-income summaries with the canonical finance_entry logic.
-- The source remains finance_entry; this only broadens the derived mieteingaenge
-- category rule from category = 'Miete' to the same rent-like text used by the app.

CREATE OR REPLACE VIEW public.v_portfolio_finance_summary_jahr_backup_including_deleted AS
WITH portfolio_map AS (
  SELECT
    pp.id AS portfolio_property_id,
    pp.id,
    pp.id AS object_id,
    pp.user_id,
    pp.name,
    CASE
      WHEN pp.name ~~* 'Lilienthaler%'::text THEN 'Objekt_1'::text
      WHEN pp.name ~~* 'Elsasser%'::text THEN 'Objekt_2'::text
      WHEN pp.name ~~* 'Colmarer%'::text THEN 'Objekt_3'::text
      WHEN pp.name ~~* 'Fürther%'::text THEN 'Objekt_4'::text
      WHEN pp.name ~~* 'Hohenloher%'::text THEN 'Objekt_5'::text
      WHEN pp.name ~~* 'Rosenstein%'::text THEN 'Objekt_6'::text
      ELSE NULL::text
    END AS objekt_code
  FROM public.portfolio_properties pp
  WHERE COALESCE(pp.is_test, false) = false
),
finance_year AS (
  SELECT
    fe.user_id,
    fe.objekt_code,
    EXTRACT(year FROM fe.booking_date)::integer AS jahr,
    SUM(
      CASE
        WHEN fe.entry_type = 'income'::public.entry_type THEN fe.amount
        ELSE 0::numeric
      END
    )::numeric(12,2) AS einnahmen,
    SUM(
      CASE
        WHEN fe.entry_type = 'expense'::public.entry_type THEN fe.amount
        ELSE 0::numeric
      END
    )::numeric(12,2) AS ausgaben,
    SUM(
      CASE
        WHEN fe.entry_type = 'income'::public.entry_type
          AND LOWER(COALESCE(fe.category, ''::text) || ' ' || COALESCE(fe.note, ''::text)) ~
            '(miete|kaltmiete|warmmiete|garage|stellplatz|pacht)'::text
        THEN fe.amount
        ELSE 0::numeric
      END
    )::numeric(12,2) AS mieteingaenge
  FROM public.finance_entry fe
  GROUP BY fe.user_id, fe.objekt_code, (EXTRACT(year FROM fe.booking_date))
)
SELECT
  p.portfolio_property_id,
  p.id,
  p.object_id,
  p.user_id,
  p.name,
  p.objekt_code,
  f.jahr,
  COALESCE(f.einnahmen, 0::numeric)::numeric(12,2) AS einnahmen,
  COALESCE(f.ausgaben, 0::numeric)::numeric(12,2) AS ausgaben,
  COALESCE(f.mieteingaenge, 0::numeric)::numeric(12,2) AS mieteingaenge,
  (COALESCE(f.einnahmen, 0::numeric) - COALESCE(f.ausgaben, 0::numeric))::numeric(12,2) AS cashflow
FROM portfolio_map p
LEFT JOIN finance_year f
  ON f.user_id = p.user_id
 AND f.objekt_code = p.objekt_code;

CREATE OR REPLACE VIEW public.v_portfolio_finance_summary_jahr AS
SELECT
  b.portfolio_property_id,
  b.id,
  b.object_id,
  b.user_id,
  b.name,
  b.objekt_code,
  b.jahr,
  (COALESCE(b.einnahmen, 0::numeric) - COALESCE(d.deleted_einnahmen, 0::numeric))::numeric(14,2) AS einnahmen,
  (COALESCE(b.ausgaben, 0::numeric) - COALESCE(d.deleted_ausgaben, 0::numeric))::numeric(14,2) AS ausgaben,
  (COALESCE(b.mieteingaenge, 0::numeric) - COALESCE(d.deleted_mieteingaenge, 0::numeric))::numeric(14,2) AS mieteingaenge,
  (COALESCE(b.einnahmen, 0::numeric) - COALESCE(d.deleted_einnahmen, 0::numeric) - COALESCE(b.ausgaben, 0::numeric) + COALESCE(d.deleted_ausgaben, 0::numeric))::numeric(14,2) AS cashflow
FROM public.v_portfolio_finance_summary_jahr_backup_including_deleted b
LEFT JOIN (
  SELECT
    finance_entry.objekt_code,
    EXTRACT(year FROM finance_entry.booking_date)::integer AS jahr,
    SUM(
      CASE
        WHEN LOWER(finance_entry.entry_type::text) = 'income'::text THEN ABS(finance_entry.amount)
        ELSE 0::numeric
      END
    )::numeric(14,2) AS deleted_einnahmen,
    SUM(
      CASE
        WHEN LOWER(finance_entry.entry_type::text) = 'expense'::text THEN ABS(finance_entry.amount)
        ELSE 0::numeric
      END
    )::numeric(14,2) AS deleted_ausgaben,
    SUM(
      CASE
        WHEN LOWER(finance_entry.entry_type::text) = 'income'::text
          AND LOWER(COALESCE(finance_entry.category, ''::text) || ' ' || COALESCE(finance_entry.note, ''::text)) ~
            '(miete|kaltmiete|warmmiete|garage|stellplatz|pacht)'::text
        THEN ABS(finance_entry.amount)
        ELSE 0::numeric
      END
    )::numeric(14,2) AS deleted_mieteingaenge
  FROM public.finance_entry
  WHERE finance_entry.booking_date IS NOT NULL
    AND (COALESCE(finance_entry.is_deleted, false) = true OR finance_entry.deleted_at IS NOT NULL)
  GROUP BY finance_entry.objekt_code, (EXTRACT(year FROM finance_entry.booking_date)::integer)
) d
  ON d.objekt_code = b.objekt_code
 AND d.jahr = b.jahr;
