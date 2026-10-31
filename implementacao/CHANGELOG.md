# Alterações

## 0.3.1 — 31/10/2026

- Máximo de 5 visitantes cadastrados por casa, incluindo até 2 familiares e excluindo o proprietário.
- Contador e bloqueio de adição no painel, com validação transacional no servidor. Remoção libera vaga.
- Dois cenários de regressão adicionados para execução pela equipe; suítes não executadas nesta entrega.

## 0.3.0 — 29/10/2026

- Chaves vinculadas ao perfil, projetadas apenas no inventário pessoal do CORE UI. Removida a emissão física e a reposição manual; a migração preserva as identidades de chaves existentes.
- Pós-compra exclusivamente em TAB → Propriedades. Donos e membros autorizados entram com E, sem botão intermediário; imóveis privados mostram mensagem a terceiros.
- Visitantes por nome completo/profile_id, até dois familiares, chave para familiares, confirmação de remoção e revogação imediata no acesso ao armazenamento. Porta pública só concede entrada.
- Imposto em Septims: 10% do valor base a cada sete dias, sem antecipação; duas parcelas suspendem acesso e três recolocam o imóvel à compra pelo preço cadastrado. Quitação integral recupera a casa apenas antes de uma nova compra.
- Venda voluntária por preço inteiro em Septims, crédito ao vendedor conferido por profile_id, transferência de propriedade atômica e exclusão de todos os membros antigos. Os itens guardados permanecem na casa para o comprador.
- Proteção de todos os recipientes auditados e dos armazenamentos dinâmicos dos interiores cadastrados. Mantido piloto das cinco casas vanilla.
- Migração incremental 002, integrador com CORE UI/servidor TypeScript, documentação e testes atualizados. Testes executáveis e homologação oficial desta versão permanecem pendentes; nenhuma implantação foi feita.


## 0.2.1 — 20/10/2026

- Primeira etapa restrita a Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside: oito pares de portas e cinco baús/cofres candidatos. Hjerim continua dependendo de armazenamento aprovado.
- Rascunho inicial agora contém somente as cinco casas vanilla. Severin Manor e seis casas de mods preservadas em `catalogo/etapas-futuras/`, fora do piloto.
- Auditoria completa das 12 casas, evidências e fila de 87 candidatos preservadas. Gerador identifica a etapa de cada imóvel e reproduz os dois rascunhos separados.
- Documentação, metadados e pacote atualizados. Configuração ativa permanece vazia/desativada, sem preços ou chave inventados. Nenhuma alteração de runtime, painel, plugin ou banco.
- Conferência estrutural do recorte e integridade do pacote; testes automatizados do sistema e homologação no jogo permanecem pendentes.

## 0.2.0 — 20/10/2026

- Cadastro preliminar de 12 casas: 15 pares de portas, 270 recipientes auditados e 15 baús/cofres sugeridos. Seis casas são de mods. Acrescentadas fila de 87 candidatos nominais, evidências e pendências por imóvel.
- Paleta, transparência e título seguem o painel de administração recebido; alinhamento visual com o Aetherius UI Core.
- Nome da casa permanece no topo, inclusive na confirmação. Escolha da moeda pelo mouse, botão Fechar no rodapé e retirada de Atualizar.
- ESC e perda de foco fecham a interface. Fechar durante uma operação mantém o pedido; resposta atrasada não reabre o painel.
- Cinco testes de interface preparados para foco, navegação, fechamento durante compra e recuperação do mesmo pedido. A suíte total passa a 25 testes preparados, ainda não executados.
- Conferida a prévia isolada do código da interface: seleção por mouse, ESC, fechamento durante solicitação, ausência de reabertura após resposta atrasada e layout a 360 px, sem erro de JavaScript. Essa conferência usou respostas simuladas, sem servidor, banco ou saldo.
- Configuração ativa continua vazia/desativada. Carteira de Diademas, chave dedicada e aprovação/homologação dos imóveis permanecem pendentes.

## 0.1.0 — 19/10/2026

Primeira entrega do módulo de compra, posse, chave, controles de acesso, migração, interface e contrato de integração de Diademas.
