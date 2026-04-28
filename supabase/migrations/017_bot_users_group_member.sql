-- Track group (AI Олимп / Ветки) membership alongside channel membership.
-- Filled by webhook chat_member updates and by the one-shot backfill route.
ALTER TABLE public.bot_users
  ADD COLUMN IF NOT EXISTS is_group_member BOOLEAN,
  ADD COLUMN IF NOT EXISTS group_member_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bot_users_group_member ON public.bot_users(is_group_member);

NOTIFY pgrst, 'reload schema';
