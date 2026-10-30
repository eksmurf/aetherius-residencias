'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validateCatalog, descriptor } = require('../server/gamemode/residences/catalog.cjs');
const { request } = require('../server/gamemode/residences/service.cjs');
const { createCurrencies } = require('../server/gamemode/residences/currencies.cjs');
const { createHost } = require('../server/gamemode/residences/host.cjs');
const { authorizeReference } = require('../server/gamemode/residences/access.cjs');
const sample = () => ({ id:'fixture', name:'Imóvel fictício de teste',revision:1,forSale:true,interiorCells:['100:Fixture.esp'],interiorPassages:[],storageGuards:[],prices:{septims:100,diademas:10},
  refs:[{desc:'1:Fixture.esp',kind:'entry',partner:'2:Fixture.esp'},{desc:'2:Fixture.esp',kind:'exit',partner:'1:Fixture.esp'},{desc:'3:Fixture.esp',kind:'container'}] });
test('catálogo não permite vender a mesma porta em imóveis distintos', () => {
  assert.throws(()=>validateCatalog([sample(),{...sample(),id:'second'}]),{code:'INVALID'});
});
test('pares incompletos e moeda inventada são rejeitados', () => {
  const definition=sample(); definition.refs[1].partner='4:Fixture.esp';
  assert.throws(()=>validateCatalog([definition]),{code:'INVALID'});
  assert.throws(()=>validateCatalog([{...sample(),prices:{cash:10}}]),{code:'INVALID'});
});
test('endereço canônico não depende de maiúsculas ou zeros',()=>{
  assert.equal(descriptor('0000AB:Fixture.esp'),'ab:fixture.esp');
  assert.throws(()=>descriptor('FE000ABC:Fixture.esp'),{code:'INVALID'});
});
test('não aceita preço ou comprador escolhido pelo cliente',()=>{
  const input={version:1,requestId:randomUUID(),action:'purchase',residenceId:'fixture',revision:1,accessRevision:1,offerKind:'initial',currency:'septims'};
  assert.deepEqual(request(input),input);
  for(const extra of [{price:1},{profileId:999},{accountId:randomUUID()}]) assert.throws(()=>request({...input,...extra}),{code:'INVALID'});
  assert.throws(()=>request({...input,residenceId:undefined}),{code:'INVALID'});
});
test('cash sem adaptador falha sem tentar débito',async()=>{
  const currencies=createCurrencies({tx:{applyGoldDelta(){throw Error('unexpected');},recordGoldLedger(){throw Error('unexpected');}}});
  assert.equal(currencies.available('diademas'),false);
  await assert.rejects(currencies.debit({}, {currency:'diademas',amount:10}),{code:'DIADEMAS_UNAVAILABLE'});
});
test('migração retira apenas chaves residenciais legadas sem criar item transferível',()=>{
  const identity={profile_id:11,userId:0},character={profileId:11,accountId:randomUUID(),characterId:randomUUID()};
  let inv={entries:[{baseId:99,count:2,name:'Item existente'},{baseId:4,count:1,name:'Chave residencial [AR:'+randomUUID()+']'}]};
  const mp={aetheriusOfficialIdentity:{session:()=>identity,isCurrent:x=>x===identity},getIdFromDesc:()=>4,getDescFromId:()=> '4:fixture.esp',get:()=>inv,set:(_id,_key,v)=>{inv=v;}};
  const host=createHost({mp,commands:{getActiveCharacterData:()=>character},keyDescriptor:'4:fixture.esp'});
  host.retireLegacyKeys(host.session(25));assert.deepEqual(inv.entries,[{baseId:99,count:2,name:'Item existente'}]);
});
test('posição indisponível ou em outra célula não autoriza compra',()=>{
  const mp={getIdFromDesc:()=>4,getDescFromId:()=> '4:fixture.esp',get:()=>{throw Error('missing');}};
  const host=createHost({mp,commands:{},keyDescriptor:'4:fixture.esp'});
  assert.equal(host.near(1,2),false);
  mp.get=id=>({cellOrWorldDesc:id===1?'a:fixture.esp':'b:fixture.esp',pos:[0,0,0]});
  assert.equal(host.near(1,2),false);
});
test('todas as entradas obedecem à mesma fechadura e a saída continua livre',()=>{
  const residence={owner_profile_id:1,owner_account_id:'owner',locked:true};
  const input={residence,session:{profileId:2,accountId:'visitor'},nearby:true,transfer:false};
  assert.equal(authorizeReference({...input,ref:{kind:'entry'}}),false);
  assert.equal(authorizeReference({...input,ref:{kind:'exit'}}),true);
  assert.equal(authorizeReference({...input,residence:{...residence,locked:false},ref:{kind:'entry'}}),true);
  assert.equal(authorizeReference({ref:{kind:'exit'}}),true);
});
test('porta aberta não concede inventário do baú e perfil sem conta correspondente não é dono',()=>{
  const input={ref:{kind:'container'},residence:{owner_profile_id:1,owner_account_id:'owner',locked:false},nearby:true,transfer:true};
  assert.equal(authorizeReference({...input,session:{profileId:2,accountId:'visitor'}}),false);
  assert.equal(authorizeReference({...input,session:{profileId:1,accountId:'wrong'}}),false);
  assert.equal(authorizeReference({...input,session:{profileId:1,accountId:'owner'}}),true);
});
