alter table public.rent_adjustments
add column if not exists effective_end_date date null;

create index if not exists idx_rent_adjustments_validity
on public.rent_adjustments(property_id, effective_date desc, effective_end_date desc)
where is_deleted = false;
