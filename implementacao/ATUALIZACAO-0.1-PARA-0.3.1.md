# Atualização das residências de 0.1.0 para 0.3.1

Guia para os responsáveis pela integração e operação do servidor oficial Aetherius. Atualizado em 31/10/2026. **A versão instalada é a primeira entrega, 0.1.0, conforme confirmação do solicitante nesta data.** Ainda é necessário conferir os arquivos efetivamente carregados, as adaptações da equipe e o estado do banco. Não houve inspeção remota do processo em produção.

O destino é o código 0.3.1, publicado no commit `e054d900d7170b27d443ab160c078ca6b6f88c6c`. Esta revisão documental acrescenta o guia e ferramentas de conferência, sem alterar esse runtime. O ZIP `aetherius-residencias-0.3.1-guia-atualizacao-1.zip` inclui esses materiais; o ZIP 0.3.1 original permanece preservado.

**A atualização é direta. Não instalar 0.2.0, 0.2.1 ou 0.3.0 como etapas intermediárias.** Não copiar o pacote inteiro sobre a instalação nem substituir o catálogo/configuração pelos exemplos vazios. Fazer a integração em uma cópia da revisão oficial mantida pela equipe e distribuir os artefatos pelo fluxo oficial.

## 1. Base confirmada e mudanças incompatíveis

| Componente | Primeira entrega 0.1.0 | Destino 0.3.1 |
| --- | --- | --- |
| Banco | Migração `001`, recibos e uma chave ativa por residência | `001` preservada e migração `002`, chaves por beneficiário, membros, impostos e venda |
| Chave | Item físico com nome `Chave residencial [AR:UUID]` | Registro persistido projetado no inventário pessoal do CORE UI, sem item transferível |
| Gerenciamento | Fluxo na porta e comando `/casa`, reposição manual de chave | Somente TAB → Propriedades; sem reposição manual e sem `/casa` |
| Cliente | Compra por ponte CEF | Compra revisada, módulo `properties` e inventário pessoal integrado |
| Catálogo | `refs`, preços e revisão existentes | Acrescentar `interiorCells`, `storageGuards`, `interiorPassages` e preço base em Septims |
| Pessoas | Proprietário | Até 5 cadastros, incluindo até 2 familiares; dono fora dessa contagem |
| Impostos | Ausentes | 10% semanal em Septims, suspensão e retorno à venda por inadimplência |
| Venda | Ausente | Revenda em Septims com crédito oficial e transferência de posse/conteúdo |

Preservar IDs das residências, proprietários, contas, `profile_id`, recibos, IDs de chaves, preços aprovados, conteúdos dos baús e configuração econômica. A migração não cobra novamente pelas casas existentes.

## 2. Confirmar a instalação antes da manutenção

Identificar pelo gerenciador do serviço o diretório usado pelo processo oficial e sua revisão/build. Registrar também a versão do cliente distribuída pelo launcher. Um checkout ou ZIP disponível no disco não comprova o que está carregado em memória ou entregue aos jogadores.

No diretório extraído do pacote, a equipe pode executar:

```sh
node atualizacao/conferir-instalacao.cjs --server=/caminho/runtime/server --client=/caminho/fontes/client --ui=/caminho/distribuicao/Data/Platform/UI > conferencia-residencias.json
```

`--server` é obrigatório; `--client` e `--ui` são opcionais. Os caminhos são exemplos e devem ser substituídos pelos destinos reais. O coletor apenas lê arquivos e escreve JSON na saída padrão: não inicia servidor, importa código instalado, altera arquivos, consulta rede ou conecta ao banco. Não mostra o conteúdo de configurações, adaptadores, credenciais ou dados de jogadores. A conferência de UI pressupõe a estrutura relativa `residences/` e `ui-core/frontend/modules/properties/`; distribuição com estrutura diferente precisa de comparação manual.

O relatório compara hashes com as entregas 0.1.0, 0.2.0, 0.2.1, 0.3.0 e 0.3.1. Normaliza CRLF/LF apenas para comparação de texto e também informa o SHA256 dos bytes originais. Módulos idênticos podem corresponder a várias versões. Nenhuma correspondência significa arquivos personalizados, ausentes ou misturados, não autorização para sobrescrever. Hash de fonte não identifica bundle compilado nem comprova processo ativo.

Para o banco, executar `atualizacao/conferir-banco.sql` na base/schema oficial usando o acesso habitual da equipe. O script usa transação somente de leitura e termina com `ROLLBACK`. Pressupõe as tabelas da `001` e `users`; se faltarem, interromper e revisar o schema real. Não colocar credenciais em comandos publicados no Discord/GitHub.

Conferir e registrar:

- As quatro tabelas da `001` estão presentes; há correspondência entre proprietários e contas oficiais.
- Não há mais de uma chave ativa por residência/perfil nem proprietário sem sua chave ativa. Inconsistências exigem reconciliação com recibos antes da migração; a `002` não cria chaves ausentes.
- Se `tax_due_at`, membros, recibos de imposto ou estado `bound` já existirem, a instalação recebeu adaptações ou parte da `002`. Comparar colunas, índices e constraints antes de seguir. Não tratar presença de uma coluna como prova de migração concluída.
- Perfis com mais de uma casa precisam de decisão/reconciliação da equipe: o novo piloto exige `maxPerProfile:1`, mas não remove propriedades existentes.
- Registrar hashes do adaptador `official-diademas.cjs`, configuração, arquivos de integração e builds. Conferir o contrato real das duas moedas já validado pela equipe.

Guardar os relatórios em ambiente restrito da equipe. Não publicar dumps, inventários, contas ou IDs de jogadores no repositório público.

## 3. Preparar a integração sem interromper produção

1. Extrair o pacote em diretório separado. Verificar o `.sha256` e `MANIFESTO-SHA256.json`.
2. Comparar o código oficial com a base 0.1.0 e com o destino 0.3.1. Preservar correções locais de economia, identidade, autenticação, inventário, UI e persistência. O integrador substitui os arquivos do módulo `residences`; **ele não mescla adaptações locais nesses arquivos**.
3. Manter o adaptador real em `server/gamemode/residences/official-diademas.cjs`. Não substituir pelo `.example`, não criar carteira paralela e não fazer conversão entre moedas. O integrador não fornece nem remove esse adaptador; a distribuição também deve preservá-lo.
4. Adaptar o catálogo conforme a seção 4, sem alterar o banco da produção nesta preparação.
5. Na cópia oficial de integração, conferir a lista de alterações sem gravar:

   ```sh
   node integrate.cjs --server=/copia/oficial/server --client=/copia/oficial/client
   ```

6. Revisar os arquivos listados. Se as âncoras não existirem ou forem ambíguas, mesclar a alteração ao código real; não contornar a verificação com substituições cegas. Marcadores já presentes também exigem revisão de conteúdo: o integrador considera esses blocos integrados, mas não valida suas adaptações.
7. Depois da revisão, aplicar **na cópia de integração**:

   ```sh
   node integrate.cjs --server=/copia/oficial/server --client=/copia/oficial/client --apply
   ```

8. Compilar o servidor TypeScript e o cliente com os comandos, dependências e versões do projeto oficial. O pacote residencial não define nem substitui a pipeline oficial. Esta atualização não entrega uma DLL nativa nova. Executar as suítes em homologação da equipe, incluindo a base de testes exclusiva `residence_test...`; nunca usar o banco de produção para testes.

O integrador preserva `config/residences.json` quando já existe; cria apenas a configuração vazia/desativada quando ela não existe. Se aparecer uma configuração nova inesperadamente, conferir o caminho de destino. Os backups individuais em `residences-backups/` não substituem backup do banco, save storage e distribuição. A escrita dos arquivos não é uma publicação atômica e pode ficar parcial em falhas de I/O.

## 4. Migrar o catálogo e preservar as casas existentes

Partir da configuração oficial atual, e não do `server/config/residences.json` de exemplo. Manter as cinco casas vanilla: Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside. Se houver propriedade adicional já vendida, não apagá-la nem retirar sua proteção para adequar o piloto; interromper a mudança de escopo dessa casa e preparar tratamento específico com a equipe.

Para cada definição persistida:

- Preservar `id` e os pares `desc/kind/partner` de `refs`. O novo código recusa alteração dessas referências. Se o servidor usou IDs ou portas diferentes dos rascunhos, preservar o cadastro real e reconciliar o mapeamento; não renomear a casa no banco para encaixar no exemplo.
- Acrescentar `interiorCells`, `storageGuards` e `interiorPassages` aprovados para a revisão de plugins instalada. Consultar os rascunhos apenas como referência. Não retirar guardas/células/passagens já persistidos sem migração própria.
- Aumentar `revision` acima da revisão efetiva no banco ao mudar a definição. O número `2` dos rascunhos não é uma revisão universal de produção.
- Manter os preços oficiais e informar `prices.septims` positivo, inclusive se a compra original ocorreu por Diademas. Esse valor fornece a base do imposto. Não preencher preços fictícios para fazer o módulo iniciar.
- Incluir todas as casas possuídas na configuração reconciliada. Casa legada omitida pode continuar no banco sem os campos novos e impedir a inicialização. Omitir uma casa não apaga sua posse; apenas retira sua oferta inicial.
- Preservar o `keyDescriptor` antigo durante a migração de chaves. Confirmar que representa um item dedicado e que continua resolvendo na mesma revisão de plugins.
- Usar `maxPerProfile:1`. Não iniciar com `enabled:false` em ambiente aberto que já tenha propriedades vendidas: isso retira a proteção do módulo.

`storageGuards` protege acessos; não torna um recipiente persistente. Homologar respawn/reset, scripts e conflitos, especialmente Hjerim, antes de liberar armazenamento.

## 5. Janela de manutenção e backup consistente

1. Fechar o acesso público e aguardar operações em andamento terminarem. Suspender também escritores externos que movimentem os saldos envolvidos enquanto a equipe obtém o backup consistente.
2. Salvar o mundo e encerrar o processo oficial pelo procedimento habitual. Não executar a `002` com a versão antiga ainda aceitando solicitações.
3. Fazer e verificar backup restaurável do banco oficial, economia/recibos relacionados, inventários/changeforms/save storage, referências/armazenamentos do mundo, configuração, adaptador de Diademas, fontes integradas e distribuição de servidor/cliente. Usar o mesmo ponto de manutenção para todos.
4. Registrar contagens e estado anterior: casas/donos, recibos, chaves e inventários. Preservar pedidos com resposta pendente para conciliar pelo mesmo `request_id`; não repetir uma compra para testar a migração.

`purchasesEnabled:false` limita compras, mas **não é um modo geral de manutenção**: pagamentos e outras alterações de gestão continuam possíveis. `allowProfiles` também não substitui bloqueio de acesso público. Manter a janela de manutenção até concluir toda a verificação.

## 6. Aplicar a migração 002

Para a instalação original 0.1.0 com `001` íntegra, aplicar **somente** `migrations/002_household_tax.sql`, uma vez, no schema oficial correto, usando o executor de migrações da equipe com interrupção em erro. A própria migração contém `BEGIN` e `COMMIT`; não envelopá-la inadvertidamente em outra transação incompatível com o executor.

**Não reaplicar a `001` depois da `002`.** A `001` tenta criar o índice antigo de uma chave ativa por casa. Isso é incompatível com chaves adicionais de familiares: pode falhar ou reinstalar uma restrição que impede a nova funcionalidade. Também não recriar tabelas, truncar dados nem importar fixture de testes.

A `002`:

- Acrescenta dados de imposto, revisão de acesso e anúncio às residências.
- Cria membros e recibos de impostos.
- Preserva recibos históricos, inclusive as ações antigas `lock`/`reissue`.
- Substitui a unicidade de chave por casa pela unicidade por casa/perfil.
- Converte chaves `pending`/`delivered` para `bound`, mantendo seus IDs e vínculos; não altera chaves `revoked`.
- Não debita saldos, transfere casas ou modifica o conteúdo dos baús.

Se houver erro, não iniciar o runtime novo nem registrar a migração como concluída. Verificar o rollback e a causa. Não marcar migração parcial como concluída só porque algumas tabelas existem.

## 7. Implantar servidor e cliente juntos

Distribuir os artefatos revisados na mesma janela, mantendo os jogadores desconectados:

| Destino lógico | Alteração |
| --- | --- |
| `server/gamemode/residences/` | Módulos 0.3.1, preservando o adaptador oficial de Diademas |
| `server/config/residences.json` | Configuração oficial conciliada, catálogo ampliado e `keyDescriptor` antigo |
| `server/gamemode/phase0-basic.js` | Manter uma única inicialização do módulo |
| `server/ts/systems/aetheriusUiSystem.ts` e seu build | Rota de gestão `properties` |
| `server/ts/systems/aetheriusInventoryService.ts` e seu build | Projeção de chaves vinculadas e bloqueio de mutações dessas linhas |
| `client/src/services/services/BridgeService.ts` e seu build | Ponte de compra/foco, sem perder integrações existentes |
| `client/residences/` e HTML que o carrega | Compra atualizada |
| `client/ui-core/frontend/modules/properties/` e HTML do CORE | Painel do TAB, carregado uma única vez |

Os caminhos acima são de fonte/estrutura do pacote. Mapear para os artefatos realmente usados pelo processo e launcher; copiar apenas `.ts` não atualiza um bundle em execução. Não substituir o painel administrativo inteiro nem o inventário CORE por versões antigas. Evitar dois módulos registrados como `properties`, inclusive registros feitos pelo manifesto oficial.

Exigir atualização do cliente antes de liberar conexão. O protocolo de compra novo inclui revisão de acesso e tipo de oferta; o cliente antigo não é compatível. Fazer reinício completo controlado: hot reload pode manter `/casa`, handlers ou a instância anterior em memória.

## 8. Retirar chaves físicas antigas

Conferir antes a chave ativa de cada proprietário e o vínculo com a posse. Só depois da `002`, migrar os itens físicos com o procedimento compatível com o armazenamento real do servidor. **Não há limpador universal de saves offline neste pacote**, porque esse formato/revisão instalado não foi fornecido.

Identificar o item pelo `keyDescriptor` dedicado antigo **e** pelo nome/marcador residencial original, conferindo o UUID com o ledger. Se a equipe alterou o formato, adaptar a limpeza ao formato real. Não remover indiscriminadamente toda chave do Skyrim ou todo item com um nome parecido. Cobrir personagens online/offline, baús, corpos, itens largados e cópias históricas quando aplicáveis.

O novo módulo remove itens legados reconhecidos sob demanda ao consultar o inventário pessoal ou interagir com referências protegidas. Isso não comprova limpeza de jogadores offline ou de recipientes que nunca foram acessados. Não contar apenas com essa rotina para declarar a migração completa.

Manter os registros de chaves/posses/recibos no banco. As chaves vinculadas passam a aparecer no inventário pessoal pelo mesmo perfil; perder o item físico antigo não deve exigir nova compra. Não criar novas chaves físicas nem reativar a rotina de reemissão. A limpeza deve preservar os demais itens e as quantidades dos armazenamentos.

## 9. Primeira inicialização e impostos legados

Iniciar em manutenção, com `enabled:true` e compras ainda bloqueadas. Confirmar identidade oficial, integração das carteiras e módulo saudável antes de testar as casas.

A primeira inicialização bem-sucedida executa `installCatalog`. Para **cada casa possuída com `tax_due_at` nulo**, grava vencimento em sete dias a partir dessa inicialização e os termos calculados com o preço base em Septims. Não usa a data antiga de compra para gerar dívida retroativa. Uma vez gravado, esse prazo não reinicia em reinícios posteriores; a contagem continua durante manutenção. Casas que já tinham imposto conservam seus prazos e termos. Registrar o marco real e comunicá-lo aos donos.

Conferir que IDs de casas, donos, chaves ativas e recibos antigos permanecem iguais. Conferir `bound`, índice `aetherius_residence_personal_key` e ausência de `aetherius_residence_current_key`. Confirmar ausência de novos débitos na migração/inicialização e persistência dos itens nos baús.

## 10. Critérios de liberação

Executar na homologação mantida pela equipe os testes preparados (`npm test` e `npm run test:postgres`, com banco exclusivo `residence_test...`). No servidor de produção em manutenção, limitar a validação a procedimentos controlados; não avançar o relógio global, forçar impostos, simular venda de casa real ou limpar inventários de jogadores para reproduzir testes.

| Cenário | Resultado exigido |
| --- | --- |
| Dono legado após atualização e reconexão | Mesma casa/posse, chave pessoal disponível, entrada com E e baús preservados |
| Terceiro sem autorização | “Residência privada”; sem painel de compra nem acesso a baús |
| TAB e compra | Gerenciamento só por Propriedades; mouse, ESC e foco corretos; sem `/casa` ou reemissão |
| Chave | Apenas no inventário pessoal; sem transferência, descarte, depósito ou saque; futuro trade deve excluir a projeção |
| Membros | Quinta pessoa aceita, sexta recusada; terceiro familiar recusado; remover libera vaga |
| Revogação | Removido/demovido perde baús imediatamente, inclusive com recipiente aberto; saída permanece livre |
| Porta pública | Visitante entra, mas não movimenta armazenamento |
| Impostos em homologação | Sem antecipação; 7 dias libera; 14 suspende; 21 reoferta; pagamento antes de recompra recupera a mesma chave |
| Revenda em homologação | Débito/crédito oficial atômicos; itens permanecem; antigos membros e vendedor perdem permissões |
| Compras nas duas moedas | Carteiras reais e reconciliação corretas; idempotência e perda de resposta sem duplicar cobrança |
| Concorrência/reinício | Um comprador por venda, quitação contra recompra consistente, dados preservados ao reiniciar |

Liberar compras e acesso público somente após aceite da equipe, cliente distribuído e chaves legadas reconciliadas. Arquivar revisão de servidor/cliente, hashes, relatório de migração, horário do primeiro vencimento, resultados e responsável. Isso passa a ser a evidência da nova versão instalada.

## 11. Se a atualização falhar

Antes de qualquer nova operação financeira ou alteração de mundo: manter manutenção, encerrar os processos e restaurar o conjunto consistente anterior (banco, save storage/inventários, configuração, adaptador e distribuição de servidor/cliente). Verificar os dados restaurados antes de reabrir.

**Não voltar apenas o JavaScript para 0.1.0 mantendo o banco e chaves em 0.3.1.** O código antigo não entende os novos contratos/estados. Se os itens físicos foram removidos, rollback também precisa recuperar os inventários correspondentes; restaurar só o banco não os devolve.

Após novas compras, impostos ou vendas: não restaurar cegamente um snapshot antigo. Isso pode apagar créditos e recriar posses já transferidas. Manter manutenção e reconciliar os recibos, saldos e estado do mundo pelo procedimento oficial; preferir corrigir a falha na versão nova quando possível. Não há migração reversa automática neste pacote.

## Escopo da conferência

Comparação realizada entre o commit da primeira entrega e a 0.3.1, com leitura de migrações, integrador, configuração e módulos. A `001` e a configuração de exemplo não mudaram entre essas versões. Ferramentas e guia destinam-se à equipe oficial; a inspeção de produção e a execução da migração permanecem sob responsabilidade dela. A confirmação de versão 0.1.0 é do solicitante; não foi inferida a partir do host local.
