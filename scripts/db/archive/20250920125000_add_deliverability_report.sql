create or replace function deliverability_report(p_user_id uuid, p_window interval)
returns jsonb
stable
language sql
as $$
  with cutoff as (
    select now() - p_window as since_at
  ),
  scoped_campaigns as (
    select id, name
    from campaigns
    where user_id = p_user_id
  ),
  scoped_recipients as (
    select
      cr.*,
      c.name as campaign_name
    from campaign_recipients cr
    join scoped_campaigns c on c.id = cr.campaign_id
  ),
  recipient_with_last as (
    select
      r.id,
      r.buyer_id,
      r.campaign_name,
      r.status,
      r.error,
      r.sent_at,
      r.delivered_at,
      r.opened_at,
      r.clicked_at,
      r.bounced_at,
      r.complained_at,
      r.unsubscribed_at,
      r.rejected_at,
      r.rendering_failed_at,
      r.delivery_delayed_at,
      nullif(
        greatest(
          coalesce(r.sent_at, 'epoch'::timestamptz),
          coalesce(r.delivered_at, 'epoch'::timestamptz),
          coalesce(r.opened_at, 'epoch'::timestamptz),
          coalesce(r.clicked_at, 'epoch'::timestamptz),
          coalesce(r.bounced_at, 'epoch'::timestamptz),
          coalesce(r.complained_at, 'epoch'::timestamptz),
          coalesce(r.unsubscribed_at, 'epoch'::timestamptz),
          coalesce(r.rejected_at, 'epoch'::timestamptz),
          coalesce(r.rendering_failed_at, 'epoch'::timestamptz),
          coalesce(r.delivery_delayed_at, 'epoch'::timestamptz)
        ),
        'epoch'::timestamptz
      ) as last_event_at
    from scoped_recipients r
  ),
  recipient_window as (
    select *
    from recipient_with_last, cutoff
    where last_event_at >= cutoff.since_at
  ),
  kpis as (
    select
      count(*) filter (where sent_at >= cutoff.since_at) as sent,
      count(*) filter (where delivered_at >= cutoff.since_at) as delivered,
      count(*) filter (where opened_at >= cutoff.since_at) as opens,
      count(*) filter (where clicked_at >= cutoff.since_at) as clicks,
      count(*) filter (where bounced_at >= cutoff.since_at) as bounces,
      count(*) filter (where complained_at >= cutoff.since_at) as complaints,
      count(*) filter (where unsubscribed_at >= cutoff.since_at) as unsubscribes,
      count(*) filter (
        where rejected_at >= cutoff.since_at
          or rendering_failed_at >= cutoff.since_at
      ) as errors
    from scoped_recipients, cutoff
  ),
  recipient_drilldown as (
    select
      b.email as email,
      coalesce(b.full_name, concat_ws(' ', b.fname, b.lname)) as name,
      r.campaign_name as campaign_name,
      r.error as error_message,
      r.last_event_at as last_event_at,
      coalesce(
        (
          select e.event_type
          from email_events e
          where e.recipient_id = r.id
          order by e.created_at desc
          limit 1
        ),
        case
          when r.rejected_at is not null or r.rendering_failed_at is not null then 'error'
          when r.bounced_at is not null then 'bounce'
          when r.complained_at is not null then 'complaint'
          when r.unsubscribed_at is not null then 'unsubscribe'
          when r.clicked_at is not null then 'click'
          when r.opened_at is not null then 'open'
          when r.delivered_at is not null then 'delivery'
          when r.sent_at is not null then 'sent'
          else coalesce(r.status, 'unknown')
        end
      ) as last_status
    from recipient_window r
    left join buyers b on b.id = r.buyer_id
    order by r.last_event_at desc nulls last
    limit 500
  ),
  top_links as (
    select
      e.payload->'click'->>'link' as url,
      count(*) as total_clicks,
      count(distinct e.recipient_id) as unique_clickers
    from email_events e
    join scoped_campaigns c on c.id = e.campaign_id
    join cutoff on true
    where e.created_at >= cutoff.since_at
      and e.event_type = 'click'
      and e.payload->'click'->>'link' is not null
    group by url
    order by total_clicks desc
    limit 50
  ),
  link_clickers as (
    select
      e.payload->'click'->>'link' as url,
      b.email as email,
      coalesce(b.full_name, concat_ws(' ', b.fname, b.lname)) as name,
      e.created_at as clicked_at,
      c.name as campaign_name
    from email_events e
    join scoped_campaigns c on c.id = e.campaign_id
    left join campaign_recipients cr on cr.id = e.recipient_id
    left join buyers b on b.id = cr.buyer_id
    join cutoff on true
    where e.created_at >= cutoff.since_at
      and e.event_type = 'click'
      and e.payload->'click'->>'link' is not null
    order by e.created_at desc
    limit 1000
  )
  select jsonb_build_object(
    'kpis', (select row_to_json(kpis) from kpis),
    'recipients', (select coalesce(jsonb_agg(recipient_drilldown), '[]'::jsonb) from recipient_drilldown),
    'top_links', (select coalesce(jsonb_agg(top_links), '[]'::jsonb) from top_links),
    'link_clickers', (select coalesce(jsonb_agg(link_clickers), '[]'::jsonb) from link_clickers)
  );
$$;
