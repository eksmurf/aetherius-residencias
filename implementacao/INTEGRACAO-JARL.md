# Integração das residências com a cidade

O backend municipal administra a associação entre casa e cidade. O módulo de residências registra os pagamentos e, na interação com uma porta de entrada cadastrada, recolhe os valores para a cidade mediante autorização municipal. O painel do Jarl pode ser conectado posteriormente.

## Pagamento e recolhimento

O pagamento desconta os Septims do morador, quita as parcelas e cria uma pendência de recolhimento na mesma transação. Uma casa sem cidade aceita o pagamento. O primeiro vínculo cadastrado pelo painel do Jarl atribui à cidade as pendências dessa casa que ainda estavam sem destino.

O responsável autorizado recolhe ao pressionar E na porta. A autorização e a posição são conferidas no servidor. O crédito municipal e a marcação dos pagamentos como recolhidos são confirmados juntos. O saldo pessoal do coletor não recebe essa arrecadação. O pagamento do morador continua quitado enquanto a coleta aguarda o responsável.

A proximidade é verificada no evento de ativação da porta, antes de aguardar o banco. A identidade da sessão e a referência da porta são reconferidas na transação. Isso permite que alguém que também tenha direito de entrada atravesse a porta durante o processamento. O recolhimento é disparado pelo hook do servidor, sem ação de coleta remota exposta ao cliente.

Cada interação recolhe até 100 pagamentos, limitada a 2.147.483.647 Septims por transação. Havendo excedente, outra interação recolhe o restante. Coletas concorrentes bloqueiam a mesma residência e cada pagamento só integra um recolhimento. A venda da casa preserva as pendências de arrecadação já pagas.

Uma troca ou remoção do vínculo exige recolher antes as pendências já destinadas à cidade atual. O histórico continua associado ao destino e aos agentes originais. Essa regra evita que uma alteração de cidade redirecione arrecadação pendente.

## Chamadas do futuro painel

O router autenticado do Jarl deve usar o `actorId` fornecido pelo servidor ao chamar `globalThis.aetheriusResidencesBridge.cityRequest(actorId, action, payload)`. A resposta segue `{ok:true,data}` ou `{ok:false,error:{code,message},uncertain}`.

| Ação | Payload | Resultado |
|---|---|---|
| `inspectResidence` | `{residenceId}` | Nome, cidade, revisão do vínculo, valor e quantidade de pagamentos pendentes |
| `linkCity` | `{requestId,residenceId,cityId,bindingRevision}` | Recibo com operação, cidade anterior, cidade atual e nova revisão |

`residenceId` é o identificador do catálogo de casas. `cityId` é o identificador canônico reconhecido pelo backend municipal, como texto de até 64 caracteres alfanuméricos, `_` ou `-`. Para remover o vínculo, usar `cityId:null`. `bindingRevision` começa em zero e vem de `inspectResidence`. Uma alteração concorrente exige nova consulta. `requestId` é um UUID e deve ser reutilizado ao consultar o resultado reenviando o mesmo pedido após perda de resposta. O reenvio de uma operação confirmada retorna seu recibo.

Os totais de inspeção são strings decimais, para preservar valores acima do limite seguro de inteiros do JavaScript. A interface do Jarl deve formatá-los sem conversão imprecisa para `Number`.

As ações municipais são expostas pela ponte do servidor. Os canais de compra na porta e Propriedades rejeitam solicitações de vínculo. A autorização municipal também é obrigatória na ponte.

## Adaptador da cidade

A equipe deve fornecer `server/gamemode/residences/official-cities.cjs`, exportando o contrato abaixo. O carregamento ocorre na inicialização das residências.

```js
{
  contract: 'aetherius-residence-city-taxes-v1',
  async authorizeInTransaction(conn, context) { /* retorna true apenas se autorizado */ },
  async creditInTransaction(conn, input) { /* retorna recibo do crédito municipal */ }
}
```

`authorizeInTransaction` recebe `{session,permission,residenceId,cityId,toCityId}`. A sessão contém os IDs autenticados de perfil, conta e personagem. As permissões são `residence.inspectCity`, `residence.linkCity` e `residence.collectTax`.

- Na inspeção, validar a jurisdição do agente sobre a residência, inclusive enquanto ela estiver sem cidade.
- No vínculo, validar a existência da cidade de destino e a autoridade para atribuir aquela residência. Na transferência, exigir autorização sobre a origem e o destino. Permissão em qualquer cidade isoladamente não autoriza tomar uma residência de outra jurisdição.
- Na coleta, validar que o personagem tem função ativa de coletor para a cidade indicada. Ser dono, familiar ou visitante da casa não concede essa função.
- Ler e bloquear as linhas oficiais necessárias na conexão recebida, mantendo a autorização válida até o commit. Bloquear cidades em ordem estável ao lidar com mais de uma. Evitar promoção concorrente de locks compartilhados para exclusivos sobre a tesouraria.

`creditInTransaction` recebe `{cityId,currency,amount,operationId,idempotencyKey,residenceId,collectorProfileId,collectorAccountId,collectorCharacterId}`. Deve atualizar o saldo que o painel municipal exibirá e registrar o crédito em seu histórico, usando a conexão `conn`. Deve retornar `{cityId,currency:'septims',amount,transactionId}`, com os mesmos valores recebidos e um identificador de transação não vazio de até 160 caracteres. Valores ou destino divergentes fazem a operação reverter.

O módulo de residências controla begin/commit/rollback. O adaptador executa suas consultas nessa transação, aguarda todas as gravações e verifica que a cidade foi realmente atualizada. Um erro precisa propagar para reverter a coleta inteira. O crédito deve ter chave de idempotência única e origem rastreável. Se o backend municipal usar outra base, a equipe precisará implementar um protocolo de transferência durável antes de ativar a coleta. Uma chamada HTTP isolada não atende ao contrato transacional.

A fonte recebida de `governance-service.js` possui conceitos de cidade e permissões, e `market-stalls-service.js` menciona tesouraria municipal. Essas referências precisam ser conciliadas com o backend oficial atual. O módulo não presume o schema nem a revisão instalada desse backend.

## Disponibilidade e escopo

Com a migração aplicada, o IPTU pode ser quitado mesmo enquanto o adaptador municipal estiver ausente. Os valores ficam registrados como pendentes. A ligação e a coleta são liberadas quando a equipe fornece o adaptador e as permissões oficiais.

Esta entrega implementa a associação de residências e a arrecadação na porta. A definição de alíquotas e os saques serão operações do backend/painel do Jarl. O IPTU residencial desta versão usa a regra quinzenal já aprovada. A tabela de pendências não é um saldo sacável pelo proprietário ou pelo coletor.
