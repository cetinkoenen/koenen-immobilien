-- Restore loan dashboard reads without re-exposing public materialized views.
--
-- The previous security follow-up correctly revoked direct API access to
-- public.mv_property_loan_dashboard, but the public dashboard views still
-- depended on that materialized view. With security_invoker=true this caused
-- authenticated users to hit permission denied. With security_invoker=false
-- Supabase flags the public views as SECURITY DEFINER.
--
-- These app-facing views now read from the base ledger tables directly and
-- stay SECURITY INVOKER.

DROP VIEW IF EXISTS public.vw_property_loan_dashboard_display CASCADE;
DROP VIEW IF EXISTS public.vw_property_loan_dashboard_display_v2 CASCADE;
DROP VIEW IF EXISTS public.vw_property_loan_dashboard_portfolio_v2 CASCADE;
DROP VIEW IF EXISTS public.vw_property_loan_dashboard_portfolio CASCADE;
DROP VIEW IF EXISTS public.vw_portfolio_concentration CASCADE;
DROP VIEW IF EXISTS public.vw_portfolio_progress CASCADE;
DROP VIEW IF EXISTS public.vw_property_loan_dashboard_dedup CASCADE;

CREATE OR REPLACE VIEW public.vw_property_loan_dashboard_dedup AS
WITH ledger AS (
  SELECT
    l.property_id::uuid AS property_id,
    l.year::int AS year,
    COALESCE(l.balance, 0)::numeric AS balance,
    COALESCE(l.interest, 0)::numeric AS interest,
    COALESCE(l.principal, 0)::numeric AS principal,
    l.updated_at,
    l.created_at
  FROM public.property_loan_ledger l
  WHERE l.property_id IS NOT NULL
), latest AS (
  SELECT DISTINCT ON (ledger.property_id)
    ledger.property_id,
    ledger.year AS last_balance_year,
    ledger.balance AS last_balance
  FROM ledger
  ORDER BY
    ledger.property_id,
    ledger.year DESC,
    ledger.updated_at DESC NULLS LAST,
    ledger.created_at DESC NULLS LAST
), summary AS (
  SELECT
    ledger.property_id,
    MIN(ledger.year)::int AS first_year,
    MAX(ledger.year)::int AS last_year,
    SUM(ledger.interest)::numeric AS interest_total,
    SUM(ledger.principal)::numeric AS principal_total,
    MAX(COALESCE(ledger.updated_at, ledger.created_at)) AS refreshed_at
  FROM ledger
  GROUP BY ledger.property_id
), named AS (
  SELECT
    summary.property_id,
    COALESCE(p.name, pp.name, summary.property_id::text)::text AS property_name,
    summary.first_year,
    summary.last_year,
    latest.last_balance_year,
    latest.last_balance,
    summary.interest_total,
    summary.principal_total,
    CASE
      WHEN COALESCE(summary.principal_total, 0) + COALESCE(latest.last_balance, 0) > 0
        THEN ROUND((COALESCE(summary.principal_total, 0) / (COALESCE(summary.principal_total, 0) + COALESCE(latest.last_balance, 0))) * 100, 2)
      ELSE 0::numeric
    END AS repaid_percent,
    summary.refreshed_at
  FROM summary
  JOIN latest ON latest.property_id = summary.property_id
  LEFT JOIN public.properties p ON p.id = summary.property_id
  LEFT JOIN public.portfolio_properties pp
    ON pp.id = summary.property_id
    OR pp.core_property_id = summary.property_id
)
SELECT
  named.property_id,
  named.property_name,
  named.first_year,
  named.last_year,
  named.last_balance_year,
  named.last_balance,
  named.interest_total,
  named.principal_total,
  named.repaid_percent,
  (TO_CHAR(named.repaid_percent, 'FM990D00') || ' %')::text AS repaid_percent_display,
  CASE
    WHEN COALESCE(named.last_balance, 0) <= 1 THEN 'paid_off'
    WHEN named.repaid_percent >= 80 THEN 'advanced'
    WHEN named.repaid_percent >= 40 THEN 'active'
    ELSE 'early'
  END::text AS repayment_status,
  CASE
    WHEN COALESCE(named.last_balance, 0) <= 1 THEN 'Abbezahlt'
    WHEN named.repaid_percent >= 80 THEN 'Fortgeschritten'
    WHEN named.repaid_percent >= 40 THEN 'Laufend'
    ELSE 'Anlaufphase'
  END::text AS repayment_label,
  named.refreshed_at
FROM named;

ALTER VIEW public.vw_property_loan_dashboard_dedup SET (security_invoker = true);
GRANT SELECT ON public.vw_property_loan_dashboard_dedup TO authenticated;

CREATE OR REPLACE VIEW public.vw_property_loan_dashboard_display AS
SELECT
  property_id,
  property_name,
  first_year,
  last_year,
  last_balance_year,
  last_balance,
  interest_total,
  principal_total,
  repaid_percent,
  repaid_percent_display,
  repayment_status,
  repayment_label,
  refreshed_at
FROM public.vw_property_loan_dashboard_dedup;

ALTER VIEW public.vw_property_loan_dashboard_display SET (security_invoker = true);
GRANT SELECT ON public.vw_property_loan_dashboard_display TO authenticated;

CREATE OR REPLACE VIEW public.vw_property_loan_dashboard_display_v2 AS
SELECT
  property_id,
  property_name,
  first_year,
  last_year,
  last_balance_year,
  last_balance,
  interest_total,
  principal_total,
  repaid_percent,
  repaid_percent_display,
  repayment_status,
  repayment_label,
  refreshed_at
FROM public.vw_property_loan_dashboard_dedup;

ALTER VIEW public.vw_property_loan_dashboard_display_v2 SET (security_invoker = true);
GRANT SELECT ON public.vw_property_loan_dashboard_display_v2 TO authenticated;

CREATE OR REPLACE VIEW public.vw_property_loan_dashboard_portfolio AS
SELECT
  d.property_id,
  pp.id::uuid AS portfolio_property_id,
  COALESCE(pp.name, d.property_name)::text AS property_name,
  d.first_year,
  d.last_year,
  d.last_balance_year,
  d.last_balance,
  d.interest_total,
  d.principal_total,
  d.repaid_percent,
  d.repaid_percent_display,
  d.repayment_status,
  d.repayment_label,
  d.refreshed_at
FROM public.vw_property_loan_dashboard_dedup d
LEFT JOIN public.portfolio_properties pp
  ON pp.id = d.property_id
  OR pp.core_property_id = d.property_id;

ALTER VIEW public.vw_property_loan_dashboard_portfolio SET (security_invoker = true);
GRANT SELECT ON public.vw_property_loan_dashboard_portfolio TO authenticated;

CREATE OR REPLACE VIEW public.vw_portfolio_concentration AS
SELECT
  property_id,
  portfolio_property_id,
  property_name,
  last_balance,
  SUM(COALESCE(last_balance, 0)) OVER ()::numeric AS portfolio_balance_total,
  CASE
    WHEN SUM(COALESCE(last_balance, 0)) OVER () > 0
      THEN ROUND((COALESCE(last_balance, 0) / SUM(COALESCE(last_balance, 0)) OVER ()) * 100, 2)
    ELSE 0::numeric
  END AS portfolio_balance_percent
FROM public.vw_property_loan_dashboard_portfolio;

ALTER VIEW public.vw_portfolio_concentration SET (security_invoker = true);
GRANT SELECT ON public.vw_portfolio_concentration TO authenticated;

CREATE OR REPLACE VIEW public.vw_portfolio_progress AS
SELECT
  property_id,
  portfolio_property_id,
  property_name,
  principal_total,
  last_balance,
  repaid_percent,
  repaid_percent_display,
  repayment_status,
  repayment_label
FROM public.vw_property_loan_dashboard_portfolio;

ALTER VIEW public.vw_portfolio_progress SET (security_invoker = true);
GRANT SELECT ON public.vw_portfolio_progress TO authenticated;

CREATE OR REPLACE VIEW public.vw_property_loan_dashboard_portfolio_v2 AS
SELECT
  d.property_id,
  pp.id::uuid AS portfolio_property_id,
  COALESCE(pp.name, d.property_name)::text AS property_name,
  d.last_balance,
  d.principal_total,
  d.interest_total,
  d.repaid_percent,
  d.repayment_status,
  d.repayment_label
FROM public.vw_property_loan_dashboard_dedup d
LEFT JOIN public.portfolio_properties pp
  ON pp.id = d.property_id
  OR pp.core_property_id = d.property_id;

ALTER VIEW public.vw_property_loan_dashboard_portfolio_v2 SET (security_invoker = true);
GRANT SELECT ON public.vw_property_loan_dashboard_portfolio_v2 TO authenticated;

DO $$
DECLARE
  matview_name text;
BEGIN
  FOREACH matview_name IN ARRAY ARRAY[
    'mv_property_latest_balance',
    'mv_portfolio_loan_totals_by_year',
    'mv_latest_loan_balance',
    'mv_portfolio_debt_over_time',
    'mv_property_loan_dashboard'
  ]
  LOOP
    IF to_regclass(format('public.%I', matview_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', matview_name);
    END IF;
  END LOOP;
END $$;
