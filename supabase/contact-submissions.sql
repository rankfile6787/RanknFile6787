create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  contact text,
  topic text not null default 'other' check (topic in ('flyer', 'suggestion', 'site-issue', 'other')),
  message text not null,
  image_url text,
  image_path text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived'))
);

create index if not exists contact_submissions_status_created_at_idx
  on public.contact_submissions(status, created_at desc);

alter table public.contact_submissions enable row level security;

update push_subscriptions
set preferences = preferences || '{"contact_submissions": true}'::jsonb
where audience = 'admin' and not preferences ? 'contact_submissions';

update push_subscriptions
set preferences = preferences || '{"contact_submissions": false}'::jsonb
where audience = 'public' and not preferences ? 'contact_submissions';
