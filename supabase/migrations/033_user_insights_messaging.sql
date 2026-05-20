-- 033: расширение user_insights — поля под персональную рассылку.
--   engagement_hook — короткая строка-«хук», что зацепит юзера (1 фраза)
--   draft_message   — готовый текст DM, который админ может одним кликом
--                     отправить через sendTracked

ALTER TABLE public.user_insights
  ADD COLUMN IF NOT EXISTS engagement_hook TEXT,
  ADD COLUMN IF NOT EXISTS draft_message   TEXT;

NOTIFY pgrst, 'reload schema';
