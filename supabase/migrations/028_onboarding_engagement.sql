-- 028: онбординг-движок второй фазы.
--
-- Что меняем:
--   1) Колесо удачи открывается сразу при approve (раньше было +7 дней).
--      Webhook сам ставит spins_available=1, first_week_spin_granted=true.
--      Лежавший в /api/wheel/route.ts ленивый грант оставляем как safety net,
--      но условие 7 дней дропнуто — он начнёт отдавать сразу.
--
--   2) DM-вопрос про цель теперь приходит через 1 час после approve, не сразу
--      (раньше webhook слал немедленно). Хранится в onboarding_answers.dm1_due_at.
--      Cron /api/cron/onboarding-reminders выбирает задачи и шлёт.
--
--   3) Три новых напоминалки (cron):
--      - onb_wheel_3h    : через 3ч после approve, если ни разу не крутил колесо
--      - onb_dm1_24h     : через 24ч, если не ответил на DM-вопрос про цель
--      - onb_full_72h    : через 72ч после ответа на DM, если не добил мини-аппу
--
--   4) Анкета в мини-аппе свернулась с 4 шагов до 1 экрана (новые поля ниже).
--      Поля level/skills/hours_per_week/has_business сохраняем как nullable —
--      старые ответы остаются валидными, новых не собираем (кроме level).
--
--   5) Notify Сергею на новую оплату (tribute) — отдельный шаблон для редактуры
--      через /flow.
--
-- Идемпотентность всех напоминалок — таблица onboarding_reminders с PK
-- (tg_id, reminder_key). Один и тот же reminder отсылается ровно один раз.
--
-- Существующих участников (joined_at до cutoff) не трогаем по требованию.
-- Cutoff пишется в bot_settings.onboarding_engagement_cutoff_at = now()
-- в этой миграции. Cron сравнивает joined_at > cutoff.

-- ─── 1) onboarding_reminders — учёт отправленных напоминалок ─────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_reminders (
  tg_id        BIGINT NOT NULL,
  reminder_key TEXT   NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id   BIGINT,
  PRIMARY KEY (tg_id, reminder_key)
);

-- Доступ строго через service_role (cron-endpoint). Из клиента на anon/auth
-- ключах эта таблица недоступна — она техническая, для idempotency.
ALTER TABLE public.onboarding_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.onboarding_reminders;
CREATE POLICY service_role_all ON public.onboarding_reminders FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.onboarding_reminders TO service_role;

CREATE INDEX IF NOT EXISTS idx_onboarding_reminders_key_sent
  ON public.onboarding_reminders(reminder_key, sent_at DESC);

-- ─── 2) Новые колонки в onboarding_answers ───────────────────────────────────
-- motivation       : "Почему вступил? Что зацепило?" (textarea, обяз)
-- looking_for      : массив id чипов "Что хочешь забрать из клуба?" (>=1, обяз)
-- looking_for_text : опциональная свободная приписка к чипам
-- working_on       : "Над чем работаешь сейчас?" (textarea, опц)
-- dm1_due_at       : когда cron должен отправить DM-вопрос про цель.
--                    Заполняется webhook'ом на approve (joined_at + 1h).
ALTER TABLE public.onboarding_answers
  ADD COLUMN IF NOT EXISTS motivation        TEXT,
  ADD COLUMN IF NOT EXISTS looking_for       JSONB,
  ADD COLUMN IF NOT EXISTS looking_for_text  TEXT,
  ADD COLUMN IF NOT EXISTS working_on        TEXT,
  ADD COLUMN IF NOT EXISTS dm1_due_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_onboarding_answers_dm1_due
  ON public.onboarding_answers(dm1_due_at)
  WHERE dm_step1_at IS NULL AND dm1_due_at IS NOT NULL;

-- ─── 3) bot_settings: cutoff и killswitch ────────────────────────────────────
INSERT INTO public.bot_settings (key, value) VALUES
  ('onboarding_engagement_cutoff_at', to_jsonb(now())),
  ('onboarding_reminders_enabled',    'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── 4) bot_messages: дефолты для редактуры через /flow ─────────────────────
-- Кнопки описаны в JSONB `buttons` для тех ключей, где они URL-типа.
-- Для l_dm_q1 / onb_dm1_24h кнопки фиксированные (callback к dmGoalKeyboard),
-- ставятся хардкодом в коде, не из БД.

INSERT INTO public.bot_messages (key, label, type, content, buttons, enabled) VALUES
  (
    'l_dm_q1',
    'Онбординг · Шаг 1 · DM-вопрос про цель',
    'message',
    E'🧭 <b>Первый вопрос для твоей карты пути</b>\n\n' ||
    E'Что ты хочешь от <b>AI Олимп</b> в первую очередь?\n\n' ||
    E'Выбери вариант ниже и сразу получишь +5 фантиков. Дальше в Мини-аппе разберём подробнее.',
    NULL,
    true
  ),
  (
    'l_dm_q1_ack',
    'Онбординг · Ответ на выбор цели',
    'message',
    E'✅ <b>+5 фантиков</b> за первый шаг!\n\n' ||
    E'Цель: <b>{label}</b>\n\n' ||
    E'🎰 Колесо удачи у тебя уже открыто, можно крутить прямо сейчас. ' ||
    E'Жми кнопку «AI Олимп» внизу слева, рядом с полем ввода. ' ||
    E'В мини-аппе вкладка «Колесо».\n\n' ||
    E'А после колеса там же в «Профиле» можно добить анкету. ' ||
    E'4 коротких поля, ещё +10 фантиков, бонусная крутка и подскажем, куда лучше идти в клубе.',
    NULL,
    true
  ),
  (
    'l_dm_q1_custom_ack',
    'Онбординг · Ответ на «свой вариант»',
    'message',
    E'✅ <b>+5 фантиков</b>! Записал: «{custom}»\n\n' ||
    E'🎰 Колесо удачи у тебя уже открыто, можно крутить прямо сейчас. ' ||
    E'Жми кнопку «AI Олимп» внизу слева, рядом с полем ввода. ' ||
    E'В мини-аппе вкладка «Колесо».\n\n' ||
    E'А после колеса там же в «Профиле» можно добить анкету. ' ||
    E'4 коротких поля, ещё +10 фантиков и подскажем, куда лучше идти в клубе.',
    NULL,
    true
  ),
  (
    'l_onb_thanks',
    'Онбординг · Поздравление после анкеты',
    'message',
    E'🎉 <b>Анкета пройдена, +10 фантиков твои!</b>\n\n' ||
    E'И открыли бонусную попытку Колеса удачи.\n\n' ||
    E'Сергей увидит твои ответы и подскажет, куда лучше идти в клубе.',
    NULL,
    true
  ),
  (
    'onb_wheel_3h',
    'Напоминание · через 3ч, не крутил колесо',
    'message',
    E'{name}, у тебя уже есть бесплатная попытка Колеса удачи.\n\n' ||
    E'Можно выиграть фантики, промокоды или личную консультацию с Сергеем.\n\n' ||
    E'Чтобы крутить:\n\n' ||
    E'1. Жми кнопку «AI Олимп» внизу слева, рядом с полем ввода\n' ||
    E'2. В мини-аппе выбери вкладку «Колесо»\n' ||
    E'3. Жми «Крутить»\n\n' ||
    E'Кстати, ты теперь в клубе. Если что-то непонятно или хочется обсудить, пиши в общий чат или прямо Сергею в личку: @sergeyzolotykh.',
    '[{"label":"🎰 Открыть AI Олимп","url":"{mini_app_url}"}]'::jsonb,
    true
  ),
  (
    'onb_dm1_24h',
    'Напоминание · через 24ч, не выбрал цель',
    'message',
    E'Привет, {name}!\n\n' ||
    E'Вчера ты вступил в AI Олимп, рад тебя тут видеть.\n\n' ||
    E'Заметил, что не ответил на первый вопрос про направление. Это один тап, плюс 5 фантиков и сразу подскажем, куда лучше идти в клубе.\n\n' ||
    E'Выбери что тебе ближе:',
    NULL,
    true
  ),
  (
    'onb_full_72h',
    'Напоминание · через 3 дня, не добил анкету',
    'message',
    E'Прошло 3 дня, как ты вступил в клуб AI Олимп, ценим!\n\n' ||
    E'И команде с Сергеем важно понять: чем ты занимаешься и что ищешь.\n\n' ||
    E'Это поможет сделать максимально эффективным твоё пребывание в клубе. За ответы дадим плюс 10 фантиков, Колесо удачи и подскажем, куда лучше идти в клубе.\n\n' ||
    E'Жми кнопку ниже или «AI Олимп» внизу слева, рядом с полем ввода. Раздел «Профиль», блок «Мой путь».',
    '[{"label":"🚀 Открыть AI Олимп","url":"{mini_app_url}"}]'::jsonb,
    true
  ),
  (
    'admin_paid_notify',
    'Сергею · уведомление о новой оплате',
    'message',
    E'💸 <b>Новая оплата</b>\n\n' ||
    E'<b>{name}</b> ({handle}), оформил подписку на {period}.\n\n' ||
    E'<b>Напиши ему лично сейчас.</b> Личное приветствие в первый день удерживает в 2-3 раза лучше любого бота.',
    '[{"label":"💬 Написать в DM","url":"{user_link}"}]'::jsonb,
    true
  )
ON CONFLICT (key) DO NOTHING;

-- ─── 5) pg_cron schedule ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onboarding-reminders-15min') THEN
    PERFORM cron.unschedule('onboarding-reminders-15min');
  END IF;
END$$;

-- Каждые 15 минут — компромисс между точностью delay (3ч / 24ч / 72ч) и нагрузкой.
-- Endpoint идемпотентен (onboarding_reminders PK), повторный вызов безопасен.
SELECT cron.schedule(
  'onboarding-reminders-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://aiolymp.vercel.app/api/cron/onboarding-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <YOUR_CRON_SECRET>',
      'Content-Type', 'application/json'
    )
  );
  $$
);

NOTIFY pgrst, 'reload schema';
