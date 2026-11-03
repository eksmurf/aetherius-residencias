'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { fail } = require('./errors.cjs');
const { terms, taxView, offerKind, TAX_PERIOD_DAYS, TAX_PERIOD_MS } = require('./tax.cjs');
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
      // No IPTU was active when the 15-day rule was approved. Never reinterpret a weekly debt silently.
      for(const row of existing) if(row.owner_profile_id!==null && row.tax_due_at && row.tax_terms?.periodDays!==TAX_PERIOD_DAYS) fail('TAX_PERIOD');
      for (const definition of definitions) {
        const previous = existing.find(row => row.id === definition.id);
        if (previous && previous.definition_hash !== definition.hash && definition.revision <= previous.revision) fail('PRICE_CHANGED');
        if (previous && referenceSignature(previous.definition.refs) !== referenceSignature(definition.refs)) {
          throw Error(`As referências de ${definition.id} são imutáveis; prepare uma migração específica.`);
        }
        for(const field of ['interiorCells','storageGuards','interiorPassages']) {
          if(previous && (previous.definition[field]||[]).some(ref=>!definition[field].includes(ref))) {
            throw Error(`Não retire ${field} de ${definition.id} sem uma migração revisada.`);
          }
        }
        await conn.query(`INSERT INTO aetherius_residences(id,definition,definition_hash,revision,for_sale)
          VALUES($1,$2::jsonb,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET definition=EXCLUDED.definition,
          definition_hash=EXCLUDED.definition_hash,revision=EXCLUDED.revision,for_sale=EXCLUDED.for_sale,updated_at=now()`,
        [definition.id, JSON.stringify(definition), definition.hash, definition.revision, definition.forSale]);
        for (const ref of [...definition.refs,...definition.storageGuards.map(desc=>({desc,kind:'container'}))]) {
          const [found] = await conn.query('SELECT residence_id,kind FROM aetherius_residence_refs WHERE descriptor=$1', [ref.desc]);
          if (found.length && (found[0].residence_id !== definition.id || found[0].kind !== ref.kind)) fail('CONFLICT');
          await conn.query('INSERT INTO aetherius_residence_refs(descriptor,residence_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [ref.desc, definition.id, ref.kind]);
        }
      }
      const [legacy]=await conn.query('SELECT * FROM aetherius_residences WHERE owner_profile_id IS NOT NULL AND tax_due_at IS NULL FOR UPDATE');
      for(const row of legacy) await conn.query("UPDATE aetherius_residences SET tax_due_at=now()+($3::int * interval '24 hours'),tax_terms=$2::jsonb WHERE id=$1",[row.id,JSON.stringify(terms(row.definition.prices.septims)),TAX_PERIOD_DAYS]);
      for (const row of existing) if (!definitions.some(d => d.id === row.id)) {
        await conn.query('UPDATE aetherius_residences SET for_sale=false WHERE id=$1', [row.id]);
      }
    });
  }
  const snapshot = () => db.query(`SELECT r.*, COALESCE((SELECT jsonb_agg(m) FROM aetherius_residence_members m WHERE m.residence_id=r.id),'[]'::jsonb) AS members FROM aetherius_residences r ORDER BY id`);
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
      const hash = payloadHash(Object.keys(input).filter(k=>k!=='requestId').sort().map(k=>[k,input[k]]));
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
      let amount = null, walletId = null, key = null, chargeCurrency = null;
      let recipient = session;
      if (input.action === 'purchase') {
        if (!purchasesEnabled) fail('UNAVAILABLE');
        const kind=offerKind(residence),foreclosure=kind==='foreclosure',resale=kind==='resale';
        if(input.accessRevision!==residence.access_revision||input.offerKind!==kind) fail('PRICE_CHANGED');
        if ((residence.owner_profile_id!==null&&!foreclosure&&!resale)||(!foreclosure&&!resale&&!residence.for_sale)||residence.owner_profile_id===session.profileId) fail('SOLD');
        if (input.revision !== residence.revision) fail('PRICE_CHANGED');
        if(resale&&input.currency!=='septims') fail('CURRENCY');
        amount = resale?residence.listing_price:residence.definition.prices[input.currency];
        if (!amount) fail('CURRENCY');
        if (!currencies.available(input.currency)) fail(input.currency === 'diademas' ? 'DIADEMAS_UNAVAILABLE' : 'CURRENCY');
        const [owned] = await conn.query('SELECT count(*) AS total FROM aetherius_residences WHERE owner_profile_id=$1', [session.profileId]);
        if (Number(owned[0].total) >= maxPerProfile) fail('LIMIT');
        const taxTerms=terms(residence.definition.prices.septims);
        chargeCurrency = input.currency;
        walletId = await currencies.debit(conn, { ...session, currency: chargeCurrency, amount, purchaseId: operationId });
        if(resale) await currencies.creditSeller(conn,{amount,profileId:residence.owner_profile_id,accountId:residence.owner_account_id,characterId:residence.seller_character_id,purchaseId:operationId});
        residence.listing_price=null;residence.seller_character_id=null;
        if(residence.owner_profile_id!==null){
          await conn.query('DELETE FROM aetherius_residence_members WHERE residence_id=$1',[residence.id]);
          await conn.query("UPDATE aetherius_residence_keys SET delivery_state='revoked' WHERE residence_id=$1",[residence.id]);
          residence.generation+=1;
        }
        residence.owner_profile_id = session.profileId;
        residence.owner_account_id = session.accountId;
        residence.locked = true;
        residence.tax_terms=taxTerms; residence.tax_due_at=new Date(Date.now()+TAX_PERIOD_MS).toISOString();
      } else {
        if (residence.owner_profile_id !== session.profileId || residence.owner_account_id !== session.accountId) fail('FORBIDDEN');
        if (input.accessRevision !== residence.access_revision) fail('STALE');
        if(input.action!=='payTax' && taxView(residence).suspended) fail('TAX_SUSPENDED');
        if(input.action==='listSale') {
          residence.listing_price=input.amount;residence.seller_character_id=session.characterId;
        } else if(input.action==='cancelSale') {
          residence.listing_price=null;residence.seller_character_id=null;
        } else if (input.action === 'public') {
          residence.locked = !input.open;
        } else if (input.action === 'addMember') {
          const numeric=/^[1-9][0-9]*$/.test(input.query);
          const [targets]=await conn.query(`SELECT DISTINCT ON (u.profile_id) u.id AS account_id,u.profile_id,c.id AS character_id,c.name
            FROM users u JOIN characters c ON c.user_id=u.id
            WHERE u.is_banned IS FALSE AND c.status='approved' AND ${numeric?'u.profile_id=$1':'lower(trim(c.name))=lower($1)'}
            ORDER BY u.profile_id,c.id LIMIT 2`, [numeric?Number(input.query):input.query]);
          if (!targets.length) fail('MEMBER_NOT_FOUND');
          if (new Set(targets.map(t=>t.profile_id)).size!==1) fail('AMBIGUOUS');
          const target=targets[0];
          if (target.profile_id===session.profileId) fail('INVALID');
          const [members]=await conn.query('SELECT * FROM aetherius_residence_members WHERE residence_id=$1',[residence.id]);
          if (members.some(m=>m.profile_id===target.profile_id)) fail('CONFLICT');
          if (members.length>=5) fail('MEMBER_LIMIT');
          await conn.query(`INSERT INTO aetherius_residence_members(residence_id,profile_id,account_id,character_id,display_name)
            VALUES($1,$2,$3,$4,$5)`,[residence.id,target.profile_id,target.account_id,target.character_id,target.name]);
        } else if (['setFamily','removeMember'].includes(input.action)) {
          const [members]=await conn.query('SELECT * FROM aetherius_residence_members WHERE residence_id=$1 FOR UPDATE',[residence.id]);
          const target=members.find(m=>m.profile_id===input.memberProfileId);
          if (!target) fail('MEMBER_NOT_FOUND');
          if (input.action==='removeMember') {
            await conn.query('DELETE FROM aetherius_residence_members WHERE residence_id=$1 AND profile_id=$2',[residence.id,target.profile_id]);
          } else {
            if (input.family && !target.family && members.filter(m=>m.family).length>=2) fail('FAMILY_LIMIT');
            await conn.query('UPDATE aetherius_residence_members SET family=$3 WHERE residence_id=$1 AND profile_id=$2',[residence.id,target.profile_id,input.family]);
            if (input.family && !target.family) recipient={profileId:target.profile_id,accountId:target.account_id,characterId:target.character_id};
          }
          if (input.action==='removeMember'||!input.family) await conn.query(`UPDATE aetherius_residence_keys SET delivery_state='revoked' WHERE residence_id=$1 AND profile_id=$2`,[residence.id,target.profile_id]);
        } else if (input.action==='payTax') {
          const due=residence.tax_due_at && new Date(residence.tax_due_at).toISOString();
          if (!due || input.dueAt!==due) fail('TAX_CHANGED');
          const bill=taxView(residence,c=>currencies.available(c));
          if (!bill.canPay) fail('TAX_EARLY');
          if(input.periods!==bill.periods) fail('TAX_CHANGED');
          amount=bill.amount; chargeCurrency='septims';
          walletId=await currencies.debit(conn,{...session,currency:chargeCurrency,amount,purchaseId:operationId,reason:'residence_tax'});
          if(bill.suspended){residence.locked=true;residence.listing_price=null;residence.seller_character_id=null;}
          residence.tax_due_at=new Date(Date.parse(due)+bill.periods*TAX_PERIOD_MS).toISOString();
        } else fail('INVALID');
      }
      if (input.action==='purchase'||recipient!==session) {
        key={id:randomUUID(),residenceId:residence.id,generation:residence.generation};
        key.name=`Chave residencial [AR:${key.id}]`;
      }
      residence.access_revision += 1;
      const result = { operationId, residenceId: residence.id, action: input.action, ownerProfileId: residence.owner_profile_id,
        locked: residence.locked, accessRevision:residence.access_revision, ...(amount ? { currency: chargeCurrency, amount } : {}), ...(key ? { keyId: key.id, delivery: 'bound' } : {}) };
      await conn.query(`INSERT INTO aetherius_residence_operations
        (id,profile_id,account_id,character_id,request_id,action,residence_id,payload_hash,currency,amount,wallet_transaction_id,result)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [operationId,session.profileId,session.accountId,session.characterId,input.requestId,input.action,residence.id,hash,
        chargeCurrency,amount,walletId,JSON.stringify(result)]);
      if (key) await conn.query(`INSERT INTO aetherius_residence_keys
        (id,residence_id,operation_id,profile_id,account_id,character_id,generation,item_name,delivery_state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'bound')`, [key.id,residence.id,operationId,recipient.profileId,recipient.accountId,recipient.characterId,key.generation,key.name]);
      if(input.action==='payTax') await conn.query('INSERT INTO aetherius_residence_tax_receipts(residence_id,due_at,operation_id) VALUES($1,$2,$3)',[residence.id,input.dueAt,operationId]);
      await conn.query(`UPDATE aetherius_residences SET owner_profile_id=$2,owner_account_id=$3,
        locked=$4,generation=$5,tax_due_at=$6,tax_terms=$7::jsonb,access_revision=$8,listing_price=$9,seller_character_id=$10,updated_at=now() WHERE id=$1`,
      [residence.id,residence.owner_profile_id,residence.owner_account_id,residence.locked,residence.generation,residence.tax_due_at||null,JSON.stringify(residence.tax_terms||null),residence.access_revision,residence.listing_price||null,residence.seller_character_id||null]);
      assertCurrent(residence);
      return result;
    });
  }
  async function properties(session) {
    return transact(async conn=>{
      await authorize(conn,session);
      const [owned]=await conn.query('SELECT * FROM aetherius_residences WHERE owner_profile_id=$1 AND owner_account_id=$2 ORDER BY id FOR UPDATE',[session.profileId,session.accountId]);
      const result=[];
      for(const row of owned){
        if(!row.tax_due_at){
          row.tax_terms=terms(row.definition.prices.septims);row.tax_due_at=new Date(Date.now()+TAX_PERIOD_MS).toISOString();
          await conn.query('UPDATE aetherius_residences SET tax_due_at=$2,tax_terms=$3::jsonb WHERE id=$1',[row.id,row.tax_due_at,JSON.stringify(row.tax_terms)]);
        }
        const [members]=await conn.query('SELECT profile_id,display_name,family FROM aetherius_residence_members WHERE residence_id=$1 ORDER BY created_at,profile_id',[row.id]);
        result.push({residenceId:row.id,name:row.definition.name,open:!row.locked,accessRevision:row.access_revision,listingPrice:row.listing_price,
          tax:taxView(row,c=>currencies.available(c)),members:members.map(m=>({profileId:m.profile_id,name:m.display_name.slice(0,48),family:m.family})),memberLimit:5,familyLimit:2});
      }
      return {residences:result,serverNow:new Date().toISOString()};
    });
  }
  async function inventoryKeys(session, context='personal') {
    if(context!=='personal') return [];
    return transact(async conn=>{
      await authorize(conn,session);
      const [rows]=await conn.query(`SELECT k.*,r.tax_due_at,r.tax_terms,r.definition->>'name' AS residence_name
        FROM aetherius_residence_keys k JOIN aetherius_residences r ON r.id=k.residence_id
        WHERE k.profile_id=$1 AND k.account_id=$2 AND k.delivery_state<>'revoked'
        AND ((r.owner_profile_id=k.profile_id AND r.owner_account_id=k.account_id) OR EXISTS
          (SELECT 1 FROM aetherius_residence_members m WHERE m.residence_id=r.id AND m.profile_id=k.profile_id AND m.account_id=k.account_id AND m.family))
        ORDER BY r.id`,[session.profileId,session.accountId]);
      return rows.filter(k=>!taxView(k).suspended).map(k=>({id:'residence-key:'+k.id,key:'residence-key:'+k.id,baseId:0,
        name:'Chave — '+k.residence_name,category:'keys',count:1,equipped:[],favorite:false,favoriteId:'',effects:[],actions:[],equip:{kind:'item'},
        weight:0,value:0,bound:true,description:'Chave pessoal vinculada ao perfil. Não pode ser perdida, destruída ou transferida.'}));
    });
  }

  return { installCatalog, snapshot, keys, status, mutate, properties, inventoryKeys };
}
module.exports = { createStore };
