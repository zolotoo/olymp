-- 025: library_items — кураторский слой над tg_messages.
--
-- Раньше /api/library читал tg_messages напрямую и применял фильтр top-level
-- + has_text + не-hidden на каждом запросе. Теперь над постами есть явный
-- статус: pending → published → rejected. Только published показывается
-- в мини-аппе. is_featured и title_override живут здесь же.
--
-- Зачем отдельная таблица, а не колонки в tg_messages:
--   - tg_messages = сырой mirror из webhook, его не должны мутировать админ-руки
--   - retract публикации = смена status, исходник не теряется
--   - на будущее: потенциально один и тот же tg-пост можно «вынуть» в
--     библиотеку несколько раз с разными заголовками

CREATE TABLE IF NOT EXISTS public.library_items (
  id             BIGSERIAL PRIMARY KEY,
  chat_id        BIGINT NOT NULL,
  message_id     BIGINT NOT NULL,
  thread_id      BIGINT,                       -- денорм. из tg_messages.message_thread_id
  kind           TEXT   NOT NULL,              -- денорм. из tg_topics.kind на момент создания
  status         TEXT   NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','published','rejected')),
  title_override TEXT,                         -- если первая строка плохой заголовок
  is_featured    BOOLEAN NOT NULL DEFAULT false,
  approved_by    BIGINT,                       -- tg_id админа, кто approve
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, message_id)
);
ALTER TABLE public.library_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE    public.library_items          TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.library_items_id_seq   TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_library_items_status_created
  ON public.library_items(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_items_kind_published
  ON public.library_items(kind, created_at DESC) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_library_items_featured
  ON public.library_items(created_at DESC) WHERE is_featured = true AND status = 'published';

-- Бэкфилл: создаём library_items для всех уже-загруженных tg-постов, которые
-- попадают в видимые топики и подходят под старый client-side фильтр
-- (top-level + текст + не-hidden). Все идут в status='pending' — пользователь
-- разбирает их через /library в админке.
INSERT INTO public.library_items (chat_id, message_id, thread_id, kind, status)
SELECT m.chat_id, m.message_id, m.message_thread_id, t.kind, 'pending'
FROM public.tg_messages m
JOIN public.tg_topics  t
  ON t.chat_id = m.chat_id
 AND ((t.thread_id = 0 AND m.message_thread_id IS NULL)
      OR (t.thread_id <> 0 AND m.message_thread_id = t.thread_id))
WHERE COALESCE(m.is_hidden, false) = false
  AND m.text IS NOT NULL
  AND t.is_visible = true
  AND (
    m.reply_to_message_id IS NULL
    OR (t.thread_id <> 0 AND m.reply_to_message_id = t.thread_id)
  )
ON CONFLICT (chat_id, message_id) DO NOTHING;

-- Аналитика кликов из мини-аппа: тап «Открыть в Telegram» на карточке.
-- Используется на /stats/library и для авто-предложения «поднять в Featured».
CREATE TABLE IF NOT EXISTS public.library_events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,                 -- 'click' | 'open_tab'
  chat_id      BIGINT,
  message_id   BIGINT,
  kind         TEXT,
  member_tg_id BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.library_events DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE    public.library_events            TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.library_events_id_seq     TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_library_events_created
  ON public.library_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_events_msg
  ON public.library_events(chat_id, message_id, created_at DESC);

-- Дайджесты: один ряд на неделю, ровно одно состояние:
--   draft     — собран автоматом cron-ом 12:00 вс, ждёт твоего ревью
--   sent      — отправлен (в канал и/или DM)
-- Если в воскресенье ты не нажал «Отправить» — ряд остаётся draft, неделя пропущена.
CREATE TABLE IF NOT EXISTS public.weekly_digests (
  week_start    DATE PRIMARY KEY,             -- понедельник недели в МСК
  intro_md      TEXT,                         -- редактируется вручную, override шаблона
  outro_md      TEXT,
  template_key  TEXT NOT NULL DEFAULT 'default',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent')),
  sent_to_channel BOOLEAN NOT NULL DEFAULT false,
  sent_to_dm      BOOLEAN NOT NULL DEFAULT false,
  sent_to_count   INT,                        -- сколько личных чатов получили
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_digests DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.weekly_digests TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
