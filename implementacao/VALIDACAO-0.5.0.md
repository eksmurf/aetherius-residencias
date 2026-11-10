# Validação da entrega 0.5.0

Executada em 10/11/2026 sobre o código deste pacote. Alvo de entrega: servidor oficial do Aetherius, com integração e implantação pelos superiores. Nenhum servidor de jogo foi iniciado e nenhum banco ou saldo oficial foi alterado.

## Resultados

| Verificação | Resultado |
|---|---|
| `npm test` — regras, protocolo e interface em DOM simulado | 42 testes passaram |
| `npm run test:extensions` — transações em PGlite 0.3.10 em memória | 8 testes passaram (7 cenários e o agrupador) |
| Mesma suíte SQL sobre a composição com IPTU3 recebido | 8 testes passaram (mesmos cenários, outra composição) |
| Regressão IPTU3: cadastro pela porta, pagamento, coleta e tesouro | 1 teste passou |
| `node --check` nos arquivos JS/CJS do pacote | 28 arquivos passaram |
| Aplicação do delta sobre a base IPTU3 recebida | `git apply --check` passou |
| Formatação do diff | `git diff --check` passou |

Os testes SQL cobrem espera conferida no servidor, sessão, cancelamento, mudança de revisão e vencimento, rollback por falha de crédito, repetição após perda de resposta, dívida maior que o retorno, retorno de visita pendente e revisão de ficha antes do débito. Os testes de interface conferem as duas confirmações, os dez segundos e o cancelamento.

## Reprodução

No diretório do pacote, com Node 22 ou superior:

```text
npm ci --ignore-scripts
npm test
npm run test:extensions
```

Para a composição IPTU3, o integrador precisa da fonte recebida correspondente aos hashes em `compat/IPTU3/manifest.json`. No checkout do repositório, executar:

```text
node implementacao/tools/build-compat-iptu3.cjs /fontes/IPTU3/server/gamemode/residences
```

O comando cria uma composição isolada em `.build-0.5/composed`, sem alterar a fonte fornecida. Definir `RESIDENCES_SOURCE` para seu diretório `server/gamemode/residences` e executar `npm run test:extensions` no pacote. A suíte aplica também a migração 004 dessa fonte para o cadastro pela porta.

A regressão municipal utilizou `projetos/iptu-tesouro-20261109/entrega-IPTU3/testes/porta-tesouro.test.cjs`, o módulo SkyHouses recebido e a composição acima. A cópia de execução mudou somente os caminhos de fontes/migrações e acrescentou a migração 006. A fonte municipal e o teste original pertencem à entrega IPTU3; não são substituídos por este pacote.

## Limites do resultado

- PGlite executa SQL em memória; não substitui homologação no PostgreSQL oficial, concorrência de múltiplos processos ou testes multiplayer. A suíte de PostgreSQL externo não foi executada nesta entrega.
- Crédito, barreiras e deslocamento nativo foram simulados nos testes. `official-extensions.cjs` ainda precisa ser conectado aos mecanismos oficiais conforme o contrato; venda instantânea e visita ficam desabilitadas por padrão.
- A interface foi verificada por testes de DOM, sem comprovação visual desta revisão no compositor do jogo.
- O levantamento de equipamentos identifica candidatos em cinco interiores. Não certifica presença ativa, uso, persistência ou cobertura de todas as casas cadastradas no servidor.
- A composição passou contra a revisão IPTU3 recebida. Isso não identifica nem comprova a revisão atualmente instalada. Alterações paralelas no painel precisam de conciliação antes da aplicação.

Os critérios de aceite nativo, sequência de atualização e retorno de versão estão em [ATUALIZACAO-0.5.0.md](ATUALIZACAO-0.5.0.md).
