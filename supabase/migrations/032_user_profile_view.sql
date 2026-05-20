-- 032: user_profile_v — единая агрегированная вьюха по каждому tg_id.
-- Используется в:
--   • карточке участника в админке (блок «Insights»)
--   • сегментации Broadcasts (фильтр аудитории по funnel_stage/top_interest/…)
--   • генерации персональной карты уроков (рекомендации по library_items)
--
-- Ключ — tg_id (а не member_id), потому что персонализировать хотим и
-- бот-юзеров без клубной подписки тоже (warm-up рассылки).
--
-- Окна: «за 30 дней» — основное окно поведения; «всё время» — для интересов.

CREATE OR REPLACE VIEW public.user_profile_v AS
WITH base AS (
  SELECT
    bu.tg_id,
    bu.tg_username,
    bu.tg_first_name,
    bu.tg_last_name,
    bu.language_code,
    bu.is_channel_member,
    bu.is_group_member,
    bu.first_seen_at,
    bu.last_seen_at,
    bu.last_event_type,
    bu.events_count,
    bu.source
  FROM public.bot_users bu
),
mem AS (
  SELECT
    m.tg_id,
    m.id AS member_id,
    m.status AS member_status,
    m.rank,
    m.points,
    m.joined_at,
    m.last_active,
    m.expires_at,
    m.subscription_count,
    m.onboarding_dm_state,
    (m.expires_at IS NOT NULL AND m.expires_at > now()) AS subscription_active
  FROM public.members m
),
onb AS (
  SELECT
    oa.tg_id,
    oa.goal,
    oa.goal_custom,
    oa.level,
    oa.skills,
    oa.hours_per_week,
    oa.has_business,
    oa.mini_app_done_at IS NOT NULL AS onboarding_done,
    oa.recommended_paths
  FROM public.onboarding_answers oa
),
beh AS (
  SELECT
    tg_id,
    COUNT(*) FILTER (WHERE event_type='mini_app_open' AND created_at >= now() - interval '30 days') AS mini_app_opens_30d,
    COUNT(*) FILTER (WHERE event_type='mini_app_open') AS mini_app_opens_total,
    COUNT(*) FILTER (WHERE event_type='link_click' AND created_at >= now() - interval '30 days') AS link_clicks_30d,
    COUNT(*) FILTER (WHERE event_type='command:/start') AS starts_total,
    MAX(created_at) FILTER (WHERE event_type='mini_app_open') AS last_mini_app_open
  FROM public.bot_events
  GROUP BY tg_id
),
lib AS (
  SELECT
    member_tg_id AS tg_id,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS library_clicks_30d,
    COUNT(*) AS library_clicks_total,
    MAX(created_at) AS last_library_click
  FROM public.library_events
  WHERE member_tg_id IS NOT NULL
  GROUP BY member_tg_id
),
lib_top AS (
  SELECT
    tg_id,
    jsonb_agg(jsonb_build_object('kind', kind, 'clicks', c) ORDER BY c DESC) FILTER (WHERE rn <= 3) AS top_kinds
  FROM (
    SELECT
      member_tg_id AS tg_id,
      kind,
      COUNT(*) AS c,
      ROW_NUMBER() OVER (PARTITION BY member_tg_id ORDER BY COUNT(*) DESC) AS rn
    FROM public.library_events
    WHERE member_tg_id IS NOT NULL AND kind IS NOT NULL
    GROUP BY member_tg_id, kind
  ) sub
  GROUP BY tg_id
),
deliv AS (
  SELECT
    tg_id,
    COUNT(*) FILTER (WHERE sent_at >= now() - interval '90 days') AS broadcasts_received_90d,
    COUNT(*) FILTER (WHERE sent_at >= now() - interval '90 days' AND engaged_at IS NOT NULL) AS broadcasts_engaged_90d,
    MAX(engaged_at) AS last_broadcast_engaged_at,
    MAX(sent_at)    AS last_broadcast_sent_at
  FROM public.message_deliveries
  GROUP BY tg_id
),
rx AS (
  SELECT
    reactor_tg_id AS tg_id,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS reactions_given_30d,
    COUNT(*) AS reactions_given_total
  FROM public.reactions_log
  WHERE action = 'add'
  GROUP BY reactor_tg_id
),
act AS (
  SELECT
    tg_id,
    SUM(message_count) FILTER (WHERE week_start >= (CURRENT_DATE - interval '30 days')) AS messages_30d,
    SUM(message_count) AS messages_total
  FROM public.activity_log
  GROUP BY tg_id
)
SELECT
  b.tg_id, b.tg_username, b.tg_first_name, b.tg_last_name, b.language_code,
  b.first_seen_at, b.last_seen_at, b.last_event_type, b.events_count, b.source,
  b.is_channel_member, b.is_group_member,

  m.member_id,
  (m.member_id IS NOT NULL) AS is_member,
  m.member_status, m.rank, m.points, m.joined_at, m.last_active, m.expires_at,
  m.subscription_count, m.onboarding_dm_state,
  COALESCE(m.subscription_active, false) AS subscription_active,

  o.goal, o.goal_custom, o.level, o.skills, o.hours_per_week, o.has_business,
  COALESCE(o.onboarding_done, false) AS onboarding_done,
  o.recommended_paths,

  COALESCE(beh.mini_app_opens_30d, 0)   AS mini_app_opens_30d,
  COALESCE(beh.mini_app_opens_total, 0) AS mini_app_opens_total,
  COALESCE(beh.link_clicks_30d, 0)      AS link_clicks_30d,
  COALESCE(beh.starts_total, 0)         AS starts_total,
  beh.last_mini_app_open,

  COALESCE(lib.library_clicks_30d, 0)   AS library_clicks_30d,
  COALESCE(lib.library_clicks_total, 0) AS library_clicks_total,
  lib.last_library_click,
  COALESCE(lib_top.top_kinds, '[]'::jsonb) AS top_kinds,

  COALESCE(deliv.broadcasts_received_90d, 0) AS broadcasts_received_90d,
  COALESCE(deliv.broadcasts_engaged_90d, 0)  AS broadcasts_engaged_90d,
  CASE WHEN COALESCE(deliv.broadcasts_received_90d,0) > 0
       THEN ROUND(100.0 * deliv.broadcasts_engaged_90d::numeric / deliv.broadcasts_received_90d, 1)
       ELSE NULL END AS broadcast_engagement_pct,
  deliv.last_broadcast_engaged_at,
  deliv.last_broadcast_sent_at,

  COALESCE(rx.reactions_given_30d, 0)   AS reactions_given_30d,
  COALESCE(rx.reactions_given_total, 0) AS reactions_given_total,
  COALESCE(act.messages_30d, 0)         AS messages_30d,
  COALESCE(act.messages_total, 0)       AS messages_total,

  CASE
    WHEN m.last_active IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - m.last_active))/86400
    WHEN b.last_seen_at IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - b.last_seen_at))/86400
    ELSE NULL
  END::int AS days_since_active,

  -- funnel_stage:
  --   churned       — был member, status='churned'
  --   churn_risk    — member, не активен 14+ дней или подписка истекает <7д
  --   member        — активный member
  --   engaged       — не member, но кликал библиотеку или открывал miniapp
  --   onboarded     — прошёл онбординг, но без кликов/miniapp
  --   visitor       — есть в bot_users, ничего больше
  CASE
    WHEN m.member_id IS NOT NULL AND m.member_status = 'churned' THEN 'churned'
    WHEN m.member_id IS NOT NULL AND (
      (m.last_active IS NULL OR m.last_active < now() - interval '14 days')
      OR (m.expires_at IS NOT NULL AND m.expires_at < now() + interval '7 days' AND m.expires_at > now())
    ) THEN 'churn_risk'
    WHEN m.member_id IS NOT NULL THEN 'member'
    WHEN COALESCE(lib.library_clicks_total,0) > 0 OR COALESCE(beh.mini_app_opens_total,0) > 0 THEN 'engaged'
    WHEN COALESCE(o.onboarding_done,false) THEN 'onboarded'
    ELSE 'visitor'
  END AS funnel_stage,

  LEAST(100,
    COALESCE(beh.mini_app_opens_30d,0) * 5 +
    COALESCE(lib.library_clicks_30d,0) * 6 +
    COALESCE(rx.reactions_given_30d,0) * 2 +
    COALESCE(act.messages_30d,0) * 3 +
    COALESCE(deliv.broadcasts_engaged_90d,0) * 4 +
    CASE WHEN m.member_id IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN COALESCE(o.onboarding_done,false) THEN 10 ELSE 0 END
  )::int AS engagement_score
FROM base b
LEFT JOIN mem     m  ON m.tg_id = b.tg_id
LEFT JOIN onb     o  ON o.tg_id = b.tg_id
LEFT JOIN beh        ON beh.tg_id = b.tg_id
LEFT JOIN lib        ON lib.tg_id = b.tg_id
LEFT JOIN lib_top    ON lib_top.tg_id = b.tg_id
LEFT JOIN deliv      ON deliv.tg_id = b.tg_id
LEFT JOIN rx         ON rx.tg_id = b.tg_id
LEFT JOIN act        ON act.tg_id = b.tg_id;

GRANT SELECT ON public.user_profile_v TO anon, authenticated, service_role;

-- Кеш LLM-резюме по юзеру.
CREATE TABLE IF NOT EXISTS public.user_insights (
  tg_id            BIGINT PRIMARY KEY,
  summary          TEXT,
  suggested_action TEXT,
  next_lessons     JSONB,
  inputs_hash      TEXT,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  model            TEXT
);
ALTER TABLE public.user_insights DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.user_insights TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
