-- 011: pg_cron расписание для weekly-messages Edge Function
-- Запускается каждый день в 9:00 UTC (= 12:00 MSK).
--
-- Edge Function сама идемпотентна (идёт в weekly_sends), поэтому повторный
-- запуск не создаёт дубликатов.
--
-- ВАЖНО: перед применением нужно задать секрет в Edge Function Dashboard:
--   Supabase → Edge Functions → weekly-messages → Secrets:
--     TELEGRAM_BOT_TOKEN = <твой бот-токен, тот же что в Vercel>
--   (SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY уже доступны автоматически)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Идемпотентность миграции: снимаем старый job если он был.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-messages-daily') THEN
    PERFORM cron.unschedule('weekly-messages-daily');
  END IF;
END$$;

SELECT cron.schedule(
  'weekly-messages-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iobyjrjwtzyrmszizebm.functions.supabase.co/weekly-messages',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
