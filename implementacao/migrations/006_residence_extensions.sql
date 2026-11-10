BEGIN;
-- 004 and 005 belong to door registration/IPTU3. Existing provenance stays unknown.
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS acquisition_history jsonb NOT NULL DEFAULT '{"status":"unknown"}';
-- Existing rows stay unknown. Only a newly created stable registry starts a new chain.
ALTER TABLE aetherius_residences ALTER COLUMN acquisition_history SET DEFAULT '{"status":"never","source":"created-after-006"}';
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS amenities jsonb;
CREATE TABLE IF NOT EXISTS aetherius_residence_sale_quotes (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, profile_id integer NOT NULL,
 character_id uuid NOT NULL, session_id uuid NOT NULL,
 residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
 access_revision integer NOT NULL, revision integer NOT NULL,
 base integer NOT NULL CHECK(base>0), amount integer NOT NULL CHECK(amount>0), tax jsonb NOT NULL,
 ready_at timestamptz, expires_at timestamptz NOT NULL, cancelled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aetherius_residence_extension_operations (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, profile_id integer NOT NULL, character_id uuid NOT NULL,
 request_id uuid NOT NULL, residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
 action text NOT NULL, payload_hash text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(account_id,request_id)
);
CREATE TABLE IF NOT EXISTS aetherius_residence_tours (
 id uuid PRIMARY KEY, account_id uuid NOT NULL, profile_id integer NOT NULL, character_id uuid NOT NULL,
 session_id uuid NOT NULL, residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
 revision integer NOT NULL, state text NOT NULL CHECK(state IN ('entering','active','returning','closed')),
 route jsonb NOT NULL, reason text, deadline timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS aetherius_residence_one_tour ON aetherius_residence_tours(account_id) WHERE state<>'closed';
COMMIT;
