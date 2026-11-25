BEGIN;
CREATE SCHEMA IF NOT EXISTS pawflow_bff;
CREATE TABLE IF NOT EXISTS pawflow_bff.sessions (
  id_hash text PRIMARY KEY CHECK (length(id_hash) = 64),
  generation uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('anonymous','authenticating','active','refreshing','revoked')),
  user_id text,
  backend_session_id uuid,
  tokens text,
  access_expires_at timestamptz,
  expires_at timestamptz NOT NULL,
  operation_id uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS bff_session_expiry ON pawflow_bff.sessions(expires_at);
CREATE INDEX IF NOT EXISTS bff_session_user ON pawflow_bff.sessions(user_id);
CREATE INDEX IF NOT EXISTS bff_session_backend ON pawflow_bff.sessions(backend_session_id);
COMMIT;
