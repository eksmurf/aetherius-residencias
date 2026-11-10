# Residências 0.5.0 — venda instantânea, visita e características

Entrega de desenvolvimento de 10/11/2026 para integração pelos superiores. Não comprova instalação no servidor. As três funções têm configuração independente e preservam o cadastro pela porta e o IPTU3. Começar pelo delta compatível com a revisão efetivamente recebida, sem substituir um backend integrado pelo pacote base.

## Regras atuais confirmadas neste chat

- Venda instantânea pelo TAB → Propriedades: **40% do valor base da aquisição**, arredondados para baixo; perda de 60%. O anúncio particular não determina esse valor.
- O IPTU vencido é descontado do retorno até zerar os ganhos. Não há débito adicional. Excedente de dívida é encerrado com a venda e registrado separadamente. A cidade recebe como pendência de coleta somente a retenção efetiva.
- Duas confirmações; a segunda mostra dez segundos completos, com prazo também conferido no servidor. Cancelar, fechar ou expirar não vende automaticamente.
- Casas adquiridas com Diademas e cadeias de origem não comprovadas não têm venda instantânea. A cadeia de Diademas não é convertida em elegível por uma revenda particular em Septims.
- Os itens permanecem na casa. Proprietário, familiares e visitantes perdem os direitos; quem estiver dentro pode sair. A casa volta à oferta sem proprietário e preserva cidade e arrecadação já pendente.
- **Visita experimental de 60 segundos para uma oferta sem proprietário**, inclusive após venda instantânea. Se existe proprietário, orientar tour combinado com ele. Esta decisão substitui a restrição anterior de “nunca comprada”. O minuto começa na chegada confirmada pelo servidor.
- A ficha apresenta apenas armazenamentos, camas e atividades com quantidade positiva confirmada, inclusive na revenda e na confirmação da compra. Categorias ausentes ou ainda não verificadas ficam ocultas; sem nenhuma característica confirmada, a seção inteira fica oculta. O backend continua distinguindo ausência de falta de verificação para a revisão da equipe.

| Base da casa | Retorno bruto | IPTU vencido | Retido para a cidade | Recebido pelo vendedor | Excedente encerrado |
|---|---|---|---|---|---|
| 100.000 | 40.000 | 0 | 0 | 40.000 | 0 |
| 100.000 | 40.000 | 10.000 | 10.000 | 30.000 | 0 |
| 100.000 | 40.000 | 50.000 | 40.000 | 0 | 10.000 |

Todos os valores da tabela são Septims. O tesouro municipal não financia a recompra. A fonte e o crédito oficial da recompra pertencem à integração econômica; não criar uma carteira paralela.

## Sequência de atualização

1. Registrar a revisão instalada, os adaptadores oficiais e seus hashes. Fazer backup consistente e manutenção pelo procedimento oficial. Preservar cidade, posse, referências, conteúdos, recibos e configurações.
2. Para a base IPTU3 recebida, conferir o [manifesto de compatibilidade](compat/IPTU3/manifest.json) e aplicar `compat/IPTU3/residencias-0.5.0.patch` na raiz que contém `server/gamemode/residences`. Executar primeiro `git apply --check /pacote/compat/IPTU3/residencias-0.5.0.patch`; só então `git apply` com o mesmo caminho. Um erro exige conciliar as diferenças; não forçar o patch. O delta preserva cadastro, atribuição municipal, reserva de autoridade e inicialização do tesouro.
3. Aplicar `migrations/006_residence_extensions.sql` depois das migrações residenciais 001 a 005 da base integrada. A 004 e a 005 pertencem às entregas do painel/IPTU3; este pacote não as renumera nem as reaplica. A 006 também pode ser usada em homologação da base residencial pura 0.4.0 com 001–003.
4. Atualizar os assets `client/properties` e `client/residences` nos caminhos efetivamente distribuídos. Atualizar a lista de ações de Propriedades no CORE: acrescentar `instantQuote`, `instantArm`, `instantCancel`, `instantSell`, `tourStatus`, `tourEnd`. A ponte continua usando `context.actorId`. Não expor ações de revisão da staff nesse canal.
5. `core-patches.cjs` inclui a atualização dessa lista para a âncora V3 conhecida. `integrate.cjs` serve para a base sem cadastro pela porta e recusa substituir uma instalação com `door-registration.cjs`; na base IPTU3, integrar o delta e a lista TypeScript manualmente, preservando os demais módulos. Compilar o servidor/cliente conforme o procedimento existente.
6. Conectar `official-extensions.cjs` conforme [CONTRATO-EXTENSOES.md](CONTRATO-EXTENSOES.md). O arquivo concreto não está nesta entrega. Sem o adaptador, venda instantânea e visita permanecem indisponíveis. O adaptador municipal de IPTU3 continua separado e deve ser preservado.
7. Acrescentar à configuração existente, sem substituir as outras chaves:

   ```json
   "extensions": {"instantSale": false, "tours": false, "requireAmenities": false}
   ```

8. Preparar/revisar as fichas das ofertas e conectar a revisão S+ do cadastro. Só depois ativar `requireAmenities:true`, que impede concluir compra sem ficha completa. Isso não retira acesso ou gestão dos proprietários atuais. Enquanto a exigência não está ativada, a interface informa as pendências e mantém compatibilidade com a compra existente.
9. Homologar cada função e então habilitar `instantSale` e `tours` separadamente. Uma casa sem rota segura ou proteção comprovada deve continuar recusando visita, mesmo com o recurso global habilitado.

## Histórico e regularização das aquisições

A migração conserva aquisições antigas como origem desconhecida. Cadastros novos começam uma cadeia nova; toda compra posterior grava moeda, valor pago, base da aquisição, conta, perfil e personagem na mesma transação da compra. Não apagar/recriar cadastros para contornar a origem. PD, alteração de dono e liberação administrativa devem preservar `acquisition_history`.

Para casas antigas, S+ deve conciliar recibos e evidências da aquisição. A ponte de servidor `reviewAcquisition(actorId,payload)` exige sessão S+ e recebe `{requestId,residenceId,purchaseId,basePrice,accessRevision,chain,evidence}`. O recibo precisa ser a última compra do atual proprietário, a base deve corresponder à base fiscal registrada e `chain:'septims'` é recusada se o histórico disponível contém Diademas. A evidência deve atestar a completude do histórico: ausência de um recibo de cash, sozinha, não prova que ele nunca existiu. Revisão é auditada e invalida cotações. Casos sem recibo/base comprováveis permanecem indisponíveis até migração específica revisada.

## Ficha e mapeamento

O [relatório das cinco casas](catalogo/FICHAS-20261110.md) contém candidatos, fontes e pendências. Nenhuma ficha de uso real foi homologada apenas pela leitura dos plugins. O universo é o catálogo histórico dessas cinco casas; o usuário confirmou cadastro de qualquer casa, mas não forneceu uma lista completa das ofertas atuais para este levantamento.

A ponte de servidor `reviewAmenities(actorId,payload)` recebe `{requestId,residenceId,expectedRevision,sheet}`. Exige S+, revisão crescente, todas as células do imóvel e referências únicas. O contrato do objeto está em `amenities.cjs`. A ficha registra origem, data, revisão do catálogo, completude por categoria, função, subtipo e evidência por referência. “Usável” exige presença, acesso e funcionamento confirmados; armazenamento exige também persistência validada.

Não usar o tamanho de `storageGuards` como contagem comercial. Camas contam como objetos, sem deduzir hóspedes dos marcadores. A função de forno de assar é distinta da fundição. O comprador recebe somente o resumo; não recebe IDs internos, coordenadas, conteúdo de recipientes ou dados de antigos moradores. Uma mudança de ficha entre oferta e confirmação é recusada antes de debitar. Alteração de revisão do catálogo invalida a ficha anterior.

O formulário S+ do painel administrativo e a descoberta de objetos dinâmicos ainda precisam ser ligados pela equipe do Painel-oficial. Não foi adicionado um comando nativo inexistente para varrer interiores. Revalidar ficha ao alterar decoração, permissões, scripts ou plugins; publicar revisão incompleta enquanto houver dúvida.

## Conferência e aceite

Executar `npm ci --ignore-scripts`, `npm test` e `npm run test:extensions` no pacote. A última suíte usa PGlite em memória, sem servidor de jogo, conexão com banco oficial ou movimentação de saldo real. O [registro de validação](VALIDACAO-0.5.0.md) distingue esses testes da homologação nativa. A suíte PostgreSQL externa continua disponível apenas para base dedicada `residence_test...`, com a migração 006 incluída.

No servidor oficial de homologação, conferir:

- Retorno de 40%, arredondamento, dívida menor/igual/maior que o retorno, líquido zero e arrecadação limitada à retenção. Duplo clique, resposta perdida, reconexão e reinício não repetem crédito nem baixa fiscal.
- Diademas e origem desconhecida bloqueados; compra de terceiro ou imposto que vence durante a espera invalidam a cotação. A venda deve coordenar PD, transferências de itens e salvamentos em andamento.
- Após a venda, antigo dono e familiares não usam baú já aberto; conteúdos permanecem e saídas continuam livres. Cidade e pagamentos antigos a recolher permanecem íntegros.
- Tour sem combate, por 60 segundos desde chegada, sem abrir recipientes, tocar em itens, usar camas/estações, trocar, atacar, lançar magia ou acionar scripts. Testar pedidos diretos e menus previamente abertos, com dois clientes.
- Tour após venda instantânea; revenda de morador sem tour. Compra durante visita revoga as interações antes de liberar o novo dono. Desconexão, morte, falha de viagem e reinício mantêm retorno pendente até confirmação segura.
- Ficha de casa com várias entradas/células, cama de casal, objeto condicional/desativado e recipiente com respawn. Revisão concorrente exige nova confirmação sem débito.

## Retorno de versão

Desabilitar novas operações e drenar visitas antes de retirar o adaptador. Visitas pendentes exigem proteção e recuperação no login; nunca apagar suas linhas para “liberar” o personagem. Preservar os recibos de venda e a conciliação de créditos externos. Reverter arquivos não desfaz vendas concluídas nem devolve seus conteúdos. Não restaurar o banco inteiro para desfazer código.
