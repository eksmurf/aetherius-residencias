# Enquete sobre residências e decisões de produto

**Escopo vigente — 0.2.1 (20/10/2026):** começar somente com Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside, após validação individual. Severin Manor e casas de mods ficam para etapas futuras. O rascunho inicial contém apenas essas cinco casas; a configuração ativa permanece vazia e desativada. Hjerim ainda requer armazenamento aprovado. Esta decisão substitui referências anteriores a um piloto sem lista definida.

## Texto pronto para publicar

Estamos planejando um sistema de compra de residências no servidor Aetherius, com pagamento em Septims, a moeda do jogo, ou Diademas, o cash adquirido com dinheiro real. A propriedade ficará registrada no perfil do jogador, que receberá uma chave para trancar e destrancar a casa.

Qual modelo de moradia vocês preferem?

**1. Residências únicas no mundo:** cada imóvel tem um proprietário por vez. Todos compartilham o mesmo cenário, e a disponibilidade depende das casas cadastradas.

**2. Residências instanciadas:** uma mesma entrada pode levar a cópias separadas do interior para compradores diferentes. Isso permite atender mais moradores, mas exige um sistema adicional de instâncias e regras para visitas.

Se quiser, comente também o que considera mais importante: localização, privacidade, espaço para armazenamento ou possibilidade de receber convidados.

Os preços, o limite de imóveis por perfil e as regras de cópias de chaves serão definidos antes da abertura das vendas.

## Estado da consulta

Texto preparado para publicação pela equipe; enquete não enviada. O desenvolvimento seguirá com residências únicas no mundo, conforme a proposta inicial de Hermaeus Mora. A enquete permanece uma consulta de produto e pode orientar uma mudança posterior; sua publicação não é pré-requisito para iniciar o sistema.

“Única no mundo” significa que cada imóvel não tem cópias paralelas. Isso não significa automaticamente “uma casa por perfil”; o limite por jogador é uma decisão separada.

## Decisões adotadas e configurações de operação

| Tema | Proposta inicial | Definição necessária |
|---|---|---|
| Ambiente | Servidor e cliente oficiais | Host local somente mediante pedido explícito |
| Modelo | Residências existentes sem instâncias | Enquete não bloqueia implementação; instâncias exigiriam revisão posterior |
| Dono | Perfil autenticado, vinculado à conta | Personagens do mesmo perfil mantêm acesso; aposentadoria não altera dono; exclusão de conta suspende para tratamento |
| Quantidade | Limite configurável por perfil | Configuração de abertura das vendas, sem bloquear desenvolvimento |
| Moedas | Escolha entre preços separados em Septims e Diademas | Oferta de cada imóvel indica as opções habilitadas, sem conversão automática |
| Diademas | Consumir o saldo de cash oficial | Desenvolvimento identifica e integra a carteira; não cria fluxo novo de recarga |
| Preços | Definidos por imóvel | Equipe aprova tabela; o plano não inventa valores nem taxa de conversão |
| Fechadura | Chave inicial e reposição revogando as anteriores | Cópias e transferências para terceiros fora da primeira versão; custo de reposição configurável |
| Baús | Acesso privado do proprietário | Sem compartilhamento por padrão; regras futuras não bloqueiam implementação |
| Visitantes | Entrada quando a casa estiver destrancada; saída livre | Sem acesso automático aos baús |
| Abandono e revenda | Desativados no piloto | Futuras regras de devolução, valores e destino dos itens guardados |
| Administração | Consulta e correção com registro de motivo | Reutilizar a hierarquia oficial e permissões específicas, sem conceder poder pela UI |
| Piloto | Catálogo pequeno, com casa de uma entrada e casa de múltiplas entradas | Desenvolvimento mapeia locais reais e confere os plugins oficiais |

## Dependências técnicas que precisam ser resolvidas

O desenvolvimento deve investigar e comprovar a carteira de Diademas, a identidade persistente de cada chave no inventário e os hooks efetivos de portas/baús na revisão oficial. Prosseguir nas partes independentes enquanto fecha esses contratos. Só pedir informação ao solicitante se faltar acesso ou um dado inacessível pelas fontes disponíveis, identificando exatamente qual operação depende dele. Não presumir acesso remoto apenas porque os arquivos do servidor foram recebidos.
