-- 016: Кампании-рассылки. Каждая кампания → много message_deliveries
-- (одна на получателя). Когорты определяются audience_filter (JSONB).

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,                   -- внутреннее имя
  text            TEXT NOT NULL,                   -- HTML, поддерживаются плейсхолдеры {name}
  audience        TEXT NOT NULL,                   -- 'members_active' | 'members_churned' | 'bot_users_all' | 'bot_users_no_member' | 'custom'
  audience_filter JSONB,                           -- доп. фильтры (rank, days_since_seen, etc.)
  cta_url         TEXT,                            -- если есть CTA — обернётся в click_token
  cta_label       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sending' | 'sent' | 'failed'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  total_targeted  INT NOT NULL DEFAULT 0,
  total_delivered INT NOT NULL DEFAULT 0,
  total_failed    INT NOT NULL DEFAULT 0,
  created_by_tg   BIGINT
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at
  ON public.broadcasts(created_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.broadcasts;
CREATE POLICY service_role_all ON public.broadcasts FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.broadcasts TO service_role;

NOTIFY pgrst, 'reload schema';
