insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'investment-analysis-files',
  'investment-analysis-files',
  false,
  104857600,
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists investment_analysis_files_select_own on storage.objects;
create policy investment_analysis_files_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'investment-analysis-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists investment_analysis_files_insert_own on storage.objects;
create policy investment_analysis_files_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'investment-analysis-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists investment_analysis_files_delete_own on storage.objects;
create policy investment_analysis_files_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'investment-analysis-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
