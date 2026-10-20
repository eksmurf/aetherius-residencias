'use strict';
const messages = {
  INVALID: 'Pedido inválido.', SESSION: 'A sessão do personagem mudou.',
  UNAVAILABLE: 'Residências temporariamente indisponíveis.', NOT_FOUND: 'Residência não cadastrada.',
  SOLD: 'Esta residência não está disponível para compra.', PRICE_CHANGED: 'A oferta mudou. Consulte novamente.',
  FUNDS: 'Saldo insuficiente.', CURRENCY: 'Esta moeda não está disponível para este imóvel.',
  DIADEMAS_UNAVAILABLE: 'A carteira oficial de Diademas ainda não está integrada.',
  FORBIDDEN: 'Você não tem autorização para esta residência.', KEY: 'É necessário portar a chave atual.',
  DISTANCE: 'Aproxime-se de uma entrada cadastrada.', CONFLICT: 'O identificador do pedido já foi usado com outros dados.',
  LIMIT: 'O limite de residências deste perfil foi atingido.', BUSY: 'Aguarde a operação em andamento.',
  UNKNOWN: 'Resultado ainda não confirmado. Consulte o mesmo pedido antes de tentar novamente.',
};
function fail(code) { throw Object.assign(new Error(messages[code] || messages.UNAVAILABLE), { code }); }
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
function integer(value, min = 1, max = 2147483647) { return Number.isSafeInteger(value) && value >= min && value <= max; }
module.exports = { messages, fail, uuid, integer };
