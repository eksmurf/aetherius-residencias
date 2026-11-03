'use strict';
const messages = {
  SELLER:'Não foi possível creditar o saldo oficial do vendedor. A compra não foi concluída.',
  TAX_PERIOD:'Há um IPTU de periodicidade anterior registrado. A equipe deve reconciliar os vencimentos antes de iniciar a cobrança quinzenal.',
  TAX_BASE:'Defina o valor base da casa em Septims antes da venda.', TAX_SUSPENDED:'Pague os impostos pendentes para recuperar a chave e o acesso à residência.',
  PRIVATE: 'Residência privada', MEMBER_NOT_FOUND: 'Jogador não encontrado pelo nome completo ou profile_id.',
  AMBIGUOUS: 'Há mais de um perfil com esse nome. Informe o profile_id.', FAMILY_LIMIT: 'Esta residência já possui dois familiares.',
  MEMBER_LIMIT: 'Limite de 5 visitantes cadastrados nesta residência, incluindo familiares. Remova alguém para adicionar outra pessoa.',
  STALE: 'As permissões mudaram. Atualize a consulta antes de confirmar.',
  TAX_CHANGED: 'Este vencimento já foi pago ou foi atualizado.',
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
