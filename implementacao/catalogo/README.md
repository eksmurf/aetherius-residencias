# Mapeamento para confirmação no servidor oficial

Em 20/10/2026, foram levantados 12 interiores prioritários: cinco do jogo base, Severin Manor do DLC Dragonborn e seis de mods. O cadastro registra 15 pares de portas recíprocas e audita 270 recipientes. Quinze baús/cofres passaram na triagem inicial; nenhum imóvel está liberado para venda.

## Arquivos para a equipe

- [IMOVEIS.md](IMOVEIS.md): relação resumida das 12 casas.
- [cadastro-auditado.json](cadastro-auditado.json): IDs, origem, portas, baús, donos nativos, exclusões e pendências por imóvel.
- [residences.draft.json](residences.draft.json): definições com referências concretas, preços vazios e `forSale: false`, separadas da configuração ativa.
- [fila-de-mapeamento.json](fila-de-mapeamento.json): 87 outros candidatos nominais, incluindo dependências, casas ocupadas e locais compartilhados. Ainda sem levantamento completo das portas.
- [PROVENIENCIA-MAPEAMENTO.json](PROVENIENCIA-MAPEAMENTO.json): comparação das listas e hashes dos arquivos disponíveis.
- `evidencias/`: leituras dos registros e união dos objetos declarados por todos os plugins que contribuem para cada interior.

## O que foi comprovado nos arquivos

As listas de 413 plugins ativos dos perfis PERFORMANCE e GRAFICO - QUALIDADE disponíveis coincidem, na mesma sequência, com as listas do cliente oficial recebido em 09/10. O houseCARL resolveu 424 plugins, incluindo 11 masters/CC implícitos, no epoch `e2-7f6816a2cb626d27`. A interface do MO2 mudou de perfil durante a investigação; o epoch permaneceu igual e ambas as listas ativas foram comparadas.

Isso comprova a compatibilidade das listas, **não a igualdade das versões dos arquivos nem a revisão instalada no servidor**. Os registros foram lidos na cópia disponível em MO2; não houve acesso ao runtime remoto. O manifesto inclui hashes de 41 plugins relevantes e seus provedores para a comparação pela equipe. `Shadows.esp` e `ccBGSSSE001-Fish.esm` têm provedores ambíguos no levantamento de arquivos; os hashes de ambos estão registrados, sem assumir qual binário está em produção.

Não foram usados os plugins do laboratório do servidor para preencher IDs. Não houve edição de ESP/ESM/ESL, alteração de load order, execução do jogo ou mudança em banco.

## Critérios e limites

As referências usam o FormID local e o plugin que define o registro, não o prefixo temporário da ordem de carregamento. Para cada interior, foram reunidos os filhos persistentes e temporários de **todos** os plugins declarantes; ler apenas a lista do último override perderia objetos. Os objetos e recipientes foram então lidos no vencedor da ordem disponível.

Os pares de porta foram conferidos em ambas as direções, incluindo o lado externo. Proudspire tem três entradas; Honeyside tem duas. Portas sem teleporte são registradas à parte. Rotas alternativas, portas habilitadas por scripts e alterações durante missões ainda exigem inspeção no jogo.

O rascunho inclui apenas baús/cofres convencionais sem `Respawns`, sem `EnableParent` e sem o flag de desativação inicial nos registros lidos. Exclui recipientes especiais identificados por suas funções, como mercadores, estantes, aquários e baús de missão. Essas regras são uma triagem: não garantem ausência de scripts ou de referências em missões.

Hjerim, Forger's Retreat e Burzag Yomgur Longhouse ficaram sem baú sugerido. É necessário selecionar ou adaptar armazenamento persistente antes de vendê-las. Os demais recipientes excluídos continuam fora da proteção do rascunho; a equipe precisa decidir quais adaptar, bloquear ou remover da área negociada.

## Confirmação e ativação pelos superiores

1. Comparar plugins/hashes e confirmar os vencedores de registros no servidor e no cliente distribuído.
2. Aprovar quais casas poderão ser comercializadas. Dono nativo ausente não prova que a casa está vaga; presença de NPCs, missões, serviços públicos e posse anterior precisa ser revisada.
3. Resolver portas/fechaduras nativas, dependências de missão e todos os recipientes excluídos. Confirmar que entradas internas, externas e acessos alternativos foram cobertos.
4. Definir nome exibido, preços reais, item dedicado de chave e a integração da carteira de Diademas.
5. Copiar somente os imóveis aprovados para `server/config/residences.json`, preencher preços e habilitar venda durante o piloto. Aumentar revisão se atualizar um imóvel já persistido.
6. Homologar com dois jogadores: entrada/saída, compra concorrente, chave, baús, reset, reconexão e reinicialização.

**Não importar o rascunho inteiro apenas porque `forSale` está falso.** O módulo protege referências cadastradas mesmo sem oferta de venda; isso poderia bloquear casas ou objetos de missão. O pacote mantém a configuração ativa vazia e desativada.

`build-catalog.cjs` reproduz os arquivos derivados a partir das evidências incluídas e verifica sua estrutura. Não conecta ao jogo ou ao banco. A validação estrutural foi realizada; os testes automatizados do sistema e a homologação em jogo continuam pendentes.
