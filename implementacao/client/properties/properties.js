(() => {
  'use strict';
  const ui=window.AetheriusUI;
  if(!ui) throw Error('Propriedades exige Aetherius UI Core.');
  const id=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
  const money=v=>v.toLocaleString('pt-BR')+' Septims';
  ui.registerModule({id:'properties',label:'PROPRIEDADES',version:'0.5.0',sdkMin:'1.0.0',sdkMaxExclusive:'2.0.0',rootRoute:'/properties',radialSlot:9,
    assets:['modules/properties/properties.js','modules/properties/properties.css'],capabilities:['properties.read','properties.write'],
    mount(container,context){
      container.classList.add('ar-properties');
      const shell = container.closest?.('#aetherius-shell');
      shell?.classList.add('ar-properties-open');
      let activeTour=null,houses=[],selected=null,busy=false,disposed=false,notice='',confirm=null,uncertain=null,serverOffset=0;
      const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
      const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
      const house=()=>houses.find(h=>h.residenceId===selected);
      const call=(action,payload={})=>context.request('properties',action,{requestId:id(),...payload});
      async function refresh(){
        if(busy||disposed)return;
        busy=true;render();
        try{const r=await call('snapshot');if(disposed)return;if(!r.ok)throw Error(r.error.message);
          houses=r.data.residences;activeTour=r.data.tour||null;serverOffset=Date.parse(r.data.serverNow)-Date.now();
          if(!house())selected=houses[0]?.residenceId||null;
        }catch(e){if(!disposed)notice=e.message;}finally{busy=false;if(!disposed)render();}
      }
      async function mutate(action,values,original){
        if(busy||disposed||(!house()&&!original))return;
        const input=original||{requestId:id(),residenceId:house().residenceId,accessRevision:house().accessRevision,...values};
        uncertain={action,input};busy=true;confirm=null;notice='';render();
        try{
          const r=await call(action,input);if(disposed)return;
          if(!r.ok){if(!r.uncertain)uncertain=null;notice=r.error.message;}
          else{uncertain=null;notice='Alteração registrada.';}
        }catch{notice='Resposta não confirmada. Consulte o resultado antes de repetir a operação.';}
        finally{busy=false;if(!disposed)await refresh();}
      }
      async function checkReceipt(){
        if(busy||!uncertain)return;busy=true;render();
        try{const r=await call('status',{operationRequestId:uncertain.input.requestId});if(disposed)return;
          if(r.ok&&r.data.committed!==false){uncertain=null;notice='Operação confirmada.';}
          else notice=r.ok?r.data.message:r.error.message;
        }catch{notice='Não foi possível confirmar. Aguarde e consulte novamente.';}
        finally{busy=false;if(!disposed)await refresh();}
      }
      async function beginInstant(){
        if(busy||uncertain||!house())return;busy=true;notice='';render();
        try{const h=house(),r=await call('instantQuote',{residenceId:h.residenceId,accessRevision:h.accessRevision});
          if(!r.ok)throw Error(r.error.message);
          if(disposed){void call('instantCancel',{residenceId:h.residenceId,quoteId:r.data.quoteId});return;}
          confirm={kind:'instant',houseId:h.residenceId,quote:r.data,stage:1};
        }catch(e){notice=e.message;}finally{busy=false;render();}
      }
      async function armInstant(){
        if(busy||confirm?.kind!=='instant'||confirm.stage!==1)return;
        const c=confirm;busy=true;render();
        try{const r=await call('instantArm',{residenceId:c.houseId,quoteId:c.quote.quoteId});if(!r.ok)throw Error(r.error.message);
          if(disposed||confirm!==c){void call('instantCancel',{residenceId:c.houseId,quoteId:c.quote.quoteId});return;}
          c.stage=2;c.visibleUntil=performance.now()+10000;c.expiresAt=Date.parse(r.data.expiresAt);
        }catch(e){notice=e.message;cancelInstant();}finally{busy=false;render();}
      }
      function cancelInstant(){const c=confirm;confirm=null;if(c?.kind==='instant')void call('instantCancel',{residenceId:c.houseId,quoteId:c.quote.quoteId}).catch(()=>{});}
      function renderInstant(h){
        container.querySelectorAll('button,input,select').forEach(n=>{n.disabled=true;});
        const c=confirm,q=c.quote,overlay=el('div',undefined,'arp-confirm-overlay'),modal=el('section',undefined,'arp-confirm arp-confirm-tax');
        modal.setAttribute('role','alertdialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Venda instantânea');
        modal.append(el('p',h.name,'arp-confirm-house'),el('h3',c.stage===1?'Revisar venda instantânea':'Confirmar venda instantânea'));
        modal.append(el('p','Valor base: '+money(q.base)+' · Perda de 60%: '+money(q.loss),'arp-muted'));
        modal.append(el('p','Retorno de 40%: '+money(q.amount)+' · IPTU descontado: '+money(q.taxWithheld),'arp-muted'));
        if(q.taxWaived)modal.append(el('p','Dívida excedente encerrada com a venda: '+money(q.taxWaived),'arp-muted'));
        if(q.rounding)modal.append(el('p','Retorno arredondado para baixo para Septims inteiros.','arp-muted'));
        const total=el('div',undefined,'arp-confirm-total');total.append(el('span','Você receberá'),el('strong',money(q.net)));modal.append(total);
        modal.append(el('p','Todos os itens guardados permanecerão na casa. Você perderá o acesso a eles ao concluir a venda.','arp-warning'));
        modal.append(el('p','Seus acessos e os de familiares e visitantes serão encerrados. O crédito vai para o personagem atual.','arp-muted'));
        const cancel=button('Cancelar',()=>{cancelInstant();render();});
        const yes=button(c.stage===1?'Continuar':'Confirmar venda instantânea',()=>{
          if(c.stage===1)return armInstant();
          if(performance.now()<c.visibleUntil||Date.now()+serverOffset>=c.expiresAt)return;
          return mutate('instantSell',{quoteId:q.quoteId});
        });yes.className='arp-primary';yes.disabled=busy;
        if(c.stage===2){const countdown=el('p',undefined,'arp-muted');countdown.dataset.instantCountdown='true';modal.append(countdown);yes.dataset.instantFinal='true';}
        const actions=el('div',undefined,'arp-confirm-actions');actions.append(cancel,yes);modal.append(actions);overlay.append(modal);container.append(overlay);
        overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelInstant();render();}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel&&!yes.disabled?yes:cancel).focus();}};
        cancel.focus();
      }
      function checkbox(text,checked,disabled,run){
        const label=el('label',undefined,'arp-check');const box=el('input');box.type='checkbox';box.checked=checked;box.disabled=disabled;
        box.onchange=()=>run(box.checked);label.append(box,el('span',text));if(disabled)label.classList.add('is-disabled');return label;
      }
      function render(){
        if(disposed)return;container.replaceChildren();
        const h=house();container.append(el('h2',h?.name||'Minhas propriedades'));
        if(activeTour){container.append(el('p','Visita experimental em andamento.','arp-muted'));const leave=button('Sair da visita',async()=>{if(busy)return;busy=true;try{const r=await call('tourEnd');if(!r.ok)notice=r.error.message;}finally{busy=false;await refresh();}});leave.disabled=busy;container.append(leave);}
        if(houses.length>1){const select=el('select');for(const r of houses){const option=el('option',r.name);option.value=r.residenceId;option.selected=r.residenceId===selected;select.append(option);}select.disabled=busy||!!uncertain;select.onchange=()=>{selected=select.value;confirm=null;render();};container.append(select);}
        if(!h)container.append(el('p',busy?'Consultando propriedades…':'Você não possui uma residência.'));
        else{
          const t=h.tax, tax=el('section',undefined,'arp-card');tax.append(el('h3','Imposto residencial'));
          if(t.configured){
            const time=el('p',undefined,'arp-time');time.dataset.due=t.periods?t.nextAccrualAt:t.dueAt;time.setAttribute('aria-label',t.periods?'Tempo até o próximo imposto acumular':'Tempo até o próximo vencimento');tax.append(time);
            const pay=button('Pagar impostos — '+money(t.periods>0?t.amount:t.periodAmount),()=>{confirm={kind:'tax',houseId:h.residenceId,dueAt:t.dueAt,periods:t.periods,amount:t.amount};render();});pay.className='arp-primary';pay.disabled=t.periods===0||!t.canPay||busy||!!uncertain;tax.append(pay);
            tax.append(el('p','Os impostos acumulam. Na 2ª quinzena sem pagar, todos perdem acesso à casa e aos baús. Na 3ª, a casa volta à venda.','arp-muted arp-tax-note'));
            if(t.suspended)tax.append(el('p',t.auction?'Casa à venda por falta de pagamento. Quite a dívida antes de outra compra para recuperar a casa e seus itens.':'Acessos suspensos. Quite os impostos para recuperar sua chave.','arp-warning'));
          }else tax.append(el('p','O imposto aguarda configuração da equipe.'));
          container.append(tax);
          const permissions=el('section',undefined,'arp-card');permissions.append(el('h3','Acesso à residência'));
          permissions.append(checkbox('Porta aberta ao público',h.open,busy||!!uncertain||t.suspended,open=>mutate('public',{open})));
          permissions.append(el('p','Com a porta aberta, qualquer pessoa pode entrar.','arp-muted'));
          const familyCount=h.members.filter(m=>m.family).length;
          const memberLimit=5,memberLimitReached=h.members.length>=memberLimit;
          permissions.append(el('h3',`Visitantes · ${h.members.length}/${memberLimit} cadastrados · ${familyCount}/2 familiares`));
          if(memberLimitReached)permissions.append(el('p','Limite de visitantes atingido. Remova alguém para liberar uma vaga.','arp-muted'));
          const form=el('form',undefined,'arp-add');const name=el('input');name.type='text';name.placeholder='Nome completo ou profile_id';name.maxLength=255;name.setAttribute('aria-label','Nome completo ou profile_id');name.required=true;
          const add=el('button','Adicionar visitante');add.type='submit';name.disabled=add.disabled=busy||!!uncertain||t.suspended||memberLimitReached;
          form.onsubmit=e=>{e.preventDefault();if(!memberLimitReached&&name.value.trim())mutate('addMember',{query:name.value.trim()});};form.append(name,add);permissions.append(form);
          for(const m of h.members){
            const row=el('div',undefined,'arp-member');row.append(el('span',`${m.name} · ${m.profileId}`,'arp-member-name'));
            row.append(checkbox('Familiar',m.family,busy||!!uncertain||t.suspended||(!m.family&&familyCount>=2),family=>mutate('setFamily',{memberProfileId:m.profileId,family})));
            const remove=button('Remover',()=>{confirm={kind:'remove',houseId:h.residenceId,profileId:m.profileId,name:m.name};render();});remove.className='arp-remove';remove.disabled=busy||!!uncertain||t.suspended;row.append(remove);permissions.append(row);
          }
          permissions.append(el('p','Familiares recebem chave pessoal e acessam os armazenamentos. Visitantes cadastrados podem entrar com a porta fechada, mas não podem abrir baús.','arp-muted'));
          container.append(permissions);
          const sale=el('section',undefined,'arp-card');sale.append(el('h3','Venda da residência'));
          sale.append(el('p','Você mantém o uso da casa enquanto ela estiver anunciada e os impostos estiverem regulares. Ao concluir a venda, todos os itens guardados ficam com o comprador. Seu acesso e os de familiares e visitantes serão encerrados.','arp-muted'));
          if(h.listingPrice){sale.append(el('p','Anunciada por '+money(h.listingPrice)));const cancel=button('Cancelar anúncio',()=>mutate('cancelSale',{}));cancel.disabled=busy||!!uncertain||t.suspended;sale.append(cancel);}
          const saleForm=el('form',undefined,'arp-add'),price=el('input');price.type='text';price.inputMode='numeric';price.pattern='[0-9]+';price.maxLength=10;price.required=true;price.placeholder='Valor em Septims';price.setAttribute('aria-label','Preço de venda em Septims');
          const advertise=el('button',h.listingPrice?'Alterar anúncio':'Anunciar venda');advertise.type='submit';price.disabled=advertise.disabled=busy||!!uncertain||t.suspended;
          saleForm.onsubmit=e=>{e.preventDefault();const amount=Number(price.value);if(!/^[0-9]+$/.test(price.value)||!Number.isSafeInteger(amount)||amount<1||amount>2147483647){notice='Informe um valor inteiro positivo em Septims.';render();return;}confirm={kind:'sale',houseId:h.residenceId,amount};render();};saleForm.append(price,advertise);sale.append(saleForm);container.append(sale);
          const instant=button('Vender instantaneamente',beginInstant);instant.className='arp-primary';instant.disabled=busy||!!uncertain||!h.instantSale?.eligible;sale.append(instant);
          sale.append(el('p',h.instantSale?.eligible?'Receba 40% do valor base, com desconto do IPTU até zerar os ganhos.':h.instantSale?.reason||'Venda instantânea aguardando integração.','arp-muted'));
        }
        if(uncertain){const r=el('section',undefined,'arp-warning');r.append(el('p','Existe uma solicitação com resultado pendente.'),button('Consultar resultado',checkReceipt),button('Reenviar o mesmo pedido',()=>mutate(uncertain.action,{},uncertain.input)));container.append(r);}
        if(notice){const n=el('p',notice,'arp-notice');n.setAttribute('role','status');container.append(n);}
        if(confirm?.kind==='instant')renderInstant(h);
        else if(confirm){container.querySelectorAll('button,input,select').forEach(n=>{n.disabled=true;});const overlay=el('div',undefined,'arp-confirm-overlay'),modal=el('section',undefined,'arp-confirm');modal.setAttribute('role','alertdialog');modal.setAttribute('aria-modal','true');
          const isTax=confirm.kind==='tax';
          const title=confirm.kind==='remove'?`Remover ${confirm.name} da residência?`:confirm.kind==='sale'?`Anunciar a casa por ${money(confirm.amount)}?`:'Pagar impostos';modal.setAttribute('aria-label',title);
          if(isTax){modal.classList.add('arp-confirm-tax');modal.append(el('p',h.name,'arp-confirm-house'));}
          modal.append(el('h3',title));
          if(isTax){modal.append(el('p',confirm.periods===1?'1 parcela vencida':`${confirm.periods} parcelas vencidas`,'arp-confirm-detail'));const total=el('div',undefined,'arp-confirm-total');total.append(el('span','Total a pagar'),el('strong',money(confirm.amount)));modal.append(total);}
          if(confirm.kind==='remove')modal.append(el('p','O acesso aos baús será revogado imediatamente. A pessoa poderá sair, mas só poderá entrar novamente se for adicionada ou se a porta estiver aberta.'));
          if(confirm.kind==='sale')modal.append(el('p','A venda inclui todos os itens guardados. O pagamento será creditado no saldo oficial do personagem que publicou o anúncio, conferido pelo seu profile_id.'));
          const yes=button(isTax?'Confirmar pagamento':'Sim',()=>{const c=confirm;if(c.houseId!==selected)return;return c.kind==='remove'?mutate('removeMember',{memberProfileId:c.profileId,confirmed:true}):c.kind==='sale'?mutate('listSale',{amount:c.amount}):mutate('payTax',{dueAt:c.dueAt,periods:c.periods});});
          const cancel=()=>{const previous=confirm;confirm=null;render();const buttons=[...container.querySelectorAll('button')];const target=previous.kind==='tax'?buttons.find(n=>/^Pagar impostos/.test(n.textContent)):previous.kind==='sale'?buttons.find(n=>/^(Anunciar venda|Alterar anúncio)$/.test(n.textContent)):buttons.filter(n=>n.textContent==='Remover')[house().members.findIndex(m=>m.profileId===previous.profileId)];target?.focus();};
          const no=button(isTax?'Cancelar':'Não',cancel);if(isTax){yes.className='arp-primary';const actions=el('div',undefined,'arp-confirm-actions');actions.append(no,yes);modal.append(actions);}else modal.append(yes,no);overlay.append(modal);container.append(overlay);
          overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===yes?no:yes).focus();}};
          overlay.onwheel=e=>{if(!modal.contains(e.target))e.preventDefault();};yes.focus();
        }
        if(busy)container.querySelectorAll('button,input,select').forEach(n=>{n.disabled=true;});
        tick();
      }
      function tick(){
        if(confirm?.kind==='instant'&&confirm.stage===2){const remaining=Math.max(0,Math.ceil((confirm.visibleUntil-performance.now())/1000)),expired=Date.now()+serverOffset>=confirm.expiresAt;
          const label=container.querySelector('[data-instant-countdown]'),btn=container.querySelector('[data-instant-final]');
          if(label)label.textContent=expired?'Confirmação expirada. Cancele e consulte novamente.':remaining?'Confirmação disponível em '+remaining+' segundos':'Confirmação disponível';
          if(btn)btn.disabled=busy||remaining>0||expired;
        }
        for(const n of container.querySelectorAll('[data-due]')){const seconds=Math.max(0,Math.ceil((Date.parse(n.dataset.due)-Date.now()-serverOffset)/1000));n.textContent=`${Math.floor(seconds/86400)}d ${Math.floor(seconds%86400/3600)}h ${Math.floor(seconds%3600/60)}min`;}}
      const clock=setInterval(tick,1000),poll=setInterval(()=>{const editing=document.activeElement?.tagName==='INPUT'&&container.contains(document.activeElement);if(!confirm&&!uncertain&&!editing)void refresh();},15000);
      const cleanup=()=>{if(disposed)return;cancelInstant();disposed=true;shell?.classList.remove('ar-properties-open');clearInterval(clock);clearInterval(poll);container.classList.remove('ar-properties');};
      context.signal.addEventListener('abort',cleanup,{once:true});void refresh();return{unmount:cleanup};
    }
  });
})();
