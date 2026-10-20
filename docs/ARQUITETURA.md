# Arquitetura proposta para residências

**Escopo vigente — 0.2.1 (20/10/2026):** começar somente com Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside, após validação individual. Severin Manor e casas de mods ficam para etapas futuras. O rascunho inicial contém apenas essas cinco casas; a configuração ativa permanece vazia e desativada. Hjerim ainda requer armazenamento aprovado. Esta decisão substitui referências anteriores a um piloto sem lista definida.

## Alvo oficial

Integrar o módulo ao backend e ao cliente oficiais do Aetherius. As fontes recebidas em `analise-painel-20261009/aetherius-server-main` mostram `server/gamemode` para os serviços, PostgreSQL por `database.js` e identidade autenticada em `server/ts/systems/official-identity.ts`. Conferir essas interfaces contra a revisão efetivamente usada antes da implantação. O laboratório `Aetherius-RP-Local` não é base de implementação, fonte do catálogo nem etapa padrão de testes. Usar o host local somente mediante pedido explícito.

## Identidade e unidade de compra

O dono será `owner_profile_id`, resolvido a partir da sessão autenticada e conferido contra a conta oficial. Nome do personagem e `actorId` servem à apresentação e à sessão; não serão a chave da posse. Registrar também o identificador estável da conta e o personagem que pagou permite rastrear a operação sem transformar o personagem em proprietário.

Nas fontes oficiais recebidas, `characters.id` e `users.id` são UUIDs, e `characters.gold` representa o saldo do personagem. O servidor deve validar que o personagem debitado pertence ao perfil comprador, reutilizando a identidade autenticada da sessão. A posse fica com o perfil/conta e permanece após troca de nome ou personagem; outro personagem desse mesmo perfil pode administrar a residência após autenticação. A aposentadoria de um personagem não revende a casa. Exclusão de conta suspende a posse para tratamento explícito, sem liberação automática para compra ou transferência por reutilização de ID. Um perfil sem vínculo inequívoco não pode comprar.

Uma residência comercial corresponde a um grupo aprovado de referências físicas. Seu identificador é estável e independente da posição dos plugins na ordem de carregamento. Os identificadores das referências serão persistidos com o plugin de origem e o identificador local, e resolvidos para o formato exigido pelo runtime na inicialização. Não gravar apenas o FormID numérico transitório como identidade permanente.

## Cadastro dos imóveis

| Grupo | Campos propostos | Validações |
|---|---|---|
| Imóvel | ID, nome, região, estado, revisão | ID único; estados de rascunho, disponível, reservado, vendido e suspenso |
| Localização | células, mundos e ponto de interação | Correspondem ao cenário efetivo do servidor |
| Portas | pares interior/exterior e função de cada passagem | Todas as entradas contempladas; referências não compartilhadas entre imóveis |
| Baús | referências incluídas, política de acesso e persistência | Sem reset destrutivo; sem apropriar baú público/de missão |
| Preços | preço em Septims e preço em Diademas | Inteiros positivos na unidade oficial; ausência significa moeda não oferecida |
| Validação | versão do catálogo, conjunto de plugins e responsável pela conferência | Alteração relevante de mod suspende o imóvel até nova conferência |

O desenvolvimento identifica candidatos no mundo oficial, monta o catálogo e confere no jogo antes de colocá-los à venda. Detectar uma porta ou um baú é insuficiente para incluí-lo no catálogo. Interiores públicos, comércio, missões, rotas compartilhadas e propriedades de facções precisam ser excluídos ou avaliados individualmente.

O mapeamento técnico parte dos plugins e das referências efetivamente carregados no servidor oficial. Quando houver consulta de registros via houseCARL, usar a skill `mutagen-reference` e confirmar que a instância consultada representa exatamente esse conjunto oficial; a instância local do laboratório não será adotada por padrão. O resultado precisa ser confrontado com o servidor e o cliente distribuído. Esta fase ainda não foi executada: não há imóveis reais ou FormIDs aprovados neste plano.

Para múltiplas entradas, conferir o par de cada porta, outras entradas externas, porões, varandas, passagens entre células e possíveis rotas de acesso por scripts. O catálogo é a autoridade: não agrupar todas as portas de uma célula automaticamente. Referência faltando, repetida ou conflitante impede publicar o imóvel.

## Septims e Diademas

Septims são a moeda do jogo. O adaptador inicial deve usar a economia oficial, incluindo `transactionService.tx.applyGoldDelta` e `recordGoldLedger` dentro da transação da compra, conforme as interfaces recebidas. Não remover ouro físico e debitar o saldo persistido como duas cobranças da mesma compra: conferir como a economia oficial sincroniza inventário e saldo e manter uma única autoridade.

Diademas são o cash que o jogador compra com dinheiro real. A residência consome o saldo já existente da conta; a aquisição desse saldo continua no fluxo de pagamento oficial. Localizar seu contrato e implementar a integração é responsabilidade do desenvolvimento. Não inventar coluna de saldo ou criar uma carteira paralela porque o contrato ainda não apareceu nas fontes recebidas.

Cada imóvel terá preços independentes e configuráveis nas duas moedas. O comprovante registra perfil/conta, personagem quando aplicável, imóvel, moeda, valor, operação da carteira, pedido e resultado. Falha definitiva após um débito exige recuperação ou estorno pela mesma moeda e operação, sem crédito duplicado. Nunca compensar uma compra em Diademas dando Septims. Estorno da compra de residência e contestação de uma recarga de cash são operações diferentes: preservar os vínculos para a política oficial existente, sem introduzir remoção automática de imóveis.

## Fluxo da compra

1. Consultar oferta a partir de uma referência cadastrada, perto do jogador. Servidor devolve ID do imóvel, revisão da oferta, moedas e preços.
2. Confirmar com `request_id`, ID do imóvel, moeda escolhida e revisão esperada. Perfil, preço e saldo são obtidos pelo servidor; valores enviados pelo cliente não são autoridade.
3. Revalidar sessão, vínculo com o personagem pagador, distância, célula/mundo, catálogo, disponibilidade, limite de imóveis e preço.
4. Reservar a operação por perfil e pedido, rejeitando o reaproveitamento do mesmo pedido com conteúdo diferente. Bloquear a residência e a carteira em ordem determinística.
5. Persistir débito, registro financeiro, proprietário e emissão pendente da chave de forma consistente.
6. Após confirmação persistida, sincronizar as referências e entregar a chave. Responder com resultado recuperável pelo mesmo pedido após desconexão.

Se carteira e posse estiverem no mesmo banco, usar uma transação para débito, registro financeiro, posse, auditoria e fila persistida de entrega. Deve existir unicidade de dono ativo por imóvel e de referência por imóvel. A resposta ao perdedor de uma corrida de compra não pode deixar débito.

Se Diademas estiverem em serviço externo, não prometer atomicidade de banco entre sistemas. O adaptador precisará de reserva/confirmação/cancelamento idempotentes, ou protocolo equivalente documentado. Persistir a reserva exclusiva do imóvel e o estado de pagamento, consultar resultados incertos e reconciliar após reinício. Timeout não autoriza uma segunda cobrança, liberar um imóvel já pago ou confirmar sucesso sem evidência. Se a carteira não oferecer suporte suficiente, a compra em Diademas permanece indisponível até resolver a integração.

## Chaves e acesso

A compra emite uma chave física específica do imóvel. O registro proposto contém ID da chave, ID do imóvel, geração da fechadura, emissor, destinatário e estado de entrega/revogação. O nome visível pode ser “Chave da residência …”, mas o texto do nome sozinho não autentica o item.

Antes de implementar, confirmar se o inventário real preserva a identidade individual da chave, dados adicionais e transferências. O servidor deve conferir a chave emitida e sua presença no inventário autoritativo. Caso o runtime não ofereça essa garantia, documentar e resolver a dependência técnica antes de liberar chaves transferíveis; não reduzir silenciosamente o requisito a uma notificação visual.

A chave concede uso autorizado da fechadura; a posse permanece com o perfil. Perder, guardar ou entregar uma chave não vende nem abandona a casa. Proposta inicial: usar a chave para trancar/destrancar; o dono pode solicitar reposição validando sua identidade, com revogação das cópias anteriores. A reposição precisa funcionar para dono legítimo que ficou do lado de fora.

O número de geração aumenta ao trocar fechadura ou transferir a posse. Chaves antigas deixam de funcionar, inclusive se estiverem com usuários offline ou em baús. Uma cópia não pode transferir propriedade, emitir novas cópias ou executar ações administrativas.

A chave inicial deve ser entregue exatamente uma vez do ponto de vista de autorização. Usar uma fila persistida e ID estável de emissão; em resultado incerto, conferir a existência do item antes de reenviar. A compra concluída com entrega pendente não será repetida e não cobrará novamente. Não anunciar “chave entregue” antes de confirmar.

Para a primeira versão, adotar saída livre a partir do interior para não prender jogadores. Trancar uma entrada atua em todas as entradas externas configuradas, preservando o estado de acesso do imóvel. Deixar a casa destrancada permite visitas, mas não autoriza automaticamente acesso aos baús. Cópias/convites com permissão de baú ficam desativados nesta versão; sua implementação futura não bloqueia o núcleo de compra e propriedade.

## Autoridade e persistência

| Entidade proposta | Responsabilidade |
|---|---|
| `residences` | Catálogo, preços, estado e revisão |
| `residence_refs` | Relação exclusiva de portas, pares, saídas e baús com o imóvel |
| `residence_ownership` | Perfil/conta proprietária e histórico de aquisição |
| `residence_purchases` | Pedido, pagador, moeda, valor, resultado e reconciliação |
| `residence_keys` | Emissão, geração, permissões e revogação das chaves |
| `residence_access` | Autorizações adicionais, caso a política de convidados seja habilitada |
| `residence_outbox` | Entregas e sincronizações persistidas ainda não confirmadas |
| `residence_audit` | Compra, rejeições relevantes, reposição e ações administrativas |

Estes nomes são um modelo de domínio, não uma migração pronta. Reutilizar as estruturas oficiais equivalentes onde existirem. A base de posse escolhida é a autoridade; propriedades replicadas no mundo são projeções reconstruíveis, sem uma segunda fonte concorrente de dono.

Interceptar no servidor a ativação de portas e baús e as operações que efetivamente movem itens. Bloquear apenas o menu do cliente não protege um contêiner. A integração deverá preservar os demais handlers e confirmar como o runtime cancela cada ação, inclusive pacote direto, lockpick, abertura nativa e eventos de inventário.

Baús exigem uma fonte única de inventário, proteção contra acesso simultâneo, rejeição de quantidades inválidas e persistência verificada após reinício. Não duplicar itens entre uma tabela nova e o inventário nativo. Chaves, objetos com dados extras e itens não empilháveis precisam sobreviver a depósito/saque. O comportamento de respawn/reset deve ser validado em cada baú cadastrado.

Falha de banco/cache bloqueia compra e acesso aos baús protegidos sem cobrar, mas preserva a rota de saída. Suspender novas vendas não remove o direito de acesso já comprado. Ao alterar o catálogo de imóvel ocupado, manter o controle sobre as referências antigas até migração validada; não removê-las da proteção por simples substituição de arquivo.

## Pontos de integração e implantação futura

Implementar o domínio de residências como módulo próprio em `server/gamemode`, conectado ao ciclo de vida oficial e à ponte do cliente distribuído. Reutilizar a sessão autenticada oficial, a conexão PostgreSQL e as transações existentes. Integrar as funcionalidades estudadas no Alduinak sem importar seu gamemode inteiro, suas facções, pets ou persistência MongoDB.

Confirmar a revisão do backend e do cliente alvo antes de alterar arquivos. Preparar migração aditiva com cópia de segurança e relatório de dados legados por personagem; nenhuma posse antiga pode ser convertida para perfil sem vínculo válido. Não executar a compra antiga e a nova simultaneamente.

Introduzir controles separados de novas compras e acesso a imóveis existentes. Validar no ambiente do servidor oficial com perfis de teste e imóveis restritos à equipe, sem abertura pública automática. Executar concorrência e falhas destrutivas em recursos isolados no host/infraestrutura oficial, sem derrubar o processo público nem usar cash comprado de jogadores como massa de testes. Homologar com dois clientes compatíveis com a distribuição oficial e liberar primeiro o catálogo piloto. O retorno de versão deve suspender vendas, reconciliar pagamentos pendentes e manter acesso/posse/chaves; restaurar arquivos não desfaz uma compra já realizada. Nenhuma DLL nova é presumida como necessária: a investigação dos hooks e das chaves determinará isso.
