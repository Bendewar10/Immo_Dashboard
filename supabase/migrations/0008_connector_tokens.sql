CREATE TABLE connector_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

ALTER TABLE connector_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own connector tokens"
  ON connector_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own connector tokens"
  ON connector_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own connector tokens"
  ON connector_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own connector tokens"
  ON connector_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_connector_tokens_user_id ON connector_tokens(user_id);
CREATE INDEX idx_connector_tokens_user_provider ON connector_tokens(user_id, provider);
