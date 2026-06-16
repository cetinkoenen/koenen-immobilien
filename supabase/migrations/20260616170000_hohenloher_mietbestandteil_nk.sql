UPDATE public.finance_entry
SET
  category = 'Mietbestandteil-NK',
  note = trim(both ' ' from concat_ws(' | ', nullif(note, ''), 'Hohenloher Str. 78: 270 EUR Nebenkosten-Vorauszahlung als Mietbestandteil der Gesamtmiete')),
  nk_relevant = true,
  tax_relevant = true
WHERE entry_type = 'income'
  AND is_deleted IS DISTINCT FROM true
  AND abs(coalesce(amount, 0)::numeric - 270::numeric) <= 0.01
  AND (
    coalesce(objekt_code, '') ILIKE '%hohenloher%'
    OR coalesce(note, '') ILIKE '%hohenloher%'
    OR coalesce(category, '') ILIKE '%hohenloher%'
    OR EXISTS (
      SELECT 1
      FROM public.v_object_dropdown vod
      WHERE (
        vod.object_id::text = finance_entry.object_id::text
        OR vod.value::text = finance_entry.object_id::text
        OR vod.objekt_code::text = finance_entry.objekt_code::text
      )
      AND vod.label ILIKE '%hohenloher%'
    )
  )
  AND (
    coalesce(category, '') ILIKE '%hausverwaltung%'
    OR coalesce(category, '') ILIKE '%hausgeld%'
    OR coalesce(category, '') ILIKE '%nebenkosten%'
    OR coalesce(category, '') ILIKE '%betriebskosten%'
    OR coalesce(category, '') ILIKE '%nk%'
    OR coalesce(note, '') ILIKE '%hausverwaltung%'
    OR coalesce(note, '') ILIKE '%hausgeld%'
    OR coalesce(note, '') ILIKE '%nebenkosten%'
    OR coalesce(note, '') ILIKE '%betriebskosten%'
    OR coalesce(note, '') ILIKE '%nk%'
  );
