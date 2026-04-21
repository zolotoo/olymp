-- Wheel spins: 1 per tg_id per calendar month
CREATE TABLE wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_id BIGINT NOT NULL,
  month TEXT NOT NULL,  -- format: YYYY-MM
  prize_leaves INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tg_id, month)
);

CREATE INDEX idx_wheel_spins_tg_id ON wheel_spins(tg_id);

-- Bot messages log: every message the bot sends, with reason and recipient
CREATE TABLE messages_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_id BIGINT,
  chat_id BIGINT NOT NULL,
  tg_username TEXT,
  tg_first_name TEXT,
  message_text TEXT NOT NULL,
  reason TEXT NOT NULL,  -- e.g. 'welcome', 'rank_up', 'weekly_bonus', 'test'
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_log_tg_id ON messages_log(tg_id);
CREATE INDEX idx_messages_log_sent_at ON messages_log(sent_at DESC);

ALTER TABLE wheel_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON wheel_spins FOR ALL USING (true);
CREATE POLICY "service_role_all" ON messages_log FOR ALL USING (true);
