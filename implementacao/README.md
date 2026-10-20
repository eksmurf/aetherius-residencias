# Implementação de residências para o servidor oficial

Pacote 0.2.0 atualizado em 20/10/2026 para entrega aos responsáveis pelo Aetherius. Contém a implementação inicial do módulo, migração PostgreSQL, interface, integrador e testes. Usa como contrato os arquivos oficiais recebidos em 09/10 e os pontos de integração do painel de 13/10. O Alduinak permanece referência de comportamento, fixada em `db9933d911eec60092d3646b4ee28dc19f2fe254`; o HEAD remoto foi conferido novamente em 19/10 e continuava nessa revisão.

**Estado de entrega: código para integração e validação, ainda não homologado.** Não houve instalação, migração, débito ou teste no servidor. Nenhum servidor de laboratório foi iniciado. Os testes executáveis foram incluídos para rodar na infraestrutura dos responsáveis; não há resultado de execução que permita declarar o pacote aprovado.

`PROVENIENCIA.json` identifica as fontes recebidas e suas revisões/hashes, sem afirmar que são as instaladas. `MANIFESTO-SHA256.json` relaciona os arquivos deste pacote para conferência da entrega. São nove testes unitários de domínio, cinco de interface e onze testes PostgreSQL preparados, todos ainda sem execução.

## O que foi implementado

- Catálogo restrito, referências únicas e pares completos de entrada/saída. Uma residência agrupa todas as entradas e baús.
- Compra com saldo de Septims pela interface transacional da economia recebida. Débito, histórico financeiro, dono por `profile_id`/UUID de conta, recibo e emissão da chave são gravados na mesma transação.
- Caminho de compra em Diademas com adaptador transacional separado. **A integração concreta da carteira de cash está pendente**, porque seu código/contrato não foi fornecido. Sem adaptador, a opção fica indisponível e não há débito.
- Exclusão mútua para compradores, limite configurável por perfil, pedido idempotente e consulta do resultado depois de perda da resposta.
- Emissão de chave nomeada no inventário autoritativo; recuperação por ID de emissão, reposição com revogação e posse vinculada ao perfil/conta.
- Bloqueio de portas trancadas e de ativação/saque/depósito em baús privados. Saída interna liberada, inclusive durante indisponibilidade após inicialização.
- Interface de oferta, confirmação, escolha da moeda, fechadura, reposição e recuperação. `/casa` consulta uma entrada próxima; tentar abrir uma entrada bloqueada também oferece a consulta.
- Migração aditiva, configuração inicialmente desativada, integração com backup e testes unitários/PostgreSQL.

## Atualização do cadastro e da interface

O [mapeamento](catalogo/README.md) reúne 12 casas, incluindo seis de mods, com 15 pares de portas e 270 recipientes inspecionados. O rascunho não é carregado automaticamente. Os responsáveis precisam confirmar versões, ocupação, missões, preços e armazenamento.

O painel usa a paleta verde e transparência do painel de administração recebido, com seletores isolados para coexistir com o CORE UI. O nome da casa fica no topo, inclusive nas confirmações; as opções são clicáveis, Fechar fica no rodapé e ESC também fecha. A ponte do cliente ativa foco/cursor ao abrir e o devolve ao jogo ao fechar. Fechar não cancela compra em andamento; respostas atrasadas não reabrem a interface. Homologar foco, ESC e coexistência com os demais menus no cliente distribuído.

## Integração pelos responsáveis

1. Comparar o pacote com a revisão oficial em uso, revisar os arquivos e aplicar `migrations/001_residences.sql` na base PostgreSQL oficial escolhida, com backup. A migração acrescenta tabelas próprias; não cria nem modifica a carteira de cash.
2. Confirmar que `users` e `characters` estão acessíveis nessa conexão e que `profile_id`, UUIDs, `is_banned` e status do personagem correspondem às interfaces recebidas. Bancos separados para conta e personagem exigem adaptação da autorização; o módulo não adivinha esse vínculo.
3. Na infraestrutura de desenvolvimento oficial, conferir a integração sem alterar arquivos:

   ```sh
   node integrate.cjs --server=/caminho/aetherius-server/server --client=/caminho/aetherius-client/client
   ```

4. Aplicar com os mesmos caminhos e `--apply`. O integrador copia o módulo/interface, acrescenta inicialização no gamemode, conecta os pacotes e foco no `BridgeService.ts` e inclui CSS/JS em `index.html`. Faz backup dos arquivos substituídos, preserva configuração existente e recusa âncoras ambíguas. Não aplica SQL, não inicia processos e não compila o cliente.
5. Integrar a carteira de Diademas conforme [CONTRATO-DIADEMAS.md](CONTRATO-DIADEMAS.md). Não copiar o exemplo para produção como se já fosse a integração.
6. Preencher `server/config/residences.json` com o item de chave e o catálogo real, conforme [CATALOGO.md](CATALOGO.md). O padrão `maxPerProfile: 1` é configurável e não está ativado enquanto o módulo estiver desativado. `allowProfiles` não vazio restringe a interface de operação ao piloto; lista vazia abre o fluxo a todos os perfis autenticados quando habilitado.
7. Compilar o cliente pelo processo oficial e distribuir o JavaScript compilado, o `index.html` efetivamente carregado pelo Meridian/CEF e a pasta `residences`. Confirmar o caminho real da página antes de copiar; alterar um HTML não usado pelo cliente não instala a interface.
8. Rodar os testes e a matriz no servidor com contas/imóveis restritos. Somente depois habilitar compras públicas. A configuração ativa continua vazia. O cadastro preliminar separado em `catalogo/` contém 12 casas com referências lidas, mas ainda sem aprovação para venda; conferir suas pendências antes de importar qualquer definição.

## Inicialização e proteção

O módulo precisa ser instalado após os handlers existentes e antes de abrir o servidor aos jogadores. Habilitá-lo começa com bloqueio temporário de ativações e transferências de inventário enquanto carrega catálogo e estado. **Se a inicialização falhar, esses bloqueios permanecem até corrigir e reiniciar.** Ativar pela primeira vez em manutenção, após migração/configuração e validação. O log identifica a falha; não continuar a abertura pública nesse estado.

Depois da carga, a proteção se limita às referências residenciais e ao transporte de chaves residenciais. O cache expira em cinco segundos e falha de leitura bloqueia os objetos protegidos. Uma conexão dedicada com trava PostgreSQL impede dois processos deste módulo na mesma base. Não reatribuir os hooks depois da instalação. A política de saída livre pressupõe que os pares e o lado interior foram corretamente cadastrados.

O módulo mantém as referências persistidas mesmo quando uma oferta sai do arquivo de configuração. Mudanças de referências existentes são recusadas e exigem migração específica. Preços/oferta podem mudar com aumento de revisão; o cliente precisa reconfirmar preço novo. Não alterar proprietário, fechaduras ou chaves por SQL enquanto o serviço estiver aberto.

## Limites da chave e dos baús

A chave usa o item configurado, um nome único associado à emissão persistida e a validação independente de perfil/conta. Não é uma credencial transferível: uma pessoa que copie o nome ou carregue a chave de outra conta não obtém acesso. Nesta versão, mover o item base escolhido por operações de baú é bloqueado; escolher um item dedicado, sem uso compartilhado com outras mecânicas. O próprio dono pode solicitar reposição, que invalida as anteriores e tranca a residência.

A confirmação de `mp.set(inventory)` é uma leitura imediata do estado do servidor, não uma garantia de flush físico do changeform antes de uma queda da máquina. A emissão pendente é recuperável pelo mesmo ID; uma chave já marcada como entregue e perdida após falha de persistência pode ser reposta com revogação. Homologar nome, persistência, reset e reconciliação no build oficial. Não há cópias para terceiros, venda de imóvel ou abandono no pacote inicial.

O inventário dos baús continua sendo o nativo. O módulo valida autorização nos eventos de ativação, depósito e saque; não cria uma segunda tabela de itens. A integridade de itens com dados extras, respawn e persistência depende de homologação do runtime e de cada baú cadastrado. O bloqueio é de acesso no servidor; esta versão não adiciona uma aparência de fechadura por Papyrus.

## Testes para executar na infraestrutura oficial

```sh
npm install --ignore-scripts --no-audit --no-fund
npm test
# Definir RESIDENCES_TEST_DATABASE_URL numa base exclusiva residence_test_...
npm run test:postgres
```

O teste PostgreSQL recusa `DATABASE_URL` de produção, exige nome de banco começando por `residence_test` e cria/remove apenas um schema aleatório próprio nessa base. A carteira fictícia existe somente nesse schema de teste. O modelo `ci/residences.yml` pode ser colocado em `.github/workflows` no repositório de entrega, com este pacote na raiz; para subpasta, ajustar o diretório dos passos. O arquivo não foi publicado nem executado.

Os testes cobrem disputa por compra, repetição, adulteração, fundos, rollback após débito, contrato cash, resultado incerto do commit, revogação e entrega recuperável. A matriz de jogo do planejamento continua obrigatória, particularmente dois clientes, múltiplas portas, baús, crash/reconexão e mudança de personagem.

## Desativação e retorno

Para interromper novas compras, usar `purchasesEnabled: false` e reiniciar de forma controlada mantendo o módulo de acesso ativo. Não desabilitar/remover o módulo inteiro após vender imóveis: isso retiraria a proteção. Restaurar arquivos não estorna dinheiro nem remove propriedade. Manter tabelas, chaves, acesso e recibos até uma migração de retorno revisada. Nenhuma coluna legada de moradia é convertida automaticamente.
