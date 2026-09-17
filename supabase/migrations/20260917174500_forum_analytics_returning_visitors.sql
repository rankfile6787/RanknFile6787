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
  select
    b.visitor_id,
    count(distinct b.session_id)::bigint as period_sessions
  from base b, params p
  where b.viewed_local::date >= p.today_local - 29
  group by b.visitor_id
),
classified_30 as (
  select
    pv.visitor_id,
    case
      when (fs.first_seen_at at time zone 'America/Chicago')::date < p.today_local - 29
        or pv.period_sessions >= 2
      then true
      else false
    end as is_returning
  from period_30_visitors pv
  join first_seen fs using (visitor_id)
  cross join params p
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
      'new_visitors', (select count(*)::bigint from classified_30 where not is_returning),
      'returning_visitors', (select count(*)::bigint from classified_30 where is_returning)
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
