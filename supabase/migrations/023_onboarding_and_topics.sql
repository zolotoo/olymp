-- 023: онбординг (анкета «Мой путь») + тематические ветки группы для Библиотеки.

-- ─── 1) message_thread_id для tg_messages ─────────────────────────────────────
-- Без этого нельзя понять, в какой ветке форума было сообщение, а значит
-- нельзя строить «Библиотека = посты из ветки Уроки/Гайды».
ALTER TABLE public.tg_messages
  ADD COLUMN IF NOT EXISTS message_thread_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_tg_messages_chat_thread_sent
  ON public.tg_messages(chat_id, message_thread_id, sent_at DESC);

-- ─── 2) tg_topics — справочник веток группы ───────────────────────────────────
-- Заполняется руками админом (миграция/SQL/админка). Один ряд на ветку форума.
-- kind — машинная категория, по ней мини-апп фильтрует Библиотеку.
CREATE TABLE IF NOT EXISTS public.tg_topics (
  chat_id    BIGINT NOT NULL,
  thread_id  BIGINT NOT NULL,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  emoji      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, thread_id)
);

ALTER TABLE public.tg_topics DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.tg_topics TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_tg_topics_kind_sort
  ON public.tg_topics(kind, sort_order);

-- ─── 3) onboarding_answers — анкета «Мой путь» ────────────────────────────────
-- Один ряд на участника. Поля могут быть NULL — заполняются по мере прохождения.
-- skills — массив строк (id умений) в JSONB.
-- recommended_paths — рассчитанный сервером top-3 направлений: [{kind, score}].
CREATE TABLE IF NOT EXISTS public.onboarding_answers (
  member_id          UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  tg_id              BIGINT NOT NULL UNIQUE,
  goal               TEXT,           -- 'sell' | 'build' | 'content' | 'explore' | 'vibecode' | 'custom'
  goal_custom        TEXT,           -- свободный текст, если goal='custom'
  level              TEXT,           -- 'starter' | 'user' | 'maker' | 'pro'
  skills             JSONB,          -- ['prompts','cursor','lovable',...] — зависит от goal
  hours_per_week     TEXT,           -- '<2' | '2-5' | '5-10' | '10+'
  has_business       TEXT,           -- 'yes' | 'no' | 'in_progress'
  dm_step1_at        TIMESTAMPTZ,    -- момент ответа на 1-й DM-вопрос (+5 фантиков)
  mini_app_done_at   TIMESTAMPTZ,    -- момент завершения полной анкеты (+10 фантиков)
  recommended_paths  JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_answers DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.onboarding_answers TO anon, authenticated, service_role;

-- ─── 4) members.onboarding_dm_state — промежуточное состояние DM-флоу ─────────
-- Используется когда юзер выбрал «✍️ Написать своё» — следующий текст в DM
-- мы интерпретируем как ответ на первый вопрос анкеты, а не как обычное
-- сообщение (без этого пришлось бы парсить «нечто похожее на ответ»).
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS onboarding_dm_state TEXT;

NOTIFY pgrst, 'reload schema';
