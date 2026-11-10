# Atualização 0.5.1 — ficha da residência simplificada

Entrega de 10/11/2026 para integração pelos superiores no servidor oficial. Não representa implantação em produção.

## O que mudou

A oferta inicial, a revenda e a confirmação de compra mostram somente características com quantidade inteira positiva confirmada. Categorias com zero, ausentes ou ainda não verificadas ficam ocultas. Se nenhuma característica estiver confirmada, o título e a seção inteira também ficam ocultos.

O backend continua distinguindo ausência de falta de verificação. Esta atualização não transforma candidatos do levantamento em equipamentos homologados e não altera a exigência de ficha completa quando `requireAmenities` estiver habilitado.

## Para quem já integrou a 0.5.0

1. Confirmar a revisão realmente distribuída e guardar cópia do asset atual.
2. Substituir `client/residences/app.js` pelo arquivo deste pacote no caminho equivalente da distribuição oficial. Se a equipe modificou esse arquivo, conciliar apenas a função `amenities(body)` para preservar as adaptações.
3. Regerar e distribuir o bundle/cliente pelo procedimento oficial, atualizando o cache/versionamento dos assets para que o CEF carregue o arquivo novo.
4. Conferir uma oferta e sua confirmação com categorias positivas, zero e desconhecidas: apenas as positivas aparecem, com suas quantidades. Conferir também uma ficha inteiramente pendente: não deve haver título vazio nem avisos de ausência/verificação. Repetir em uma revenda.

Não há nova migração de banco nem alteração de economia, IPTU, permissões, visita ou adaptadores nesta revisão. Não reaplicar a migração 006 ou o delta IPTU3 apenas para atualizar esta interface.

## Para instalações anteriores à 0.5.0

Este ZIP contém a implementação completa. Seguir primeiro [ATUALIZACAO-0.5.0.md](ATUALIZACAO-0.5.0.md), usando o asset atualizado daqui. O delta `compat/IPTU3/residencias-0.5.0.patch` mantém o nome porque o backend não mudou. Preservar cadastro pela porta, integrações municipais e adaptadores oficiais; não copiar o backend base por cima da composição IPTU3.

Venda instantânea e visita continuam dependendo de `official-extensions.cjs` e da homologação descrita em [CONTRATO-EXTENSOES.md](CONTRATO-EXTENSOES.md). Esta revisão visual não habilita esses recursos.

## Validação e retorno

Os seis testes existentes de interface de compra passaram após o ajuste. A prévia web com dados fictícios foi conferida: somente quatro categorias positivas apareceram, enquanto categorias zero/desconhecidas ficaram ocultas. Isso não substitui a conferência no CEF oficial. Os resultados anteriores de backend permanecem documentados em [VALIDACAO-0.5.0.md](VALIDACAO-0.5.0.md).

O ZIP possui manifesto SHA256 interno e checksum externo. Para voltar apenas esta mudança, restaurar o asset anterior e redistribuir o cliente/cache. Não restaurar o banco ou desfazer operações residenciais.
