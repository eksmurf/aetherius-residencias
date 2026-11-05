# Atualização para Residências 0.4.0

Esta versão acrescenta o recolhimento municipal do IPTU pago. O vínculo entre casa e cidade é administrado por uma API destinada ao painel do Jarl, com autorização no backend municipal. Leia o [contrato de integração](INTEGRACAO-JARL.md).

## Instalação pela equipe

1. Conferir a versão e as adaptações instaladas, preservar o adaptador oficial de Diademas e preparar backup do banco e dos artefatos.
2. Suspender os processos que escrevem nas residências durante a aplicação da migração. Em atualização da 0.3.6, aplicar `migrations/003_city_tax_collection.sql` na base oficial de homologação antes de iniciar o novo código. Para instalações antigas, seguir também as migrações e os cuidados dos guias anteriores, na ordem 001, 002 e 003.
3. Distribuir os módulos de servidor, incluindo `city-taxes.cjs`, recompilar os artefatos usados pelo runtime e reiniciar conforme o procedimento oficial. Conferir a saúde das residências e o carregamento das portas.
4. Implementar `official-cities.cjs` com autorização e crédito transacionais na tesouraria usada pelo painel municipal. Conectar o router autenticado do Jarl à ponte `cityRequest`. A interface de Propriedades do morador não cadastra cidades.
5. Vincular uma residência de homologação pelo backend municipal. Pagar o IPTU com o morador e conferir a quitação imediata. Interagir com a porta usando um coletor autorizado e conferir o crédito no histórico da cidade.

## Pagamentos anteriores

A migração cria a estrutura para registrar os próximos pagamentos. Antes de importar recibos anteriores, conferir se a equipe já destinou esses valores à cidade por alguma adaptação. Importar apenas operações efetivamente debitadas e ainda não arrecadadas. A pendência usa o UUID da operação de pagamento como chave única.

A consulta abaixo identifica recibos históricos para conciliação. Ela não movimenta dinheiro.

```sql
SELECT o.id, o.residence_id, o.profile_id, o.currency, o.amount, t.due_at
FROM aetherius_residence_tax_receipts t
JOIN aetherius_residence_operations o ON o.id=t.operation_id
LEFT JOIN aetherius_residence_tax_collections c ON c.payment_operation_id=o.id
WHERE c.payment_operation_id IS NULL AND o.action='payTax'
ORDER BY o.residence_id,t.due_at;
```

Para cada operação aprovada pela conciliação, registrar `payment_operation_id`, `residence_id`, o valor pago em Septims e `city_id=NULL` ou o vínculo municipal já validado. Aplicar a importação sob bloqueio da residência, usando a mesma ordem de locks do serviço. Registrar quem aprovou a conciliação. Não descontar novamente do morador.

## Homologação

Foram preparados cenários de pagamento sem cidade, vínculo posterior, acesso indevido, distância da porta, duas coletas concorrentes, reenvio, perda de resposta, falha de crédito, troca de sessão, troca de cidade, venda e reversão de pagamento se a pendência falhar. A sintaxe é conferida na preparação. As suítes de domínio/PostgreSQL e os testes dentro do jogo devem ser executados pela equipe na infraestrutura oficial de homologação.

Conferir também uma conta com vários personagens, revogação do cargo municipal durante operação, cidades distintas, entrada e saída de moradores, compra na porta durante anúncio e saldo pessoal do coletor. A coleta nunca concede permissões residenciais. Conferir pagamento antes do vencimento, duplicação de chamadas e preservação dos limites de visitantes/familiares.

## Recuperação

Em falha, suspender a coleta e preservar recibos, pendências e histórico municipal. Reconciliar uma resposta desconhecida pelo UUID de operação e pelas chaves de idempotência antes de qualquer compensação. A migração é aditiva, mas um runtime anterior deixa de criar pendências para novos pagamentos. Um retorno de versão exige manter as cobranças suspensas até definir a conciliação desse intervalo.
