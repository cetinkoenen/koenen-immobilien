-- Make intentionally blocked backup/internal tables explicit for Supabase Advisor.
-- RLS without policies already denies access, but an explicit deny policy documents
-- that these tables are not part of the browser/API surface.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('internal', 'backup_property_income'),
      ('internal', 'backup_property_income_lilienthaler'),
      ('internal', 'backup_property_loan_ledger_lilienthaler'),
      ('internal', 'backup_yearly_capex_entries_lilienthaler'),
      ('internal', 'backup_yearly_property_income_lilienthaler'),
      ('public', 'finance_entry_backup_after_successful_cache_restore_20260601'),
      ('public', 'finance_entry_backup_before_cache_restore_20260601'),
      ('public', 'finance_entry_backup_before_cache_v6_restore_20260601'),
      ('public', 'finance_entry_backup_before_february_final_repair'),
      ('public', 'finance_entry_backup_before_full_rollback'),
      ('public', 'finance_entry_backup_before_may_reconstruction'),
      ('public', 'finance_entry_backup_before_month_repair'),
      ('public', 'finance_entry_backup_before_rent_full_repair'),
      ('public', 'finance_entry_backup_before_restore'),
      ('public', 'finance_entry_backup_final_20260601'),
      ('public', 'finance_entry_cache_restore_v6'),
      ('public', 'finance_entry_cache_restore_v6_missing'),
      ('public', 'finance_entry_final_safe_backup_20260601'),
      ('public', 'finance_entry_reconstruction_2024'),
      ('public', 'property_id_aliases')
    ) AS listed(schema_name, table_name)
  LOOP
    IF to_regclass(format('%I.%I', target.schema_name, target.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target.schema_name, target.table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated', target.schema_name, target.table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = target.schema_name
        AND tablename = target.table_name
        AND policyname = 'deny_browser_api_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY deny_browser_api_access ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        target.schema_name,
        target.table_name
      );
    END IF;
  END LOOP;
END $$;
