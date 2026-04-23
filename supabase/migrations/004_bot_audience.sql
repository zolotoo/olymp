-- ─── bot_users ────────────────────────────────────────────────────────────────
-- Everyone who ever touched the bot (wrote a message, pressed a button,
-- opened the Mini App). Broader than `members` (club members only).
CREATE TABLE IF NOT EXISTS public.bot_users (
  tg_id           BIGINT PRIMARY KEY,
  tg_username     TEXT,
  tg_first_name   TEXT,
  tg_last_name    TEXT,
  language_code   TEXT,
  is_channel_member BOOLEAN,          -- last known membership status (may lag)
  channel_member_checked_at TIMESTAMPTZ,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_type TEXT,
  events_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bot_users_last_seen ON public.bot_users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_users_channel_member ON public.bot_users(is_channel_member);

ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.bot_users;
CREATE POLICY service_role_all ON public.bot_users FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.bot_users TO service_role;
GRANT SELECT ON TABLE public.bot_users TO anon, authenticated;

-- ─── bot_events ───────────────────────────────────────────────────────────────
-- Every interaction with the bot or mini app.
-- event_type examples: 'message', 'command:/start', 'callback', 'mini_app_open',
-- 'link_click', 'wheel_spin', 'join_request'.
CREATE TABLE IF NOT EXISTS public.bot_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id       BIGINT NOT NULL,
  event_type  TEXT NOT NULL,
  chat_id     BIGINT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_events_tg_id_created ON public.bot_events(tg_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_type_created ON public.bot_events(event_type, created_at DESC);

ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.bot_events;
CREATE POLICY service_role_all ON public.bot_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.bot_events TO service_role;
GRANT SELECT ON TABLE public.bot_events TO anon, authenticated;

-- ─── click_tokens ─────────────────────────────────────────────────────────────
-- Short tokens attached to outgoing links so we can track clicks.
-- When the bot sends a message with a CTA link, we wrap it in
-- https://<host>/api/r/<token>  →  redirects to target_url + logs a bot_event.
CREATE TABLE IF NOT EXISTS public.click_tokens (
  token       TEXT PRIMARY KEY,
  target_url  TEXT NOT NULL,
  campaign    TEXT,                   -- e.g. 'welcome_cta', 'wheel_promo'
  tg_id       BIGINT,                 -- if link was personalized to a user
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicks      INTEGER NOT NULL DEFAULT 0,
  last_click_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_click_tokens_campaign ON public.click_tokens(campaign);

ALTER TABLE public.click_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.click_tokens;
CREATE POLICY service_role_all ON public.click_tokens FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.click_tokens TO service_role;

-- ─── Reload PostgREST cache ───────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
