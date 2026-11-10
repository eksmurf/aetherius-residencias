'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {instantOffer,tourEligible,acquisition}=require('../server/gamemode/residences/estate-policy.cjs');
const {validateSheet,publicSheet,labels}=require('../server/gamemode/residences/amenities.cjs');
const {request}=require('../server/gamemode/residences/service.cjs');
const baseRow=()=>({owner_profile_id:1,owner_account_id:'account',for_sale:true,revision:1,definition:{interiorCells:['1:test.esm']},tax_due_at:new Date(Date.now()+100000).toISOString(),tax_terms:{amount:10000,basePrice:100000,periodDays:15},acquisition_history:{status:'acquired',chain:'septims',currency:'septims',base:100000,profileId:1,accountId:'account'}});
test('40% da base, desconto de IPTU limitado ao retorno, sem débito adicional',()=>{
  const row=baseRow();assert.equal(instantOffer(row).net,40000);
  row.tax_due_at=new Date(Date.now()-1000).toISOString();assert.equal(instantOffer(row).net,30000);
  row.tax_due_at=new Date(Date.now()-4*15*86400000-1000).toISOString();
  const q=instantOffer(row);assert.equal(q.net,0);assert.equal(q.taxWithheld,40000);assert.equal(q.taxWaived,10000);
  row.acquisition_history.base=101;row.tax_due_at=new Date(Date.now()+100000).toISOString();assert.equal(instantOffer(row).amount,40);assert.equal(instantOffer(row).loss,61);
});
test('Diademas e cadeia desconhecida nunca convertem elegibilidade; base não é preço do anúncio',()=>{
  const row=baseRow();row.listing_price=1;assert.equal(instantOffer(row).amount,40000);
  for(const chain of ['diademas','unknown']){row.acquisition_history.chain=chain;assert.equal(instantOffer(row).eligible,false);}
  const h=acquisition(row,{profileId:1,accountId:'account',characterId:'character'},'septims',1,100000,'op');assert.equal(h.chain,'unknown');
  row.acquisition_history.chain='diademas';assert.equal(acquisition(row,{},'septims',1,100000,'op').chain,'diademas');
});
test('visita retorna à casa sem dono, mas não à revenda com morador',()=>{
  const row=baseRow();assert.equal(tourEligible(row),false);row.owner_profile_id=null;assert.equal(tourEligible(row),true);row.for_sale=false;assert.equal(tourEligible(row),false);
});
const sheet=()=>({revision:1,catalogRevision:1,cells:['1:test.esm'],source:'Fixture, não é evidência oficial',verifiedAt:new Date().toISOString(),complete:Object.keys(labels),objects:[{id:'2:test.esm',cell:'1:test.esm',functions:['storage'],state:'usable',present:true,accessible:true,functional:true,persistenceVerified:true,subtype:'Baú',reason:'',evidence:'Fixture'}]});
test('ficha deriva contagens, separa ausência de desconhecido e não divulga objetos',()=>{
  const row=baseRow();assert.equal(publicSheet(row).items[0].count,null);
  row.amenities=sheet();const v=publicSheet(row);assert.equal(v.verified,true);assert.equal(v.items[0].count,1);assert.equal(v.items[1].count,0);assert.ok(!JSON.stringify(v).includes('2:test.esm'));
  row.revision=2;assert.equal(publicSheet(row).verified,false);
});
test('ficha rejeita duplicação, persistência não comprovada e objeto de outra célula',()=>{
  for(const change of [s=>s.objects.push({...s.objects[0]}),s=>s.objects[0].persistenceVerified=false,s=>s.objects[0].cell='3:test.esm',s=>s.objects[0].state='conditional']){const s=sheet();change(s);assert.throws(()=>validateSheet(s,baseRow()),{code:'AMENITIES'});}
});
test('protocolo recusa valores e identidade injetados na venda e tour',()=>{
  const input={version:1,requestId:randomUUID(),action:'instantSell',residenceId:'house',quoteId:randomUUID()};assert.deepEqual(request(input),input);
  for(const extra of [{amount:1},{accountId:randomUUID()},{readyAt:0}])assert.throws(()=>request({...input,...extra}),{code:'INVALID'});
});
