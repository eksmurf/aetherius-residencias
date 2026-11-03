'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {taxView,terms,offerKind,TAX_PERIOD_MS}=require('../server/gamemode/residences/tax.cjs');
const {authorizeReference}=require('../server/gamemode/residences/access.cjs');
const {request,createService}=require('../server/gamemode/residences/service.cjs');
const start=Date.parse('2026-10-29T00:00:00.000Z');
const row={owner_profile_id:1,owner_account_id:'owner',locked:true,tax_due_at:new Date(start+TAX_PERIOD_MS).toISOString(),tax_terms:terms(1000),members:[{profile_id:2,account_id:'family',family:true},{profile_id:3,account_id:'visitor',family:false}]};
test('imposto só abre aos 15 dias; 30 suspende; 45 recoloca à venda; dívida continua acumulando',()=>{
  assert.equal(TAX_PERIOD_MS,15*24*60*60*1000);
  const cases=[[0,0,false,false],[TAX_PERIOD_MS-1,0,false,false],[7*86400000,0,false,false],[14*86400000,0,false,false],[TAX_PERIOD_MS,1,false,false],[2*TAX_PERIOD_MS-1,1,false,false],[2*TAX_PERIOD_MS,2,true,false],[3*TAX_PERIOD_MS-1,2,true,false],[3*TAX_PERIOD_MS,3,true,true],[4*TAX_PERIOD_MS,4,true,true]];
  for(const [elapsed,periods,suspended,auction]of cases){const t=taxView(row,()=>true,start+elapsed);assert.equal(t.periods,periods);assert.equal(t.suspended,suspended);assert.equal(t.auction,auction);assert.equal(t.canPay,periods>0);assert.equal(t.amount,periods*100);}
});
test('imposto usa valor base em Septims e arredonda para unidade inteira',()=>{
  assert.deepEqual(terms(1001),{amount:101,currency:'septims',periodDays:15,basePrice:1001});assert.throws(()=>terms(null),{code:'TAX_BASE'});
});

test('IPTU semanal inesperado exige reconciliação, sem reinterpretar a dívida',()=>{
  assert.throws(()=>taxView({...row,tax_terms:{...row.tax_terms,periodDays:7}}),{code:'TAX_PERIOD'});
});
test('data retornada pelo PostgreSQL preserva milissegundos no pedido de quitação',()=>{
  const due=new Date('2026-11-05T12:34:56.789Z');assert.equal(taxView({...row,tax_due_at:due},()=>true,due.getTime()).dueAt,due.toISOString());
});
test('anúncio voluntário suspende aos 30 dias e vira oferta de retomada aos 45',()=>{
  const listed={...row,listing_price:2500};assert.equal(offerKind(listed,start+TAX_PERIOD_MS),'resale');assert.equal(offerKind(listed,start+2*TAX_PERIOD_MS),null);assert.equal(offerKind(listed,start+3*TAX_PERIOD_MS),'foreclosure');
});
test('dono, familiar e visitante entram diretamente; apenas dono e familiar usam armazenamento',()=>{
  const current={...row,tax_due_at:new Date(Date.now()+TAX_PERIOD_MS).toISOString()};
  for(const [profileId,accountId,storage]of [[1,'owner',true],[2,'family',true],[3,'visitor',false]]){
    const input={residence:current,session:{profileId,accountId},nearby:true};
    assert.equal(authorizeReference({...input,ref:{kind:'entry'},transfer:false}),true);
    assert.equal(authorizeReference({...input,ref:{kind:'container'},transfer:true}),storage);
    assert.equal(authorizeReference({...input,ref:{kind:'container'},transfer:false}),storage);
  }
});
test('remover familiar dentro da casa impede abrir e transferir; saída segue livre',()=>{
  const current={...row,members:[],tax_due_at:new Date(Date.now()+TAX_PERIOD_MS).toISOString()},session={profileId:2,accountId:'family'};
  for(const transfer of [false,true])assert.equal(authorizeReference({ref:{kind:'container'},residence:current,session,nearby:true,transfer}),false);
  assert.equal(authorizeReference({ref:{kind:'entry'},residence:current,session,nearby:true,transfer:false}),false);
  assert.equal(authorizeReference({ref:{kind:'exit'},residence:current,session,nearby:true,transfer:false}),true);
});
test('porta pública nunca concede baús; imposto suspende até o dono e familiares',()=>{
  const current={...row,locked:false,tax_due_at:new Date(Date.now()-TAX_PERIOD_MS-1000).toISOString()};
  for(const session of [{profileId:1,accountId:'owner'},{profileId:2,accountId:'family'},{profileId:3,accountId:'visitor'}]){
    assert.equal(authorizeReference({ref:{kind:'entry'},residence:current,session,nearby:true,transfer:false}),false);
    assert.equal(authorizeReference({ref:{kind:'container'},residence:current,session,nearby:true,transfer:true}),false);
    assert.equal(authorizeReference({ref:{kind:'exit'},residence:current,session,nearby:true,transfer:false}),true);
  }
});
test('cliente não pode repor chave, escolher destinatário do dinheiro ou remover sem confirmação',()=>{
  const base={version:1,requestId:randomUUID(),residenceId:'first',accessRevision:1};
  assert.throws(()=>request({...base,action:'reissue'}),{code:'INVALID'});
  assert.throws(()=>request({...base,action:'removeMember',memberProfileId:2,confirmed:false}),{code:'INVALID'});
  assert.throws(()=>request({...base,action:'listSale',amount:100,sellerProfileId:9}),{code:'INVALID'});
  assert.throws(()=>request({...base,action:'listSale',amount:0}),{code:'INVALID'});
});
test('canal de compra não abre gerenciamento e imóvel privado não envia oferta',async()=>{
  const identity={},session={profileId:8,accountId:'stranger',identity},notices=[],packets=[];
  const service=createService({store:{},host:{session:()=>session,retireLegacyKeys(){},assertNear(){},notify:(_s,msg)=>notices.push(msg),send:(_s,msg)=>packets.push(msg)},currencies:{available:()=>true},state:{available:()=>true,get:()=>({...row,tax_due_at:new Date(Date.now()+TAX_PERIOD_MS).toISOString()})},purchasesEnabled:true});
  await assert.rejects(service.handle(1,{version:1,requestId:randomUUID(),action:'properties'}),{code:'FORBIDDEN'});
  await service.receive(1,{version:1,requestId:randomUUID(),action:'offer',residenceId:'first'});
  assert.deepEqual(notices,['Residência privada']);assert.ok(!packets.some(p=>p.action==='offer'&&p.status==='succeeded'));
});
