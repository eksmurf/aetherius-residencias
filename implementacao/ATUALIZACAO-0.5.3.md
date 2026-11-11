# Atualização 0.5.3 — cancelar anúncio no primeiro IPTU vencido

Entrega de 11/11/2026 para integração pelos superiores. Substitui a suspensão temporária de anúncio introduzida na 0.5.2.

## Comportamento

Ao vencer o primeiro IPTU, o anúncio manual é cancelado definitivamente: preço anunciado e personagem vendedor são removidos, com incremento da revisão de acesso. Pagar a dívida não recria o anúncio. Após quitar todos os impostos vencidos, o dono precisa informar o preço e confirmar um novo anúncio.

A oferta já é recusada no instante do vencimento pela verificação de dívida, inclusive quando o comprador mantém uma confirmação antiga aberta. A remoção persistente ocorre no próximo ciclo de atualização (normalmente 1,5 segundo), na inicialização do serviço ou ao consultar Propriedades. Funciona com o proprietário offline. Se o pagamento chegar antes desse ciclo, a mesma transação de quitação remove o anúncio antes de avançar o vencimento; ele não reaparece depois do pagamento.

Não muda a retomada automática com três IPTUs vencidos, o bloqueio de acesso com dois, a posse, os membros, os conteúdos da casa nem a venda instantânea de 40% com desconto de dívida.

## Atualização

1. Confirmar a revisão em uso e guardar cópia dos arquivos afetados.
2. Para uma instalação **0.5.2 já integrada**, aplicar `compat/0.5.2-para-0.5.3.patch` na raiz que contém `server/gamemode/residences`: primeiro `git apply --check /pacote/compat/0.5.2-para-0.5.3.patch`, depois `git apply` com o mesmo caminho. O delta altera apenas `store.cjs`, preservando cadastro/IPTU3 e adaptadores. Divergências exigem conciliação; não substituir o backend integrado pelo arquivo base.
3. Para **0.5.0/0.5.1**, aplicar primeiro o delta incremental `compat/0.5.1-para-0.5.2.patch`, depois o delta do passo 2. Para **IPTU3 anterior à 0.5.0**, usar somente o delta completo `compat/IPTU3-0.5.3/residencias-0.5.3.patch`, verificando seu manifesto e os pré-requisitos do guia 0.5.0. Não sobrepor deltas completos de versões diferentes.
4. Atualizar `client/properties/properties.js` no destino oficial, recompilar/distribuir os assets e invalidar seu cache. O módulo identifica a versão 0.5.3.
5. Reiniciar/recarregar o serviço residencial pelo procedimento oficial. A primeira atualização cancela anúncios já vencidos, sem necessidade de o dono conectar.

Não há nova migração SQL. Não reaplicar a 006 nem zerar impostos. A atualização não habilita os adaptadores pendentes de visita/venda instantânea.

## Validação e retorno

Passaram 43 testes de domínio/interface e 9 testes SQL em memória (8 cenários e o agrupador). A suíte SQL também passou contra a composição IPTU3 recebida. Foram conferidos: cancelamento persistente sem login, limpeza repetida sem incrementar a revisão novamente, quitação antes da limpeza, consulta de Propriedades, compra antiga recusada sem débito e possibilidade de anunciar novamente após quitar. Os deltas completo e incremental tiveram sua aplicação conferida.

Homologar o mesmo fluxo com clientes oficiais, incluindo anúncio criado antes da atualização e dono offline. Os testes automatizados usam dados e adaptadores simulados, sem implantação ou movimentação de saldo oficial.

Para reverter código, restaurar backend e asset juntos. Anúncios já cancelados não devem ser reconstruídos automaticamente a partir de recibos antigos; seus donos podem criar novos anúncios após regularizar o IPTU. Não restaurar o banco inteiro.
