# Guia de integração — IPTU, recolhimento e painel do Jarl

Referência: Residências **0.4.0**, código `0663968`, documentação de 05/11/2026. Destinado à equipe responsável pelo backend municipal e pela implantação no servidor oficial.

O sistema de residências pode registrar o pagamento antes de existir a interface do Jarl. Para recolher e creditar os valores, é necessário conectar a autorização e a tesouraria oficiais. O vínculo entre casa e cidade pertence ao backend/painel do Jarl; o morador não configura esse vínculo.

## 1. Entender o fluxo

1. O morador paga o IPTU vencido em **TAB → Propriedades**.
2. O sistema desconta os Septims, quita a dívida e registra o valor como **pago, aguardando recolhimento**, na mesma transação.
3. Se a casa ainda não tiver cidade, o pagamento fica sem destino municipal até o primeiro vínculo autorizado pelo Jarl.
4. Um responsável com permissão municipal vai até uma porta de entrada cadastrada e pressiona **E**. O recolhimento é automático nessa interação.
5. O valor é **creditado na tesouraria da cidade**, que será exibida no painel do Jarl. A mesma transação marca os pagamentos como recolhidos.

O morador não precisa pagar novamente se o responsável demorar a recolher. A demora na coleta não cria dívida residencial. O coletor não recebe dinheiro no saldo pessoal nem ganha acesso à casa ou aos baús.

**Exemplo:** casa com valor base de 5.000 Septims gera IPTU de 500 Septims por quinzena. Ao pagar uma parcela vencida, o morador perde 500 Septims e regulariza aquela parcela; 500 ficam aguardando coleta. Depois do E autorizado na porta, a cidade recebe 500. Outra interação não arrecada os mesmos 500 novamente.

## 2. Separar as responsabilidades

| Responsável | Entrega |
|---|---|
| Residências 0.4.0 | Cobrança, pagamento, pendências de coleta, vínculo autorizado pela ponte e recolhimento na porta |
| Backend municipal | Identificadores oficiais das cidades, jurisdição sobre as casas, cargos, permissões e crédito na tesouraria |
| Painel do Jarl | Interface para consultar e vincular casas e apresentar o saldo/histórico municipal |
| Equipe de implantação | Migrações, adaptação às fontes oficiais atuais, builds, homologação e publicação no servidor |

**Ajustar alíquotas e sacar para investimentos ainda depende do sistema do Jarl.** Esta entrega não fornece essas operações nem uma nova carteira municipal. A regra residencial atual continua sendo 10% do valor base em Septims a cada 15 dias, sem antecipação; duas parcelas vencidas suspendem o acesso e três colocam a casa novamente à venda.

## 3. Preparar a atualização

1. Identificar o código realmente instalado e preservar as adaptações oficiais, especialmente o adaptador de Diademas. O relato de instalação da 0.1.0 não comprova a revisão atual do processo.
2. Seguir [Atualização 0.4.0](ATUALIZACAO-0.4.0.md). Se a origem ainda for a primeira versão, seguir também [Migração da 0.1.0](ATUALIZACAO-0.1-PARA-0.3.1.md) e os ajustes quinzenais do [guia 0.3.3](ATUALIZACAO-0.3.3.md).
3. Fazer backup e suspender as escritas residenciais durante a atualização. Conferir as migrações já aplicadas: a ordem é `001`, `002`, `003`; não reaplicar a `001` sobre uma instalação existente.
4. Aplicar `migrations/003_city_tax_collection.sql` antes de iniciar o código 0.4.0. Distribuir os módulos, incluindo `city-taxes.cjs`, e realizar os builds e reinício conforme o procedimento oficial.
5. Preservar a configuração do catálogo e homologar primeiro com uma das cinco casas vanilla aprovadas. Se `allowProfiles` restringir o piloto, incluir também os perfis usados para administração municipal e coleta.

Não é necessário construir a interface do Jarl primeiro. A equipe pode conectar e homologar o backend autenticado antes dela. Sem `official-cities.cjs`, os pagamentos novos ficam pendentes, mas vínculo e coleta municipal não ficam disponíveis.

## 4. Implementar o adaptador oficial

Criar `server/gamemode/residences/official-cities.cjs` na instalação integrada. O contrato completo está em [INTEGRACAO-JARL.md](INTEGRACAO-JARL.md). O arquivo deve exportar:

| Exportação | Obrigação |
|---|---|
| `contract` | Valor exato `aetherius-residence-city-taxes-v1` |
| `authorizeInTransaction(conn, context)` | Retornar exatamente `true` somente quando a sessão tiver a permissão municipal solicitada |
| `creditInTransaction(conn, input)` | Creditar o saldo oficial da cidade, registrar o histórico e devolver o recibo do crédito |

As permissões são `residence.inspectCity`, `residence.linkCity` e `residence.collectTax`. A equipe deve associá-las aos cargos reais do servidor. O vínculo exige validar a cidade de destino e a jurisdição sobre a residência, inclusive quando ainda não tem cidade. Uma transferência exige autoridade sobre a origem e o destino. Ser proprietário, familiar ou visitante não concede permissão de coletor.

O crédito deve usar **a conexão `conn` e a transação recebidas**, com a chave única `input.idempotencyKey`. Não abrir outra transação nem fazer commit próprio. O retorno obrigatório é `{cityId, currency:'septims', amount, transactionId}`, mantendo cidade e valor recebidos. Erros devem propagar para reverter a coleta inteira.

O schema e as permissões municipais atuais precisam ser fornecidos pela equipe; não há um adaptador concreto pronto no pacote. Se a tesouraria estiver em outra base, o contrato atual exige projetar uma transferência durável antes de ativar a coleta: uma chamada HTTP isolada não garante crédito e baixa conjuntos.

## 5. Conectar o painel do Jarl à ponte

As chamadas abaixo são feitas **no servidor**, pelo router autenticado do Jarl. A ponte atual exige uma sessão de personagem ativa: `actorId` deve vir dessa sessão, nunca de um campo informado pelo cliente. Um painel administrativo externo sem essa sessão precisará de uma integração autenticada própria; não deve inventar ou aceitar um `actorId` do navegador.

Primeiro consultar a casa:

```js
// actorId vem do contexto autenticado do servidor.
// residenceId vem do catálogo residencial aprovado.
const bridge = globalThis.aetheriusResidencesBridge;
const consulta = await bridge.cityRequest(actorId, 'inspectResidence', {
  residenceId,
});
if (!consulta.ok) {
  // Tratar consulta.error.code e consulta.error.message na resposta do router.
  return consulta;
}
```

`consulta.data` contém `residenceId`, `name`, `cityId`, `bindingRevision`, `pendingAmount`, `pendingPayments` e `currency`. Valores pendentes e contagem são strings decimais; preservá-los sem conversão imprecisa para `Number`.

Para vincular, guardar um UUID para a operação e enviar a revisão consultada:

```js
const { randomUUID } = require('node:crypto');
const pedido = {
  requestId: randomUUID(),
  residenceId,
  cityId, // ID canônico validado pelo backend municipal.
  bindingRevision: consulta.data.bindingRevision,
};
// Persistir pedido para poder reenviar o MESMO conteúdo se a resposta for perdida.
const vinculo = await bridge.cityRequest(actorId, 'linkCity', pedido);
```

O sucesso retorna `{ok:true,data}` com o recibo e a nova revisão. Falhas retornam `{ok:false,error:{code,message},uncertain}`. Se o resultado for incerto, reconciliar/repetir o mesmo pedido com o mesmo UUID; não gerar outro automaticamente. Uma revisão desatualizada exige nova consulta e nova decisão antes de criar outra operação.

Usar `cityId:null` para desvincular. O primeiro vínculo atribui à cidade as pendências ainda sem destino. Para trocar ou remover uma cidade existente, recolher antes os valores pendentes destinados à cidade atual. Não atualizar esses campos diretamente pelo SQL do painel.

Não existe ação pública de “coletar remotamente” nessa ponte. O recolhimento ocorre pelo evento de ativação da porta no servidor. A interface de Propriedades também não cadastra cidades.

## 6. Homologar pagamento e recolhimento

Usar a infraestrutura oficial de homologação e registrar evidências dos seguintes cenários antes da liberação:

| Cenário | Resultado esperado |
|---|---|
| Pagamento antes do vencimento | Botão desabilitado e servidor rejeita antecipação |
| Pagamento vencido sem cidade | Débito único, dívida quitada e pendência sem destino |
| Primeiro vínculo pelo Jarl | Pendência passa à cidade escolhida e autorizada |
| Coletor autorizado pressiona E na entrada cadastrada | Crédito único na tesouraria, histórico e baixa da pendência |
| Coletor sem acesso residencial | Recolhe, mas não ganha entrada ou acesso a baús |
| Pessoa sem cargo, cargo de outra cidade ou interação inválida | Nenhum crédito nem baixa indevidos |
| Duas coletas concorrentes ou nova interação | Cada pagamento é recolhido uma única vez |
| Falha no crédito ou recibo divergente | Transação revertida; valor continua pendente |
| Perda de resposta do vínculo | Reenvio com mesmo UUID retorna o recibo sem repetir a alteração |
| Troca de cidade com valores pendentes | Bloqueada até recolher os valores da cidade atual |
| Venda da casa antes da coleta | Pagamentos já feitos continuam pendentes, sem cobrar o novo dono por eles |
| Troca de personagem ou revogação de cargo durante a operação | Não permite movimentação com identidade/permissão inválida |
| Reinício após pagamento ou coleta | Pendências e recibos persistem, sem nova cobrança/crédito duplicado |

Conferir saldo do morador, saldo da cidade, histórico municipal e saldo pessoal do coletor antes e depois. Cada E processa até 100 pagamentos, limitado a 2.147.483.647 Septims por transação; havendo excedente, repetir a interação para os restantes.

As suítes preparadas estão em `package.json`: `npm test` e `npm run test:postgres`. A suíte PostgreSQL exige `RESIDENCES_TEST_DATABASE_URL` apontando para uma base exclusiva de testes com nome `residence_test` ou prefixo `residence_test_`; não usar produção. Instalação das dependências e demais verificações estão no [README de integração](README.md#testes-preparados).

## 7. Conferir histórico e resolver falhas

A migração 003 não transforma automaticamente pagamentos antigos em arrecadação pendente. Usar a consulta de conciliação do [guia de atualização](ATUALIZACAO-0.4.0.md#pagamentos-anteriores), verificar se houve crédito por alguma adaptação anterior e importar somente operações aprovadas. Não descontar novamente do morador.

| Código | Tratamento |
|---|---|
| `CITY_UNAVAILABLE` | Conferir instalação/carregamento do adaptador municipal |
| `FORBIDDEN` | Conferir cargo, jurisdição, sessão e eventual restrição de perfis do piloto |
| `CITY_CHANGED` | Consultar novamente a casa antes de decidir outro vínculo |
| `CITY_PENDING` | Recolher pendências da cidade atual antes da troca/remoção |
| `CITY_CREDIT` | Corrigir a integração da tesouraria; a coleta foi revertida |
| `SESSION` | Refazer a operação com a sessão atual do personagem |
| `UNKNOWN` ou resposta incerta | Reconciliar pelo pedido/recibo antes de repetir ou compensar valores |

Na coleta sem cidade, sem pendência ou sem autorização municipal, o fluxo normal da porta é preservado; não presumir que toda interação exibirá um erro de arrecadação. Em falha de implantação, preservar recibos e histórico. Voltar ao runtime antigo interrompe a criação de novas pendências: suspender pagamentos até definir como reconciliar esse intervalo.

## 8. Registrar a liberação

A equipe deve registrar a revisão implantada, migrações aplicadas, revisão do adaptador municipal, casas vinculadas, cargos autorizados, evidências dos testes e tratamento dos pagamentos históricos. Depois da aprovação, liberar o piloto conforme a configuração oficial.

**Estado da entrega:** código e contratos preparados; sintaxe e integridade do pacote conferidas. As suítes de domínio/PostgreSQL e a homologação no jogo não foram executadas nesta entrega. Não há comprovação de implantação da 0.4.0 no servidor. Este guia acrescenta documentação, sem alterar as regras ou o runtime.
