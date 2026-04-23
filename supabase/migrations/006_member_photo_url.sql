-- 006: Store Telegram photo_url on members for leaderboard avatars.
-- Captured from Mini App initData whenever a member opens the app.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
