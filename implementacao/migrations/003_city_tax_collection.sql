BEGIN;
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS tax_city_id varchar(64);
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS tax_city_revision integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS aetherius_residence_city_operations (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  profile_id integer NOT NULL CHECK (profile_id > 0),
  character_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action varchar(24) NOT NULL CHECK (action IN ('linkCity', 'collectTax')),
  payload_hash varchar(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, request_id)
);

-- A paid installment is immediately settled for the resident. This row tracks collection only.
CREATE TABLE IF NOT EXISTS aetherius_residence_tax_collections (
  payment_operation_id uuid PRIMARY KEY REFERENCES aetherius_residence_operations(id),
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  city_id varchar(64),
  amount integer NOT NULL CHECK (amount > 0),
  collected_operation_id uuid REFERENCES aetherius_residence_city_operations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aetherius_residence_tax_pending
  ON aetherius_residence_tax_collections(residence_id, created_at, payment_operation_id)
  WHERE collected_operation_id IS NULL;
COMMIT;
