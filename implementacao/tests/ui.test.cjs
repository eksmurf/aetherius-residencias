'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function harness() {
  const messages=[], listeners={}, timers=new Map();
  let nextTimer=0;
  function element(tag) {
    return {
      tag, children:[], attributes:{}, hidden:false, disabled:false, textContent:'',
      append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=children;},
      setAttribute(name,value){this.attributes[name]=value;},
      querySelectorAll(selector){
        return this.children.flatMap(child=>[...(selector===child.tag?[child]:[]),...child.querySelectorAll(selector)]);
      },
    };
  }
  const body=element('body'), windowListeners={};
  const window={skyrimPlatform:{sendMessage(...args){messages.push(args);}},
    addEventListener(name,fn){windowListeners[name]=fn;}};
  const document={body,createElement:element,addEventListener(name,fn){listeners[name]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client/residences/app.js'),'utf8'),{
    window,document,crypto:webcrypto,Uint8Array,
    setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},
    clearTimeout(id){timers.delete(id);},
  });
  const root=body.children[0];
  const offer=()=>window.AetheriusResidences.receive({action:'offer',status:'succeeded',data:{
    residenceId:'fixture',name:'Casa de teste',revision:1,owned:false,owner:false,forSale:true,locked:true,
    refs:[{kind:'entry'},{kind:'exit'},{kind:'container'}],
    prices:[{currency:'septims',amount:100,available:true},{currency:'diademas',amount:10,available:false}],
  }});
  function click(text){
    const btn=root.querySelectorAll('button').find(b=>b.textContent===text || b.children.some(c=>c.textContent===text));
    assert.ok(btn,`Missing button: ${text}`);assert.equal(btn.disabled,false);btn.onclick();
  }
  function escape(){
    const event={key:'Escape',preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    listeners.keydown(event);return event;
  }
  return {root,messages,offer,click,escape,receive:window.AetheriusResidences.receive,timers,windowListeners};
}
test('nome da casa fica no cabeçalho; Fechar fica no rodapé e Atualizar não existe',()=>{
  const h=harness();h.offer();
  assert.equal(h.root.children[0].tag,'header');
  assert.equal(h.root.querySelectorAll('h2')[0].textContent,'Casa de teste');
  assert.equal(h.root.children.at(-1).tag,'footer');
  assert.equal(h.root.children.at(-1).querySelectorAll('button')[0].textContent,'Fechar');
  assert.ok(!h.root.querySelectorAll('button').some(b=>b.textContent==='Atualizar'));
  assert.deepEqual(h.messages.at(-1),['aetherius-residences:focus',true]);
});
test('seleção por clique abre confirmação mantendo o nome da casa; ESC devolve foco',()=>{
  const h=harness();h.offer();h.click('Septims');
  assert.equal(h.root.querySelectorAll('h2')[0].textContent,'Casa de teste');
  assert.ok(!h.messages.some(m=>m[0]==='cef::ui:event'));
  const event=h.escape();assert.ok(event.prevented && event.stopped);
  assert.equal(h.root.hidden,true);
  assert.deepEqual(h.messages.at(-1),['aetherius-residences:focus',false]);
  assert.equal(h.escape().stopped,undefined);
});
test('fechar durante compra não cancela pedido e recibo atrasado não reabre painel',()=>{
  const h=harness();h.offer();h.click('Septims');h.click('Confirmar compra');
  const sent=h.messages.find(m=>m[0]==='cef::ui:event')[2];
  h.click('Fechar');
  h.receive({requestId:sent.requestId,action:'purchase',status:'succeeded',data:{
    action:'purchase',residenceId:'fixture',locked:true,keyId:'test-key',delivery:'delivered',
  }});
  assert.equal(h.root.hidden,true);
  assert.deepEqual(h.messages.at(-1),['aetherius-residences:focus',false]);
  assert.equal(h.messages.filter(m=>m[0]==='cef::ui:event').length,1);
});
test('timeout e ESC conservam o identificador original para reenvio',()=>{
  const h=harness();h.offer();h.click('Septims');h.click('Confirmar compra');
  const original=h.messages.find(m=>m[0]==='cef::ui:event')[2];
  h.escape();for(const fn of h.timers.values())fn();
  assert.equal(h.root.hidden,true);
  h.offer();h.click('Reenviar o mesmo pedido');
  const retried=h.messages.filter(m=>m[0]==='cef::ui:event').at(-1)[2];
  assert.equal(retried.requestId,original.requestId);
  assert.equal(retried.currency,original.currency);
});
test('Diademas sem integração permanece desabilitado e perda de foco fecha',()=>{
  const h=harness();h.offer();
  const cash=h.root.querySelectorAll('button').find(b=>b.children.some(c=>c.textContent==='Diademas'));
  assert.equal(cash.disabled,true);
  h.windowListeners['skymp5-client:browserUnfocused']();
  assert.equal(h.root.hidden,true);
});
