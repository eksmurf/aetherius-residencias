'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { fail, integer, uuid } = require('./errors.cjs');

const CITY_CONTRACT = 'aetherius-residence-city-taxes-v1';
const cityIdValid = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
const residenceIdValid = value => typeof value === 'string' && /^[a-z0-9_-]{1,48}$/.test(value);

function cityRequest(action, payload) {
  const fields = action === 'linkCity'
    ? ['requestId', 'residenceId', 'cityId', 'bindingRevision']
    : action === 'inspectResidence' ? ['residenceId'] : null;
  if (!fields || !payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(key => !fields.includes(key)) || !residenceIdValid(payload.residenceId)) fail('INVALID');
  if (action === 'linkCity' && (!uuid(payload.requestId) || !integer(payload.bindingRevision, 0) ||
      (payload.cityId !== null && !cityIdValid(payload.cityId)))) fail('INVALID');
  return { ...payload, action };
}

function createCityTaxes({ transact, authorize, cities }) {
  if (cities && (cities.contract !== CITY_CONTRACT ||
      typeof cities.authorizeInTransaction !== 'function' ||
      typeof cities.creditInTransaction !== 'function')) throw Error('Contrato municipal incompatível.');

  async function permit(conn, session, permission, residence, toCityId = null) {
    if (!cities) fail('CITY_UNAVAILABLE');
    const allowed = await cities.authorizeInTransaction(conn, {
      session, permission, residenceId: residence.id,
      cityId: residence.tax_city_id, toCityId,
    });
    if (allowed !== true) fail('FORBIDDEN');
  }

  async function residenceForUpdate(conn, residenceId) {
    const [rows] = await conn.query('SELECT * FROM aetherius_residences WHERE id=$1 FOR UPDATE', [residenceId]);
    if (!rows.length) fail('NOT_FOUND');
    return rows[0];
  }

  async function operation(session, input, guard, work) {
    if (!cities) fail('CITY_UNAVAILABLE');
    return transact(async conn => {
      await conn.query('SELECT pg_advisory_xact_lock(174623,$1)', [session.profileId]);
      await authorize(conn, session);
      const hash = createHash('sha256').update(JSON.stringify(
        Object.keys(input).filter(key => key !== 'requestId').sort().map(key => [key, input[key]])
      )).digest('hex');
      const [previous] = await conn.query(
        'SELECT * FROM aetherius_residence_city_operations WHERE account_id=$1 AND request_id=$2',
        [session.accountId, input.requestId]
      );
      if (previous.length) {
        if (previous[0].profile_id !== session.profileId || previous[0].payload_hash !== hash) fail('CONFLICT');
        return previous[0].result;
      }
      const residence = await residenceForUpdate(conn, input.residenceId);
      guard(residence);
      const operationId = randomUUID();
      const result = await work(conn, residence, operationId);
      await conn.query(`INSERT INTO aetherius_residence_city_operations
        (id,account_id,profile_id,character_id,request_id,action,payload_hash,result)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [operationId, session.accountId, session.profileId, session.characterId,
        input.requestId, input.action, hash, JSON.stringify(result)]);
      // The operation must exist before collected rows reference its receipt.
      if (result.paymentIds?.length) {
        await conn.query(`UPDATE aetherius_residence_tax_collections SET collected_operation_id=$1
          WHERE payment_operation_id=ANY($2::uuid[]) AND collected_operation_id IS NULL`,
        [operationId, result.paymentIds]);
      }
      guard(residence);
      return result;
    });
  }

  async function recordPayment(conn, residence, operationId, amount) {
    await conn.query(`INSERT INTO aetherius_residence_tax_collections
      (payment_operation_id,residence_id,city_id,amount) VALUES($1,$2,$3,$4)`,
    [operationId, residence.id, residence.tax_city_id || null, amount]);
  }

  async function link(session, input, guard) {
    input = cityRequest('linkCity', input);
    return operation(session, input, guard, async (conn, residence, operationId) => {
      // The city backend must authorize the source, target and jurisdiction of an unbound house.
      await permit(conn, session, 'residence.linkCity', residence, input.cityId);
      if (input.bindingRevision !== residence.tax_city_revision) fail('CITY_CHANGED');
      if (residence.tax_city_id !== input.cityId) {
        const [pending] = await conn.query(`SELECT 1 FROM aetherius_residence_tax_collections
          WHERE residence_id=$1 AND city_id IS NOT NULL AND collected_operation_id IS NULL LIMIT 1`, [residence.id]);
        if (pending.length) fail('CITY_PENDING');
      }
      const revision = residence.tax_city_revision + 1;
      await conn.query(`UPDATE aetherius_residences SET tax_city_id=$2,tax_city_revision=$3,updated_at=now()
        WHERE id=$1`, [residence.id, input.cityId, revision]);
      if (input.cityId !== null) {
        await conn.query(`UPDATE aetherius_residence_tax_collections SET city_id=$2
          WHERE residence_id=$1 AND city_id IS NULL AND collected_operation_id IS NULL`, [residence.id, input.cityId]);
      }
      return { operationId, residenceId: residence.id, previousCityId: residence.tax_city_id,
        cityId: input.cityId, bindingRevision: revision };
    });
  }

  async function inspect(session, input, guard) {
    input = cityRequest('inspectResidence', input);
    return transact(async conn => {
      await authorize(conn, session);
      const residence = await residenceForUpdate(conn, input.residenceId);
      await permit(conn, session, 'residence.inspectCity', residence);
      const [rows] = await conn.query(`SELECT COUNT(*)::text AS payments,COALESCE(SUM(amount),0)::text AS amount
        FROM aetherius_residence_tax_collections WHERE residence_id=$1 AND collected_operation_id IS NULL`, [residence.id]);
      guard(residence);
      return { residenceId: residence.id, name: residence.definition.name,
        cityId: residence.tax_city_id, bindingRevision: residence.tax_city_revision,
        pendingAmount: rows[0].amount, pendingPayments: rows[0].payments, currency: 'septims' };
    });
  }

  async function collect(session, input, guard) {
    if (!input || !uuid(input.requestId) || !residenceIdValid(input.residenceId) ||
        typeof input.door !== 'string' || input.door.length > 160) fail('INVALID');
    input = { action: 'collectTax', requestId: input.requestId, residenceId: input.residenceId, door: input.door };
    return operation(session, input, guard, async (conn, residence, operationId) => {
      if (!residence.tax_city_id) fail('CITY_UNASSIGNED');
      await permit(conn, session, 'residence.collectTax', residence);
      const [pending] = await conn.query(`SELECT payment_operation_id,amount FROM aetherius_residence_tax_collections
        WHERE residence_id=$1 AND city_id=$2 AND collected_operation_id IS NULL
        ORDER BY created_at,payment_operation_id LIMIT 100 FOR UPDATE`, [residence.id, residence.tax_city_id]);
      let amount = 0;
      const paymentIds = [];
      for (const payment of pending) {
        if (!integer(payment.amount)) fail('UNAVAILABLE');
        if (amount + payment.amount > 2147483647) break;
        amount += payment.amount;
        paymentIds.push(payment.payment_operation_id);
      }
      if (!paymentIds.length) fail('CITY_EMPTY');
      const receipt = await cities.creditInTransaction(conn, {
        cityId: residence.tax_city_id, currency: 'septims', amount, operationId,
        idempotencyKey: `residence-collection:${operationId}`, residenceId: residence.id,
        collectorProfileId: session.profileId, collectorAccountId: session.accountId,
        collectorCharacterId: session.characterId,
      });
      if (!receipt || receipt.cityId !== residence.tax_city_id || receipt.currency !== 'septims' ||
          receipt.amount !== amount || typeof receipt.transactionId !== 'string' ||
          !receipt.transactionId || receipt.transactionId.length > 160) fail('CITY_CREDIT');
      return { operationId, residenceId: residence.id, cityId: residence.tax_city_id, currency: 'septims',
        amount, paymentIds, cityTransactionId: receipt.transactionId };
    });
  }

  return { enabled: !!cities, recordPayment, link, inspect, collect };
}

module.exports = { createCityTaxes, cityRequest, CITY_CONTRACT };
