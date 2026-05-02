-- 024: ручное скрытие постов из Библиотеки.
-- Закрепы (навигация, правила, шапки) почти всегда лежат вверху ветки и
-- без флага вечно «съедают» первую карточку. Bot API не присылает явный
-- маркер «is_pinned» вместе с сообщением — приходится скрывать руками.
-- Этот флаг также пригодится чтобы прятать оффтоп / устаревший контент.

ALTER TABLE public.tg_messages
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tg_messages_chat_thread_visible
  ON public.tg_messages(chat_id, message_thread_id, sent_at DESC)
  WHERE is_hidden = false;

NOTIFY pgrst, 'reload schema';
