BEGIN;
-- Preserve only a logout fence for an anonymous request racing with login.
ALTER TABLE pawflow_bff.sessions ADD COLUMN IF NOT EXISTS previous_id_hash text;
ALTER TABLE pawflow_bff.sessions ADD COLUMN IF NOT EXISTS previous_generation uuid;
CREATE UNIQUE INDEX IF NOT EXISTS bff_session_previous ON pawflow_bff.sessions(previous_id_hash);
COMMIT;
