-- 015: Авторизация админ-панели через Telegram OTP.
-- Только пользователь с tg_id = ADMIN_TG_ID может войти. Код приходит ботом.

CREATE TABLE IF NOT EXISTS public.admin_login_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id        BIGINT NOT NULL,
  code_hash    TEXT NOT NULL,             -- sha256(code)
  attempts     INT NOT NULL DEFAULT 0,
  used         BOOLEAN NOT NULL DEFAULT false,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_login_codes_tg
  ON public.admin_login_codes(tg_id, created_at DESC);

ALTER TABLE public.admin_login_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.admin_login_codes;
CREATE POLICY service_role_all ON public.admin_login_codes FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.admin_login_codes TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash    TEXT PRIMARY KEY,         -- sha256(cookie_value)
  tg_id         BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent    TEXT,
  ip            TEXT,
  revoked       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_tg ON public.admin_sessions(tg_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON public.admin_sessions(expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.admin_sessions;
CREATE POLICY service_role_all ON public.admin_sessions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.admin_sessions TO service_role;

NOTIFY pgrst, 'reload schema';
