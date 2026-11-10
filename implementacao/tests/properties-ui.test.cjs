'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
async function harness(extraMembers=[],taxValues={},options={}){
  let elapsed=0;const ticks=[];
  let definition;const calls=[];const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
  const document={activeElement:null,createElement:element};
  function element(tag){return {tag,children:[],dataset:{},textContent:'',disabled:false,classList:{add(){},remove(){}},
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
    setAttribute(k,v){this[k]=v;},focus(){document.activeElement=this;},contains(target){return target===this||this.children.some(c=>c.contains(target));},
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    querySelectorAll(selector){const match=n=>selector==='[data-due]'?n.dataset.due!==undefined:selector==='[data-instant-countdown]'?n.dataset.instantCountdown!==undefined:selector==='[data-instant-final]'?n.dataset.instantFinal!==undefined:selector.split(',').includes(n.tag);return this.children.flatMap(c=>[...(match(c)?[c]:[]),...c.querySelectorAll(selector)]);}};}
  const residence={residenceId:'first',name:'Breezehome',accessRevision:3,open:false,listingPrice:null,familyLimit:2,
    tax:{configured:true,periods:1,amount:100,paymentAmount:100,paymentPeriods:1,advance:false,periodAmount:100,periodDays:15,dueAt:new Date().toISOString(),nextAccrualAt:new Date(Date.now()+86400000).toISOString(),canPay:true,suspended:false,auction:false},
    members:[{profileId:2,name:'Pessoa Dois',family:true},{profileId:3,name:'Pessoa Três',family:true},{profileId:4,name:'Pessoa Quatro',family:false}]};
  Object.assign(residence.tax,taxValues);
  if(options.instantSale)residence.instantSale=options.instantSale;
  residence.members.push(...extraMembers);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client/properties/properties.js'),'utf8'),{window:{AetheriusUI:{registerModule:d=>{definition=d;}}},document,crypto:webcrypto,Date,performance:{now:()=>elapsed},setInterval:f=>{ticks.push(f);return 1;},clearInterval(){}});
  const context={request:async(moduleId,action,input)=>{calls.push({moduleId,action,input});if(options.reply&&action!=='snapshot')return options.reply(action,input);return action==='snapshot'?{ok:true,data:{residences:[residence],serverNow:new Date().toISOString()}}:{ok:true,data:{}};},signal:new AbortController().signal};
  const root=element('main');definition.mount(root,context);await flush();
  const click=async text=>{const b=root.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(b,text);assert.equal(b.disabled,false);b.onclick();await flush();};
  return{definition,residence,root,calls,flush,click,advance(ms){elapsed+=ms;ticks[0]();}};
}
test('pós-compra registra somente Propriedades no slot 9',async()=>{const h=await harness();assert.equal(h.definition.id,'properties');assert.equal(h.definition.rootRoute,'/properties');assert.equal(h.definition.radialSlot,9);assert.equal(h.root.querySelectorAll('h2')[0].textContent,'Breezehome');});

test('IPTU mantém botão desabilitado antes do vencimento e confirma antes de cobrar',async()=>{
  for(const periods of [0,1,2]){
    const amount=periods*100;
    const h=await harness([],{periods,advance:false,amount,paymentAmount:amount,paymentPeriods:periods,canPay:periods>0});
    const paragraphs=h.root.querySelectorAll('p').map(n=>n.textContent);
    assert.ok(paragraphs.some(t=>t.includes('Na 2ª quinzena')&&t.includes('Na 3ª')));
    assert.ok(!paragraphs.some(t=>t.includes('imposto(s) em aberto')||t.includes('10% do valor base')||t.includes('Próximo acúmulo:')));
    assert.ok(!h.root.querySelectorAll('button').some(n=>n.textContent.includes('Antecipar')));
    if(!periods){const pay=h.root.querySelectorAll('button').find(n=>n.textContent==='Pagar impostos — 100 Septims');assert.ok(pay);assert.equal(pay.disabled,true);assert.ok(!h.calls.some(c=>c.action==='payTax'));continue;}
    await h.click('Pagar impostos — '+amount+' Septims');
    assert.ok(!h.calls.some(c=>c.action==='payTax'));await h.click('Confirmar pagamento');
    const payment=h.calls.find(c=>c.action==='payTax');assert.equal(payment.input.periods,periods);
    assert.equal(payment.input.dueAt,h.residence.tax.dueAt);
  }
});

test('cinco cadastros incluindo familiares bloqueiam adição; remover libera vaga',async()=>{
  const h=await harness([{profileId:5,name:'Pessoa Cinco',family:false},{profileId:6,name:'Pessoa Seis',family:false}]);
  const add=()=>h.root.querySelectorAll('button').find(n=>n.textContent==='Adicionar visitante');
  assert.equal(add().disabled,true);
  const name=h.root.querySelectorAll('input').find(n=>n.placeholder==='Nome completo ou profile_id');
  assert.equal(name.disabled,true);name.value='7';
  h.root.querySelectorAll('form')[0].onsubmit({preventDefault(){}});await h.flush();
  assert.ok(!h.calls.some(c=>c.action==='addMember'));
  await h.click('Remover');h.residence.members.shift();await h.click('Sim');
  assert.equal(add().disabled,false);
});
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

test('venda instantânea exige as duas telas, dez segundos completos e cancelamento',async()=>{
 const q={quoteId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',base:100000,amount:40000,loss:60000,taxWithheld:10000,taxWaived:0,net:30000};
 const h=await harness([],{}, {instantSale:{eligible:true},reply:async action=>({ok:true,data:action==='instantQuote'?q:action==='instantArm'?{expiresAt:new Date(Date.now()+120000).toISOString()}: {}})});
 await h.click('Vender instantaneamente');assert.ok(!h.calls.some(c=>c.action==='instantSell'));
 assert.ok(h.root.querySelectorAll('p').some(p=>p.textContent.includes('Todos os itens guardados')));
 await h.click('Continuar');const final=()=>h.root.querySelectorAll('button').find(b=>b.textContent==='Confirmar venda instantânea');
 assert.equal(final().disabled,true);h.advance(9999);assert.equal(final().disabled,true);h.advance(1);assert.equal(final().disabled,false);
 await h.click('Cancelar');assert.ok(h.calls.some(c=>c.action==='instantCancel'));assert.ok(!h.calls.some(c=>c.action==='instantSell'));
 await h.click('Vender instantaneamente');await h.click('Continuar');assert.equal(final().disabled,true);h.advance(10000);await h.click('Confirmar venda instantânea');
 assert.equal(h.calls.filter(c=>c.action==='instantSell').length,1);assert.equal(h.calls.find(c=>c.action==='instantSell').input.quoteId,q.quoteId);
});
