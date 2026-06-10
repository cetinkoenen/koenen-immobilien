-- Fix Supabase Database Advisor security findings:
-- 1) Views must run with the querying user's permissions/RLS.
-- 2) The old public backup table must not be exposed through PostgREST.

DO $$
DECLARE
  view_name text;
BEGIN
  FOREACH view_name IN ARRAY ARRAY[
    'v_portfolio_finance_summary_jahr',
    'v_portfolio_finance_summary_jahr_backup_including_deleted',
    'v_finance_summary_2026_current',
    'v_objekt_finanz_summary_jahr',
    'v_property_finance_master_yearly',
    'v_expense_entries',
    'v_income_entries',
    'v_mieteingaenge_monat',
    'v_finance_entry_norm'
  ]
  LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', view_name);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_entry_final_safe_backup_20260601') IS NOT NULL THEN
    ALTER TABLE public.finance_entry_final_safe_backup_20260601 ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.finance_entry_final_safe_backup_20260601 FROM anon;
    REVOKE ALL ON TABLE public.finance_entry_final_safe_backup_20260601 FROM authenticated;
  END IF;
END $$;

ALTER FUNCTION public.set_tenant_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_professional_workflow_updated_at() SET search_path = public, pg_temp;

REVOKE ALL ON TABLE public.mv_property_latest_balance FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_portfolio_loan_totals_by_year FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_latest_loan_balance FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_property_loan_dashboard FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_portfolio_debt_over_time FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_koenen_finance_materialized_views() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_koenen_finance_materialized_views() TO service_role;

DROP POLICY IF EXISTS finance_entry_select_authenticated ON public.finance_entry;
DROP POLICY IF EXISTS finance_entry_insert_authenticated ON public.finance_entry;
DROP POLICY IF EXISTS finance_entry_update_authenticated ON public.finance_entry;

CREATE POLICY finance_entry_select_authenticated
ON public.finance_entry
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY finance_entry_insert_authenticated
ON public.finance_entry
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY finance_entry_update_authenticated
ON public.finance_entry
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
