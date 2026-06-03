create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  preferences jsonb not null default '{
    "forum_posts": true,
    "forum_replies": true,
    "incentive_updates": true,
    "new_flyers": true,
    "new_resources": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_updated_at_idx
  on push_subscriptions (updated_at desc);

create table if not exists push_notification_events (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  title text not null,
  body text,
  url text not null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table push_notification_events enable row level security;

drop policy if exists "Service role manages push subscriptions" on push_subscriptions;
create policy "Service role manages push subscriptions"
  on push_subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages push notification events" on push_notification_events;
create policy "Service role manages push notification events"
  on push_notification_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
