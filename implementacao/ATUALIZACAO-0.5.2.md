# Atualização 0.5.2 — anúncio manual exige IPTU quitado

Entrega de 11/11/2026 para integração pelos superiores. Não comprova instalação no servidor oficial.

## Regra

- Qualquer parcela vencida impede criar ou alterar um anúncio manual. Campo e botão ficam desabilitados, com orientação para quitar os impostos. O servidor também recusa pedidos diretos na transação que altera o anúncio.
- Anúncio existente fica suspenso desde o primeiro vencimento. Uma confirmação antiga de compra é recusada antes de debitar o comprador. Com uma parcela, quitar reativa o anúncio existente; após suspensão de acesso por duas ou mais parcelas, a recuperação continua cancelando o anúncio anterior, exigindo novo anúncio.
- Sem vencimentos, anunciar é permitido. Não é necessário antecipar impostos e o sistema continua sem pagamento antecipado. Imposto não configurado impede anunciar até regularização pela equipe.
- A retomada automática com três parcelas vencidas continua pelo preço cadastrado. O antigo dono não recebe o valor dessa venda.
- A venda instantânea continua separada: retorno de 40%, com IPTU descontado até zerar o ganho, sem cobrança adicional.

## Instalações 0.5.0 ou 0.5.1 já integradas

1. Registrar revisão e hashes em uso; guardar cópia dos arquivos a alterar.
2. Na raiz que contém `server/gamemode/residences`, executar `git apply --check /pacote/compat/0.5.1-para-0.5.2.patch` e depois `git apply` com o mesmo caminho. O patch altera somente `store.cjs`, `tax.cjs` e `errors.cjs`; preserva o cadastro pela porta/IPTU3. Se houver divergência, conciliar os trechos em vez de substituir o módulo integrado pelo arquivo base.
3. Atualizar `client/properties/properties.js` no destino oficial do CORE UI e redistribuir o bundle/cache do cliente. O módulo identifica a versão 0.5.2.
4. Reiniciar/recarregar o backend pelo procedimento oficial para aplicar a nova validação e atualizar as ofertas em memória. Não habilitar venda instantânea ou visita como parte desta correção.
5. Não há migração SQL nova. Não reaplicar a 006 nem alterar datas, dívidas, conteúdos ou donos existentes.

## Instalações anteriores

Seguir os pré-requisitos de [ATUALIZACAO-0.5.0.md](ATUALIZACAO-0.5.0.md), mas usar o delta completo `compat/IPTU3-0.5.2/residencias-0.5.2.patch` e seu `manifest.json` em lugar do delta 0.5.0. Não aplicar os dois deltas completos em sequência. A migração continua sendo a 006, uma única vez. Os assets deste pacote já incluem a ficha simplificada da 0.5.1.

## Validação e aceite

Passaram 43 testes de domínio/interface e 9 testes SQL em memória (8 cenários e o agrupador), incluindo recusa de anúncio no primeiro vencimento, tentativa direta, quitação e desbloqueio, compra com oferta antiga sem débito e preservação da venda instantânea com dívida. Os mesmos 9 testes SQL passaram sobre a composição IPTU3 recebida. O delta completo passou em `git apply --check`.

No servidor de homologação: testar sem vencimentos, com uma/duas/três parcelas, vencimento durante confirmação, quitação, anúncio existente e oferta automática com três parcelas. Conferir que imposto pago mas ainda não recolhido pela cidade não bloqueia anúncio: a regra olha a dívida do proprietário, não a pendência de arrecadação.

Os testes usam SQL em memória e adaptadores simulados; não representam movimentação real ou homologação multiplayer. Para reverter código, restaurar backend e asset juntos; não restaurar o banco. A versão anterior permite novamente anúncios com uma parcela vencida.
