'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
async function harness(){
  let definition;const calls=[];const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
  const document={activeElement:null,createElement:element};
  function element(tag){return {tag,children:[],dataset:{},textContent:'',disabled:false,classList:{add(){},remove(){}},
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
    setAttribute(k,v){this[k]=v;},focus(){document.activeElement=this;},contains(target){return target===this||this.children.some(c=>c.contains(target));},
    querySelectorAll(selector){const match=n=>selector==='[data-due]'?n.dataset.due!==undefined:selector.split(',').includes(n.tag);return this.children.flatMap(c=>[...(match(c)?[c]:[]),...c.querySelectorAll(selector)]);}};}
  const residence={residenceId:'first',name:'Breezehome',accessRevision:3,open:false,listingPrice:null,familyLimit:2,
    tax:{configured:true,periods:1,amount:100,weeklyAmount:100,dueAt:new Date().toISOString(),nextAccrualAt:new Date(Date.now()+86400000).toISOString(),canPay:true,suspended:false,auction:false},
    members:[{profileId:2,name:'Pessoa Dois',family:true},{profileId:3,name:'Pessoa Três',family:true},{profileId:4,name:'Pessoa Quatro',family:false}]};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client/properties/properties.js'),'utf8'),{window:{AetheriusUI:{registerModule:d=>{definition=d;}}},document,crypto:webcrypto,Date,setInterval:()=>1,clearInterval(){}});
  const context={request:async(moduleId,action,input)=>{calls.push({moduleId,action,input});return action==='snapshot'?{ok:true,data:{residences:[residence],serverNow:new Date().toISOString()}}:{ok:true,data:{}};},signal:new AbortController().signal};
  const root=element('main');definition.mount(root,context);await flush();
  const click=async text=>{const b=root.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(b,text);assert.equal(b.disabled,false);b.onclick();await flush();};
  return{definition,residence,root,calls,flush,click};
}
test('pós-compra registra somente Propriedades no slot 9',async()=>{const h=await harness();assert.equal(h.definition.id,'properties');assert.equal(h.definition.rootRoute,'/properties');assert.equal(h.definition.radialSlot,9);assert.equal(h.root.querySelectorAll('h2')[0].textContent,'Breezehome');});
test('limite de dois familiares desabilita só as caixas ainda desmarcadas',async()=>{
  const h=await harness(),checks=h.root.querySelectorAll('input').filter(n=>n.type==='checkbox');
  assert.equal(checks[1].disabled,false);assert.equal(checks[2].disabled,false);assert.equal(checks[3].disabled,true);
  checks[1].checked=false;h.residence.members[0].family=false;checks[1].onchange();await h.flush();assert.equal(h.calls.find(c=>c.action==='setFamily').input.memberProfileId,2);assert.equal(h.root.querySelectorAll('input').filter(n=>n.type==='checkbox')[3].disabled,false);
});
test('remover exige confirmação e envia perfil correto',async()=>{
  const h=await harness();await h.click('Remover');assert.ok(!h.calls.some(c=>c.action==='removeMember'));
  await h.click('Não');assert.ok(!h.calls.some(c=>c.action==='removeMember'));
  await h.click('Remover');await h.click('Sim');const c=h.calls.find(c=>c.action==='removeMember');assert.equal(c.input.confirmed,true);assert.equal(c.input.memberProfileId,2);
});
test('anunciar usa inteiro em Septims, com confirmação antes de enviar',async()=>{
  const h=await harness();const price=h.root.querySelectorAll('input').find(n=>n.placeholder==='Valor em Septims');price.value='25000';
  const form=h.root.querySelectorAll('form').find(n=>n.children.includes(price));form.onsubmit({preventDefault(){}});await h.flush();assert.ok(!h.calls.some(c=>c.action==='listSale'));
  await h.click('Sim');assert.equal(h.calls.find(c=>c.action==='listSale').input.amount,25000);
});
