-- 014: Детальный лог входящих сообщений, реакций и исходящих доставок.
-- Цель: для каждого tg_id видеть полный таймлайн — что писал, какие реакции
-- ставил, что получал от бота, когда. Нужно для когортного анализа.

-- ─── tg_messages ──────────────────────────────────────────────────────────────
-- Таблица уже используется в webhook (для атрибуции реакций). Досоздаём
-- официально и расширяем — теперь храним полный текст и время.
CREATE TABLE IF NOT EXISTS public.tg_messages (
  message_id   BIGINT NOT NULL,
  chat_id      BIGINT NOT NULL,
  author_tg_id BIGINT NOT NULL,
  PRIMARY KEY (message_id, chat_id)
);

ALTER TABLE public.tg_messages
  ADD COLUMN IF NOT EXISTS text       TEXT,
  ADD COLUMN IF NOT EXISTS chat_type  TEXT,                       -- private/group/supergroup/channel
  ADD COLUMN IF NOT EXISTS chat_title TEXT,
  ADD COLUMN IF NOT EXISTS reply_to_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS has_media  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_kind TEXT,                       -- photo/video/voice/document/sticker/video_note/audio
  ADD COLUMN IF NOT EXISTS sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tg_messages_author_sent
  ON public.tg_messages(author_tg_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_messages_chat_sent
  ON public.tg_messages(chat_id, sent_at DESC);

ALTER TABLE public.tg_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.tg_messages;
CREATE POLICY service_role_all ON public.tg_messages FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.tg_messages TO service_role;

-- ─── reactions_log ────────────────────────────────────────────────────────────
-- Каждый факт постановки/снятия реакции. reactor_tg_id — кто поставил,
-- author_tg_id — автор сообщения (если удалось атрибутировать).
CREATE TABLE IF NOT EXISTS public.reactions_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      BIGINT NOT NULL,
  chat_id         BIGINT NOT NULL,
  reactor_tg_id   BIGINT NOT NULL,
  author_tg_id    BIGINT,
  emoji           TEXT,                 -- 👍, ❤, 🔥, etc. либо custom_emoji_id
  emoji_type      TEXT,                 -- 'emoji' | 'custom_emoji' | 'paid'
  action          TEXT NOT NULL,        -- 'added' | 'removed'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reactions_log_reactor
  ON public.reactions_log(reactor_tg_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_log_author
  ON public.reactions_log(author_tg_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_log_msg
  ON public.reactions_log(message_id, chat_id);

ALTER TABLE public.reactions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.reactions_log;
CREATE POLICY service_role_all ON public.reactions_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.reactions_log TO service_role;

-- ─── message_deliveries ───────────────────────────────────────────────────────
-- Исходящие сообщения бота конкретному пользователю. Заполняется обёрткой
-- вокруг sendMessage/sendPhoto (чтобы не терять атрибуцию рассылок и
-- персонализированных CTA). Для рассылок поле broadcast_id связывает
-- доставки с кампанией (таблица `broadcasts` появится в миграции 015).
CREATE TABLE IF NOT EXISTS public.message_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id           BIGINT NOT NULL,               -- получатель
  chat_id         BIGINT,                        -- куда отправили (обычно = tg_id)
  tg_message_id   BIGINT,                        -- message_id из ответа Telegram (для дедупа, edit)
  campaign        TEXT,                          -- 'welcome' | 'broadcast:<id>' | 'renewal' | etc.
  template_key    TEXT,                          -- ключ из bot_messages, если использовался
  broadcast_id    UUID,                          -- FK на broadcasts (мягкий, таблица в 015)
  text            TEXT,
  has_media       BOOLEAN NOT NULL DEFAULT false,
  delivered       BOOLEAN NOT NULL DEFAULT true,
  error_text      TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  engaged_at      TIMESTAMPTZ,                   -- прокси «прочитано»: клик/реакция/ответ
  engagement_kind TEXT                           -- 'reply' | 'reaction' | 'click' | 'callback'
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_tg
  ON public.message_deliveries(tg_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_campaign
  ON public.message_deliveries(campaign, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_broadcast
  ON public.message_deliveries(broadcast_id);

ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.message_deliveries;
CREATE POLICY service_role_all ON public.message_deliveries FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.message_deliveries TO service_role;

NOTIFY pgrst, 'reload schema';
