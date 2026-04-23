-- 005: Credit-based wheel + subscription tracking on members
--
-- Wheel moves from monthly calendar lock to a credit counter:
--   * +1 credit ~7 days after joining (once per subscription cycle)
--   * +1 credit on each Tribute renewal (starting from the 2nd payment)
-- `first_week_spin_granted` guards the 7-day trigger.
-- `subscription_count` tracks total Tribute payments for this member.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS spins_available        INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_count     INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_week_spin_granted BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: every currently-active member has at least 1 payment.
UPDATE members
SET subscription_count = 1
WHERE status = 'active' AND subscription_count = 0;

-- Backfill: active members older than 7 days who already spun at least once
-- are treated as "first-week spin already granted" (historical spin counts).
UPDATE members m
SET first_week_spin_granted = TRUE
WHERE status = 'active'
  AND joined_at < NOW() - INTERVAL '7 days'
  AND EXISTS (SELECT 1 FROM wheel_spins ws WHERE ws.tg_id = m.tg_id);

-- Backfill: active members older than 7 days who never spun get their missed
-- welcome spin now (one-time goodwill as we switch mechanics).
UPDATE members
SET spins_available = spins_available + 1,
    first_week_spin_granted = TRUE
WHERE status = 'active'
  AND joined_at < NOW() - INTERVAL '7 days'
  AND NOT first_week_spin_granted;
