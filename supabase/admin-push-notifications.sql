alter table push_subscriptions
  add column if not exists audience text not null default 'public',
  add column if not exists user_email text;

alter table push_subscriptions
  drop constraint if exists push_subscriptions_audience_check;

alter table push_subscriptions
  add constraint push_subscriptions_audience_check
  check (audience in ('public', 'admin'));

update push_subscriptions
set preferences = preferences || '{"pending_comments": false}'::jsonb
where not preferences ? 'pending_comments';

create index if not exists push_subscriptions_audience_idx
  on push_subscriptions (audience);

alter table push_notification_events
  add column if not exists audience text not null default 'public';

alter table push_notification_events
  drop constraint if exists push_notification_events_audience_check;

alter table push_notification_events
  add constraint push_notification_events_audience_check
  check (audience in ('public', 'admin'));
