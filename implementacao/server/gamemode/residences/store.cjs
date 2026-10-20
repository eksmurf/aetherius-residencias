'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { fail } = require('./errors.cjs');
const { validateCatalog } = require('./catalog.cjs');
const payloadHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// JSONB does not preserve object member order. Compare explicit values instead.
const referenceSignature = refs => JSON.stringify(refs.map(ref => [ref.desc, ref.kind, ref.partner ?? null])
  .sort((a, b) => a[0].localeCompare(b[0])));
function createStore({ db, currencies, maxPerProfile = 1 }) {
  async function transact(work) {
    const conn = await db.getConnection();
    let committing = false;
    try {
      await conn.beginTransaction();
      await conn.query("SET LOCAL lock_timeout='5s'");
      await conn.query("SET LOCAL statement_timeout='15s'");
      const result = await work(conn);
      committing = true;
      await conn.commit();
      return result;
    } catch (error) {
      try { await conn.rollback(); } catch { }
      if (committing) fail('UNKNOWN');
      throw error;
    } finally { conn.release(); }
  }
  async function authorize(conn, session) {
    const [rows] = await conn.query(`SELECT u.id FROM users u JOIN characters c ON c.user_id=u.id
      WHERE u.id=$1 AND u.profile_id=$2 AND u.is_banned IS FALSE
        AND c.id=$3 AND c.status='approved' FOR SHARE OF u,c`, [session.accountId, session.profileId, session.characterId]);
    if (rows.length !== 1) fail('SESSION');
  }
  async function installCatalog(raw) {
    const definitions = validateCatalog(raw);
    await transact(async conn => {
      await conn.query('SELECT pg_advisory_xact_lock(174622,0)');
      const [existing] = await conn.query('SELECT * FROM aetherius_residences ORDER BY id FOR UPDATE');
      for (const definition of definitions) {
        const previous = existing.find(row => row.id === definition.id);
        if (previous && previous.definition_hash !== definition.hash && definition.revision <= previous.revision) fail('PRICE_CHANGED');
        if (previous && referenceSignature(previous.definition.refs) !== referenceSignature(definition.refs)) {
          throw Error(`As referências de ${definition.id} são imutáveis; prepare uma migração específica.`);
        }
        await conn.query(`INSERT INTO aetherius_residences(id,definition,definition_hash,revision,for_sale)
          VALUES($1,$2::jsonb,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET definition=EXCLUDED.definition,
          definition_hash=EXCLUDED.definition_hash,revision=EXCLUDED.revision,for_sale=EXCLUDED.for_sale,updated_at=now()`,
        [definition.id, JSON.stringify(definition), definition.hash, definition.revision, definition.forSale]);
        for (const ref of definition.refs) {
          const [found] = await conn.query('SELECT residence_id,kind FROM aetherius_residence_refs WHERE descriptor=$1', [ref.desc]);
          if (found.length && (found[0].residence_id !== definition.id || found[0].kind !== ref.kind)) fail('CONFLICT');
          await conn.query('INSERT INTO aetherius_residence_refs(descriptor,residence_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [ref.desc, definition.id, ref.kind]);
        }
      }
      for (const row of existing) if (!definitions.some(d => d.id === row.id)) {
        await conn.query('UPDATE aetherius_residences SET for_sale=false WHERE id=$1', [row.id]);
      }
    });
  }
  const snapshot = () => db.query('SELECT * FROM aetherius_residences ORDER BY id');
  const keys = profileId => db.query("SELECT * FROM aetherius_residence_keys WHERE profile_id=$1 AND delivery_state <> 'revoked'", [profileId]);
  async function status(session, requestId) {
    return transact(async conn => {
      await authorize(conn, session);
      const [rows] = await conn.query('SELECT result FROM aetherius_residence_operations WHERE account_id=$1 AND profile_id=$2 AND request_id=$3', [session.accountId, session.profileId, requestId]);
      return rows[0]?.result || null;
    });
  }
  async function mutate(session, input, assertCurrent, assertKey, purchasesEnabled) {
    return transact(async conn => {
      await conn.query('SELECT pg_advisory_xact_lock(174623,$1)', [session.profileId]);
      await authorize(conn, session);
      const hash = payloadHash([input.action, input.residenceId, input.revision ?? null, input.currency ?? null, input.locked ?? null]);
      const [old] = await conn.query('SELECT profile_id,payload_hash,result FROM aetherius_residence_operations WHERE account_id=$1 AND request_id=$2', [session.accountId, input.requestId]);
      if (old.length) {
        if (old[0].profile_id !== session.profileId || old[0].payload_hash !== hash) fail('CONFLICT');
        return old[0].result;
      }
      const [rows] = await conn.query('SELECT * FROM aetherius_residences WHERE id=$1 FOR UPDATE', [input.residenceId]);
      const residence = rows[0];
      if (!residence) fail('NOT_FOUND');
      assertCurrent(residence);
      const operationId = randomUUID();
      let amount = null, walletId = null, key = null;
      if (input.action === 'purchase') {
        if (!purchasesEnabled) fail('UNAVAILABLE');
        if (residence.owner_profile_id !== null || !residence.for_sale) fail('SOLD');
        if (input.revision !== residence.revision) fail('PRICE_CHANGED');
        amount = residence.definition.prices[input.currency];
        if (!amount) fail('CURRENCY');
        if (!currencies.available(input.currency)) fail(input.currency === 'diademas' ? 'DIADEMAS_UNAVAILABLE' : 'CURRENCY');
        const [owned] = await conn.query('SELECT count(*) AS total FROM aetherius_residences WHERE owner_profile_id=$1', [session.profileId]);
        if (Number(owned[0].total) >= maxPerProfile) fail('LIMIT');
        walletId = await currencies.debit(conn, { ...session, currency: input.currency, amount, purchaseId: operationId });
        residence.owner_profile_id = session.profileId;
        residence.owner_account_id = session.accountId;
        residence.locked = true;
      } else {
        if (residence.owner_profile_id !== session.profileId || residence.owner_account_id !== session.accountId) fail('FORBIDDEN');
        if (input.action === 'lock') {
          const [current] = await conn.query("SELECT * FROM aetherius_residence_keys WHERE residence_id=$1 AND delivery_state <> 'revoked'", [residence.id]);
          if (current.length !== 1) fail('KEY');
          assertKey(current[0]);
          residence.locked = input.locked;
        } else if (input.action === 'reissue') {
          residence.generation += 1;
          residence.locked = true;
          await conn.query("UPDATE aetherius_residence_keys SET delivery_state='revoked' WHERE residence_id=$1", [residence.id]);
        } else fail('INVALID');
      }
      if (input.action !== 'lock') {
        key = { id: randomUUID(), residenceId: residence.id, generation: residence.generation };
        key.name = `Chave residencial [AR:${key.id}]`;
      }
      const result = { operationId, residenceId: residence.id, action: input.action, ownerProfileId: residence.owner_profile_id,
        locked: residence.locked, ...(amount ? { currency: input.currency, amount } : {}), ...(key ? { keyId: key.id, delivery: 'pending' } : {}) };
      await conn.query(`INSERT INTO aetherius_residence_operations
        (id,profile_id,account_id,character_id,request_id,action,residence_id,payload_hash,currency,amount,wallet_transaction_id,result)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [operationId,session.profileId,session.accountId,session.characterId,input.requestId,input.action,residence.id,hash,
        input.action === 'purchase' ? input.currency : null,amount,walletId,JSON.stringify(result)]);
      if (key) await conn.query(`INSERT INTO aetherius_residence_keys
        (id,residence_id,operation_id,profile_id,account_id,character_id,generation,item_name)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [key.id,residence.id,operationId,session.profileId,session.accountId,session.characterId,key.generation,key.name]);
      await conn.query(`UPDATE aetherius_residences SET owner_profile_id=$2,owner_account_id=$3,
        locked=$4,generation=$5,updated_at=now() WHERE id=$1`,
      [residence.id,residence.owner_profile_id,residence.owner_account_id,residence.locked,residence.generation]);
      assertCurrent(residence);
      return result;
    });
  }
  async function deliver(session, keyId, ensureItem) {
    return transact(async conn => {
      await conn.query('SELECT pg_advisory_xact_lock(174623,$1)', [session.profileId]);
      await authorize(conn, session);
      const [rows] = await conn.query(`SELECT k.* FROM aetherius_residence_keys k JOIN aetherius_residences r ON r.id=k.residence_id
        WHERE k.id=$1 AND k.profile_id=$2 AND k.account_id=$3 AND r.owner_profile_id=k.profile_id
          AND r.owner_account_id=k.account_id AND r.generation=k.generation AND k.delivery_state <> 'revoked' FOR UPDATE OF k,r`,
      [keyId,session.profileId,session.accountId]);
      const key = rows[0];
      if (!key || key.character_id !== session.characterId) fail('KEY');
      if (key.delivery_state === 'delivered') return 'delivered';
      ensureItem(key);
      await conn.query("UPDATE aetherius_residence_keys SET delivery_state='delivered',delivered_at=now() WHERE id=$1", [key.id]);
      return 'delivered';
    });
  }
  return { installCatalog, snapshot, keys, status, mutate, deliver };
}
module.exports = { createStore };
