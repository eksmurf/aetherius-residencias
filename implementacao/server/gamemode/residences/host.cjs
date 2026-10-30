'use strict';
const { fail, uuid, integer } = require('./errors.cjs');
const { descriptor } = require('./catalog.cjs');
function createHost({ mp, commands, keyDescriptor, maxDistance = 250 }) {
  function session(actorId) {
    const identity = mp.aetheriusOfficialIdentity?.session(actorId);
    const character = commands.getActiveCharacterData(actorId);
    if (!identity || !character || !integer(identity.profile_id) || character.profileId !== identity.profile_id ||
        !uuid(character.accountId) || !uuid(character.characterId)) fail('SESSION');
    return { actorId, identity, character, userId: identity.userId, profileId: identity.profile_id,
      accountId: character.accountId.toLowerCase(), characterId: character.characterId.toLowerCase() };
  }
  function assertCurrent(expected) {
    const current = session(expected.actorId);
    if (current.identity !== expected.identity || current.character !== expected.character ||
        !mp.aetheriusOfficialIdentity.isCurrent(expected.identity)) fail('SESSION');
  }
  function resolve(desc) {
    const id = mp.getIdFromDesc(descriptor(desc));
    if (!integer(id, 1, 4294967295) || descriptor(mp.getDescFromId(id)) !== descriptor(desc)) fail('UNAVAILABLE');
    return id;
  }
  const keyBaseId = keyDescriptor ? resolve(keyDescriptor) : null;
  function near(actorId, id) {
    try {
      const a = mp.get(actorId, 'locationalData'), b = mp.get(id, 'locationalData');
      if (!a || !b || typeof a.cellOrWorldDesc !== 'string' ||
          a.cellOrWorldDesc.toLowerCase() !== String(b.cellOrWorldDesc).toLowerCase()) return false;
      if (![a.pos,b.pos].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) return false;
      return a.pos.reduce((sum, value, i) => sum + (value - b.pos[i]) ** 2, 0) <= maxDistance ** 2;
    } catch { return false; }
  }
  function assertNear(expected, residence) {
    assertCurrent(expected);
    if (!residence.definition.refs.some(ref => ref.kind !== 'container' && near(expected.actorId, resolve(ref.desc)))) fail('DISTANCE');
  }
  function inventory(expected) {
    assertCurrent(expected);
    const inv = mp.get(expected.actorId, 'inventory');
    if (!inv || !Array.isArray(inv.entries)) fail('UNAVAILABLE');
    return inv;
  }
  function retireLegacyKeys(expected) {
    const inv=inventory(expected);
    const entries=inv.entries.filter(e=>!(keyBaseId!==null && e.baseId===keyBaseId && /^Chave residencial \[AR:[0-9a-f-]{36}\]$/.test(e.name||'')));
    if(entries.length!==inv.entries.length) mp.set(expected.actorId,'inventory',{...inv,entries});
  }
  function cellOf(id) {
    try { return descriptor(mp.get(id,'locationalData')?.cellOrWorldDesc); } catch { return null; }
  }
  function storageAt(id) {
    try {
      const base=resolve(mp.get(id,'baseDesc'));
      const type=mp.lookupEspmRecordById(base)?.record?.type;
      return type ? ['CONT','NPC_'].includes(type) : true;
    } catch { return true; }
  }
  function notify(expected,message) {
    assertCurrent(expected);
    mp.set(expected.actorId,'browserModal',{type:'toast',data:{message},sentAt:Date.now()});
  }
  function send(expected, response) {
    assertCurrent(expected);
    mp.sendCustomPacket(expected.userId, JSON.stringify({ customPacketType: 'aetheriusResidences', response }));
  }
  return { session, assertCurrent, resolve, near, assertNear, retireLegacyKeys, cellOf, storageAt, notify, send, keyBaseId };
}
module.exports = { createHost };
