# Cadastro de residências no mundo oficial

Atualização 0.2.1 de 20/10/2026: a primeira etapa contém somente Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside. O arquivo `catalogo/residences.draft.json` reúne essas cinco casas, separado da configuração ativa e com preços vazios e venda desativada.

O [cadastro auditado](catalogo/README.md) mantém as 12 casas investigadas. Severin Manor e as seis casas de mods estão separadas em `catalogo/etapas-futuras/residences.draft.json`; não importar esses sete imóveis no piloto. Todos exigem confirmação individual. Hjerim depende de seleção ou adaptação de armazenamento persistente antes da venda.

`server/config/residences.json` começa desativado e sem imóveis. O responsável deve cadastrar as referências efetivas dos plugins oficiais e um item dedicado de chave. Não usar os IDs de teste como endereços reais.

Cada imóvel recebe `id`, `name`, `revision`, `forSale`, `prices` e `refs`. `prices` pode conter `septims` e `diademas`, com valores inteiros positivos independentes. A ausência de uma moeda retira a oferta correspondente. `revision` aumenta quando nome, preços ou oferta mudam. As referências tornam-se imutáveis pelo carregador depois do cadastro.

Cada referência possui `desc` no formato `hex-local:plugin.esp` e `kind`: `entry`, `exit` ou `container`. Uma entrada exige `partner`, apontando para sua saída; a saída exige o parceiro recíproco. Cadastrar outro par para cada entrada adicional. Todos os pares e baús da casa usam o mesmo `id` residencial. Nenhuma referência pode pertencer a duas casas.

Um modelo simbólico, deliberadamente não carregável até substituir os valores, é:

```json
{
  "id": "residencia-identificador-estavel",
  "name": "Nome aprovado do imóvel",
  "revision": 1,
  "forSale": false,
  "prices": { "septims": "DEFINIR_INTEIRO", "diademas": "DEFINIR_INTEIRO" },
  "refs": [
    { "desc": "ENTRADA:PLUGIN", "kind": "entry", "partner": "SAIDA:PLUGIN" },
    { "desc": "SAIDA:PLUGIN", "kind": "exit", "partner": "ENTRADA:PLUGIN" },
    { "desc": "BAU:PLUGIN", "kind": "container" }
  ]
}
```

Conferir os tipos reais das referências, os destinos de teleporte, o lado interno da saída, interiores compartilhados, portas de missão, rotas alternativas e o reset/respawn dos baús. Usar houseCARL e a referência de schema somente com a instância que corresponda aos plugins oficiais. O carregador valida estrutura, unicidade e resolução, mas não certifica que uma porta pertence arquitetonicamente à casa nem que o baú não respawna.

O item `keyDescriptor` deve ser dedicado às residências: o módulo bloqueia depósito/saque desse item base para impedir transferência de chaves nesta versão. Revisar sua existência e sincronização com o cliente. Não inserir uma chave genérica usada por missões apenas porque ela tem aparência adequada.
