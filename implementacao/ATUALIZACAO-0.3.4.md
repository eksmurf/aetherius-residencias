# Residências 0.3.4 — IPTU compacto e antecipação

**Documento histórico:** a [versão 0.3.5](ATUALIZACAO-0.3.5.md) remove a antecipação. O ZIP 0.3.4 preserva a regra descrita abaixo. Usar o pacote e o guia mais recentes.

03/11/2026. Substitui a regra anterior que impedia pagamento antes do vencimento. O intervalo permanece em 15 dias e cada parcela mantém 10% do valor base em Septims.

## Comportamento

- Sem parcelas vencidas: **Antecipar pagamento — valor de uma parcela**. Após confirmação e débito, o próximo vencimento avança exatamente 15 dias a partir do vencimento existente; não a partir do instante do pagamento. Cada operação antecipa uma parcela. Uma nova antecipação exige nova confirmação/pedido e avança mais um ciclo.
- Com uma ou mais parcelas vencidas: **Pagar impostos — total acumulado**. Quita todas as parcelas vencidas, sem incluir uma parcela futura nessa mesma operação.
- O proprietário confirma o pagamento antes de ser debitado. Na antecipação, a confirmação informa a nova data de vencimento.
- A seção mostra título, contagem de tempo, botão e aviso curto. O contador aponta para o próximo vencimento/acúmulo; a data completa aparece na confirmação de antecipação. Avisos de suspensão/retomada continuam aparecendo quando aplicáveis.
- Aviso permanente: “Os impostos acumulam. Na 2ª quinzena sem pagar, todos perdem acesso à casa e aos baús. Na 3ª, a casa volta à venda.” As consequências seguem a quantidade de parcelas vencidas, considerando antecipações e pagamentos realizados.

Exemplo: casa com primeiro vencimento em 18/11. Antecipar antes dessa data quita uma parcela e desloca o próximo vencimento para 03/12, mantendo o mesmo horário. Sem pagamentos, o bloqueio continua ocorrendo ao acumular duas parcelas e a retomada ao acumular três.

## Contrato e integração

Esta atualização altera servidor e cliente, não apenas o texto do botão. Atualizar juntos `tax.cjs`, `service.cjs`, `store.cjs`, `errors.cjs`, `properties.js` e `properties.css`, preservando as adaptações oficiais e distribuindo os artefatos usados pelo runtime/launcher.

O DTO acrescenta `advance`, `paymentPeriods` e `paymentAmount`. `periods`/`amount` continuam representando a dívida vencida, inclusive zero. `paymentAmount` é o valor que será pago: uma parcela quando não há dívida ou a dívida integral quando existe. O pedido `payTax` aceita `periods:0` para antecipação; negativos são recusados. O cliente não informa o preço nem o novo vencimento.

O servidor reconfere proprietário, revisão de acesso, vencimento e número de parcelas sob bloqueio da residência. Debita a economia oficial, avança o vencimento e grava recibo na mesma transação. Repetir o mesmo pedido retorna o recibo sem nova cobrança. Se o vencimento/quantidade de parcelas mudar antes da confirmação, o pedido deve ser atualizado e confirmado novamente. Não alterar `request_id` para reenviar uma operação pendente.

Não há migração de schema nova em relação à 0.3.3. O ledger existente de impostos registra antecipações pela mesma ação `payTax` e pelo vencimento quitado. Não zerar prazos, recriar chaves ou converter moeda. Aplicam-se as orientações do [guia 0.3.3](ATUALIZACAO-0.3.3.md) para instalações antigas; as proibições de antecipação nos documentos históricos deixam de valer.

## Validação pela equipe

Homologar antecipação com saldo suficiente/insuficiente, pagamento de uma e várias parcelas, confirmação cancelada, repetição do mesmo pedido, concorrência, mudança de parcela durante confirmação e reinício. Conferir o avanço em múltiplos de 15 dias e a preservação das chaves. A prévia usa dados fictícios; as suítes de domínio/PostgreSQL precisam ser executadas na infraestrutura oficial de homologação, sem usar o banco de produção como fixture.

Manter cliente e servidor na mesma versão durante recuperação. Voltar a um cliente anterior remove a ação de antecipar; nunca restaurar um banco antigo sem reconciliar antecipações/débitos já confirmados.
