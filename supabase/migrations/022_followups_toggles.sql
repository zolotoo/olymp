-- 022: тумблеры для догонов.
-- 1) bot_settings — общая таблица key/value для глобальных флагов админки.
--    Сейчас тут будет только followups_enabled, дальше можно добавлять.
-- 2) bot_messages.enabled — per-template флаг. Cron-эндпоинт уважает оба:
--    глобальный выкл = всё стоит; per-template выкл = именно этот догон стоит.

CREATE TABLE IF NOT EXISTS public.bot_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_settings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.bot_settings TO anon, authenticated, service_role;

-- Дефолт: догоны включены глобально.
INSERT INTO public.bot_settings (key, value) VALUES
  ('followups_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Per-template enabled. NULL/true = включено, false = выключено.
ALTER TABLE public.bot_messages
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
