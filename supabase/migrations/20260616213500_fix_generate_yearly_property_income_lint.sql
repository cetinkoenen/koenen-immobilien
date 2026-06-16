-- Keep the active yearly income generator, but remove PL/pgSQL lint warnings.
create or replace function public.generate_yearly_property_income(
  p_property_id uuid,
  p_start_year integer default 2024,
  p_year_count integer default 10
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annual_rent numeric := 0;
  v_other_income numeric := 0;
  target_year integer;
begin
  select
    coalesce(pi.annual_rent, 0)::numeric,
    coalesce(pi.other_income, 0)::numeric
  into v_annual_rent, v_other_income
  from public.property_income pi
  where pi.property_id = p_property_id
  order by pi.updated_at desc nulls last, pi.created_at desc nulls last
  limit 1;

  for target_year in p_start_year..(p_start_year + greatest(p_year_count, 0) - 1) loop
    insert into public.yearly_property_income (
      property_id,
      year,
      annual_rent,
      other_income,
      source
    )
    values (
      p_property_id,
      target_year,
      v_annual_rent,
      v_other_income,
      'generated'
    )
    on conflict (property_id, year) do nothing;
  end loop;
end;
$$;

grant execute on function public.generate_yearly_property_income(uuid, integer, integer) to authenticated;
