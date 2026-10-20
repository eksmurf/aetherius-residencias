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
    if (['purchase','lock','reissue'].includes(input.action)) lastMutation = input;
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
    } else if (offer && view === 'purchase' && selectedPrice) {
      body.append(node('p', 'Confirmar compra', 'ar-subtitle'));
      body.append(node('p', `${selectedPrice.amount.toLocaleString('pt-BR')} ${labels[selectedPrice.currency]}`, 'ar-total'));
      body.append(node('p', 'A residência ficará registrada no seu perfil. Você receberá uma chave para trancar e destrancar as entradas.', 'ar-muted'));
      if (selectedPrice.currency === 'diademas') body.append(node('p', 'Será usado o saldo de Diademas já existente na sua conta.', 'ar-muted'));
      body.append(button('Confirmar compra', () => send({ action:'purchase', residenceId:offer.residenceId, revision:offer.revision, currency:selectedPrice.currency }), 'ar-primary'));
      body.append(button('Voltar', () => navigate('offer')));
    } else if (offer && view === 'reissue') {
      body.append(node('p', 'Reposição da chave', 'ar-subtitle'));
      body.append(node('p', 'As chaves anteriores deixarão de funcionar e a residência será trancada. A posse permanece no seu perfil.', 'ar-muted'));
      body.append(button('Confirmar reposição', () => send({ action:'reissue', residenceId:offer.residenceId }), 'ar-primary'));
      body.append(button('Voltar', () => navigate('offer')));
    } else if (offer) {
      body.append(node('p', offer.owned ? (offer.owner ? 'Esta residência pertence ao seu perfil.' : 'Residência já adquirida.') : 'Residência disponível para consulta.', 'ar-subtitle'));
      body.append(node('p', `${offer.refs.filter(r => r.kind === 'entry').length} entrada(s) · ${offer.refs.filter(r => r.kind === 'container').length} baú(s) privado(s)`, 'ar-muted'));
      if (offer.owner) {
        body.append(button(offer.locked ? 'Destrancar com a chave' : 'Trancar com a chave', () => send({ action:'lock', residenceId:offer.residenceId, locked:!offer.locked }), 'ar-primary'));
        body.append(button('Solicitar reposição da chave', () => navigate('reissue')));
        for (const key of offer.pendingKeys || []) if (key.sameCharacter) body.append(button('Recuperar entrega pendente', () => send({ action:'recover', keyId:key.id })));
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
    if (data.committed === false) { notice = data.message; render(); return; }
    lastMutation = null; view = 'offer';
    if (offer && data.residenceId === offer.residenceId) {
      offer.owner = true; offer.owned = true; offer.forSale = false; offer.locked = data.locked;
      if (data.keyId) offer.pendingKeys = data.delivery === 'pending' ? [{ id:data.keyId, sameCharacter:true }] : [];
    }
    if (offer && response.action === 'recover' && data.delivery === 'delivered') offer.pendingKeys = (offer.pendingKeys || []).filter(key => key.id !== data.keyId);
    notice = data.delivery === 'pending' ? 'Posse registrada. A entrega da chave está pendente; recupere sem comprar novamente.' :
      data.delivery === 'delivered' ? 'Chave entregue. A residência está registrada no seu perfil.' : 'Operação registrada.';
    render();
  }
  document.addEventListener('keydown', event => {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }, true);
  window.addEventListener('skymp5-client:browserUnfocused', close);
  window.AetheriusResidences = { receive, close };
})();
