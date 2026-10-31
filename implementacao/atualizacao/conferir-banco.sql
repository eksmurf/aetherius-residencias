-- Executar pela equipe na base/schema usados pelo serviço, após confirmar o destino.
-- Consultas compatíveis com a migração 001. Não exibem nomes, perfis ou saldos.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema=current_schema() AND table_name LIKE 'aetherius_residence%'
  ORDER BY table_name, ordinal_position;
SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname=current_schema() AND tablename LIKE 'aetherius_residence%'
  ORDER BY tablename,indexname;
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname=current_schema() AND t.relname LIKE 'aetherius_residence%'
  ORDER BY t.relname,c.conname;
SELECT count(*) AS residences, count(*) FILTER (WHERE owner_profile_id IS NOT NULL) AS owned
  FROM aetherius_residences;
SELECT action,count(*) AS receipts FROM aetherius_residence_operations GROUP BY action ORDER BY action;
SELECT delivery_state,count(*) AS keys FROM aetherius_residence_keys GROUP BY delivery_state ORDER BY delivery_state;
SELECT count(*) AS profiles_with_multiple_houses FROM (
  SELECT owner_profile_id FROM aetherius_residences WHERE owner_profile_id IS NOT NULL
  GROUP BY owner_profile_id HAVING count(*)>1
) q;
SELECT count(*) AS duplicate_active_personal_keys FROM (
  SELECT residence_id,profile_id FROM aetherius_residence_keys WHERE delivery_state<>'revoked'
  GROUP BY residence_id,profile_id HAVING count(*)>1
) q;
SELECT count(*) AS owned_without_active_owner_key
  FROM aetherius_residences r WHERE r.owner_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM aetherius_residence_keys k WHERE k.residence_id=r.id
    AND k.profile_id=r.owner_profile_id AND k.account_id=r.owner_account_id AND k.delivery_state<>'revoked'
  );
SELECT count(*) AS owners_without_account_match FROM aetherius_residences r
  WHERE r.owner_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id=r.owner_account_id AND u.profile_id=r.owner_profile_id
  );
ROLLBACK;
