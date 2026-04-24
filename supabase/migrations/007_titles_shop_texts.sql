-- 007: Month-based titles, editable app texts, kiosk shop, promo codes, wheel prizes table
--
-- Shifts titles from points-thresholds to subscription-month tiers (1 = Адепт, 2 = Герой, …).
-- Adds editable registries for UI strings, title bonuses, shop items, promo codes, wheel prizes.

-- ─── titles: month-based title tiers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.titles (
  rank          TEXT PRIMARY KEY,             -- 'newcomer' | 'member' | 'active' | 'champion' | 'legend'
  month         INT  NOT NULL UNIQUE,         -- 1..5 (5 = Бог and above)
  label         TEXT NOT NULL,
  color         TEXT NOT NULL,
  tag_title     TEXT NOT NULL DEFAULT '',     -- custom_title used in TG group
  bonus_points  INT  NOT NULL DEFAULT 0,      -- фантики начисляются при переходе в титул
  perks         JSONB NOT NULL DEFAULT '[]'::jsonb, -- список строк-бонусов
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.titles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.titles TO anon, authenticated, service_role;

INSERT INTO public.titles (rank, month, label, color, tag_title, bonus_points, perks) VALUES
  ('newcomer', 1, 'Адепт',           '#8E8E93', 'Адепт',   0,  '[]'::jsonb),
  ('member',   2, 'Герой',           '#0A84FF', 'Герой',   10, '["Тег Герой в общем чате","+10 фантиков","Практикум: как сделать монтаж на миллион просмотров с помощью ИИ","Участие в розыгрыше консультации с Сергеем"]'::jsonb),
  ('active',   3, 'Чемпион Олимпа',  '#BF5AF2', 'Чемпион', 20, '["Тег Чемпион в общем чате","+20 фантиков","1 разбор Инстаграма от Сергея с рекомендациями"]'::jsonb),
  ('champion', 4, 'Полубог',         '#FF9500', 'Полубог', 30, '["Тег Полубог в общем чате","+30 фантиков","Личный практикум для Полубогов — как я дважды заработал больше 10 000 долларов в ИИ"]'::jsonb),
  ('legend',   5, 'Бог',             '#FF9F0A', 'Бог',     40, '["Тег Бог в общем чате","+40 фантиков","+1 общий созвон в неделю только для Богов"]'::jsonb)
ON CONFLICT (rank) DO NOTHING;

-- ─── app_texts: editable UI strings with {var} placeholders ─────────────────
CREATE TABLE IF NOT EXISTS public.app_texts (
  key         TEXT PRIMARY KEY,
  label       TEXT,            -- human-readable description for admin
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_texts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.app_texts TO anon, authenticated, service_role;

INSERT INTO public.app_texts (key, label, content) VALUES
  ('titul.headline',         'Заголовок вкладки Титул',               'Путь на Олимп'),
  ('titul.your_title_prefix','Префикс у текущего титула',             'твой титул · {title}'),
  ('titul.next_text',        'Текст "до следующего титула"',          'Следующий титул — {next_title}, через {months_left} мес.'),
  ('titul.top_text',         'Текст когда достигнут высший титул',    'Ты достиг высшего титула'),
  ('titul.howto_heading',    'Заголовок "Как получить фантики"',      'Как получить фантики'),
  ('titul.howto_items',      'Список (по строке) как получать фантики','+3 за реакцию на твоё сообщение\n+5 за участие в опросе\n+10 за каждое продление подписки\nКолесо — фантики выпадают случайно'),
  ('kiosk.headline',         'Заголовок вкладки Киоск',               'Киоск'),
  ('kiosk.subtitle',         'Подзаголовок киоска',                   'Трать фантики на бонусы клуба'),
  ('kiosk.balance',          'Подпись баланса',                       'У тебя {points} фантиков'),
  ('kiosk.sold_out',         'Текст "нет в наличии"',                 'Нет в наличии'),
  ('kiosk.buy',              'Надпись на кнопке покупки',             'Купить за {price}'),
  ('kiosk.insufficient',     'Недостаточно фантиков',                 'Не хватает {missing} фантиков'),
  ('kiosk.purchase_ok',      'Сообщение успешной покупки',            'Покупка оформлена. Промокод и детали придут в личку от бота.')
ON CONFLICT (key) DO NOTHING;

-- ─── shop_items: Kiosk products ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_items (
  key         TEXT PRIMARY KEY,
  sort        INT NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       INT NOT NULL,                    -- фантики
  kind        TEXT NOT NULL,                   -- 'promo_code' | 'wheel_spin' | 'info'
  emoji       TEXT DEFAULT '',
  image_url   TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.shop_items TO anon, authenticated, service_role;

INSERT INTO public.shop_items (key, sort, title, description, price, kind, emoji) VALUES
  ('discount_10',     10, 'Скидка 10% на продление',      '10% скидка на следующий месяц в Tribute',                         100, 'promo_code', '🎟️'),
  ('extra_spin',      20, 'Ещё одно кручение колеса',     'Добавляет +1 попытку в Колесо удачи',                             30,  'wheel_spin', '🎡'),
  ('promo_veoseebot', 30, 'Промокод VeoSeeBot 20%',       'Промокод на скидку 20% для VeoSeeBot',                            50,  'promo_code', '🤖'),
  ('consult_30',      40, 'Консультация с Сергеем 30 мин','Личная 30-минутная консультация с Сергеем. После оплаты Сергей сам свяжется с тобой.', 200, 'info', '🎯'),
  ('ig_review',       50, 'Разбор Instagram от Сергея',   'Личный разбор твоего Instagram с рекомендациями от Сергея.',      100, 'info', '📸'),
  ('detailed_q',      60, 'Подробный ответ от Сергея',    'Задай вопрос — получи подробный личный ответ от Сергея.',         75,  'info', '💬')
ON CONFLICT (key) DO NOTHING;

-- ─── promo_codes: admin-entered pool ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key       TEXT NOT NULL REFERENCES public.shop_items(key) ON DELETE CASCADE,
  code           TEXT NOT NULL,
  claimed_by     BIGINT,
  claimed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_item_unclaimed_idx
  ON public.promo_codes (item_key) WHERE claimed_by IS NULL;

ALTER TABLE public.promo_codes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.promo_codes TO anon, authenticated, service_role;

-- ─── shop_purchases: audit log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID,
  tg_id        BIGINT NOT NULL,
  item_key     TEXT NOT NULL,
  price_paid   INT NOT NULL,
  payload      JSONB,               -- {promo_code: '...'} or {spin_granted: true}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_purchases DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.shop_purchases TO anon, authenticated, service_role;

-- ─── wheel_prizes: editable wheel segments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wheel_prizes (
  key          TEXT PRIMARY KEY,
  sort         INT NOT NULL DEFAULT 0,
  label        TEXT NOT NULL,
  emoji        TEXT DEFAULT '',
  color        TEXT NOT NULL,
  color_deep   TEXT NOT NULL,
  prize        TEXT NOT NULL,
  explanation  TEXT NOT NULL DEFAULT '',
  leaves       INT,              -- null для нефантиковых призов
  weight       INT,              -- null = neverDrop
  never_drop   BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wheel_prizes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.wheel_prizes TO anon, authenticated, service_role;

INSERT INTO public.wheel_prizes (key, sort, label, emoji, color, color_deep, prize, explanation, leaves, weight, never_drop) VALUES
  ('leaves_10',   10, '10',     '',    '#0A84FF', '#0066CC', '10 фантиков',                  'Фантики, внутренняя валюта AI Олимпа.', 10, 45, FALSE),
  ('guide',       20, 'Гайд',   '📘',  '#BF5AF2', '#8E3BC9', 'Закрытый гайд',                'Закрытый авторский гайд по AI-инструментам.', NULL, NULL, TRUE),
  ('leaves_20',   30, '20',     '',    '#30D158', '#1FA544', '20 фантиков',                  'Фантики, внутренняя валюта AI Олимпа.', 20, 35, FALSE),
  ('secret',      40, 'Секрет', '🔒',  '#FF375F', '#C82747', 'Секретный контент',            'Доступ к закрытым материалам клуба.', NULL, NULL, TRUE),
  ('consult',     50, 'Консультация', '🎯', '#FF9500', '#CC7600', 'Консультация с Сергеем 30 мин', 'Личная 30-минутная консультация с Сергеем.', NULL, 1, FALSE),
  ('ig_review',   60, 'Инста',  '📸',  '#FF3B30', '#CC2E26', 'Разбор Instagram от Сергея',    'Разбор Instagram-профиля с рекомендациями от Сергея.', NULL, 1, FALSE),
  ('detailed_q',  70, 'Ответ',  '💬',  '#5E5CE6', '#3C3AB8', 'Подробный ответ от Сергея',     'Подробный личный ответ Сергея на твой вопрос.', NULL, 3, FALSE),
  ('leaves_15',   80, '15',     '',    '#40C8E0', '#2691A3', '15 фантиков',                  'Фантики, внутренняя валюта AI Олимпа.', 15, 15, FALSE),
  ('veoseebot',   90, 'VeoSee', '🎁',  '#FFD60A', '#CC9A00', 'Промокод VeoSeeBot',            'Эксклюзивный промокод от партнёров VeoSeeBot.', NULL, NULL, TRUE)
ON CONFLICT (key) DO NOTHING;

-- ─── Month-based title backfill ─────────────────────────────────────────────
-- Recompute every member's rank from subscription_count (1→newcomer, 2→member, …, 5+→legend).
UPDATE members SET rank = CASE
  WHEN COALESCE(subscription_count, 1) >= 5 THEN 'legend'
  WHEN subscription_count = 4 THEN 'champion'
  WHEN subscription_count = 3 THEN 'active'
  WHEN subscription_count = 2 THEN 'member'
  ELSE 'newcomer'
END
WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
