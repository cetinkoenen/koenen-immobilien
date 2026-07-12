-- Follow-up fixes for Supabase Database Advisor security findings.
--
-- Scope:
-- - Pin search_path on functions flagged by function_search_path_mutable.
-- - Remove direct API access to finance materialized views.
-- - Remove public/authenticated EXECUTE from SECURITY DEFINER functions that
--   should only run as triggers, admin-owned maintenance, or service-role jobs.
--
-- This migration does not change frontend business logic or application data.

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_property_extra_info_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.koenen_is_readonly_user() SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.koenen_block_readonly_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.koenen_is_readonly_user() THEN
    RAISE EXCEPTION 'Readonly users may only read data.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_yearly_property_income(
  p_property_id uuid,
  p_start_year integer DEFAULT 2024,
  p_year_count integer DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_annual_rent numeric := 0;
  v_other_income numeric := 0;
BEGIN
  SELECT
    COALESCE(pi.annual_rent, 0)::numeric,
    COALESCE(pi.other_income, 0)::numeric
  INTO v_annual_rent, v_other_income
  FROM public.property_income pi
  WHERE pi.property_id = p_property_id
  ORDER BY pi.updated_at DESC NULLS LAST, pi.created_at DESC NULLS LAST
  LIMIT 1;

  FOR target_year IN p_start_year..(p_start_year + GREATEST(p_year_count, 0) - 1) LOOP
    INSERT INTO public.yearly_property_income (
      property_id,
      year,
      annual_rent,
      other_income,
      source
    )
    VALUES (
      p_property_id,
      target_year,
      v_annual_rent,
      v_other_income,
      'generated'
    )
    ON CONFLICT (property_id, year) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_koenen_finance_materialized_views()
RETURNS TABLE(view_name text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate text;
BEGIN
  FOREACH candidate IN ARRAY ARRAY[
    'mv_property_latest_balance',
    'mv_portfolio_loan_totals_by_year',
    'mv_latest_loan_balance',
    'mv_property_loan_dashboard',
    'mv_portfolio_debt_over_time'
  ]
  LOOP
    view_name := candidate;
    status := 'pending';

    BEGIN
      IF to_regclass(format('public.%I', candidate)) IS NULL THEN
        status := 'not_found';
      ELSE
        EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', candidate);
        status := 'refreshed';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      status := 'error: ' || SQLERRM;
    END;

    RETURN NEXT;
  END LOOP;
END;
$$;

DO $$
DECLARE
  view_name text;
BEGIN
  -- These are app-facing wrapper views used by the frontend. They should stay
  -- selectable through PostgREST while the underlying materialized views are not
  -- directly exposed as API resources.
  FOREACH view_name IN ARRAY ARRAY[
    'vw_property_loan_dashboard_dedup',
    'vw_property_loan_dashboard_display',
    'vw_property_loan_dashboard_portfolio_v2'
  ]
  LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = false)', view_name);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', view_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  matview_name text;
BEGIN
  FOREACH matview_name IN ARRAY ARRAY[
    'mv_property_latest_balance',
    'mv_portfolio_loan_totals_by_year',
    'mv_latest_loan_balance',
    'mv_portfolio_debt_over_time',
    'mv_property_loan_dashboard',
    'mv_property_rent_history_monthly'
  ]
  LOOP
    IF to_regclass(format('public.%I', matview_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', matview_name);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_yearly_property_income(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.koenen_block_readonly_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_koenen_finance_materialized_views() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.yearly_property_income TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_yearly_property_income(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_koenen_finance_materialized_views() TO service_role;
