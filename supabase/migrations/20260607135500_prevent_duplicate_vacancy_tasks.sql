create unique index if not exists property_tasks_unique_active_vacancy_source_key
on public.property_tasks ((meta->>'source_key'))
where category = 'leerstand'
  and source = 'system'
  and status in ('offen', 'in_bearbeitung')
  and meta ? 'source_key';
