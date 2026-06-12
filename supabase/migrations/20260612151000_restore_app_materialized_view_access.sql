-- Restore authenticated read access for app-facing materialized views.
--
-- The security hardening on 2026-06-10 converted several dashboard views to
-- security_invoker and revoked direct materialized-view access. These dashboard
-- views are active application sources, so authenticated users now need SELECT
-- on the underlying materialized views as well. Backup/internal tables remain
-- locked down by the explicit deny migration.

GRANT SELECT ON public.mv_property_loan_dashboard TO authenticated;
GRANT SELECT ON public.mv_property_latest_balance TO authenticated;
GRANT SELECT ON public.mv_latest_loan_balance TO authenticated;
GRANT SELECT ON public.mv_portfolio_loan_totals_by_year TO authenticated;
GRANT SELECT ON public.mv_portfolio_debt_over_time TO authenticated;

