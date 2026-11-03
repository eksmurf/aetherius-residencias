# Regras de residências 0.3.3 — 03/11/2026

Estas regras substituem o fluxo de reposição manual, trancar/destrancar por botão e painel de proprietário na porta das versões 0.1/0.2.

## Chave e entrada

A chave fica vinculada à conta e ao `profile_id`, aparecendo na categoria Chaves do INVENTÁRIO pessoal do CORE UI. Não é item físico movimentável. Não aparece em depósito, retirada, saque ou comércio. Não pode ser descartada, destruída ou transferida pelo jogador. A mesma chave volta a ser exibida após quitar impostos; não exige emitir outra.

Dono, familiares e visitantes autorizados entram diretamente ao pressionar E. A chave visual informa o direito; copiar seu nome/ID não concede acesso. Saída permanece livre mesmo após remoção, inadimplência ou venda. Casas privadas não abrem oferta a terceiros. Casas à venda/reofertadas abrem o painel de compra; familiares/visitantes mantêm entrada direta durante anúncio voluntário, enquanto os impostos estiverem regulares.

## Gerenciamento e membros

TAB → Propriedades é o único caminho de interface para gerenciamento. A porta mostra somente compra quando aplicável. Não existe comando ou botão extra para abrir gerenciamento.

O dono informa nome completo (comparação sem diferença entre maiúsculas/minúsculas) ou `profile_id`. O servidor consulta perfis e personagens aprovados. Nome que identificar mais de um perfil exige o ID. A pessoa entra como visitante. São permitidos até 5 cadastros por residência, incluindo familiares; o proprietário não ocupa vaga. Ao atingir o limite, o formulário fica desabilitado e o servidor rejeita novas inclusões sob bloqueio da residência. Remover alguém libera uma vaga; mudar o papel para Familiar não libera vaga. A porta pública não altera esse limite de cadastros. Cadastros legados acima de cinco exigem revisão da equipe, sem exclusão automática. Marcar Familiar concede acesso a armazenamentos e chave vinculada. Há no máximo dois familiares; o limite é aplicado no banco sob bloqueio da residência e refletido nas caixas desabilitadas do painel.

Desmarcar Familiar mantém a pessoa como visitante e revoga sua chave/acesso aos armazenamentos. Remover exige Sim/Não e retira todo o vínculo. Remoção e venda não expulsam por teleporte quem está dentro; apenas bloqueiam novos acessos a baús e reentrada. Porta pública permite visita, nunca armazenamento.

## Impostos

A periodicidade é de 15 dias completos (360 horas), sem vinculação aos dias 1 e 15 do mês. Duas parcelas correspondem a 30 dias e três a 45 dias sem pagamento desde o início do ciclo.

O imposto quinzenal é `ceil(valorBaseEmSeptims / 10)`, sempre em Septims. O valor base é fixado na aquisição e corresponde ao preço cadastrado em Septims, independentemente da moeda da compra ou do preço particular de revenda. A fração é arredondada para cima porque a moeda usa unidades inteiras.

O primeiro vencimento ocorre 15 dias após a aquisição. Antes disso não há pagamento. Cada 15 dias completos acrescenta uma parcela. Com uma parcela em aberto há cobrança sem bloqueio; com duas, chave, entradas e armazenamento de dono/familiares/visitantes são suspensos, inclusive porta pública. Com três, a casa volta à compra pelo preço cadastrado. Não existe disputa por lances.

Quitação paga todas as parcelas vencidas de uma só vez e avança o próximo vencimento na mesma sequência quinzenal. Não compra períodos futuros e não reinicia artificialmente o relógio. A dívida continua acumulando após a terceira quinzena. Após suspensão, a quitação devolve as chaves/permissões existentes e fecha a porta pública; o dono pode reabri-la deliberadamente. Um anúncio voluntário anterior é cancelado nessa recuperação.

Até uma nova compra concluir, o antigo dono ainda pode quitar a dívida pelo TAB e recuperar o direito. Quitação e compra concorrentes bloqueiam a mesma linha. Se a compra vencer, o pagamento do antigo dono é recusado sem débito. Ele perde a casa e os itens que permaneceram nela; os vínculos de membros e chaves anteriores são revogados. Na retomada por imposto não há crédito ao antigo dono.

## Venda voluntária

O dono informa preço inteiro positivo em Septims e confirma que a venda inclui os itens guardados. Pode alterar ou cancelar o anúncio enquanto a casa estiver regular. Continua entrando e usando os armazenamentos até alguém concluir a compra.

A compra confere oferta, preço, revisão, saldo e limite de propriedades; debita comprador, credita vendedor e muda a posse em uma única transação. O comprador não escolhe o destinatário. O vínculo do vendedor é resolvido pelo `profile_id`/UUID e o saldo creditado é o do personagem que publicou o anúncio, na economia oficial. Não há comissão ou conversão de moedas nesta versão.

Concluída a venda: anúncio retirado, porta pública fechada, todos os membros removidos, chaves anteriores revogadas e nova chave vinculada ao comprador. O conteúdo nativo dos armazenamentos não é movimentado; o comprador passa a acessá-lo. O calendário de impostos começa novamente para o novo dono.

## Exemplo

Casa com valor base de 25.000 Septims: imposto quinzenal de 2.500. No 15º dia deve 2.500; no 30º, 5.000 e perde acesso; no 45º, 7.500 e o imóvel volta à oferta. Se quitar antes de outra compra, recupera a mesma chave. Se a casa for vendida voluntariamente por 40.000, o vendedor recebe 40.000; o imposto do novo dono continua baseado no valor cadastrado de 25.000.
