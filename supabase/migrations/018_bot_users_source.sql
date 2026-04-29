-- Track which deep-link funnel brought the user.
-- ?start=hochy → ХОЧУ, ?start=promts → ПРОМТЫ, ?start=claude → КЛОД,
-- bare /start or ?start=main → main (the default flow that already exists).
ALTER TABLE public.bot_users
  ADD COLUMN IF NOT EXISTS source         TEXT  NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS source_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bot_users_source ON public.bot_users(source);

-- Seed three sales-pitch variants from the existing main one (if it's been
-- edited in the admin already). If l_sales has no DB row yet, the webhook
-- falls back to its hardcoded default for every variant — admin can then
-- edit each independently in /flow.
INSERT INTO public.bot_messages (key, label, type, content, video_url)
SELECT 'l_sales_hochy', 'Продающее · ХОЧУ', type, content, video_url
FROM public.bot_messages WHERE key = 'l_sales'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.bot_messages (key, label, type, content, video_url)
SELECT 'l_sales_promts', 'Продающее · ПРОМТЫ', type, content, video_url
FROM public.bot_messages WHERE key = 'l_sales'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.bot_messages (key, label, type, content, video_url)
SELECT 'l_sales_claude', 'Продающее · КЛОД', type, content, video_url
FROM public.bot_messages WHERE key = 'l_sales'
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
