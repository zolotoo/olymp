-- 021: pg_cron расписание для cron endpoint /api/cron/followups
-- Запускается каждые 5 минут. Endpoint сам идемпотентен (followup_sends),
-- так что повторный вызов безопасен.
--
-- ВАЖНО: перед применением задай две вещи:
--   1) В Supabase → Database → Vault или прямо здесь зашить URL Vercel'а
--      (замени <YOUR_VERCEL_HOST> ниже на твой реальный, например
--       'https://aiolymp.vercel.app').
--   2) Та же CRON_SECRET что в env Vercel — её нужно прокинуть в headers.
--      Замени <YOUR_CRON_SECRET> на значение секрета.
--
-- Откатить: SELECT cron.unschedule('followups-every-5min');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'followups-every-5min') THEN
    PERFORM cron.unschedule('followups-every-5min');
  END IF;
END$$;

SELECT cron.schedule(
  'followups-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://aiolymp.vercel.app/api/cron/followups',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <YOUR_CRON_SECRET>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
