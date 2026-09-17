create table if not exists public.forum_analytics_events (
  event_id text primary key,
  visitor_id text not null,
  session_id text not null,
  viewed_at timestamptz not null default now(),
  constraint forum_analytics_event_id_length check (char_length(event_id) between 16 and 80),
  constraint forum_analytics_visitor_id_length check (char_length(visitor_id) between 16 and 80),
  constraint forum_analytics_session_id_length check (char_length(session_id) between 16 and 80)
);

alter table public.forum_analytics_events enable row level security;

revoke all on table public.forum_analytics_events from anon, authenticated;
grant select, insert on table public.forum_analytics_events to service_role;

create index if not exists forum_analytics_events_viewed_at_idx
  on public.forum_analytics_events (viewed_at desc);
create index if not exists forum_analytics_events_visitor_viewed_idx
  on public.forum_analytics_events (visitor_id, viewed_at desc);

create or replace function public.get_forum_analytics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
params as (
  select (now() at time zone 'America/Chicago')::date as today_local
),
base as (
  select
    visitor_id,
    session_id,
    viewed_at,
    viewed_at at time zone 'America/Chicago' as viewed_local
  from public.forum_analytics_events
),
first_seen as (
  select visitor_id, min(viewed_at) as first_seen_at
  from base
  group by visitor_id
),
daily_rows as (
  select
    d::date as day,
    count(b.visitor_id)::bigint as views,
    count(distinct b.visitor_id)::bigint as unique_visitors
  from params p
  cross join generate_series(p.today_local - 13, p.today_local, interval '1 day') d
  left join base b on b.viewed_local::date = d::date
  group by d
  order by d
),
hourly_rows as (
  select
    h as hour,
    count(b.visitor_id)::bigint as views,
    count(distinct b.visitor_id)::bigint as unique_visitors
  from generate_series(0, 23) h
  cross join params p
  left join base b
    on extract(hour from b.viewed_local)::int = h
   and b.viewed_local::date >= p.today_local - 29
  group by h
  order by h
),
period_30_visitors as (
  select distinct b.visitor_id
  from base b, params p
  where b.viewed_local::date >= p.today_local - 29
),
returning_30 as (
  select count(*)::bigint as returning_visitors
  from period_30_visitors pv
  join first_seen fs using (visitor_id)
  cross join params p
  where (fs.first_seen_at at time zone 'America/Chicago')::date < p.today_local - 29
),
new_30 as (
  select count(*)::bigint as new_visitors
  from period_30_visitors pv
  join first_seen fs using (visitor_id)
  cross join params p
  where (fs.first_seen_at at time zone 'America/Chicago')::date >= p.today_local - 29
)
select jsonb_build_object(
  'generated_at', now(),
  'today', (
    select jsonb_build_object(
      'views', count(*)::bigint,
      'unique_visitors', count(distinct visitor_id)::bigint,
      'sessions', count(distinct session_id)::bigint
    )
    from base, params
    where viewed_local::date = today_local
  ),
  'last_7_days', (
    select jsonb_build_object(
      'views', count(*)::bigint,
      'unique_visitors', count(distinct visitor_id)::bigint,
      'sessions', count(distinct session_id)::bigint
    )
    from base, params
    where viewed_local::date >= today_local - 6
  ),
  'last_30_days', (
    select jsonb_build_object(
      'views', count(*)::bigint,
      'unique_visitors', count(distinct visitor_id)::bigint,
      'sessions', count(distinct session_id)::bigint,
      'new_visitors', (select new_visitors from new_30),
      'returning_visitors', (select returning_visitors from returning_30)
    )
    from base, params
    where viewed_local::date >= today_local - 29
  ),
  'all_time', (
    select jsonb_build_object(
      'views', count(*)::bigint,
      'unique_visitors', count(distinct visitor_id)::bigint,
      'sessions', count(distinct session_id)::bigint,
      'first_view', min(viewed_at),
      'last_view', max(viewed_at)
    )
    from base
  ),
  'daily', coalesce((
    select jsonb_agg(jsonb_build_object(
      'date', day,
      'views', views,
      'unique_visitors', unique_visitors
    ) order by day)
    from daily_rows
  ), '[]'::jsonb),
  'hourly_30d', coalesce((
    select jsonb_agg(jsonb_build_object(
      'hour', hour,
      'views', views,
      'unique_visitors', unique_visitors
    ) order by hour)
    from hourly_rows
  ), '[]'::jsonb)
);
$$;

revoke all on function public.get_forum_analytics() from public, anon, authenticated;
grant execute on function public.get_forum_analytics() to service_role;
