-- Remove obsolete legacy RPC.
--
-- The frontend uses public.generate_yearly_property_income. The old
-- public.generate_yearly_income function referenced yearly_property_income.amount,
-- a column that no longer exists, and caused Supabase db lint failures.
do $$
declare
  legacy_function record;
begin
  for legacy_function in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'generate_yearly_income'
  loop
    execute format('drop function if exists %s cascade', legacy_function.signature);
  end loop;
end $$;
