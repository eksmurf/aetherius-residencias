'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { taxView, offerKind } = require('./tax.cjs');
const { randomUUID } = require('node:crypto');
const { createHost } = require('./host.cjs');
const { createStore } = require('./store.cjs');
const { createCurrencies } = require('./currencies.cjs');
const { createService } = require('./service.cjs');
const { integer, fail } = require('./errors.cjs');
const { authorizeReference } = require('./access.cjs');
async function install({ mp, gamemodeDir, configPath = path.resolve(gamemodeDir, '../config/residences.json') }) {
  if (!fs.existsSync(configPath)) return null;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.enabled !== true) return null;
  if (mp.aetheriusResidences) return mp.aetheriusResidences;
  const startupHooks = ['onActivate','onPutItem','onTakeItem'].map(name => ({ name, previous: mp[name] }));
  for (const entry of startupHooks) mp[entry.name] = () => false;
  if (!mp.aetheriusOfficialIdentity || typeof config.purchasesEnabled !== 'boolean' ||
      config.maxPerProfile !== 1 || !integer(config.maxDistance, 50, 500) ||
      !Array.isArray(config.allowProfiles) || config.allowProfiles.some(v => !integer(v))) fail('INVALID');
  const db = require(path.join(gamemodeDir, 'database.js'));
  const commands = require(path.join(gamemodeDir, 'commands.js'));
  const transactionService = require(path.join(gamemodeDir, 'core/transaction-service.js'));
  const adapterPath = path.join(__dirname, 'official-diademas.cjs');
  const diademas = fs.existsSync(adapterPath) ? require(adapterPath) : null;
  const cityAdapterPath = path.join(__dirname, 'official-cities.cjs');
  const cities = fs.existsSync(cityAdapterPath) ? require(cityAdapterPath) : null;
  const currencies = createCurrencies(transactionService, diademas);
  const host = createHost({ mp, commands, keyDescriptor: config.keyDescriptor, maxDistance: config.maxDistance });
  const store = createStore({ db, currencies, cities, maxPerProfile: config.maxPerProfile });
  const lease = await db.getConnection();
  let closed = false, healthy = false, writes = 0, refreshedAt = 0, refreshing = null, rows = new Map(), refs = new Map(), cells = new Map();
  const hooks = [];
  const router = require(path.join(gamemodeDir, 'core/ui-event-router.js'));
  let timer;
  try {
    const [lock] = await lease.query('SELECT pg_try_advisory_lock(174622,1) AS acquired');
    if (!lock[0]?.acquired) throw Error('Já existe uma instância de residências conectada a esta base.');
    const state = {
      available() { return !closed && healthy && Date.now() - refreshedAt <= 5000; },
      invalidate() { writes++; healthy = false; },
      async finishMutation() { writes--; try { await state.refresh(true); } catch { healthy = false; } },
      get(id) { if (!healthy || Date.now() - refreshedAt > 5000) fail('UNAVAILABLE'); return rows.get(id); },
      async refresh(force = false) {
        if (closed) fail('UNAVAILABLE');
        if (refreshing) { await refreshing; if (!force) return; return state.refresh(true); }
        refreshing = (async () => {
          healthy = false;
          const [held] = await lease.query('SELECT 1 AS alive');
          if (!held[0]?.alive) fail('UNAVAILABLE');
          const next = await store.snapshot(), nextRows = new Map(), nextRefs = new Map(refs), nextCells=new Map(cells);
          for (const row of next) {
            if(row.owner_profile_id!==null && !row.definition.interiorCells?.length) fail('UNAVAILABLE');
            nextRows.set(row.id, row);
            for(const cell of row.definition.interiorCells||[]){if(nextCells.has(cell)&&nextCells.get(cell)!==row.id)fail('CONFLICT');nextCells.set(cell,row.id);}
            for (const ref of [...(row.definition.interiorPassages||[]).map(desc=>({desc,kind:'exit'})),...row.definition.refs,...(row.definition.storageGuards||[]).map(desc=>({desc,kind:'container'}))]) {
              const id = host.resolve(ref.desc);
              if (nextRefs.has(id) && nextRefs.get(id).residenceId !== row.id) fail('CONFLICT');
              nextRefs.set(id, { ...ref, residenceId: row.id });
            }
          }
          rows = nextRows; refs = nextRefs; cells=nextCells; refreshedAt = Date.now(); healthy = writes === 0;
        })();
        try { await refreshing; } finally { refreshing = null; }
      },
    };
    await store.installCatalog(config.residences);
    await state.refresh();
    const service = createService({ store, host, currencies, state, purchasesEnabled: config.purchasesEnabled, allowProfiles: config.allowProfiles });
    function gate(targetId, actorId, transfer = false, baseId = null) {
      const cellResidence=cells.get(host.cellOf(targetId))||cells.get(host.cellOf(actorId));
      // Dynamic containers receive the same protection; unknown base types fail closed.
      const ref = refs.get(targetId) || (cellResidence && (transfer||host.storageAt(targetId)) ? {kind:'container',residenceId:cellResidence} : null);
      if (transfer && host.keyBaseId!==null && baseId === host.keyBaseId) return false;
      if (!ref) return true;
      if (ref.kind === 'exit' && !transfer) return true;
      try {
        const row = state.get(ref.residenceId);
        const session = host.session(actorId);
        host.retireLegacyKeys(session);
        return authorizeReference({ ref, residence:row, session, nearby:host.near(actorId,targetId), transfer });
      } catch { return false; }
    }
    function hook(name, handler) {
      const previous = startupHooks.find(entry => entry.name === name)?.previous;
      const combined = (...args) => {
        if (!handler(...args)) return false;
        if (typeof previous === 'function') {
          try {
            const result = previous(...args);
            if (result?.then) { result.catch(() => {}); return false; }
            if (result === false) return false;
          } catch { return false; }
        }
        return undefined;
      };
      mp[name] = combined;
      hooks.push({ name, previous, combined });
    }
    hook('onActivate', (targetId, actorId) => {
      const allowed = gate(targetId, actorId),ref=refs.get(targetId);
      if(ref?.kind==='entry'){
        try{
          const row=state.get(ref.residenceId),session=host.session(actorId);
          const owner=row.owner_profile_id===session.profileId&&row.owner_account_id===session.accountId;
          const listed=row.owner_profile_id!==null&&offerKind(row)!==null;
          const member=row.members?.some(m=>m.profile_id===session.profileId&&m.account_id===session.accountId);
          const showOffer = !owner && (row.owner_profile_id===null || (listed && (!member || taxView(row).auction)));
          const normalInteraction = () => {
            host.assertCurrent(session);
            if (showOffer) {
              void service.receive(actorId,{version:1,requestId:randomUUID(),action:'offer',residenceId:row.id});
            } else if (!allowed) {
              host.notify(session, owner ? 'Consulte os impostos da residência em TAB → Propriedades.' : 'Residência privada');
            }
          };
          if (store.cityTaxes.enabled && row.collection_pending) {
            void service.collectAtDoor(actorId, row.id, ref.desc).then(collected => {
              if (!collected) normalInteraction();
            }).catch(() => {});
          } else normalInteraction();
          if (showOffer) return false;
        }catch{return false;}
      }
      return allowed;
    });
    for (const event of ['onPutItem','onTakeItem']) hook(event, (targetId, actorId, baseId, count) => {
      if (!refs.has(targetId) && !cells.has(host.cellOf(targetId)) && !cells.has(host.cellOf(actorId)) && baseId !== host.keyBaseId) return true;
      return integer(count) && gate(targetId, actorId, true, baseId);
    });
    router.register('residences', async (actorId, event) => {
      if (event.type !== 'residences:request') return false;
      await service.receive(actorId, event.data); return true;
    });
    timer = setInterval(() => { state.refresh().catch(() => { healthy = false; }); }, 1500);
    timer.unref?.();
    const api = { service, healthy: () => healthy && Date.now() - refreshedAt <= 5000,
      async close() {
        closed = true; healthy = false; clearInterval(timer);
        router.unregister('residences');
        if(globalThis.aetheriusResidencesBridge===bridge) delete globalThis.aetheriusResidencesBridge;
        // Gates remain fail-closed for protected refs until the server is restarted.
        await lease.query('SELECT pg_advisory_unlock(174622,1)'); lease.release();
      } };
    const bridge={
      healthy:api.healthy,
      request:(actorId,action,payload)=>service.core(actorId,action,payload),
      cityRequest:(actorId,action,payload)=>service.city(actorId,action,payload),
      async inventoryKeys(actorId,context='personal'){
        if(!state.available()) fail('UNAVAILABLE');
        const session=host.session(actorId);host.retireLegacyKeys(session);
        const keys=await store.inventoryKeys(session,context);host.assertCurrent(session);return keys;
      },
      isLegacyKey:entry=>host.keyBaseId!==null && entry?.baseId===host.keyBaseId && /^Chave residencial \[AR:[0-9a-f-]{36}\]$/.test(entry.name||''),
    };
    globalThis.aetheriusResidencesBridge=bridge;
    mp.aetheriusResidences = api;
    return api;
  } catch (error) {
    healthy = false;
    clearInterval(timer);
    // A partial startup must not leave protected containers exposed.
    for (const entry of hooks) if (mp[entry.name] !== entry.combined) mp[entry.name] = entry.combined;
    try { await lease.query('SELECT pg_advisory_unlock(174622,1)'); } finally { lease.release(); }
    throw error;
  }
}
module.exports = { install };
