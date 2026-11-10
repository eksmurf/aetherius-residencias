# Adaptador oficial das extensões residenciais

`official-extensions.cjs` deve exportar `contract:'aetherius-residence-extensions-v1'`. Este é um contrato novo de integração, não uma lista de APIs nativas existentes. A entrega contém o controlador e os testes com fixtures; os métodos abaixo precisam ser implementados sobre os mecanismos comprovados da revisão oficial. Não ativar com adaptadores vazios ou simulações.

## Venda instantânea

`withTransferBarrier({session,residenceId,requestId},work)` executa e aguarda `work()` dentro da barreira oficial que coordena propriedade, PD, inventários, menus de armazenamento já abertos e salvamentos. Antes da alteração, drenar as transferências já autorizadas. Após ela, nenhuma transferência antiga pode sobrescrever conteúdo ou retirar bens. Respeitar também o cache residencial indisponível durante a mutação. Resultado incerto mantém a conciliação durável, sem simplesmente liberar uma escrita antiga. Não alterar/apagar o conteúdo da casa.

`creditInstantSaleInTransaction(conn,input)` recebe identidade autenticada (`accountId`, `profileId`, `characterId`), `operationId`, `idempotencyKey`, `residenceId`, `amount`, `currency:'septims'`, `reason:'residence_instant_sale'`. O valor é **líquido**, depois da retenção do IPTU. Não debitar o jogador novamente nem usar o tesouro municipal como origem. Retornar `{accountId,characterId,amount,currency:'septims',transactionId}` com valores correspondentes.

O módulo controla a transação SQL. Usar a conexão recebida; não fazer commit próprio. Se crédito em banco e inventário nativo exigirem etapas distintas, gravar uma obrigação durável no mesmo commit e reconciliar a entrega com recibo único. O método não pode modificar primeiro o inventário nativo e confiar em rollback SQL. A barreira deve coordenar indisponibilidade, resultado incerto e eventual obrigação de entrega. Não registrar a mesma receita em dois saldos oficiais.

Com líquido zero, não há chamada de crédito. A retenção cria recibo fiscal e pendência municipal na mesma transação; o excedente encerrado é auditado no recibo da venda. O adaptador municipal de IPTU3 continua responsável pela coleta posterior.

## Visita experimental

| Método assíncrono | Responsabilidade |
|---|---|
| `prepareTour({session,residence,door})` | Conferir vivo, fora de combate, sessão, entrada, célula e pontos seguros; retornar rota oficial com `alive:true`, `inCombat:false`, `verified:true`, `cell`, `destination`, `returnPoint`. Nunca aceitar coordenadas do cliente. |
| `protectTour(tour)` | Instalar proteção individual antes de qualquer viagem; fechar/revogar menus já abertos e bloquear todas as rotas de manipulação/combate. Idempotente por `tour.id`. |
| `enterTour(tour)` | Revalidar identidade, rota e estado persistido antes da viagem. Não mover uma visita já revogada. Viagem idempotente; chegada será observada no servidor. |
| `observeTour(tour)` | Retornar `connected`, `sameSession`, `alive`, `inCombat`, `inside`, `arrived` autoritativos. Desconhecido nunca equivale a ausência de combate. `inside:false` representa saída do percurso; durante carregamento ainda não confirmado, não declarar chegada. |
| `returnTour(tour)` | Retorno externo seguro e idempotente; retornar `{safe:true}` somente após confirmação. Para morto, não ressuscitar/curar: coordenar o respawn oficial. Offline mantém pendência até login seguro. |
| `releaseTour(tour)` | Remover proteção somente após retorno seguro, de forma idempotente. |
| `revokeToursBeforeTransfer(ids)` | Revogar interações e instalar barreira de retorno imediatamente antes da compra; a transação marca as visitas como retornando. Um rollback pode encerrar um tour, nunca liberar bens indevidamente. |

A tabela `aetherius_residence_tours` é a fonte durável. O controlador usa 20 segundos como limite operacional de chegada e 60 segundos desde chegada confirmada. Reconexão/repetição não estendem a visita. Na inicialização, todas as visitas abertas passam a retorno; o adaptador deve recuperar sua proteção **antes de liberar qualquer interação no login**, inclusive após reinício do processo. Uma proteção preparada cuja transação não confirmou também deve ser conciliada pelo adaptador, sem teleporte por uma intenção não confirmada.

A proteção deve cobrir ativação, transferência, pickup/drop, NPC/corpo, roubo, comércio, entregas, crafting, móveis, ativadores, ataque, magia e grito. Portas internas permitidas vêm do percurso validado. Não congelar a célula inteira nem conceder invulnerabilidade. O bloqueio do servidor prevalece sobre o contador visual.

O controlador consulta as visitas a cada ciclo de manutenção. O adaptador deve aplicar prazo/revogação nos próprios pontos de autorização, sem permitir ações entre o vencimento e o próximo ciclo. Falha de retorno conserva a proteção e a linha pendente. Registrar falhas operacionais e alertar a equipe sobre retornos presos. Não existe garantia nativa apenas por implementar a consulta SQL.

O HUD CEF mostra a contagem. Há saída antecipada no HUD quando o cursor estiver disponível e em TAB → Propriedades. Fechar a oferta não pausa o tour. A equipe deve verificar a visibilidade no compositor do cliente oficial, inclusive com menus abertos.

## Cadastro S+

`aetheriusResidencesBridge.reviewAmenities(actorId,payload)` e `.reviewAcquisition(actorId,payload)` são pontes de servidor autenticadas por S+. Conectar ao router administrativo oficial, que deve fornecer o ator da sessão e limitar o tamanho do pedido. Não encaminhar ator escolhido pelo cliente. O painel municipal não recebe autoridade para editar origem de compra ou características sem o papel S+.

As capacidades de entrada/retorno, proteção completa e barreira de persistência não foram comprovadas nas fontes residenciais recebidas. Por isso, não há adaptador concreto nesta entrega e as duas funções ficam desabilitadas por padrão. O cadastro/compra existentes, a consulta de ficha e o IPTU continuam usando seus contratos próprios.
