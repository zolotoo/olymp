-- Inline-кнопки для сообщений из дерева (/flow).
-- Шейп: [{ "label": "Оплатить", "url": "https://tribute.tg/..." }, ...]
-- При отправке URL автоматически оборачивается через click_tokens, чтобы
-- видеть кто кликнул кнопку, но не дошёл до целевого действия (оплата и т.п.).

ALTER TABLE public.bot_messages
  ADD COLUMN IF NOT EXISTS buttons JSONB;

NOTIFY pgrst, 'reload schema';
