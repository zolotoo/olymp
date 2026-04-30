-- Backfill для members.tg_first_name / tg_username / tg_last_name из bot_users
-- для тех записей, что были созданы из Tribute webhook без имён.
-- Безопасный — обновляет только NULL-поля.

UPDATE public.members m
SET
  tg_username   = COALESCE(m.tg_username,   bu.tg_username),
  tg_first_name = COALESCE(m.tg_first_name, bu.tg_first_name),
  tg_last_name  = COALESCE(m.tg_last_name,  bu.tg_last_name)
FROM public.bot_users bu
WHERE bu.tg_id = m.tg_id
  AND (
    (m.tg_username IS NULL AND bu.tg_username IS NOT NULL) OR
    (m.tg_first_name IS NULL AND bu.tg_first_name IS NOT NULL) OR
    (m.tg_last_name IS NULL AND bu.tg_last_name IS NOT NULL)
  );
