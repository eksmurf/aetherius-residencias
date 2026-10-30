BEGIN;
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS tax_due_at timestamptz;
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS tax_terms jsonb;
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS access_revision integer NOT NULL DEFAULT 1;
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS listing_price integer CHECK(listing_price > 0);
ALTER TABLE aetherius_residences ADD COLUMN IF NOT EXISTS seller_character_id uuid;
CREATE TABLE IF NOT EXISTS aetherius_residence_members (
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  profile_id integer NOT NULL CHECK (profile_id > 0),
  account_id uuid NOT NULL,
  character_id uuid NOT NULL,
  display_name varchar(255) NOT NULL,
  family boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(residence_id, profile_id)
);
CREATE INDEX IF NOT EXISTS aetherius_residence_members_account ON aetherius_residence_members(account_id,profile_id);
ALTER TABLE aetherius_residence_operations DROP CONSTRAINT IF EXISTS aetherius_residence_operations_action_check;
ALTER TABLE aetherius_residence_operations ADD CONSTRAINT aetherius_residence_operations_action_check
  CHECK(action IN ('purchase','lock','reissue','public','addMember','setFamily','removeMember','payTax','listSale','cancelSale'));
-- Historical reissue receipts remain immutable; the API no longer accepts that action.
DROP INDEX IF EXISTS aetherius_residence_current_key;
CREATE UNIQUE INDEX IF NOT EXISTS aetherius_residence_personal_key
  ON aetherius_residence_keys(residence_id,profile_id) WHERE delivery_state <> 'revoked';
ALTER TABLE aetherius_residence_keys DROP CONSTRAINT IF EXISTS aetherius_residence_keys_delivery_state_check;
ALTER TABLE aetherius_residence_keys ADD CONSTRAINT aetherius_residence_keys_delivery_state_check CHECK(delivery_state IN ('pending','delivered','bound','revoked'));
UPDATE aetherius_residence_keys SET delivery_state='bound' WHERE delivery_state IN ('pending','delivered');
CREATE TABLE IF NOT EXISTS aetherius_residence_tax_receipts (
  residence_id varchar(48) NOT NULL REFERENCES aetherius_residences(id),
  due_at timestamptz NOT NULL,
  operation_id uuid NOT NULL UNIQUE REFERENCES aetherius_residence_operations(id),
  PRIMARY KEY(residence_id,due_at)
);
COMMIT;
