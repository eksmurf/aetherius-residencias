# Residências 0.3.5 — painel revisado e pagamento no vencimento

03/11/2026. Esta versão substitui a antecipação introduzida na 0.3.4. Entrega para integração pela equipe; não comprova instalação no servidor.

## O que muda

- Antes do vencimento, o botão mostra o valor da próxima parcela, em cinza e desabilitado. Não há cobrança antecipada.
- Com parcelas vencidas, o botão mostra o total acumulado e fica disponível, com letras e borda verdes e interior neutro.
- A confirmação abre em uma janela pequena e centralizada. O pagamento apresenta nome da casa, quantidade de parcelas, total, **Cancelar** e **Confirmar pagamento**. ESC cancela a confirmação e o foco retorna à ação original.
- Remoção de membros e anúncio de venda também usam a janela centralizada. As descrições redundantes abaixo da porta pública e da contagem de visitantes foram retiradas; as permissões permanecem iguais.
- O IPTU continua em 10% do valor base em Septims a cada 15 dias. Duas parcelas vencidas suspendem acessos; três recolocam a casa à venda. Pagamento quita toda a dívida vencida.

## Integração

Atualizar cliente e servidor juntos, preservando as adaptações oficiais: `client/properties/properties.js`, `properties.css` e os módulos de servidor `tax.cjs`, `service.cjs`, `store.cjs` e `errors.cjs`. Recompilar e distribuir os artefatos efetivamente usados pelo servidor e pelo launcher/CORE UI.

`payTax` exige `periods >= 1`. O servidor reconfere o vencimento sob bloqueio da residência e recusa pagamento sem dívida antes de debitar a carteira. O DTO mantém `advance:false`, `paymentPeriods` e `paymentAmount` por compatibilidade; os dois últimos representam apenas a dívida vencida, inclusive zero. Antes do vencimento, o cliente mostra `periodAmount` como valor informativo e mantém o botão desabilitado.

Não há nova migração de schema em relação à 0.3.4. Não reiniciar vencimentos, remover recibos ou desfazer antecipações eventualmente já confirmadas: preservar a data existente e liberar o próximo pagamento somente quando ela vencer. Pedidos repetidos já concluídos continuam retornando seus recibos, sem nova cobrança.

Para a instalação 0.1.0 informada pelo solicitante, seguir primeiro o [guia de migração da primeira versão](ATUALIZACAO-0.1-PARA-0.3.1.md) e as orientações de inicialização quinzenal do [guia 0.3.3](ATUALIZACAO-0.3.3.md), aplicando o comportamento final desta versão. A revisão efetivamente instalada deve ser conferida pela equipe.

## Validação e recuperação

A prévia com dados fictícios foi conferida em larguras de 360 e 1200 pixels: resumo, cores, bloqueio antes do vencimento, totais, confirmação, cancelamento e teclado. A sintaxe JavaScript foi verificada. As suítes de domínio/PostgreSQL foram atualizadas, mas não executadas; não houve acesso ao banco nem teste no jogo.

Na homologação oficial, testar o instante do vencimento, chamadas antecipadas adulteradas, saldo insuficiente, uma ou várias parcelas, repetição de pedido, perda de resposta, concorrência e reinício. Confirmar foco/ESC e posicionamento sobre o CORE UI real, incluindo os avisos de venda e remoção. Preservar chaves e prazos existentes.

Em caso de recuperação, manter servidor e cliente compatíveis e reconciliar qualquer débito já confirmado. A 0.3.4 reabilita antecipações; não usá-la como retorno automático sem considerar essa diferença. Não restaurar banco antigo sem reconciliação financeira.
