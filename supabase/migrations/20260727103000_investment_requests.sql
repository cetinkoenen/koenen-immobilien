create table if not exists public.investment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'Neue Investition',
  object_name text not null default 'Neue Investition',
  request_date date not null default current_date,
  address text,
  location text,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'bank_sent', 'archived')),
  expires_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  ai_report jsonb,
  file_metadata jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investment_requests_user_updated_idx
  on public.investment_requests (user_id, updated_at desc);

create index if not exists investment_requests_status_date_idx
  on public.investment_requests (status, request_date desc);

drop trigger if exists set_investment_requests_updated_at on public.investment_requests;
create trigger set_investment_requests_updated_at
before update on public.investment_requests
for each row execute function public.set_updated_at();

alter table public.investment_requests enable row level security;

drop policy if exists investment_requests_select_authenticated on public.investment_requests;
create policy investment_requests_select_authenticated
on public.investment_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com'
);

drop policy if exists investment_requests_insert_writer on public.investment_requests;
create policy investment_requests_insert_writer
on public.investment_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and lower(coalesce(auth.jwt() ->> 'email', '')) not in ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com')
);

drop policy if exists investment_requests_update_writer on public.investment_requests;
create policy investment_requests_update_writer
on public.investment_requests
for update
to authenticated
using (
  (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com'
  )
  and lower(coalesce(auth.jwt() ->> 'email', '')) not in ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com')
)
with check (
  (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com'
  )
  and lower(coalesce(auth.jwt() ->> 'email', '')) not in ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com')
);

drop policy if exists investment_requests_delete_writer on public.investment_requests;
create policy investment_requests_delete_writer
on public.investment_requests
for delete
to authenticated
using (
  (
    user_id = auth.uid()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'info.koenen@gmail.com'
  )
  and lower(coalesce(auth.jwt() ->> 'email', '')) not in ('nihal.koenen@gmail.com', 'cetin.koenen@gmail.com')
);

grant select, insert, update, delete on public.investment_requests to authenticated;
