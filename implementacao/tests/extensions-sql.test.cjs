'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE||'@electric-sql/pglite');
const {createStore}=require(path.join(process.env.RESIDENCES_SOURCE||path.resolve(__dirname,'../server/gamemode/residences'),'store.cjs'));
const {createCurrencies}=require('../server/gamemode/residences/currencies.cjs');
test('extensões: SQL transacional, imposto retido, visita e recuperação',async t=>{
  const pg=new PGlite();t.after(()=>pg.close());
  for(const name of ['001_residences.sql','002_household_tax.sql','003_city_tax_collection.sql','006_residence_extensions.sql'])await pg.exec(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8'));
  if(process.env.RESIDENCES_SOURCE)await pg.exec(fs.readFileSync(path.join(process.env.RESIDENCES_SOURCE,'004_door_registration.sql'),'utf8'));
  await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY,profile_id int,is_banned boolean,role text);
    CREATE TABLE characters(id uuid PRIMARY KEY,user_id uuid,status text,name text,gold int);
    CREATE TABLE fixture_credits(id text PRIMARY KEY,amount int);`);
  const s={accountId:randomUUID(),characterId:randomUUID(),profileId:1,identity:{}},other={accountId:randomUUID(),characterId:randomUUID(),profileId:2,identity:{}};
  for(const p of [s,other]){await pg.query('INSERT INTO users VALUES($1,$2,false,$3)',[p.accountId,p.profileId,'superadmin']);await pg.query("INSERT INTO characters VALUES($1,$2,'approved','Fixture',1000000)",[p.characterId,p.accountId]);}
  let failCredit=false,loseCommit=false,creditCalls=0;const guards=new Set(),returned=[];
  const sql=async(q,p)=>(await pg.query(q,p)).rows;
  const db={query:sql,getConnection:async()=>({beginTransaction:()=>pg.exec('BEGIN'),async commit(){await pg.exec('COMMIT');if(loseCommit){loseCommit=false;throw Error('ack perdido');}},rollback:()=>pg.exec('ROLLBACK'),release(){},async query(q,p){return [await sql(q,p)];}})};
  const currencies=createCurrencies({tx:{applyGoldDelta:(c,id,delta)=>c.query('UPDATE characters SET gold=gold+$2 WHERE id=$1',[id,delta]),recordGoldLedger:async()=>randomUUID()}});
  let inside=false,alive=true,combat=false,safe=true;
  const runtime={contract:'aetherius-residence-extensions-v1',withTransferBarrier:async(_ctx,work)=>work(),
    async creditInstantSaleInTransaction(conn,p){creditCalls++;await conn.query('INSERT INTO fixture_credits VALUES($1,$2)',[p.idempotencyKey,p.amount]);await conn.query('UPDATE characters SET gold=gold+$2 WHERE id=$1',[p.characterId,p.amount]);if(failCredit)throw Error('crédito interrompido');return {...p,transactionId:p.operationId};},
    async prepareTour(){return {alive:true,inCombat:false,verified:true,cell:'100:test.esm',destination:{fixture:true},returnPoint:{fixture:true}};},
    async protectTour(tour){guards.add(tour.id);},async enterTour(){inside=true;},
    async observeTour(){return {alive,inCombat:combat,connected:true,sameSession:true,inside,arrived:inside};},
    async returnTour(tour){returned.push(tour.id);if(safe)inside=false;return {safe};},async releaseTour(tour){guards.delete(tour.id);},
    async revokeToursBeforeTransfer(ids){ids.forEach(id=>guards.add(id));}
  };
  const store=createStore({db,currencies,runtime,features:{instantSale:true,tours:true}}),guard=()=>{};
  const definition={id:'fixture',name:'Casa fictícia',revision:1,forSale:true,prices:{septims:100000},interiorCells:['100:test.esm'],storageGuards:[],interiorPassages:[],refs:[{desc:'1:test.esm',kind:'entry',partner:'2:test.esm'},{desc:'2:test.esm',kind:'exit',partner:'1:test.esm'}]};
  await store.installCatalog([definition]);
  const row=async()=>(await sql('SELECT * FROM aetherius_residences'))[0];
  const buy=async()=>{const r=await row();return store.mutate(s,{action:'purchase',requestId:randomUUID(),residenceId:'fixture',revision:1,accessRevision:r.access_revision,offerKind:'initial',currency:'septims'},guard,guard,true);};
  await pg.query("UPDATE aetherius_residences SET acquisition_history=$1",[JSON.stringify({status:'never',evidence:'fixture'})]);await buy();
  await t.test('primeiro vencimento cancela anúncio offline e quitação exige novo anúncio, inclusive antes da limpeza',async()=>{
    const manage=async(action,extra={})=>store.mutate(s,{action,requestId:randomUUID(),residenceId:'fixture',accessRevision:(await row()).access_revision,...extra},guard,guard,true);
    await manage('listSale',{amount:120000});
    await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '1 second'");
    await assert.rejects(manage('listSale',{amount:130000}),{code:'TAX_UNPAID'});
    const revision=(await row()).access_revision;
    await store.snapshot();assert.equal((await row()).listing_price,null);assert.equal((await row()).seller_character_id,null);
    assert.equal((await row()).access_revision,revision+1);await store.snapshot();assert.equal((await row()).access_revision,revision+1);
    const before=(await sql('SELECT gold FROM characters WHERE id=$1',[other.characterId]))[0].gold;
    await assert.rejects(store.mutate(other,{action:'purchase',requestId:randomUUID(),residenceId:'fixture',revision:1,accessRevision:(await row()).access_revision,offerKind:'resale',currency:'septims'},guard,guard,true),{code:'PRICE_CHANGED'});
    assert.equal((await sql('SELECT gold FROM characters WHERE id=$1',[other.characterId]))[0].gold,before);
    const bill=(await store.properties(s)).residences[0].tax;
    await manage('payTax',{dueAt:bill.dueAt,periods:bill.periods});assert.equal((await row()).listing_price,null);
    await manage('listSale',{amount:130000});assert.equal((await row()).listing_price,130000);
    await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '1 second'");
    // Pay directly, without a snapshot or properties read that could already cancel it.
    await manage('payTax',{dueAt:new Date((await row()).tax_due_at).toISOString(),periods:1});
    assert.equal((await row()).listing_price,null);assert.equal((await row()).seller_character_id,null);
    await manage('listSale',{amount:140000});
    await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '1 second'");
    const props=await store.properties(s);assert.equal(props.residences[0].listingPrice,null);assert.equal((await row()).listing_price,null);
    await manage('payTax',{dueAt:props.residences[0].tax.dueAt,periods:1});
    // Keep the following independent receipt scenarios isolated from this tax payment.
    await pg.exec('DELETE FROM aetherius_residence_tax_collections');
  });
  const makeQuote=async()=>store.extensions.quote(s,{residenceId:'fixture',accessRevision:(await row()).access_revision},guard);
  const input=q=>({requestId:randomUUID(),residenceId:'fixture',quoteId:q.quoteId});
  const ready=async q=>{await store.extensions.arm(s,input(q),guard);await pg.query("UPDATE aetherius_residence_sale_quotes SET ready_at=clock_timestamp()-interval '1 second' WHERE id=$1",[q.quoteId]);};
  await t.test('espera autoritativa, sessão e cancelamento',async()=>{
    const q=await makeQuote(),i=input(q);await store.extensions.arm(s,i,guard);
    await assert.rejects(store.extensions.sell(s,i,guard),{code:'QUOTE_EARLY'});
    await assert.rejects(store.extensions.arm({...s,identity:{}},i,guard),{code:'QUOTE_EXPIRED'});
    await store.extensions.cancel(s,i);await assert.rejects(store.extensions.sell(s,i,guard),{code:'QUOTE_EXPIRED'});assert.equal(creditCalls,0);
  });
  await t.test('falha de crédito reverte posse, saldo e recibo',async()=>{
    const q=await makeQuote();await ready(q);failCredit=true;
    await assert.rejects(store.extensions.sell(s,input(q),guard),/crédito interrompido/);failCredit=false;
    assert.equal((await row()).owner_profile_id,1);assert.equal((await sql('SELECT * FROM fixture_credits')).length,0);
  });
  await t.test('mudança de revisão e novo vencimento invalidam a cotação antes do crédito',async()=>{
    let q=await makeQuote();await ready(q);
    await pg.exec('UPDATE aetherius_residences SET access_revision=access_revision+1');
    await assert.rejects(store.extensions.sell(s,input(q),guard),{code:'STALE'});
    q=await makeQuote();await ready(q);await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '1 second'");
    await assert.rejects(store.extensions.sell(s,input(q),guard),{code:'STALE'});
    assert.equal((await sql('SELECT * FROM fixture_credits')).length,0);
  });
  await t.test('IPTU é retido do retorno; perda de resposta não duplica venda',async()=>{
    await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '1 second'");
    const q=await makeQuote();assert.equal(q.net,30000);await ready(q);const i=input(q);loseCommit=true;
    await assert.rejects(store.extensions.sell(s,i,guard),{code:'UNKNOWN'});
    const receipt=await store.extensions.sell(s,i,guard);assert.equal(receipt.amount,30000);assert.equal(receipt.taxWithheld,10000);
    assert.equal((await row()).owner_profile_id,null);assert.equal((await row()).acquisition_history.status,'acquired');
    assert.equal((await sql('SELECT * FROM fixture_credits')).length,1);
    assert.equal((await sql('SELECT * FROM aetherius_residence_tax_collections'))[0].amount,10000);
    assert.equal((await sql('SELECT * FROM aetherius_residence_members')).length,0);
    assert.ok((await sql('SELECT * FROM aetherius_residence_keys')).every(k=>k.delivery_state==='revoked'));
  });
  await t.test('visita de imóvel liberado, repetição não renova prazo, retorno persiste se falhar',async()=>{
    const visit=await store.tours.start(other,{residenceId:'fixture',revision:1,door:'1:test.esm'},guard);assert.equal(visit.state,'entering');assert.equal(guards.size,1);
    await store.tours.step();const active=await store.tours.status(other);assert.equal(active.state,'active');
    const repeat=await store.tours.start(other,{residenceId:'fixture',revision:1,door:'1:test.esm'},guard);assert.equal(new Date(repeat.deadline).getTime(),new Date(active.deadline).getTime());
    safe=false;await store.tours.end(other);await store.tours.step();assert.equal((await store.tours.status(other)).state,'returning');assert.equal(guards.size,1);
    safe=true;await store.tours.step();assert.equal(await store.tours.status(other),null);assert.equal(guards.size,0);
  });
  await t.test('IPTU maior que retorno: líquido zero, excedente encerrado e cidade recebe só retenção',async()=>{
    await buy();await pg.exec("UPDATE aetherius_residences SET tax_due_at=clock_timestamp()-interval '60 days'");
    const q=await makeQuote();assert.equal(q.net,0);assert.equal(q.taxWaived,10000);await ready(q);
    const receipt=await store.extensions.sell(s,input(q),guard);assert.equal(receipt.amount,0);assert.equal(receipt.taxWaived,10000);
    const pending=await sql('SELECT sum(amount)::int AS amount FROM aetherius_residence_tax_collections');assert.equal(pending[0].amount,50000);
    assert.equal((await sql('SELECT * FROM fixture_credits')).length,1);
  });
  await t.test('revisão da ficha e invalidação antes do débito',async()=>{
    const sheet={revision:1,catalogRevision:1,source:'fixture',verifiedAt:new Date().toISOString(),cells:['100:test.esm'],complete:Object.keys(require('../server/gamemode/residences/amenities.cjs').labels),objects:[]};
    await store.extensions.review(s,{requestId:randomUUID(),residenceId:'fixture',expectedRevision:0,sheet},guard);
    await assert.rejects(buy(),{code:'AMENITIES_CHANGED'});
    assert.equal((await row()).owner_profile_id,null);
  });
});
