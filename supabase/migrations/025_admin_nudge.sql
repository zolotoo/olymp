-- 025: Админ-нудж — бот пишет админу пн/ср/пт в 19:00 МСК (16:00 UTC),
-- напоминая закинуть что-нибудь интересное ребятам в чат.
-- Edge Function: admin-nudge. Тексты редактируются в bot_messages[admin_nudge_pool].
-- Идемпотентность: PK по дате (один пинок в сутки максимум).

-- ─── Таблица логов ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_nudges (
  sent_date    DATE PRIMARY KEY,
  tg_id        BIGINT NOT NULL,
  message_id   BIGINT,
  variant_idx  INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_nudges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.admin_nudges;
CREATE POLICY service_role_all ON public.admin_nudges FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.admin_nudges TO service_role;

-- ─── Пул фраз ─────────────────────────────────────────────────────────────────
-- Разделитель между вариантами — строка ровно из трёх дефисов: ---
-- Можно править в админке /flow по ключу admin_nudge_pool.
INSERT INTO public.bot_messages (key, label, type, content)
VALUES (
  'admin_nudge_pool',
  'Админ-нудж: пул фраз (разделитель ---)',
  'message',
  $TXT$Что у тебя зацепило за последние пару дней? Закинь ребятам — пусть тоже подсветится.
---
Время кормить чат. Поделись фишкой/инсайтом/находкой — даже если кажется банальным, кому-то это новое.
---
Что ты сегодня узнал такого, что захотел бы услышать сам месяц назад? Расскажи в чат.
---
Пятница близко 😎. Закинь что-нибудь вдохновляющее: статью, видос, мысль, кейс.
---
Ребята ждут движа. Что у тебя в работе/в голове прямо сейчас? Поделись хоть на пару строк.
---
Маленький контент сегодня лучше большого «когда-нибудь». Что закинешь?
---
Если бы ты сейчас сел писать пост на 3 строки — про что бы он был? Вот это и закидывай.$TXT$
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ─── pg_cron расписание ───────────────────────────────────────────────────────
-- Пн/ср/пт в 16:00 UTC = 19:00 МСК.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-nudge-mwf') THEN
    PERFORM cron.unschedule('admin-nudge-mwf');
  END IF;
END$$;

SELECT cron.schedule(
  'admin-nudge-mwf',
  '0 16 * * 1,3,5',
  $$
  SELECT net.http_post(
    url := 'https://iobyjrjwtzyrmszizebm.functions.supabase.co/admin-nudge',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
