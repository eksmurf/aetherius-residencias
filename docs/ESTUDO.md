# Estudo do sistema de residências

## Referência atual

O `HEAD` remoto de `main`, consultado em 13/10/2026, apontava para [`db9933d911eec60092d3646b4ee28dc19f2fe254`](https://github.com/Alduinak-RP/alduinak/commit/db9933d911eec60092d3646b4ee28dc19f2fe254), commit de 06/10/2026. A cópia original do estudo anterior estava em `040f868dfbe233841e7ee9337d57ceb986d03def`, de 25/09/2026; outra referência local estava em `243c8c6b5ee1c7e191e3891daef403bfe28a96bd`, de 01/10/2026. O novo estudo usa o checkout remoto atualizado e preserva as cópias anteriores.

No comparativo entre a cópia original e a revisão atual, os quatro arquivos principais de servidor, cliente e interface de moradia somam 1.325 linhas adicionadas e 373 removidas. Isso comprova mudança no código estudado; não equivale a um teste de funcionamento dentro do Aetherius.

## Comportamento encontrado no código

| Evidência na revisão fixada | Comportamento | Consequência para o Aetherius |
|---|---|---|
| [housingSystem.ts, doClaim](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L386) | Reivindicar consome uma fechadura; a posse pessoal recebe o perfil do ator | A compra com nossas moedas deve substituir esse caminho |
| [profileOf](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L1561) | Lê `profileId` do ator no servidor | Conceito compatível com o pedido; é necessário validar seu vínculo com a conta Aetherius |
| [primaryOf e partnerOf](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L1320) | Resolve os dois lados de uma porta de teleporte e guarda uma referência primária | Um par não representa automaticamente todas as entradas da mesma casa |
| [isClaimable](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L1388) | Aceita referências de porta ou contêiner, sujeitas às demais regras do serviço | Criar um catálogo restrito; não oferecer compra em toda porta do mundo |
| [doGrantContainer](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L606) | O contêiner tem sua própria posse; concedê-lo usa a transferência | Associar explicitamente os baús do imóvel no Aetherius |
| [Persistência documentada no serviço](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L48) | Dados privados ficam nas referências/changeforms; `housing.json` indexa as posses | Não copiar esse armazenamento como se fosse a base econômica oficial do Aetherius |
| [Chaves e serial](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L1150) | Credencial no nome da chave, número de cópia e serial que invalida chaves antigas | Aproveitar a revogação por versão; validar autenticidade e persistência da instância do item no nosso runtime |
| [giveKey](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L1218) | Acrescenta uma chave nomeada ao inventário do servidor | Entrega inicial precisa ser conectada à compra e recuperável sem duplicação |
| [onActivate](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-server/ts/systems/housingSystem.ts#L233) | Intercepta ativações; trancado bloqueia até alguém autorizado destrancar; uma posse pessoal destrancada passa por esse bloqueio | Definir separadamente entrada na casa, fechadura e acesso ao baú |

A interface e a ponte do cliente estão em [housing/index.tsx](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-front/src/features/housing/index.tsx) e [housingService.ts](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/skymp5-client/src/services/services/housingService.ts). Seus pacotes e widgets pertencem à arquitetura Alduinak; a UI de compra deve usar a ponte efetivamente instalada no Aetherius.

## Pontos que precisam de adaptação

O serviço atual usa `SIDED_LOCKS = false`: o comportamento ativo não oferece duas fechaduras independentes de entrada e saída. A saída segura de uma residência deverá ser uma regra explícita da adaptação, inclusive quando a casa for trancada com alguém dentro.

O método `withinReach` permite prosseguir quando posição não pode ser lida ou é inválida. Para uma compra paga, a regra proposta é recusar sem cobrar quando não for possível comprovar distância e célula/mundo. O tratamento de exceção do hook de ativação também não deve liberar silenciosamente os objetos residenciais protegidos.

A gravação de posse na referência principal e a atualização do ponteiro da porta parceira não formam uma transação econômica; o ponteiro é atualizado em melhor esforço. No Aetherius, todas as referências do imóvel precisam apontar para o mesmo registro persistido, e falhas na sincronização do mundo devem ficar recuperáveis.

O campo `containers` no tipo de propriedade não comprova descoberta automática dos baús de uma casa. A compra agrupada será uma regra nova do nosso catálogo.

## Situação nas fontes oficiais recebidas do Aetherius

O alvo passou a ser exclusivamente o servidor oficial, conforme orientação de 13/10/2026. As fontes recebidas estão em `analise-painel-20261009/aetherius-server-main`; a pasta é uma cópia de consulta do código oficial, não o host de implantação. A revisão efetivamente instalada ainda precisa ser conferida. O laboratório `Aetherius-RP-Local` deixa de orientar implementação e validação.

O [housing-service.js recebido](../../analise-painel-20261009/aetherius-server-main/server/gamemode/housing-service.js) contém um fluxo anterior: `buyProperty` consulta disponibilidade, chama `removeGold` e depois atualiza `owner_character_id` em outra operação. Não há nesse fluxo uma transação única envolvendo débito e posse nem reserva contra dois compradores. A presença do arquivo não comprova que ele esteja ativo no servidor.

O [database.js oficial recebido](../../analise-painel-20261009/aetherius-server-main/server/gamemode/database.js) integra PostgreSQL mantendo uma interface compatível com chamadas herdadas. O [schema-core.sql](../../analise-painel-20261009/aetherius-server-main/server/gamemode/db/schema-core.sql) identifica contas e personagens por UUID e contém `characters.gold` e o registro de transações de ouro. Planejar a migração residencial para essa estrutura; não usar um schema SQLite/MySQL do laboratório como destino.

O [transaction-service.js oficial recebido](../../analise-painel-20261009/aetherius-server-main/server/gamemode/core/transaction-service.js) oferece `tx.applyGoldDelta` e `tx.recordGoldLedger`. O débito usa bloqueio do personagem e confere saldo. Reutilizar essas operações dentro da transação que também registra a compra e a posse, respeitando a revisão oficial instalada.

A [identidade oficial de sessão](../../analise-painel-20261009/aetherius-server-main/server/ts/systems/official-identity.ts) valida conexão, associação do ator ao usuário e pertencimento ao perfil, e expõe uma consulta de sessão ao código confiável do servidor. Ela é a referência para obter o comprador; o cliente não escolhe o perfil que receberá a propriedade.

O [adaptador do painel](../../painel-integracao-20261013/backend/aetherius-store.cjs) demonstra débito/ajuste de `characters.gold`, transação no banco e auditoria. O [leitor de contas](../../painel-integracao-20261013/backend/official-lib/official-reader.cjs) relaciona `users.id` a `profile_id`. Esses são pontos de referência, não uma autorização para o serviço de residências assumir privilégios administrativos.

Conforme esclarecimento do solicitante, Septims são moeda do jogo e Diademas são cash comprado com dinheiro real. Não foi identificado um contrato de débito de Diademas nos arquivos oficiais recebidos consultados. A próxima investigação deve localizar sua implementação oficial, titularidade, unidade, confirmação e repetição segura de pedidos. Isso é uma tarefa técnica do desenvolvimento, não uma definição de produto que precise ser devolvida ao solicitante. Não criar uma segunda carteira nem presumir uma coluna no banco.

## Proveniência e limites do estudo

O arquivo `fontes.json` registra revisões e hashes. O checkout de consulta está em `../tmp/alduinak-residencias-20261013`, relativo à raiz deste projeto. As conclusões são de análise estática; não houve homologação com clientes nem inventário de imóveis reais.

Ao adaptar código, preservar os avisos e as licenças correspondentes de cada subprojeto, seguindo os [termos publicados pelo repositório](https://github.com/Alduinak-RP/alduinak/blob/db9933d911eec60092d3646b4ee28dc19f2fe254/TERMS.md). Esta entrega contém planejamento, sem incorporar a implementação Alduinak ao servidor.
