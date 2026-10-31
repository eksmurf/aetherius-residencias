'use strict';
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createStore } = require('../server/gamemode/residences/store.cjs');
const { createCurrencies } = require('../server/gamemode/residences/currencies.cjs');
const { fail } = require('../server/gamemode/residences/errors.cjs');
const url = process.env.RESIDENCES_TEST_DATABASE_URL;
if (!url || !/^residence_test(?:_|$)/.test(new URL(url).pathname.slice(1))) {
  throw Error('Configure RESIDENCES_TEST_DATABASE_URL para uma base exclusiva cujo nome comece por residence_test. Não usa DATABASE_URL de produção.');
}
const schema = `residence_test_${randomUUID().replace(/-/g,'')}`;
const pool = new Pool({ connectionString:url, max:8 });
let unknownCommit = false, badCashReceipt = false;
const sessions = [1,2].map(profileId=>({profileId,accountId:randomUUID(),characterId:randomUUID()}));
async function connect() { const client=await pool.connect(); await client.query(`SET search_path TO ${schema}`); return client; }
const db = {
  async query(sql,params) {const c=await connect();try{return (await c.query(sql,params)).rows;}finally{c.release();}},
  async getConnection() {
    const c=await connect();
    return {query:async(sql,params)=>[(await c.query(sql,params)).rows],beginTransaction:()=>c.query('BEGIN'),
      async commit(){await c.query('COMMIT');if(unknownCommit){unknownCommit=false;throw Error('simulated lost commit response');}},
      rollback:()=>c.query('ROLLBACK'),release:()=>c.release()};
  },
};
const transactionService = {tx:{
  async applyGoldDelta(conn,id,delta){await conn.query('UPDATE characters SET gold=gold+$2 WHERE id=$1',[id,delta]);},
  async recordGoldLedger(conn,data){const id=randomUUID();await conn.query('INSERT INTO gold_transactions(id,character_id,delta,idempotency_key) VALUES($1,$2,$3,$4)',[id,data.characterId,data.delta,data.idempotencyKey]);return id;},
}};
// This wallet exists exclusively in the isolated test schema.
const cash = {contract:'aetherius-diademas-same-transaction-v1',async debitInTransaction(conn,input){
  const [rows]=await conn.query('UPDATE test_cash_wallet SET balance=balance-$2 WHERE account_id=$1 AND balance >= $2 RETURNING balance',[input.accountId,input.amount]);
  if(!rows.length)fail('FUNDS');
  return {accountId:input.accountId,amount:badCashReceipt?input.amount+1:input.amount,currency:'diademas',transactionId:input.idempotencyKey};
}};
const store=createStore({db,currencies:createCurrencies(transactionService,cash),maxPerProfile:2});
function definition(id,start){const desc=n=>`${n.toString(16)}:fixture.esp`;return {id,name:id,revision:1,forSale:true,interiorCells:[desc(start+100)],interiorPassages:[],storageGuards:[],prices:{septims:100,diademas:10},
  refs:[{desc:desc(start),kind:'entry',partner:desc(start+1)},{desc:desc(start+1),kind:'exit',partner:desc(start)}]};}
const input = (values={})=>({requestId:randomUUID(),action:'purchase',residenceId:'first',revision:1,accessRevision:1,offerKind:'initial',currency:'septims',...values});
const mutate=(session,request,guard=()=>{})=>store.mutate(session,request,guard,()=>{},true);
before(async()=>{
  await pool.query(`CREATE SCHEMA ${schema}`);
  await db.query(`CREATE TABLE users(id uuid PRIMARY KEY,profile_id integer UNIQUE,is_banned boolean NOT NULL DEFAULT false);
    CREATE TABLE characters(id uuid PRIMARY KEY,user_id uuid,status text DEFAULT 'approved',name text DEFAULT 'Pessoa Teste',gold integer CHECK(gold>=0));
    CREATE TABLE gold_transactions(id uuid PRIMARY KEY,character_id uuid,delta integer,idempotency_key text UNIQUE);
    CREATE TABLE test_cash_wallet(account_id uuid PRIMARY KEY,balance integer CHECK(balance>=0));`);
  const c=await connect();try{await c.query(fs.readFileSync(path.join(__dirname,'../migrations/001_residences.sql'),'utf8')+fs.readFileSync(path.join(__dirname,'../migrations/002_household_tax.sql'),'utf8'));}finally{c.release();}
});
beforeEach(async()=>{
  unknownCommit=false;badCashReceipt=false;
  await db.query('TRUNCATE aetherius_residence_keys,aetherius_residence_operations,aetherius_residence_refs,aetherius_residences,characters,users,gold_transactions,test_cash_wallet CASCADE');
  for(const s of sessions){
    await db.query('INSERT INTO users(id,profile_id) VALUES($1,$2)',[s.accountId,s.profileId]);
    await db.query('INSERT INTO characters(id,user_id,gold) VALUES($1,$2,1000)',[s.characterId,s.accountId]);
    await db.query('INSERT INTO test_cash_wallet(account_id,balance) VALUES($1,100)',[s.accountId]);
  }
  await store.installCatalog([definition('first',1),definition('second',3)]);
});
after(async()=>{try{await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);}finally{await pool.end();}});
test('dois compradores: exatamente um dono e um débito',async()=>{
  const results=await Promise.allSettled(sessions.map(s=>mutate(s,input())));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.query('SELECT sum(gold) AS total FROM characters'))[0].total,'1900');
  assert.equal((await db.query('SELECT * FROM gold_transactions')).length,1);
  assert.equal((await db.query('SELECT * FROM aetherius_residence_keys')).length,1);
});
test('pedido repetido retorna o mesmo recibo e uma chave; mudança de moeda conflita',async()=>{
  const req=input(), first=await mutate(sessions[0],req), again=await mutate(sessions[0],req);
  assert.deepEqual(again,first);
  await assert.rejects(mutate(sessions[0],{...req,currency:'diademas'}),{code:'CONFLICT'});
  assert.equal((await db.query('SELECT * FROM gold_transactions')).length,1);
});
test('falha depois do débito desfaz dinheiro, dono e chave',async()=>{
  let calls=0;
  await assert.rejects(mutate(sessions[0],input(),()=>{if(++calls===2)fail('SESSION');}),{code:'SESSION'});
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[0].characterId]))[0].gold,1000);
  assert.equal((await db.query('SELECT * FROM aetherius_residence_keys')).length,0);
  assert.equal((await db.query('SELECT owner_profile_id FROM aetherius_residences WHERE id=$1',['first']))[0].owner_profile_id,null);
});
test('cash usa a mesma transação; recibo inválido reverte o saldo',async()=>{
  badCashReceipt=true;
  await assert.rejects(mutate(sessions[0],input({currency:'diademas'})),{code:'UNAVAILABLE'});
  assert.equal((await db.query('SELECT balance FROM test_cash_wallet WHERE account_id=$1',[sessions[0].accountId]))[0].balance,100);
  badCashReceipt=false;
  const result=await mutate(sessions[0],input({currency:'diademas'}));
  assert.equal(result.currency,'diademas');assert.equal(result.amount,10);
  assert.equal((await db.query('SELECT balance FROM test_cash_wallet WHERE account_id=$1',[sessions[0].accountId]))[0].balance,90);
  assert.equal((await db.query('SELECT * FROM gold_transactions')).length,0);
});
test('saldo insuficiente não produz posse',async()=>{
  await db.query('UPDATE characters SET gold=0');
  await assert.rejects(mutate(sessions[0],input()),{code:'FUNDS'});
  assert.equal((await db.query('SELECT * FROM aetherius_residence_operations')).length,0);
});
test('commit com resposta perdida é consultável e não cobra de novo',async()=>{
  const req=input();unknownCommit=true;
  await assert.rejects(mutate(sessions[0],req),{code:'UNKNOWN'});
  const result=await store.status(sessions[0],req.requestId);
  assert.ok(result.keyId);assert.deepEqual(await mutate(sessions[0],req),result);
  assert.equal((await db.query('SELECT * FROM gold_transactions')).length,1);
});
test('chave vinculada só é projetada no inventário pessoal do perfil autorizado',async()=>{
  await mutate(sessions[0],input());
  const keys=await store.inventoryKeys(sessions[0]);assert.equal(keys.length,1);assert.equal(keys[0].bound,true);assert.deepEqual(keys[0].actions,[]);
  for(const context of ['container','trade','loot'])assert.deepEqual(await store.inventoryKeys(sessions[0],context),[]);
  assert.deepEqual(await store.inventoryKeys(sessions[1]),[]);
  assert.equal((await store.inventoryKeys(sessions[0]))[0].id,keys[0].id);
});
test('outro perfil não gerencia a casa',async()=>{
  await mutate(sessions[0],input());
  await assert.rejects(mutate(sessions[1],input({action:'public',accessRevision:2,open:true})),{code:'FORBIDDEN'});
});
test('catalogar outra casa sobre referência persistida falha; retirada da oferta preserva proteção',async()=>{
  await mutate(sessions[0],input());
  await assert.rejects(store.installCatalog([definition('third',1)]),{code:'CONFLICT'});
  await store.installCatalog([]);
  const rows=await store.snapshot();assert.equal(rows.find(r=>r.id==='first').for_sale,false);
  assert.equal((await db.query('SELECT * FROM aetherius_residence_refs')).length,4);
});
test('reinicialização aceita referências retornadas como JSONB e atualização de preço preserva a posse',async()=>{
  await mutate(sessions[0],input());
  await store.installCatalog([definition('first',1),definition('second',3)]);
  const updated=definition('first',1);updated.revision=2;updated.prices.septims=150;
  await store.installCatalog([updated,definition('second',3)]);
  const row=(await store.snapshot()).find(r=>r.id==='first');
  assert.equal(row.owner_profile_id,sessions[0].profileId);
  assert.equal(row.revision,2);assert.equal(row.definition.prices.septims,150);
  const changed=definition('first',5);changed.revision=3;
  await assert.rejects(store.installCatalog([changed]),/referências/);
});

async function manage(action,values={},session=sessions[0]){
  const row=(await store.snapshot()).find(r=>r.id==='first');
  return mutate(session,{requestId:randomUUID(),action,residenceId:'first',accessRevision:row.access_revision,...values});
}
async function makePerson(profileId,name){const s={profileId,accountId:randomUUID(),characterId:randomUUID()};await db.query('INSERT INTO users(id,profile_id) VALUES($1,$2)',[s.accountId,profileId]);await db.query('INSERT INTO characters(id,user_id,name,gold) VALUES($1,$2,$3,1000)',[s.characterId,s.accountId,name]);return s;}
test('adição por nome completo cria visitante; homônimos exigem profile_id',async()=>{
  await mutate(sessions[0],input());const friend=await makePerson(3,'Pessoa Completa');
  await manage('addMember',{query:'Pessoa Completa'});
  const members=(await store.properties(sessions[0])).residences[0].members;assert.equal(members[0].profileId,friend.profileId);assert.equal(members[0].family,false);
  await makePerson(4,'Mesmo Nome');await makePerson(5,'Mesmo Nome');await assert.rejects(manage('addMember',{query:'Mesmo Nome'}),{code:'AMBIGUOUS'});
  await assert.rejects(manage('addMember',{query:'Não Existe'}),{code:'MEMBER_NOT_FOUND'});
});
test('cinco cadastros incluindo familiares: sexta pessoa recusada e remoção libera vaga',async()=>{
  await mutate(sessions[0],input());
  for(let n=3;n<=8;n++)await makePerson(n,'Pessoa '+n);
  for(let n=3;n<=7;n++)await manage('addMember',{query:String(n)});
  await manage('setFamily',{memberProfileId:3,family:true});
  await manage('setFamily',{memberProfileId:4,family:true});
  await assert.rejects(manage('addMember',{query:'8'}),{code:'MEMBER_LIMIT'});
  let h=(await store.properties(sessions[0])).residences[0];
  assert.equal(h.memberLimit,5);assert.equal(h.members.length,5);
  await manage('removeMember',{memberProfileId:7,confirmed:true});
  await manage('addMember',{query:'8'});
  h=(await store.properties(sessions[0])).residences[0];
  assert.equal(h.members.length,5);assert.ok(h.members.some(m=>m.profileId===8));
});

test('dois familiares; terceiro recusado e remoção revoga chave imediatamente',async()=>{
  await mutate(sessions[0],input());const members=[];for(let n=3;n<=5;n++){members.push(await makePerson(n,'Pessoa '+n));await manage('addMember',{query:String(n)});}
  await manage('setFamily',{memberProfileId:3,family:true});await manage('setFamily',{memberProfileId:4,family:true});
  await assert.rejects(manage('setFamily',{memberProfileId:5,family:true}),{code:'FAMILY_LIMIT'});
  assert.equal((await store.inventoryKeys(members[0])).length,1);
  await manage('removeMember',{memberProfileId:3,confirmed:true});assert.equal((await store.inventoryKeys(members[0])).length,0);
  await manage('setFamily',{memberProfileId:5,family:true});assert.equal((await store.properties(sessions[0])).residences[0].members.filter(m=>m.family).length,2);
});
test('anúncio paga vendedor, preserva dinheiro total e remove todas as permissões antigas',async()=>{
  await mutate(sessions[0],input());const friend=await makePerson(3,'Amigo');await manage('addMember',{query:'3'});await manage('setFamily',{memberProfileId:3,family:true});
  await manage('listSale',{amount:350});const row=(await store.snapshot()).find(r=>r.id==='first');
  const request=input({accessRevision:row.access_revision,offerKind:'resale'});const result=await mutate(sessions[1],request);assert.equal(result.amount,350);
  assert.deepEqual(await mutate(sessions[1],request),result);
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[0].characterId]))[0].gold,1250);
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[1].characterId]))[0].gold,650);
  assert.equal((await db.query('SELECT * FROM aetherius_residence_members')).length,0);
  assert.equal((await store.inventoryKeys(sessions[0])).length,0);assert.equal((await store.inventoryKeys(friend)).length,0);
  assert.equal((await store.inventoryKeys(sessions[1])).length,1);
});
test('imposto não aceita antecipação e quitação recupera a mesma chave',async()=>{
  await mutate(sessions[0],input());const key=(await store.inventoryKeys(sessions[0]))[0].id;
  let h=(await store.properties(sessions[0])).residences[0];
  await assert.rejects(manage('payTax',{dueAt:h.tax.dueAt,periods:1}),{code:'TAX_EARLY'});
  await db.query("UPDATE aetherius_residences SET tax_due_at=now()-interval '7 days 1 minute' WHERE id='first'");
  h=(await store.properties(sessions[0])).residences[0];assert.equal(h.tax.periods,2);assert.equal(h.tax.suspended,true);assert.equal((await store.inventoryKeys(sessions[0])).length,0);
  await manage('payTax',{dueAt:h.tax.dueAt,periods:2});assert.equal((await store.inventoryKeys(sessions[0]))[0].id,key);
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[0].characterId]))[0].gold,880);
});
test('quitação disputa com recompra e apenas uma pode vencer',async()=>{
  await mutate(sessions[0],input());await db.query("UPDATE aetherius_residences SET tax_due_at=now()-interval '14 days 1 minute' WHERE id='first'");
  const h=(await store.properties(sessions[0])).residences[0],row=(await store.snapshot()).find(r=>r.id==='first');
  const results=await Promise.allSettled([mutate(sessions[0],{requestId:randomUUID(),action:'payTax',residenceId:'first',accessRevision:row.access_revision,dueAt:h.tax.dueAt,periods:3}),mutate(sessions[1],input({accessRevision:row.access_revision,offerKind:'foreclosure'}))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const current=(await store.snapshot()).find(r=>r.id==='first');assert.ok([1,2].includes(current.owner_profile_id));
});
test('falha ao creditar vendedor desfaz débito e mantém dono e anúncio',async()=>{
  await mutate(sessions[0],input());await manage('listSale',{amount:300});
  await db.query("UPDATE characters SET status='retired' WHERE id=$1",[sessions[0].characterId]);
  const row=(await store.snapshot()).find(r=>r.id==='first');
  await assert.rejects(mutate(sessions[1],input({accessRevision:row.access_revision,offerKind:'resale'})),{code:'SELLER'});
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[1].characterId]))[0].gold,1000);
  const after=(await store.snapshot()).find(r=>r.id==='first');assert.equal(after.owner_profile_id,1);assert.equal(after.listing_price,300);
});
test('oferta de revenda vencida não cobra o preço de retomada sem reconfirmar',async()=>{
  await mutate(sessions[0],input());await manage('listSale',{amount:50});
  const row=(await store.snapshot()).find(r=>r.id==='first');
  await db.query("UPDATE aetherius_residences SET tax_due_at=now()-interval '14 days 1 minute' WHERE id='first'");
  await assert.rejects(mutate(sessions[1],input({accessRevision:row.access_revision,offerKind:'resale'})),{code:'PRICE_CHANGED'});
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[1].characterId]))[0].gold,1000);
  await mutate(sessions[1],input({accessRevision:row.access_revision,offerKind:'foreclosure'}));
  assert.equal((await db.query('SELECT gold FROM characters WHERE id=$1',[sessions[0].characterId]))[0].gold,900);
  assert.equal((await store.inventoryKeys(sessions[0])).length,0);
  await assert.rejects(manage('payTax',{dueAt:row.tax_due_at,periods:3},sessions[0]),{code:'FORBIDDEN'});
});
