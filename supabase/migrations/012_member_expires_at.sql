-- 012: members.expires_at — дата окончания текущего оплаченного периода из Tribute.
-- Обновляется из webhook-ов new_subscription / renewed_subscription.
-- Используется для точного расчёта дней до следующего титула и до продления.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Бэкфилл из events_log: берём последнюю дату expires_at по каждому tg_id.
WITH latest_expires AS (
  SELECT DISTINCT ON (tg_id)
    tg_id,
    (metadata->>'expires_at')::timestamptz AS expires_at
  FROM public.events_log
  WHERE event_type IN ('tribute_new_subscription', 'tribute_renewed')
    AND metadata ? 'expires_at'
    AND metadata->>'expires_at' <> ''
  ORDER BY tg_id, created_at DESC
)
UPDATE public.members m
SET expires_at = le.expires_at
FROM latest_expires le
WHERE m.tg_id = le.tg_id
  AND m.expires_at IS NULL;

NOTIFY pgrst, 'reload schema';
