-- 020: догоны (follow-up) для продающих сообщений.
--
-- Идемпотентность отправки: одна запись = (юзер, ключ-догон).
-- Edge Function followup-messages смотрит: какие догоны для каких parent
-- сообщений уже наступили (по времени), фильтрует тех кто оплатил/ответил
-- и кто уже получил этот догон, и шлёт остальное.
--
-- Сами догоны — это записи в bot_messages с ключами вида
--   l_sales_fu_click_15m, l_sales_fu_noclick_24h, ...
-- (текст и кнопки редактируются в /flow). Метаданные (parent_key, trigger,
-- delay_minutes) известны Edge Function из захардкоженного списка
-- — синхронизировано с TREE в src/components/TreeClient.tsx.

CREATE TABLE IF NOT EXISTS public.followup_sends (
  tg_id         BIGINT NOT NULL,
  followup_key  TEXT   NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id    BIGINT,
  PRIMARY KEY (tg_id, followup_key)
);

ALTER TABLE public.followup_sends DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.followup_sends TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS followup_sends_tgid_idx ON public.followup_sends (tg_id);

NOTIFY pgrst, 'reload schema';
