BEGIN;
CREATE TABLE IF NOT EXISTS aetherius_residences (
  id varchar(48) PRIMARY KEY,
  definition jsonb NOT NULL,
  definition_hash char(64) NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  for_sale boolean NOT NULL DEFAULT false,
  owner_profile_id integer CHECK (owner_profile_id > 0),
  owner_account_id uuid,
  locked boolean NOT NULL DEFAULT true,
  generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_profile_id IS NULL) = (owner_account_id IS NULL))
);
CREATE TABLE IF NOT EXISTS aetherius_residence_refs (
  descriptor text PRIMARY KEY,
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  kind varchar(12) NOT NULL CHECK (kind IN ('entry','exit','container'))
);
CREATE INDEX IF NOT EXISTS aetherius_residences_owner ON aetherius_residences(owner_profile_id);
CREATE TABLE IF NOT EXISTS aetherius_residence_operations (
  id uuid PRIMARY KEY,
  profile_id integer NOT NULL CHECK (profile_id > 0),
  account_id uuid NOT NULL,
  character_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action varchar(16) NOT NULL CHECK (action IN ('purchase','lock','reissue')),
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  payload_hash char(64) NOT NULL,
  currency varchar(12) CHECK (currency IN ('septims','diademas')),
  amount integer CHECK (amount > 0),
  wallet_transaction_id varchar(160),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, request_id)
);
CREATE TABLE IF NOT EXISTS aetherius_residence_keys (
  id uuid PRIMARY KEY,
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  operation_id uuid NOT NULL UNIQUE REFERENCES aetherius_residence_operations(id),
  profile_id integer NOT NULL CHECK (profile_id > 0),
  account_id uuid NOT NULL,
  character_id uuid NOT NULL,
  generation integer NOT NULL CHECK (generation > 0),
  item_name varchar(120) NOT NULL UNIQUE,
  delivery_state varchar(16) NOT NULL DEFAULT 'pending' CHECK (delivery_state IN ('pending','delivered','revoked')),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS aetherius_residence_current_key
  ON aetherius_residence_keys(residence_id) WHERE delivery_state <> 'revoked';
COMMENT ON TABLE aetherius_residence_operations IS 'Immutable receipts of committed residence operations; debit and ownership use the same transaction.';
COMMIT;
