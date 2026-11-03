# Residências 0.3.3 — IPTU a cada 15 dias

03/11/2026. O solicitante definiu o IPTU quinzenal e confirmou que **ainda não há IPTU ativo no servidor**. A cobrança começa diretamente com a regra nova; não há conversão automática de dívida semanal.

## Regra vigente

O imposto permanece em 10% do valor base cadastrado em Septims, pago em Septims. A periodicidade é de **15 dias completos (360 horas)**, não 14 dias nem datas fixas do mês. Frações de Septim continuam arredondadas para cima.

| Sem pagamento desde o início do ciclo | Consequência |
| --- | --- |
| Antes de 15 dias | Sem pagamento antecipado |
| 15 dias | Uma parcela disponível; acesso mantido |
| 30 dias | Duas parcelas em aberto; chave, entrada e armazenamentos suspensos |
| 45 dias | Três parcelas em aberto; imóvel volta à venda pelo preço cadastrado |
| 60 dias e seguintes | Uma nova parcela a cada 15 dias, enquanto a dívida continuar |

Quitar paga todas as parcelas vencidas e avança o próximo vencimento em múltiplos de 15 dias, mantendo a sequência do ciclo. Não reinicia a contagem na data de pagamento. Uma nova compra inicia o calendário do novo proprietário. Recuperação antes da recompra, perda da casa/conteúdo após a recompra e demais regras permanecem conforme [REGRAS-0.3.md](REGRAS-0.3.md).

## Aplicação no servidor oficial

- **Base 0.1.0 ainda instalada:** seguir o [guia da atualização completa](ATUALIZACAO-0.1-PARA-0.3.1.md), usando este pacote como destino final. A migração estrutural continua sendo somente `002_household_tax.sql` após a `001` já instalada. As referências semanais do guia histórico são substituídas por este documento. Não iniciar uma versão semanal intermediária.
- **Base 0.3.x já integrada, sem IPTU inicializado:** atualizar o módulo do servidor e o cliente Propriedades juntos. Não há nova migração de schema nesta entrega e não é necessário reaplicar a `001`/`002` já concluídas. Preservar configuração, adaptador de Diademas e dados existentes.
- Em manutenção, conferir se há casas possuídas com `tax_due_at` preenchido. Se existir prazo/termo semanal, isso contradiz a informação de que ainda não há IPTU ativo: não apagar prazos, recibos ou termos para forçar a inicialização. Reconciliar o caso com a equipe antes de prosseguir. O runtime recusa termos de periodicidade diferente de 15 dias com `TAX_PERIOD`.
- Casas legadas possuídas e sem vencimento recebem o primeiro prazo **15 dias após a primeira inicialização bem-sucedida desta versão**. Não há cobrança retroativa. Reinícios posteriores preservam o prazo. Registrar e comunicar a data real aos proprietários.
- Não alterar relógio do servidor nem datas de propriedades reais para simular vencimentos. Homologar as fronteiras de 15/30/45 dias na infraestrutura de testes da equipe.

Exemplo de conferência somente de leitura, **depois de confirmar a presença das colunas da `002` e o schema correto**:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT tax_terms->>'periodDays' AS period_days,
       count(*) AS owned_with_tax_schedule
FROM aetherius_residences
WHERE owner_profile_id IS NOT NULL AND tax_due_at IS NOT NULL
GROUP BY tax_terms->>'periodDays';
ROLLBACK;
```

Atualizar `gamemode/residences/tax.cjs`, `store.cjs`, `errors.cjs` e os assets de Propriedades nas suas origens oficiais. O DTO de imposto agora informa `periodAmount` e `periodDays`, substituindo `weeklyAmount`. Cliente/servidor antigos não devem ser misturados. Usar o integrador para conferir a lista completa, preservar adaptações oficiais e distribuir os builds/assets pelo fluxo da equipe.

## Ajustes visuais incluídos

Incorpora a revisão aprovada após a 0.3.2: pagar impostos, adicionar visitante e anunciar venda têm letras/bordas verdes e interior neutro, inclusive no hover. Os campos de nome/profile_id e preço mantêm letras/placeholder em branco-cinza, interior neutro e borda verde discreta. Os estados indisponíveis continuam desabilitados.

## Verificação e recuperação

Foram preparados cenários para as fronteiras temporais, bloqueio, retomada, quitação por múltiplos de 15 dias, inicialização de casas legadas e preservação em reinício. A execução das suítes de domínio/PostgreSQL e a homologação no jogo cabem à equipe oficial. Conferências de sintaxe e da prévia não equivalem à execução desses testes.

Não voltar ao runtime semanal 0.3.2 depois de persistir termos quinzenais: ele calcula com sete dias e pode suspender ou recolocar casas à venda antecipadamente. Se houver falha, manter manutenção e aplicar o procedimento de recuperação consistente do guia completo. Não substituir apenas `tax.cjs` nem restaurar banco isoladamente após novas transações.

Conferência visual: [relatório da prévia 0.3.3](atualizacao/VERIFICACAO-UI-0.3.3.json). Essa simulação confirma textos/estados da interface, não o cálculo real no banco.
