-- AI Olymp Club — Initial Schema

-- Members table
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_id BIGINT UNIQUE NOT NULL,
  tg_username TEXT,
  tg_first_name TEXT,
  tg_last_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'churned')),
  rank TEXT DEFAULT 'newcomer' CHECK (rank IN ('newcomer', 'member', 'active', 'champion', 'legend')),
  points INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly activity per chat
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  tg_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  message_count INTEGER DEFAULT 0,
  week_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tg_id, chat_id, week_start)
);

-- Triggered events log
CREATE TABLE events_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  tg_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Points history
CREATE TABLE points_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  tg_id BIGINT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_members_tg_id ON members(tg_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_activity_tg_id_week ON activity_log(tg_id, week_start);
CREATE INDEX idx_events_tg_id_type ON events_log(tg_id, event_type);
CREATE INDEX idx_points_tg_id ON points_log(tg_id);

-- Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by bot)
CREATE POLICY "service_role_all" ON members FOR ALL USING (true);
CREATE POLICY "service_role_all" ON activity_log FOR ALL USING (true);
CREATE POLICY "service_role_all" ON events_log FOR ALL USING (true);
CREATE POLICY "service_role_all" ON points_log FOR ALL USING (true);
