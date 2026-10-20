# Integração da carteira oficial de Diademas

Diademas são o cash comprado pelo jogador com dinheiro real. O módulo consome saldo existente; não cria recarga, checkout, taxa de conversão, conta nova ou saldo paralelo. O contrato concreto da carteira não está nos arquivos recebidos e a API genérica `MasterApiBalanceSystem` não foi assumida como a carteira do Aetherius.

## Carteira no mesmo PostgreSQL

Implementar `server/gamemode/residences/official-diademas.cjs` com o formato de `adapters/official-diademas.cjs.example`. A função recebe:

```js
debitInTransaction(conn, {
  accountId, characterId, profileId, amount, idempotencyKey
})
```

`conn` é a conexão da transação já aberta, com a interface do `database.js` oficial: `query` retorna `[rows, fields]`. A função deve verificar a titularidade real da carteira, bloquear seu saldo, recusar insuficiência, debitar exatamente `amount` e gravar o registro financeiro oficial, usando **a mesma conexão**. Retornar:

```js
{
  accountId,             // UUID da conta debitada
  currency: 'diademas',
  amount,                // inteiro na unidade oficial
  transactionId          // identificador estável, de 1 a 160 caracteres
}
```

A chave `idempotencyKey` identifica a compra. Não executar `COMMIT`/`ROLLBACK`, não abrir outra conexão para debitar e não fazer HTTP para cobrar dentro dessa função. O módulo confirma o conjunto inteiro ou desfaz o conjunto inteiro. Para saldo insuficiente, lançar erro com `code: 'FUNDS'`; outras falhas devem lançar erro sem credenciais no texto.

Sem esse arquivo, `currencies.available('diademas')` é falso, a UI desabilita a opção e pedidos manipulados recebem `DIADEMAS_UNAVAILABLE`. O arquivo de exemplo lança recusa e não modifica saldo. Substituí-lo por uma função que sempre retorna sucesso concederia imóveis sem cobrança: isso não é uma integração válida.

## Carteira em API ou banco separado

**Este pacote inicial não oferece compra em cash distribuída por HTTP.** O adaptador transacional não serve para uma carteira em outro serviço. Será preciso acrescentar reserva persistente do imóvel e um fluxo de pagamento com IDs idempotentes, consulta de resultado, confirmação, cancelamento/estorno e reconciliação após falhas. Não chamar uma API de débito irreversível e depois tentar gravar a posse como se houvesse uma transação única.

Os responsáveis devem fornecer o contrato técnico dessa API, caso essa seja a topologia real. Essa é a dependência externa restante para concluir a integração de cash; não demanda compartilhar senhas nem acesso ao repositório inteiro. A abertura da opção Diademas depende dessa integração e de testes na carteira oficial em ambiente restrito.
