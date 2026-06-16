CREATE OR REPLACE FUNCTION public.koenen_is_readonly_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'nihal.koenen@gmail.com',
    'cetin.koenen@gmail.com'
  );
$$;

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

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'account_members',
    'apartment_billing_workspaces',
    'categories',
    'exposes',
    'finance_entry',
    'move_processes',
    'payment_reminders',
    'portfolio_properties',
    'portfolio_property_rentals',
    'properties',
    'property_documents',
    'property_extra_info',
    'property_income',
    'property_loan_ledger',
    'property_loans',
    'property_tasks',
    'rent_schedules',
    'tenant_contracts',
    'tenant_profiles',
    'transaction_rules',
    'unit_vacancies',
    'yearly_capex_entries',
    'yearly_property_income'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = format('%s_readonly_select_all', table_name)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.koenen_is_readonly_user())',
        format('%s_readonly_select_all', table_name),
        table_name
      );
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS koenen_block_readonly_write ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER koenen_block_readonly_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.koenen_block_readonly_write()',
      table_name
    );
  END LOOP;
END $$;

INSERT INTO public.account_members (account_id, user_id, role)
SELECT existing.account_id, target.id, 'viewer'
FROM (
  SELECT account_id
  FROM public.account_members
  WHERE user_id = (
    SELECT id FROM auth.users WHERE lower(email) = 'info.koenen@gmail.com' LIMIT 1
  )
  ORDER BY created_at
  LIMIT 1
) existing
CROSS JOIN (
  SELECT id
  FROM auth.users
  WHERE lower(email) IN ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com')
) target
ON CONFLICT (account_id, user_id) DO UPDATE
SET role = 'viewer';

DO $$
DECLARE
  view_name text;
  views text[] := ARRAY[
    'v_object_dropdown',
    'v_income_entries',
    'v_expense_entries',
    'v_mieteingaenge_monat',
    'v_objekt_finanz_summary_jahr',
    'v_portfolio_finance_summary_jahr',
    'vw_property_loan_dashboard_dedup',
    'vw_property_loan_dashboard_display',
    'vw_property_loan_dashboard_portfolio_v2'
  ];
BEGIN
  FOREACH view_name IN ARRAY views LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', view_name);
    END IF;
  END LOOP;
END $$;
