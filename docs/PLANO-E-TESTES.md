# Etapas de implementação e critérios de aceite

Atualização de 19/10/2026: o [pacote inicial](../implementacao/README.md) está preparado para entrega. Desenvolvimento e entrega são nossa responsabilidade; os superiores fazem integração e implantação. Código e testes foram preparados, sem execução de testes ou implantação. A carteira concreta de Diademas, o item de chave e o catálogo real ainda exigem integração. As etapas abaixo continuam sendo critérios de conclusão, não evidência de aprovação.

## Sequência de entregas

Todas as etapas têm como alvo o servidor oficial e o cliente distribuído aos jogadores. Não há etapa de laboratório local nem migração posterior do protótipo local. Testes automatizados usam o processo de desenvolvimento/CI oficial; conferência no jogo ocorre no servidor, inicialmente restrita a perfis e imóveis de teste. Caso não exista recurso de teste isolado na infraestrutura oficial, resolver isso nela; não substituir silenciosamente pelo host local.

| Etapa | Entrega | Condição para avançar |
|---|---|---|
| 0 Projeto oficial | Revisão do plano conforme o alvo oficial e a definição das moedas | Concluído; implementação inicial entregue para integração em 19/10 |
| 1 Integração oficial | Conferir revisão em uso, sessão, PostgreSQL, economia de Septims, carteira de Diademas e ponte do cliente | Contratos levantados pelo desenvolvimento; nenhuma dependência presumida do laboratório |
| 2 Catálogo oficial | Mapear imóveis reais, todas as entradas, pares, baús e saídas | Referências conferidas no conjunto de plugins do servidor; ofertas inicialmente restritas à equipe |
| 3 Núcleo persistente | Migração aditiva, posse por perfil/conta, pedidos, auditoria, fila de entrega e compra nas duas moedas | Uma transação ou protocolo de reconciliação preserva débito e propriedade |
| 4 Portas e chaves | Interceptação oficial de portas/baús, chave individual persistente, revogação e saída segura | Dois clientes comprovam as regras no servidor |
| 5 Interface oficial | Oferta, escolha Septims/Diademas, confirmação, resultado, chave e consulta administrativa | Funciona na distribuição oficial e apresenta o resultado persistido |
| 6 Validação restrita | Matriz abaixo, contas de teste, imóveis reservados e ensaio de recuperação | Sem impacto em saldos/posses reais de jogadores; evidências por revisão |
| 7 Ativação progressiva | Configurar preços e limites, abrir o catálogo validado e acompanhar operações | Compras, chaves, baús e retorno de versão conferidos |

Conduzir as decisões técnicas autonomamente, reutilizando as interfaces oficiais confirmadas. Adotar residências únicas, dono por perfil, chave inicial, baús privados e saída livre como base. Preços, moedas oferecidas e limites ficam configuráveis; publicação da enquete e definição desses valores não impedem implementar o sistema. A primeira versão completa inclui Septims, moeda do jogo, e Diademas, cash adquirido com dinheiro real. O contrato de Diademas deve ser investigado nas fontes/serviços oficiais e não tratado como um pedido genérico para o usuário explicar o sistema.

## Matriz de aceite

| Caso | Resultado exigido | Verificação |
|---|---|---|
| Compra com Septims | Um débito correto, um dono, uma emissão de chave | Integração com transação e jogo |
| Compra com Diademas | Débito na carteira oficial, posse e reconciliação coerentes | Adaptador real em ambiente de teste |
| Falha definitiva depois de debitar Diademas | Recuperação ou estorno idempotente da mesma moeda e operação | Conta de teste na infraestrutura oficial |
| Recarga de cash e compra de residência | Compra não cria recarga nem cobra dinheiro real novamente | Contrato da carteira e UI |
| Saldo insuficiente em qualquer moeda | Sem débito, posse ou chave | Teste automatizado |
| Dois perfis compram ao mesmo tempo | Um vencedor; perdedor não paga | Concorrência no banco real de teste |
| Clique duplo e reenvio após desconexão | Mesmo resultado, sem cobrança/emissão duplicada | Integração |
| Mesmo pedido com conteúdo diferente | Rejeição explícita | Teste automatizado |
| Preço, perfil ou moeda manipulados no pacote | Dados do cliente não substituem a autoridade | Teste de protocolo |
| Preço muda com o menu aberto | Nova confirmação, sem cobrar valor inesperado | Integração e UI |
| Jogador distante, célula diferente ou posição indisponível | Compra recusada sem cobrança | Teste de protocolo e jogo |
| Porta comum, baú público ou imóvel suspenso | Não aparece como comprável; pedido direto é recusado | Jogo e protocolo |
| Casa com duas entradas e respectivos lados | Todas apontam para o mesmo dono e a mesma oferta | Dois clientes |
| Referência repetida em duas casas ou par ausente | Catálogo não publica o imóvel | Validação de catálogo |
| Chave inicial | Item correto aparece, persiste e tranca/destranca | Dois clientes e reconexão |
| Nome de item imitando chave ou chave de outra casa | Acesso negado | Protocolo e inventário |
| Chave perdida e reposição | Dono recebe reposição sem perder posse; antigas revogadas | Jogo e persistência |
| Chave antiga com jogador offline ou em baú | Continua inválida após reconexão/saque | Dois clientes e reinício |
| Entrega incerta de chave | Recupera pelo ID da emissão; não cobra nem duplica autorização | Falhas injetadas e reinício |
| Casa destrancada e visitante | Entrada segue política; baú privado continua protegido | Dois clientes |
| Porta trancada com visitante dentro | Visitante consegue sair sem ganhar direito de entrada | Dois clientes |
| Tentativa de lockpick ou acesso direto a baú | Não contorna a autorização residencial | Jogo e eventos do servidor |
| Depósito/saque simultâneo e desconexão no meio | Quantidade total preservada, sem duplicação ou perda | Integração e dois clientes |
| Reset da célula ou respawn do baú | Conteúdo privado preservado conforme política validada | Jogo com ciclo de reset |
| Queda antes/depois do commit | Sem compra parcial; operações pendentes reconciliadas | Falhas injetadas |
| Timeout da carteira externa | Resultado consultável; não cobra de novo nem libera posse incerta | Falhas injetadas no adaptador |
| Nome alterado, reconexão e reinício | Dono continua identificado pelo perfil/conta | Integração e jogo |
| Mudança de personagem ou aposentadoria | Segue a política registrada, sem posse acidental por outro perfil | Integração |
| Mudança de mod ou referência não resolvida | Imóvel suspenso para venda; acesso existente tratado sem liberar baús | Catálogo e ensaio operacional |
| Falha de banco ou cache | Sem compras/acesso privado indevidos, com saída preservada | Falhas injetadas e jogo |
| Retorno da versão | Compras suspensas; pagamentos, posses, chaves e acesso preservados | Ensaio em homologação |

## Evidência para aprovação

Registrar revisão oficial do código, versão do catálogo, plugins utilizados, casos executados, resultado observado e IDs de operações de teste. Usar contas e carteiras de homologação na infraestrutura oficial. Testes de queda, reset e falha de banco devem atingir recursos isolados de teste, não o processo público ou as posses de jogadores. Testes com simulações validam regras, mas não substituem comprovar hooks, chaves, inventário e replicação com dois clientes no servidor.

O pacote de implementação inclui testes unitários e PostgreSQL executáveis correspondentes a parte desta matriz. Eles ainda não foram executados, e nenhum resultado da matriz é apresentado como aprovado.
