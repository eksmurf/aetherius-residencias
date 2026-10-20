# Projeto de compra de residências do Aetherius

**Entrega para integração no servidor oficial:** [pacote ZIP 0.1.0](dist/aetherius-residencias-0.1.0.zip) · [SHA256 do ZIP](dist/aetherius-residencias-0.1.0.zip.sha256) · [guia de instalação e pendências](implementacao/README.md).

O código está em `implementacao/` e os estudos em `docs/`. O modelo de CI permanece em `implementacao/ci/`; o envio deste repositório não executa testes nem implanta o sistema.

Preparar a compra de residências com Septims ou Diademas, com posse vinculada ao `profile_id` do jogador, entrega de chave e controle das portas e dos baús. A proposta inicial usa os interiores existentes do mundo, sem criar uma instância por comprador, e adapta o sistema do Alduinak às regras e à economia do Aetherius.

**Diretriz vigente em 13/10/2026:** o alvo é o servidor oficial do Aetherius, sua base de dados, seu cliente distribuído e sua economia. Planejamento, implementação e validação devem seguir essa estrutura. O host local só entra no trabalho quando o solicitante pedir explicitamente. Os documentos nesta pasta registram o projeto; sua localização não define um ambiente de execução.

**Estado em 19/10/2026:** implementação inicial preparada em [implementacao/README.md](implementacao/README.md), para encaminhar aos superiores responsáveis pela integração e implantação. Inclui módulo de compra/posse/chave, migração, interface, integrador e testes. O adaptador concreto da carteira de Diademas e o catálogo de imóveis reais permanecem pendentes de integração. Código ainda não homologado; nenhum teste foi executado no host local ou no servidor e nada foi implantado. As fontes oficiais recebidas orientam a arquitetura, mas não comprovam sozinhas qual revisão está executando no servidor neste momento.

## Moedas e responsabilidade técnica

**Septims são a moeda do jogo. Diademas são cash adquirido pelo jogador com dinheiro real.** A compra da residência usa uma dessas moedas, debitando o saldo correspondente na economia oficial. O sistema de residências não cria uma segunda carteira de cash, não vende Diademas e não converte automaticamente uma moeda na outra.

O desenvolvimento deverá conduzir autonomamente a investigação e as escolhas técnicas a partir das informações disponíveis. Identificar o contrato da carteira, o funcionamento das chaves e os eventos do servidor faz parte da implementação; não é uma tarefa a transferir ao solicitante. Uma informação só deve ser solicitada quando faltar acesso ou dado que não possa ser obtido nas fontes disponíveis.

## Requisitos dos dois prints

| Origem | Requisito | Tratamento no projeto |
|---|---|---|
| Hermaeus Mora | Usar o Alduinak como estudo | Estudo da revisão atual do GitHub, comparada com a cópia antiga |
| Hermaeus Mora | Comprar com Septims e Diademas | Escolha entre preços independentes por moeda; débito e posse consistentes |
| Hermaeus Mora | Registrar no identificador usado pelo servidor | Dono pelo `profile_id`, validado contra a conta autenticada |
| Hermaeus Mora | Posse de portas e baús em interiores existentes | Uma residência agrupa suas referências físicas; o mundo continua compartilhado |
| Hermaeus Mora | Conferir interiores com várias portas | Todas as entradas, saídas e baús cadastrados pertencem ao mesmo imóvel |
| Hermaeus Mora | Consultar preferência por casas únicas ou instanciadas | Enquete preparada; resultado ainda pendente |
| Mercurius | Registro permanece com o jogador | Nome, conexão e identificador temporário do ator não definem propriedade |
| Mercurius | Receber uma chave para trancar e destrancar | Chave física emitida pelo servidor, revogável e separada do título de propriedade |
| Mercurius | Mapear locais para não considerar toda porta uma residência | Catálogo explícito de imóveis; porta ou baú fora dele não pode ser comprado |

## Experiência proposta

1. O jogador interage com uma entrada de um imóvel cadastrado e vê nome, disponibilidade, portas/baús incluídos e preços.
2. Escolhe pagar em Septims ou Diademas, conforme as opções configuradas para aquele imóvel. A confirmação mostra uma moeda e o valor total; não há conversão implícita entre moedas.
3. O servidor confere identidade, proximidade, disponibilidade e saldo. Só uma compra pode vencer por residência.
4. A confirmação registra a posse no perfil e emite a chave. Se a entrega da chave precisar de recuperação, a interface informa isso sem cobrar novamente.
5. O jogador usa a chave para trancar/destrancar as entradas autorizadas. Os baús privados possuem controle próprio de acesso; deixar a porta aberta não torna o conteúdo dos baús público.

Uma casa com entrada principal, acesso pelos fundos e dois baús será **um imóvel com um dono**, e não quatro compras independentes. Agrupar referências para compra não significa copiar a célula nem alterar sua propriedade nativa no jogo.

## Escopo da primeira versão

- Catálogo de residências mapeado no mundo do servidor oficial, começando com um piloto restrito.
- Compra em ambas as moedas após validar seus adaptadores reais.
- Registro persistente por perfil, chave inicial, trancar/destrancar e recuperação de chave perdida.
- Proteção de múltiplas entradas e dos baús cadastrados, inclusive após reconexão e reinício.
- Consulta de dono pela equipe e correção administrativa auditada.

Facções proprietárias, aluguel, leilão, impostos, decoração, venda entre jogadores e roubo/arrombamento ficam para fases posteriores. Distribuir cópias de chaves ou acesso a convidados depende da política escolhida; não será uma transferência automática da propriedade.

## Documentos do projeto

- [Estudo do Alduinak e das fontes oficiais recebidas](docs/ESTUDO.md): o que existe, diferenças e pontos que exigem adaptação.
- [Arquitetura e regras propostas](docs/ARQUITETURA.md): catálogo, identidade, moedas, chaves, persistência e integração.
- [Etapas e critérios de aceite](docs/PLANO-E-TESTES.md): entregas, dependências e cenários de homologação.
- [Enquete e decisões de produto](docs/ENQUETE-E-DECISOES.md): texto pronto e definições ainda necessárias.
- [Registro das fontes](fontes.json): revisões, caminhos e hashes dos arquivos consultados.

## Próxima etapa

Encaminhar o pacote aos superiores para revisão, conexão à carteira oficial de Diademas, definição do item de chave e dos imóveis reais, execução dos testes e integração à distribuição oficial. O usuário esclareceu que nossa responsabilidade é desenvolver e entregar o sistema, e que não tem acesso direto ao repositório oficial. A [documentação do pacote](implementacao/README.md) diferencia os componentes implementados dos pontos ainda dependentes dessa integração.

O roteiro completo está em [Etapas e critérios de aceite](docs/PLANO-E-TESTES.md). Preços e limites serão configuráveis; defini-los não exige redesenhar ou interromper a implementação. A publicação de uma oferta exige valores intencionais, nunca preços de exemplo ativados automaticamente.
