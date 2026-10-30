# Catálogo oficial — 0.3.0

O rascunho inicial continua restrito a Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside. Os sete imóveis de DLC/mods estão em `catalogo/etapas-futuras/`. Configuração ativa vazia e desativada; não importar os rascunhos automaticamente.

Cada definição exige:

- `id`, `name`, `revision`, `forSale`, `prices` e `refs`, como na versão anterior.
- `prices.septims`: valor base obrigatório para ofertar a casa e calcular o imposto, mesmo quando também aceita Diademas. A revenda particular tem preço próprio, persistido pelo módulo; não altera esse valor base.
- `interiorCells`: descritores das células interiores exclusivas da casa. Não cadastrar áreas compartilhadas. Armazenamentos dinâmicos nessas células recebem proteção.
- `storageGuards`: todos os recipientes auditados, inclusive os excluídos da triagem de persistência. Eles não ficam liberados a visitantes; isso não remove respawn, dependências de missão ou necessidade de adaptação.
- `interiorPassages`: portas internas sem teleporte identificadas no levantamento, para circulação/saída. Não cadastrar entradas externas como passagens.

As referências de `refs` continuam usando `desc`, `kind` e `partner` recíproco para entrada/saída. O gerador mantém os oito pares e os cinco baús/cofres candidatos do piloto e acrescenta proteção dos 186 recipientes auditados das cinco casas. Hjerim ainda precisa de armazenamento persistente aprovado.

A revisão dos rascunhos passou a 2. Na instalação real, usar revisão superior à atualmente persistida e conservar os pares de `refs`; o carregador recusa mudanças nessas referências sem migração específica. Não retirar guardas/células/passagens previamente cadastradas apenas editando configuração: isso exige revisão de migração para evitar exposição de armazenamento ou bloquear saídas.

`keyDescriptor` agora serve somente para identificar e retirar o item físico dedicado das versões antigas. Novas chaves são vínculos persistentes projetados no inventário pessoal; não exigem novo item ESP. O campo pode ser nulo apenas em instalação nova sem chaves legadas. Comparar os plugins/hashes com a revisão instalada antes de ativar.
