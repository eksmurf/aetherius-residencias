'use strict';
const { messages, fail, uuid, integer } = require('./errors.cjs');
function request(raw) {
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 2048 || raw.version !== 1 || !uuid(raw.requestId) ||
      !['offer','purchase','lock','reissue','status','recover'].includes(raw.action)) fail('INVALID');
  const allowed = {
    offer: ['version','requestId','action','residenceId'],
    purchase: ['version','requestId','action','residenceId','revision','currency'],
    lock: ['version','requestId','action','residenceId','locked'],
    reissue: ['version','requestId','action','residenceId'],
    status: ['version','requestId','action','operationRequestId'],
    recover: ['version','requestId','action','keyId'],
  }[raw.action];
  if (Object.keys(raw).some(k => !allowed.includes(k))) fail('INVALID');
  if (['offer','purchase','lock','reissue'].includes(raw.action) && (typeof raw.residenceId !== 'string' || !/^[a-z0-9_-]{1,48}$/.test(raw.residenceId))) fail('INVALID');
  if (raw.action === 'purchase' && (!integer(raw.revision) || !['septims','diademas'].includes(raw.currency))) fail('INVALID');
  if (raw.action === 'lock' && typeof raw.locked !== 'boolean') fail('INVALID');
  if (raw.action === 'status' && !uuid(raw.operationRequestId)) fail('INVALID');
  if (raw.action === 'recover' && !uuid(raw.keyId)) fail('INVALID');
  return raw;
}
function createService({ store, host, currencies, state, purchasesEnabled, allowProfiles = [] }) {
  const pending = new Set(), buckets = new WeakMap();
  function checkPilot(session) { if (allowProfiles.length && !allowProfiles.includes(session.profileId)) fail('FORBIDDEN'); }
  async function deliver(session, result) {
    if (!result?.keyId) return result;
    try {
      const delivery = await store.deliver(session, result.keyId, key => host.ensureKey(session, key));
      return { ...result, delivery };
    } catch { return { ...result, delivery: 'pending', message: 'Posse registrada. Entrega da chave pendente; consulte ou recupere sem comprar novamente.' }; }
  }
  async function handle(actorId, raw) {
    const session = host.session(actorId);
    const input = request(raw);
    if (!state.available()) fail('UNAVAILABLE');
    checkPilot(session);
    if (pending.has(session.profileId)) fail('BUSY');
    let bucket = buckets.get(session.identity);
    if (!bucket || Date.now() - bucket.start > 10000) { bucket = { start: Date.now(), count: 0 }; buckets.set(session.identity, bucket); }
    if (++bucket.count > 20) fail('BUSY');
    pending.add(session.profileId);
    try {
      if (input.action === 'status') {
        const result = await store.status(session, input.operationRequestId);
        if (!result) return { committed: false, message: 'Nenhum commit encontrado para esse pedido. Reenvie o pedido original, com o mesmo identificador.' };
        return deliver(session, result);
      }
      if (input.action === 'recover') {
        const delivery = await store.deliver(session, input.keyId, key => host.ensureKey(session, key));
        return { keyId: input.keyId, delivery };
      }
      const residence = state.get(input.residenceId);
      if (!residence) fail('NOT_FOUND');
      host.assertNear(session, residence);
      if (input.action === 'offer') {
        const owner = residence.owner_profile_id === session.profileId && residence.owner_account_id === session.accountId;
        return { residenceId: residence.id, name: residence.definition.name, revision: residence.revision,
          owned: residence.owner_profile_id !== null, owner, locked: residence.locked,
          forSale: purchasesEnabled && residence.for_sale && residence.owner_profile_id === null,
          refs: residence.definition.refs.map(r => ({ kind: r.kind })),
          prices: Object.entries(residence.definition.prices).map(([currency, amount]) => ({ currency, amount, available: currencies.available(currency) })),
          pendingKeys: owner ? (await store.keys(session.profileId)).filter(k => k.residence_id === residence.id && k.delivery_state === 'pending')
            .map(k => ({ id: k.id, sameCharacter: k.character_id === session.characterId })) : [] };
      }
      state.invalidate();
      let result;
      try {
        result = await store.mutate(session, input, row => host.assertNear(session, row), key => {
          if (!host.hasKey(session, key)) fail('KEY');
        }, purchasesEnabled);
      } finally { await state.finishMutation(); }
      return deliver(session, result);
    } finally { pending.delete(session.profileId); }
  }
  async function receive(actorId, raw) {
    let session;
    try { session = host.session(actorId); } catch { return; }
    let response;
    try {
      const data = await handle(actorId, raw);
      response = { requestId: raw.requestId, action: raw.action, status: 'succeeded', data };
    } catch (error) {
      const code = Object.hasOwn(messages, error.code) ? error.code : 'UNAVAILABLE';
      response = { requestId: uuid(raw?.requestId) ? raw.requestId : null, action: raw?.action, status: code === 'UNKNOWN' ? 'unknown' : 'rejected', code, message: messages[code] };
    }
    try { host.send(session, response); } catch { }
  }
  return { handle, receive };
}
module.exports = { createService, request };
