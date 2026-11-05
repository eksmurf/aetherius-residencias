'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {taxView,terms,offerKind,TAX_PERIOD_MS}=require('../server/gamemode/residences/tax.cjs');
const {authorizeReference}=require('../server/gamemode/residences/access.cjs');
const {request,createService}=require('../server/gamemode/residences/service.cjs');
const {cityRequest,createCityTaxes}=require('../server/gamemode/residences/city-taxes.cjs');
const {createHost}=require('../server/gamemode/residences/host.cjs');
const start=Date.parse('2026-10-29T00:00:00.000Z');
const row={owner_profile_id:1,owner_account_id:'owner',locked:true,tax_due_at:new Date(start+TAX_PERIOD_MS).toISOString(),tax_terms:terms(1000),members:[{profile_id:2,account_id:'family',family:true},{profile_id:3,account_id:'visitor',family:false}]};
test('pagamento libera aos 15 dias; 30 suspende e 45 recoloca à venda',()=>{
  assert.equal(TAX_PERIOD_MS,15*24*60*60*1000);
  const cases=[[0,0,false,false],[TAX_PERIOD_MS-1,0,false,false],[7*86400000,0,false,false],[14*86400000,0,false,false],[TAX_PERIOD_MS,1,false,false],[2*TAX_PERIOD_MS-1,1,false,false],[2*TAX_PERIOD_MS,2,true,false],[3*TAX_PERIOD_MS-1,2,true,false],[3*TAX_PERIOD_MS,3,true,true],[4*TAX_PERIOD_MS,4,true,true]];
  for(const [elapsed,periods,suspended,auction]of cases){const t=taxView(row,()=>true,start+elapsed);assert.equal(t.periods,periods);assert.equal(t.suspended,suspended);assert.equal(t.auction,auction);assert.equal(t.canPay,periods>0);assert.equal(t.advance,false);assert.equal(t.paymentAmount,periods*100);assert.equal(t.paymentPeriods,periods);assert.equal(t.amount,periods*100);}
});
test('imposto usa valor base em Septims e arredonda para unidade inteira',()=>{
  assert.deepEqual(terms(1001),{amount:101,currency:'septims',periodDays:15,basePrice:1001});assert.throws(()=>terms(null),{code:'TAX_BASE'});
});

test('IPTU semanal inesperado exige reconciliação, sem reinterpretar a dívida',()=>{
  assert.throws(()=>taxView({...row,tax_terms:{...row.tax_terms,periodDays:7}}),{code:'TAX_PERIOD'});
});

test('pedido de imposto exige ao menos uma parcela vencida',()=>{
  const input={version:1,requestId:randomUUID(),action:'payTax',residenceId:'first',accessRevision:1,dueAt:new Date(start+TAX_PERIOD_MS).toISOString(),periods:0};
  assert.throws(()=>request(input),{code:'INVALID'});
  assert.equal(request({...input,periods:1}).periods,1);
  assert.throws(()=>request({...input,periods:-1}),{code:'INVALID'});
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

test('vínculo municipal exige payload próprio e não pode ser enviado pelo painel de residências',()=>{
  const payload={requestId:randomUUID(),residenceId:'first',cityId:'whiterun',bindingRevision:0};
  assert.equal(cityRequest('linkCity',payload).cityId,'whiterun');
  assert.throws(()=>cityRequest('linkCity',{...payload,collectorProfileId:1}),{code:'INVALID'});
  assert.throws(()=>cityRequest('linkCity',{...payload,cityId:''}),{code:'INVALID'});
  assert.throws(()=>cityRequest('linkCity',{...payload,bindingRevision:-1}),{code:'INVALID'});
  assert.throws(()=>request({...payload,version:1,action:'linkCity'}),{code:'INVALID'});
  assert.throws(()=>request({version:1,requestId:randomUUID(),action:'collectTax',residenceId:'first'}),{code:'INVALID'});
  assert.equal(createCityTaxes({}).enabled,false);
  assert.throws(()=>createCityTaxes({cities:{contract:'other'}}));
});

test('coleta exige proximidade da porta de entrada exata e a sessão atual',()=>{
  const identity={profile_id:1,userId:10},character={profileId:1,accountId:randomUUID(),characterId:randomUUID()};
  let distance=250,current=true;
  const descriptions={1:'1:fixture.esp',2:'2:fixture.esp'};
  const mp={aetheriusOfficialIdentity:{session:()=>identity,isCurrent:()=>current},
    getIdFromDesc:desc=>Number(Object.keys(descriptions).find(id=>descriptions[id]===desc)),
    getDescFromId:id=>descriptions[id],
    get:id=>({cellOrWorldDesc:'a:fixture.esp',pos:id===10?[distance,0,0]:[0,0,0]})};
  const host=createHost({mp,commands:{getActiveCharacterData:()=>character}});
  const session=host.session(10),residence={definition:{refs:[{kind:'entry',desc:'1:fixture.esp'},{kind:'exit',desc:'2:fixture.esp'}]}};
  host.assertAtEntry(session,residence,'1:fixture.esp');
  assert.throws(()=>host.assertAtEntry(session,residence,'2:fixture.esp'),{code:'DISTANCE'});
  distance=251;
  assert.throws(()=>host.assertAtEntry(session,residence,'1:fixture.esp'),{code:'DISTANCE'});
  current=false;
  assert.throws(()=>host.assertAtEntry(session,residence,'1:fixture.esp'),{code:'SESSION'});
});

test('ativação captura proximidade antes do SQL e permite atravessar uma porta autorizada',async()=>{
  let nearby=true,collections=0;
  const notices=[],session={profileId:9},residence={definition:{refs:[{kind:'entry',desc:'1:fixture.esp'}]}};
  const service=createService({
    store:{cityTaxes:{enabled:true,async collect(_session,_input,guard){
      collections++;nearby=false;guard(residence);return{amount:20};
    }}},
    host:{session:()=>session,assertCurrent(){},assertAtEntry(){if(!nearby)throw Object.assign(new Error('distance'),{code:'DISTANCE'});},notify:(_session,message)=>notices.push(message)},
    state:{available:()=>true,get:()=>residence,refresh:async()=>{}},
  });
  assert.equal(await service.collectAtDoor(9,'first','1:fixture.esp'),true);
  assert.equal(collections,1);assert.match(notices[0],/20 Septims/);
  await service.collectAtDoor(9,'first','1:fixture.esp');
  assert.equal(collections,1);
});
