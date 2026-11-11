# Integração oficial — residências 0.5.2

**Atualização 0.5.2:** [anúncio manual exige IPTU quitado](ATUALIZACAO-0.5.2.md). Atualizar backend e painel; usar o delta incremental para 0.5.0/0.5.1 ou o delta completo para IPTU3 anterior. Sem nova migração SQL.

**Atualização 0.5.1:** [guia da ficha simplificada](ATUALIZACAO-0.5.1.md). Para uma instalação 0.5.0 já integrada, atualizar somente o asset de compra; não reaplicar migrações ou substituir os adaptadores.

**Atualização 0.5.0:** seguir [ATUALIZACAO-0.5.0.md](ATUALIZACAO-0.5.0.md), usando o delta IPTU3 em instalações com cadastro pela porta. A migração 006 é obrigatória para este código. [Limites e testes](VALIDACAO-0.5.0.md).

**Comece pelo [guia prático do Jarl](GUIA-JARL.md)** para conectar a cidade, autorizar o responsável e homologar pagamento e recolhimento na porta.

**Versão 0.4.0.** Aplicar a [migração de recolhimento](ATUALIZACAO-0.4.0.md) e fornecer o [adaptador municipal](INTEGRACAO-JARL.md). A quitação pode ocorrer antes da configuração da cidade e o valor fica pendente de recolhimento.

**Versão 0.3.6.** [Integração do painel e da compra](ATUALIZACAO-0.3.6.md).

**Versão 0.3.5:** [guia de atualização](ATUALIZACAO-0.3.5.md). Antecipação removida; botão cinza e desabilitado antes do vencimento e verde quando há dívida. Confirmações em janela centralizada. Atualizar cliente e servidor juntos; preservar vencimentos e recibos existentes.

**IPTU quinzenal:** começar pelo [guia 0.3.3](ATUALIZACAO-0.3.3.md). O ciclo atual é de 15 dias, com suspensão aos 30 e retorno à venda aos 45 dias sem pagamento. Ainda não havia IPTU ativo, conforme confirmação do solicitante em 03/11/2026.

Atualização visual 0.3.2 preparada em 03/11/2026 sobre o backend 0.3.1. Leia [ATUALIZACAO-UI-0.3.2.md](ATUALIZACAO-UI-0.3.2.md) para distinguir a atualização visual da migração completa da primeira versão. Entregamos código e contratos para a equipe integrar no servidor oficial. Nenhum banco ou processo do servidor foi alterado. O piloto continua sendo as cinco casas vanilla.

## Componentes

- Módulo autoritativo de compra, venda, impostos e permissões por `profile_id` e UUID de conta.
- Migrações PostgreSQL incrementais `002_household_tax.sql` e `003_city_tax_collection.sql` após a `001`.
- Painel de compra por moedas e módulo `properties`, rota `/properties`, slot 9 do CORE UI.
- Integração do inventário pessoal do CORE UI para apresentar chaves vinculadas, sem item nativo transferível.
- Gerador de catálogo e evidências preservadas. Todas as referências de armazenamento inspecionadas recebem proteção, sem confundir isso com aprovação de persistência/respawn.
- Testes de domínio, interface e transações preparados para a infraestrutura oficial.

Leia [REGRAS-0.3.md](REGRAS-0.3.md) antes da integração. O usuário relatou validação das compras nas duas moedas na instalação oficial; isso fica registrado como relato, sem presumir acesso ao código instalado ou aprovação desta atualização.

## Atualização pelos responsáveis

**Para a instalação existente 0.1.0, seguir primeiro [ATUALIZACAO-0.1-PARA-0.3.1.md](ATUALIZACAO-0.1-PARA-0.3.1.md).** O guia cobre identificação, preservação das adaptações oficiais, manutenção, migração, builds conjuntos, chaves antigas e recuperação. Não reaplicar a `001` se já estiver instalada e nunca reaplicá-la depois da `002`.

1. Em manutenção, fazer backup do banco e do estado dos inventários/changeforms. Comparar a revisão oficial com as fontes recebidas descritas em `PROVENIENCIA.json`.
2. Em instalação nova, aplicar `001_residences.sql` e depois `002_household_tax.sql` e `003_city_tax_collection.sql`. Na atualização da 0.1.0 já instalada, conferir a `001` existente e aplicar `002` e `003`, na mesma base da economia oficial. A segunda migração preserva recibos históricos, amplia chaves por beneficiário e acrescenta membros, impostos e venda. Não faz débito.
3. Atualizar cada definição aprovada com `interiorCells`, `storageGuards` e `interiorPassages`. Aumentar sua revisão acima da revisão instalada. Os rascunhos estão em revisão 2, mas a equipe deve usar uma revisão maior se já houver outra em produção. Não importar imóveis de DLC/mods no piloto.
4. Confirmar preço base em Septims para toda casa, inclusive casas que também aceitam Diademas. Esse valor define o imposto. Na primeira inicialização desta atualização, propriedades legadas sem vencimento passam a ter 15 dias até a primeira cobrança; não há cobrança retroativa baseada em datas desconhecidas.
5. Preservar o adaptador concreto de Diademas já validado pela equipe. O integrador não sobrescreve `official-diademas.cjs`, que não está no pacote. O exemplo de contrato continua sendo somente referência.
6. Conferir as alterações preparadas, sem escrever:

   ```sh
   node integrate.cjs --server=/caminho/oficial/server --client=/caminho/oficial/client
   ```

7. Aplicar com os mesmos parâmetros e `--apply`. O integrador guarda backup, preserva a configuração existente e recusa âncoras ausentes/ambíguas. Atualiza o módulo CommonJS, compra CEF, CORE UI Propriedades, roteamento TypeScript e projeção do inventário. Não executa SQL, builds ou inicialização.
8. Compilar **servidor TypeScript e cliente**, distribuir `ui-core/frontend/modules/properties`, o HTML efetivamente usado pelo CORE UI e a interface de compra. Confirmar que não há outro adapter registrado como `properties` ou carregado pelo manifesto. Fazer reinício controlado para retirar o antigo `/casa` e evitar handlers legados.
9. Antes de abrir aos jogadores, retirar as chaves físicas antigas dos inventários persistidos e quaisquer cópias históricas. Manter `keyDescriptor` com o item dedicado antigo durante a migração: o módulo retira entradas com esse base e o marcador residencial ao consultar o inventário pessoal ou interagir com referências protegidas. A retirada do item legado não apaga a posse ou a chave vinculada no banco. Não afirmar migração completa só com essa limpeza sob demanda; confirmar os personagens offline e as rotas nativas de inventário.
10. Executar os testes abaixo, compilar e homologar com múltiplos jogadores. Somente então habilitar o piloto. O pacote mantém `enabled:false`, `purchasesEnabled:false` e catálogo ativo vazio. Nesta entrega, `maxPerProfile` deve permanecer 1; cadastro limitado a 5 visitantes por casa, incluindo até dois familiares; o proprietário não ocupa vaga. Cadastros antigos acima do limite devem ser revisados pela equipe: não há remoção automática, e novas adições ficam bloqueadas até haver vaga.

## Testes preparados

```sh
npm install --ignore-scripts --no-audit --no-fund
npm test
# Base exclusiva residence_test_..., nunca o banco de produção:
npm run test:postgres
```

A suíte PostgreSQL usa `RESIDENCES_TEST_DATABASE_URL`, recusa nome de banco fora de `residence_test...` e trabalha em schema isolado. Ela inclui compra concorrente, falha/rollback, recibos repetidos, chave vinculada, nomes ambíguos, limite familiar, revogação, venda com crédito e disputa entre quitação e recompra. As suítes estão preparadas, ainda sem resultado de execução desta versão.

No jogo, verificar: entrada direta E; foco e ESC; abertura somente pelo TAB; chaves no inventário pessoal e ausentes em baús, saque, menus nativos e trade; familiar offline/online; terceiro familiar bloqueado; remoção enquanto um baú está aberto; porta pública sem direito a armazenamentos; bloqueio exatamente nos vencimentos; recusa de pagamento antes do vencimento e quitação da dívida integral; perda de resposta; vendedor offline; compra concorrente com quitação; troca de personagem; reinício; respawn e conteúdo dos baús; passagem interna e saída sempre livres.

## Regras de segurança e persistência

- Posse e chaves são persistidas no PostgreSQL. A chave exibida é uma projeção somente de leitura do perfil autenticado, não uma credencial copiável. O servidor autoriza pela posse/membro atual, mesmo sem abrir o inventário.
- Apenas `inventoryKeys(actorId, 'personal')` pode compor INVENTÁRIO do próprio jogador. Outros contextos retornam lista vazia. O futuro trade não deve reutilizar a resposta do inventário pessoal: usar os itens nativos/ledger e nunca serializar itens `residence-key:`. Essas chaves não têm base transferível nem ação de destruir/equipar.
- O crédito de venda localiza o vendedor pelo `profile_id` e UUID e usa o saldo oficial do personagem que publicou o anúncio. Se o personagem não estiver mais aprovado ou o vínculo não existir, a transação inteira falha. Não escolhe arbitrariamente outro personagem. Conferir reconciliação de saldo no cliente para vendedor offline/online pela economia oficial.
- Cobrança e transferência de propriedade ficam na mesma transação. Baús continuam nativos: o módulo não copia, esvazia nem cria outra carteira/inventário. Ao mudar o dono, o conteúdo fica na casa e passa a ser acessível pelo comprador.
- Entradas e transferências validam a permissão atual. Durante mutações o cache de acesso fica indisponível, e só volta após a recarga; nenhum recibo de sucesso é emitido antes dessa etapa. Falhas de acesso bloqueiam armazenamentos, mantendo as saídas internas livres.
- `storageGuards` protege os recipientes auditados. Armazenamentos dinâmicos na célula recebem a mesma regra; tipos não identificados são bloqueados para visitantes. `interiorPassages` identifica portas internas para permitir circulação/saída. Não cadastrar células compartilhadas sem revisar esse alcance.
- Esta proteção não corrige respawn, scripts de missões ou reset de baús. Hjerim ainda depende de armazenamento persistente aprovado. Guardar referências é diferente de homologá-las.
- Não desabilitar o módulo inteiro depois de vender casas: isso retira a proteção. Para interromper vendas, usar `purchasesEnabled:false` e manter o gerenciamento/acesso. Toda atualização exige migração e reinício controlados; rollback precisa considerar os novos estados de chaves e os recibos já gravados.

## Limites da conferência desta entrega

Foram conferidas sintaxe, estrutura do catálogo e as âncoras do integrador por execução sem `--apply` nas fontes recebidas. Não foram aplicadas alterações às fontes oficiais recebidas nem executados servidor, banco ou suíte de homologação. A revisão remota instalada, sincronização do cliente, migração de chaves antigas e funcionamento em jogo precisam ser comprovados pelos responsáveis.
