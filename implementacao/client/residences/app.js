(() => {
  'use strict';
  if (window.AetheriusResidences) return;
  let offer = null, pending = null, timer = null, lastMutation = null;
  const root = document.createElement('section');
  root.id = 'aetherius-residences'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Residência'); root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  const labels = { septims: 'Septims', diademas: 'Diademas (cash)' };
  function requestId() {
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(b => b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const emit = (...args) => { if (typeof window.skyrimPlatform?.sendMessage !== 'function') throw Error('Ponte do jogo indisponível.'); window.skyrimPlatform.sendMessage(...args); };
  function node(tag, text) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; }
  function button(text, run) { const el = node('button', text); el.type = 'button'; el.onclick = run; return el; }
  function message(text) { const el = node('p', text); el.setAttribute('role','status'); root.append(el); }
  function send(data) {
    if (pending) return;
    const input = { version: 1, requestId: requestId(), ...data };
    if (['purchase','lock','reissue'].includes(input.action)) lastMutation = input;
    pending = input;
    root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { emit('cef::ui:event', 'residences:request', input); }
    catch (error) { pending = null; render(); message(error.message); return; }
    timer = setTimeout(() => {
      pending = null; render();
      message('Resposta pendente. Consulte o pedido antes de confirmar outra compra.');
    }, 12000);
  }
  function render() {
    root.replaceChildren();
    root.append(node('h2', offer?.name || 'Residências'));
    const close = button('Fechar', () => { root.hidden = true; emit('aetherius-residences:focus', false); });
    root.append(close);
    if (lastMutation) {
      message('Há uma operação a conferir. Consultar não realiza uma nova cobrança.');
      root.append(button('Consultar resultado', () => send({ action: 'status', operationRequestId: lastMutation.requestId })));
      root.append(button('Reenviar o mesmo pedido', () => send(lastMutation)));
      return;
    }
    if (!offer) return;
    root.append(node('p', offer.owned ? (offer.owner ? 'Esta residência pertence ao seu perfil.' : 'Residência já adquirida.') : 'Residência disponível para consulta.'));
    root.append(node('p', `${offer.refs.filter(r => r.kind === 'entry').length} entrada(s) · ${offer.refs.filter(r => r.kind === 'container').length} baú(s) privado(s)`));
    if (offer.owner) {
      root.append(button(offer.locked ? 'Destrancar com a chave' : 'Trancar com a chave', () => send({ action: 'lock', residenceId: offer.residenceId, locked: !offer.locked })));
      root.append(button('Solicitar reposição da chave', () => {
        root.replaceChildren(node('h2', 'Repor chave'), node('p', 'As chaves anteriores deixarão de funcionar. A residência será trancada; a posse permanece no seu perfil.'));
        root.append(button('Confirmar reposição', () => send({ action: 'reissue', residenceId: offer.residenceId })), button('Voltar', render));
      }));
      for (const key of offer.pendingKeys || []) if (key.sameCharacter) root.append(button('Recuperar entrega pendente', () => send({ action: 'recover', keyId: key.id })));
    } else if (offer.forSale) {
      for (const price of offer.prices) {
        const choose = button(`Comprar por ${price.amount.toLocaleString('pt-BR')} ${labels[price.currency]}`, () => {
          root.replaceChildren(node('h2', 'Confirmar compra'), node('p', offer.name),
            node('p', `Total: ${price.amount.toLocaleString('pt-BR')} ${labels[price.currency]}. A propriedade ficará registrada no seu perfil e você receberá uma chave.`));
          if (price.currency === 'diademas') root.append(node('p', 'Será usado o saldo de Diademas já existente na sua conta.'));
          root.append(button('Confirmar', () => send({ action:'purchase', residenceId:offer.residenceId, revision:offer.revision, currency:price.currency })), button('Voltar', render));
        });
        choose.disabled = !price.available;
        if (!price.available) choose.title = 'Integração desta moeda indisponível.';
        root.append(choose);
      }
    }
    root.append(button('Atualizar', () => send({ action:'offer', residenceId:offer.residenceId })));
  }
  function receive(response) {
    if (!response || typeof response !== 'object') return;
    if (pending && response.requestId !== pending.requestId) return;
    const current = pending;
    if (!pending && response.action !== 'offer') return;
    clearTimeout(timer); pending = null;
    root.hidden = false; emit('aetherius-residences:focus', true);
    if (response.status !== 'succeeded') {
      if (response.status !== 'unknown' && !['UNAVAILABLE','BUSY'].includes(response.code) && current?.action !== 'status') lastMutation = null;
      render(); message(response.message || 'Operação não confirmada.'); return;
    }
    const data = response.data;
    if (response.action === 'offer') { offer = data; render(); return; }
    if (data.committed === false) { render(); message(data.message); return; }
    lastMutation = null;
    if (offer && data.residenceId === offer.residenceId) {
      offer.owner = true; offer.owned = true; offer.forSale = false; offer.locked = data.locked;
      if (data.keyId) offer.pendingKeys = data.delivery === 'pending' ? [{ id:data.keyId, sameCharacter:true }] : [];
    }
    render();
    message(data.delivery === 'pending' ? 'Compra registrada; chave com entrega pendente. Atualize para recuperar a entrega.' :
      data.delivery === 'delivered' ? 'Chave entregue. A propriedade está registrada no seu perfil.' : 'Operação registrada. Atualize a consulta.');
  }
  window.AetheriusResidences = { receive };
})();
