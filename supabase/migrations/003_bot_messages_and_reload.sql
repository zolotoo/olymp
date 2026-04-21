-- ─── bot_messages ────────────────────────────────────────────────────────────
-- Редактируемые шаблоны сообщений бота (ключ = id узла в /flow или /ranks).
CREATE TABLE IF NOT EXISTS public.bot_messages (
  key         TEXT PRIMARY KEY,
  label       TEXT,
  type        TEXT NOT NULL DEFAULT 'message',
  content     TEXT NOT NULL DEFAULT '',
  video_url   TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.bot_messages TO anon, authenticated, service_role;

-- ─── messages_log (нужна для /feed и кнопки «Проверить») ─────────────────────
CREATE TABLE IF NOT EXISTS public.messages_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id          BIGINT,
  chat_id        BIGINT,
  tg_username    TEXT,
  tg_first_name  TEXT,
  message_text   TEXT NOT NULL,
  reason         TEXT NOT NULL,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.messages_log;
CREATE POLICY service_role_all ON public.messages_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.messages_log TO service_role;
GRANT SELECT ON TABLE public.messages_log TO anon, authenticated;

-- ─── wheel_spins (колесо фортуны, 1 раз в месяц) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.wheel_spins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id         BIGINT NOT NULL,
  month         TEXT NOT NULL,
  prize_leaves  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tg_id, month)
);

ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.wheel_spins;
CREATE POLICY service_role_all ON public.wheel_spins FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.wheel_spins TO service_role;
GRANT SELECT ON TABLE public.wheel_spins TO anon, authenticated;

-- ─── Helper: reload PostgREST schema cache ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.pgrst_reload_schema()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$ SELECT pg_notify('pgrst', 'reload schema') $$;

GRANT EXECUTE ON FUNCTION public.pgrst_reload_schema() TO service_role, authenticated, anon;

-- Trigger an immediate reload so the new tables are visible right away
NOTIFY pgrst, 'reload schema';
