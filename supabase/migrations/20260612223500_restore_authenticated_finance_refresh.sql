-- Re-enable the manual Datenpruefung refresh for signed-in app users.
--
-- The RPC is SECURITY DEFINER, but it only refreshes a fixed allow-list of
-- finance materialized views and returns status rows. It does not accept table
-- names or arbitrary SQL, so authenticated app users can safely trigger it from
-- the Datenpruefung page.

GRANT EXECUTE ON FUNCTION public.refresh_koenen_finance_materialized_views() TO authenticated;
