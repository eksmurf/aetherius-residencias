# Atualização visual das residências 0.3.2

03/11/2026. Aplicação do estudo do chat **UI/UX - Melhorias**, projeto de padronização de cores v1, aos painéis de compra e TAB → Propriedades. Referência principal: Classes, conforme [VISUAL_SYSTEM.md da Core UI](https://github.com/pablo-rodrigues1/AetheriusUI_Core/blob/ce96e1dc35acd02375e063554402407f471ba453/docs/VISUAL_SYSTEM.md).

## O que muda

- Superfície preta translúcida `rgba(0,0,0,.73)`; títulos e conteúdo neutros, sem fundo verde.
- Texto principal `#f0f1f1`, secundário `#d4d8db` e discreto `#b7bec2`.
- Verde `#69cf99` para foco/seleção e `#4fc787` para a ação de confirmação. Valores e cronômetros passam a ser neutros.
- Divisórias brancas a 11% de opacidade; controles a 22%, com hover neutro.
- Avisos de imposto em tom âmbar `#c4b374` e remoção em `#d98a7c`, complementos semânticos do estudo. Os avisos continuam descritos em texto.
- Corpo de 16 px, informação secundária de 14 px e títulos serifados. Campos e linhas se reorganizam em telas estreitas.
- Seções de Propriedades transparentes, separadas por linhas, evitando vários cartões escuros sobrepostos.
- Confirmações com fundo sólido para leitura; foco de teclado visível e respeito a movimento reduzido.

Nome da casa, botão Fechar, ESC, seleção pelo mouse e acesso pelo TAB mantêm seus fluxos. Não foi adicionado um segundo botão para abrir Propriedades nem alterada qualquer regra de compra, impostos, venda, chaves ou permissões. O ajuste de janela continua sob responsabilidade do CORE UI; esta entrega não cria outro controle concorrente.

## Arquivos alterados em relação à 0.3.1

| Arquivo do pacote | Alteração |
| --- | --- |
| `client/residences/style.css` | Visual do painel de compra |
| `client/properties/properties.css` | Visual de Propriedades |
| `client/properties/properties.js` | Apenas identificação de versão `0.3.2` |
| Metadados, manifesto e documentação | Registro da entrega e procedência |

O código do servidor, as migrações, o integrador, a lógica JavaScript das interfaces e as regras econômicas permanecem os da 0.3.1. Os estilos são restritos a `#aetherius-residences` e `.ar-properties`; não declaram tokens globais em `:root` nem sobrescrevem o launcher, o radial, o HUD ou outros módulos. Os tokens do estudo foram adaptados aos arquivos de origem, não copiados como uma folha global de sobrescritas.

## Integração pela equipe

**Se o servidor ainda estiver na primeira entrega 0.1.0**, esta troca visual isolada não instala o sistema completo de Propriedades. Seguir o [guia 0.1.0 → 0.3.1](ATUALIZACAO-0.1-PARA-0.3.1.md), usando este pacote 0.3.2 como destino final: o backend e as migrações necessários são os mesmos. Não instalar versões intermediárias. Preservar o adaptador de Diademas, a configuração aprovada e os dados existentes.

**Se a 0.3.1 já estiver integrada e homologada**, não reaplicar SQL nem reimplantar economia/backend por causa desta mudança visual:

1. Registrar hashes e guardar os três arquivos anteriores. Comparar com as adaptações oficiais antes de sobrescrever.
2. Atualizar `residences/style.css` no cliente e `ui-core/frontend/modules/properties/properties.css` e `properties.js` na distribuição correspondente. Os arquivos de Propriedades vêm de `client/properties/` neste pacote.
3. Atualizar também a origem mantida pelo processo de build/distribuição da equipe, para o próximo build não restaurar o tema antigo. Se o projeto copia assets estáticos durante o build, executar esse passo oficial; copiar apenas no checkout não atualiza os clientes.
4. Manter as folhas carregadas uma única vez. Não substituir `shell.js`, o painel administrativo nem os estilos compartilhados do CORE pelos arquivos deste módulo.
5. Conferir os estilos efetivos no CEF. Um tema global carregado depois pode sobrescrever o módulo; corrigir a ordem/escopo na revisão oficial, sem aplicar seletores globais ou uma camada indiscriminada de `!important`.
6. Distribuir os assets atualizados e validar após reabrir o cliente. Confirmar leitura sobre cenários claros e escuros, rolagem em resoluções baixas, foco, mouse, ESC, avisos de imposto, limite familiar, confirmação de remoção e confirmação de compra.

A única superfície nova de Propriedades é o corpo do módulo; o cabeçalho externo do CORE continua sob controle do shell oficial. A prévia usa uma moldura demonstrativa, não um patch do shell.

## Conferência e reversão

Conferidos em prévia: larguras de 736 e 360 px sem rolagem horizontal, texto 16/14 px, confirmação de compra, cancelamento de remoção, bloqueio por imposto e ESC nos dois painéis; sem erros JavaScript. [Registro da conferência](atualizacao/VERIFICACAO-UI-0.3.2.json).

A conferência desta entrega é da prévia HTML isolada com dados fictícios, sem iniciar servidor de jogo ou conectar ao banco. Não substitui homologação do CEF, sincronização do launcher nem comprova implantação. As suítes completas de domínio/PostgreSQL continuam pendentes na infraestrutura da equipe.

Para reverter **apenas o visual sobre uma base já 0.3.1**, restaurar os três arquivos guardados e redistribuir os assets; não restaurar banco, itens ou saldos. Para falha durante a migração completa de 0.1.0, seguir o procedimento de recuperação do guia de atualização, que exige considerar todos os estados persistidos.
