(() => {
  'use strict';
  if (window.AetheriusResidences) return;
  let offer = null, pending = null, timer = null, lastMutation = null;
  let view = 'offer', selectedPrice = null, notice = '';
  const root = document.createElement('section');
  root.id = 'aetherius-residences'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'ar-house-name');
  document.body.append(root);
  let tour=null,tourOffset=0;
  const tourHud=document.createElement('aside');tourHud.id='ar-tour-hud';tourHud.hidden=true;document.body.append(tourHud);
  function amenities(body){
    const section=node('section',undefined,'ar-amenities');section.append(node('h3','Características do imóvel'));
    const items=offer?.amenities?.items||[];
    if(!items.length)section.append(node('p','Características em verificação.','ar-muted'));
    for(const item of items){const line=node('p',undefined,'ar-amenity');line.append(node('span',item.label),node('strong',item.count===null?'Em verificação':item.count===0?'Não possui':String(item.count)));section.append(line);
      const types=Object.entries(item.subtypes||{});if(types.length)section.append(node('p',types.map(([name,count])=>count+' '+name).join(' · '),'ar-muted'));}
    body.append(section);
  }
  function renderTour(){tourHud.replaceChildren();tourHud.hidden=!tour;if(!tour)return;
    const seconds=Math.max(0,Math.ceil((Date.parse(tour.deadline)-Date.now()-tourOffset)/1000));
    tourHud.append(node('strong',tour.state==='active'?'Visita experimental · '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'):tour.state==='entering'?'Entrando na residência…':'Retornando à entrada…'));
    if(tour.state==='active'&&seconds<=10)tourHud.append(node('p','A visita está terminando. Você retornará à entrada.'));
    tourHud.append(node('p','Para sair antes: TAB → Propriedades'),button('Sair da visita',()=>send({action:'tourEnd'})));
  }
  setInterval(()=>{renderTour();if(tour&&!pending)send({action:'tourStatus'});},1000);
  const labels = { septims: 'Septims', diademas: 'Diademas' };
  function requestId() {
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  function emit(...args) {
    if (typeof window.skyrimPlatform?.sendMessage !== 'function') throw Error('Ponte do jogo indisponível.');
    window.skyrimPlatform.sendMessage(...args);
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    // Dismissal does not cancel a purchase or discard an uncertain receipt.
    try { emit('aetherius-residences:focus', false); } catch { }
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, run, className) {
    const el = node('button', text, className); el.type = 'button'; el.onclick = run;
    return el;
  }
  function navigate(next) { view = next; notice = ''; render(); }
  function send(data) {
    if (pending) return;
    const input = { version: 1, requestId: requestId(), ...data };
    if (['purchase'].includes(input.action)) lastMutation = input;
    pending = input; notice = ''; render();
    try { emit('cef::ui:event', 'residences:request', input); }
    catch (error) { pending = null; notice = error.message; render(); return; }
    timer = setTimeout(() => {
      pending = null;
      notice = 'Resposta pendente. Consulte o resultado antes de confirmar outra compra.';
      render();
    }, 12000);
  }
  function render() {
    root.replaceChildren();
    const header = node('header', undefined, 'ar-header');
    const title = node('h2', offer?.name || 'Residências'); title.id = 'ar-house-name';
    header.append(node('p', 'AETHERIUS · RESIDÊNCIAS', 'ar-eyebrow'), title);
    const body = node('div', undefined, 'ar-body');
    const footer = node('footer', undefined, 'ar-footer');
    footer.append(node('span', 'ESC para fechar', 'ar-hint'), button('Fechar', close, 'ar-close'));
    root.append(header, body, footer);
    if (lastMutation) {
      body.append(node('p', pending ? 'Processando solicitação…' : 'Há uma operação a conferir.', 'ar-subtitle'));
      body.append(node('p', 'Consultar o resultado não realiza uma nova cobrança.', 'ar-muted'));
      body.append(button('Consultar resultado', () => send({ action:'status', operationRequestId:lastMutation.requestId }), 'ar-primary'));
      body.append(button('Reenviar o mesmo pedido', () => send(lastMutation)));
    } else if(offer&&view==='tour'){
      body.append(node('p','Conheça o interior por um minuto. Você não poderá combater, tocar em objetos ou usar armazenamentos e estações. Ao final, retornará à entrada.','ar-muted'));
      body.append(button('Iniciar visita',()=>send({action:'tourStart',residenceId:offer.residenceId,revision:offer.revision,door:offer.entryDoor}),'ar-primary'),button('Voltar',()=>navigate('offer')));
    } else if (offer && view === 'purchase' && selectedPrice) {
      body.append(node('p', 'Confirmar compra', 'ar-subtitle'));
      body.append(node('p', `${selectedPrice.amount.toLocaleString('pt-BR')} ${labels[selectedPrice.currency]}`, 'ar-total'));
      amenities(body);
      body.append(node('p', 'Você receberá a chave no inventário pessoal.', 'ar-muted'));
      if (offer.offerKind === 'resale') body.append(node('p', 'Os itens guardados na residência também serão seus.', 'ar-muted'));
      if (selectedPrice.currency === 'diademas') body.append(node('p', 'Será usado o saldo de Diademas já existente na sua conta.', 'ar-muted'));
      body.append(button('Confirmar compra', () => send({ action:'purchase', residenceId:offer.residenceId, revision:offer.revision, accessRevision:offer.accessRevision, offerKind:offer.offerKind, amenitiesRevision:offer.amenities?.revision??null, currency:selectedPrice.currency }), 'ar-primary'));
      body.append(button('Voltar', () => navigate('offer')));
    } else if (offer) {
      body.append(node('p', offer.owned ? (offer.owner ? 'Esta residência pertence ao seu perfil.' : 'Residência já adquirida.') : (offer.offerKind === 'resale' ? 'À venda pelo proprietário' : 'Residência disponível para compra'), 'ar-subtitle'));
      amenities(body);
      if(!offer.owner){if(offer.tour?.available&&offer.entryDoor)body.append(button('Visitar interior por 1 minuto',()=>navigate('tour')));else if(offer.tour?.reason)body.append(node('p',offer.tour.reason,'ar-muted'));}
      if (offer.owner) {
        body.append(node('p', 'Compra concluída. Sua chave está no inventário pessoal. Consulte a residência em TAB → Propriedades.', 'ar-muted'));
      } else if (offer.forSale) {
        body.append(node('p', 'Escolha como pagar', 'ar-section-label'));
        for (const price of offer.prices) {
          const choose = button('', () => { selectedPrice = price; navigate('purchase'); }, 'ar-price');
          choose.append(node('span', labels[price.currency]), node('strong', price.amount.toLocaleString('pt-BR')));
          choose.disabled = !price.available;
          if (!price.available) choose.setAttribute('aria-label', `${labels[price.currency]} indisponível`);
          body.append(choose);
          if (!price.available) body.append(node('p', `${labels[price.currency]} indisponível no momento.`, 'ar-muted'));
        }
      }
    }
    if (notice) {
      const status = node('p', notice, 'ar-notice'); status.setAttribute('role','status');
      status.setAttribute('aria-live','polite'); body.append(status);
    }
    root.setAttribute('aria-busy', String(!!pending));
    if (pending) body.querySelectorAll('button').forEach(el => { el.disabled = true; });
  }
  function receive(response) {
    if (!response || typeof response !== 'object') return;
    if (pending && response.requestId !== pending.requestId) return;
    const current = pending;
    if (!pending && response.action !== 'offer') return;
    clearTimeout(timer); pending = null;
    // Only a new offer opens the panel; a delayed receipt must not steal focus after ESC.
    if (response.action === 'offer' && response.status === 'succeeded') {
      offer = response.data; view = 'offer'; selectedPrice = null; notice = '';
      root.hidden = false;
      try { emit('aetherius-residences:focus', true); } catch { notice = 'Não foi possível ativar o cursor.'; }
      render(); return;
    }
    if (response.status !== 'succeeded') {
      if (response.status !== 'unknown' && !['UNAVAILABLE','BUSY'].includes(response.code) && current?.action !== 'status') lastMutation = null;
      view = 'offer'; notice = response.message || 'Operação não confirmada.'; render(); return;
    }
    const data = response.data;
    if(['tourStart','tourStatus','tourEnd'].includes(response.action)){
      if(response.action==='tourEnd'){if(tour)tour.state='returning';}
      else {tour=response.action==='tourStatus'?data.tour:data;if(tour?.serverNow)tourOffset=Date.parse(tour.serverNow)-Date.now();}
      renderTour();if(response.action==='tourStart')close();render();return;
    }
    if (data.committed === false) { notice = data.message; render(); return; }
    lastMutation = null; view = 'offer';
    if (offer && data.residenceId === offer.residenceId) {
      offer.owner = true; offer.owned = true; offer.forSale = false; offer.locked = data.locked;
      if (data.keyId) offer.pendingKeys = data.delivery === 'pending' ? [{ id:data.keyId, sameCharacter:true }] : [];
    }

    notice = 'Compra registrada. Sua chave está vinculada ao perfil. Gerencie a casa em TAB → Propriedades.';
    render();
  }
  document.addEventListener('keydown', event => {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);
  window.addEventListener('skymp5-client:browserUnfocused', close);
  window.AetheriusResidences = { receive, close };
})();
