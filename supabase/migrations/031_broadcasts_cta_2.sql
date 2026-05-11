-- 031: Вторая CTA-кнопка в рассылке.
-- Для библиотечных уведомлений: «Открыть в приложении» (мини-апп) +
-- «Открыть в чате» (t.me/c/<chat>/<msg>). Раньше cta вшивалась ссылкой
-- в текст; теперь две inline-кнопки.

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS cta_url_2   TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_2 TEXT;

NOTIFY pgrst, 'reload schema';
