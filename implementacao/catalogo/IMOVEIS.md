# Imóveis identificados em 20/10/2026

Cadastros preliminares: nenhum imóvel liberado para venda. As referências foram lidas nos plugins disponíveis com ordem compatível com a lista oficial recebida; a revisão instalada ainda precisa ser confirmada.

## Primeira etapa: cinco casas vanilla

Somente estas casas compõem `residences.draft.json`. São oito pares de portas e cinco baús/cofres candidatos. Hjerim depende da seleção ou adaptação de armazenamento persistente.

| Imóvel | Origem | Pares de portas | Recipientes inspecionados | Baús/cofres sugeridos |
|---|---|---:|---:|---:|
| Breezehome | Skyrim.esm | 1 | 24 | 1 |
| Vlindrel Hall | Skyrim.esm | 1 | 47 | 1 |
| Hjerim | Skyrim.esm | 1 | 49 | 0 |
| Proudspire Manor | Skyrim.esm | 3 | 48 | 2 |
| Honeyside | Skyrim.esm | 2 | 18 | 1 |

## Etapas futuras: DLC e mods

Estes sete imóveis ficam fora do piloto. Seus rascunhos foram preservados em `etapas-futuras/residences.draft.json`, sem aprovação para importação ou venda.

| Imóvel | Origem | Pares de portas | Recipientes inspecionados | Baús/cofres sugeridos |
|---|---|---:|---:|---:|
| Severin Manor | Dragonborn.esm | 1 | 40 | 5 |
| Forger's Retreat | Granite Hill.esp | 1 | 4 | 0 |
| Karthman's Retreat | Amber Guard.esp | 1 | 6 | 1 |
| Fenrens Residence | Neugrad.esp | 1 | 8 | 1 |
| Falcrost Residence | North Keep.esp | 1 | 12 | 1 |
| Burzag Yomgur Longhouse | Vernim Wood.esp | 1 | 5 | 0 |
| Frostview Hall | The Great City of Winterhold v4.esp | 1 | 9 | 2 |

Os pares são recíprocos no arquivo; sua disponibilidade durante o jogo ainda exige homologação. “Sugerido” significa apenas baú/cofre sem respawn, sem enable parent e não inicialmente desativado nos registros lidos. Não certifica ausência de scripts ou interferência de missões.

Veja `cadastro-auditado.json` para os IDs de todas as portas, recipientes, donos nativos e pendências das 12 casas, identificadas pelo campo `stage`. O rascunho inicial permanece separado da configuração ativa: preços vazios e `forSale: false`. Importar somente as casas vanilla aprovadas; mesmo imóveis sem venda podem receber bloqueios quando cadastrados no módulo.

`fila-de-mapeamento.json` contém 87 outros candidatos nominais, para investigação futura, incluindo imóveis ocupados, dependências e locais compartilhados. Não é uma lista de casas vagas nem um inventário exaustivo de todas as células dos mods.
