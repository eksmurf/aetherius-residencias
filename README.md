# Residências do Aetherius — pacote 0.5.0

**0.5.0 — extensões residenciais:** venda instantânea com retorno de **40%**, IPTU descontado até zerar o ganho, visita de um minuto para ofertas sem proprietário e ficha de características. [Guia de atualização](implementacao/ATUALIZACAO-0.5.0.md) · [Contratos pendentes do runtime](implementacao/CONTRATO-EXTENSOES.md) · [Mapeamento e pendências](implementacao/catalogo/FICHAS-20261110.md) · [Validação](implementacao/VALIDACAO-0.5.0.md) · [Pacote](dist/aetherius-residencias-0.5.0.zip). Venda instantânea e visita ficam desabilitadas até conectar e homologar o adaptador oficial.

**Guia para a equipe do Jarl:** [passo a passo de integração e homologação](implementacao/GUIA-JARL.md). [Pacote 0.4.0 com o guia](dist/aetherius-residencias-0.4.0-guia-jarl-1.zip) · [SHA256](dist/aetherius-residencias-0.4.0-guia-jarl-1.zip.sha256). Revisão de documentação; o runtime permanece o mesmo da 0.4.0 original.

**Recolhimento municipal do IPTU — 0.4.0:** pagamento gera uma pendência de arrecadação, vínculo pelo backend do Jarl e recolhimento na porta por responsável autorizado. [Pacote 0.4.0](dist/aetherius-residencias-0.4.0.zip) · [SHA256](dist/aetherius-residencias-0.4.0.zip.sha256) · [Atualização](implementacao/ATUALIZACAO-0.4.0.md) · [Contrato do Jarl](implementacao/INTEGRACAO-JARL.md). A equipe precisa conectar o adaptador municipal e homologar o fluxo.

**Propriedades e compra de residências — 0.3.6.** Fundo transparente ao redor do painel e telas de compra maiores. [Baixar pacote](dist/aetherius-residencias-0.3.6.zip) · [SHA256](dist/aetherius-residencias-0.3.6.zip.sha256) · [Guia de atualização](implementacao/ATUALIZACAO-0.3.6.md).

**Painel revisado e pagamento no vencimento — 0.3.5:** botão cinza antes do vencimento, verde quando liberado, confirmação centralizada e sem antecipação. [Pacote 0.3.5](dist/aetherius-residencias-0.3.5.zip) · [SHA256](dist/aetherius-residencias-0.3.5.zip.sha256) · [guia da 0.3.5](implementacao/ATUALIZACAO-0.3.5.md).

**IPTU simplificado e antecipação — 0.3.4:** botão com valor único e aviso curto; antecipar quita uma parcela e avança o vencimento em 15 dias. [Pacote 0.3.4](dist/aetherius-residencias-0.3.4.zip) · [SHA256](dist/aetherius-residencias-0.3.4.zip.sha256) · [guia histórico](implementacao/ATUALIZACAO-0.3.4.md).

**IPTU a cada 15 dias — 0.3.3:** primeira parcela em 15 dias, suspensão com duas (30 dias) e retorno à venda com três (45 dias), sem pagamento. Confirmado pelo solicitante: ainda não há IPTU ativo. [Pacote 0.3.3](dist/aetherius-residencias-0.3.3.zip) · [SHA256](dist/aetherius-residencias-0.3.3.zip.sha256) · [guia da atualização](implementacao/ATUALIZACAO-0.3.3.md).

**Atualização visual de 03/11/2026:** compra e Propriedades seguem o estudo UI/UX e a referência de Classes: preto translúcido, texto neutro e verde nos estados/ações. [Pacote completo 0.3.2](dist/aetherius-residencias-0.3.2.zip) · [SHA256](dist/aetherius-residencias-0.3.2.zip.sha256) · [guia da atualização visual](implementacao/ATUALIZACAO-UI-0.3.2.md).

Para atualizar a **primeira versão já instalada (0.1.0, informada pelo solicitante)**, seguir o [guia de atualização direta para 0.3.1](implementacao/ATUALIZACAO-0.1-PARA-0.3.1.md). A revisão efetiva do processo e as adaptações oficiais devem ser conferidas pela equipe. [Pacote com guia e conferência](dist/aetherius-residencias-0.3.1-guia-atualizacao-1.zip) · [SHA256](dist/aetherius-residencias-0.3.1-guia-atualizacao-1.zip.sha256).

Entrega original 0.3.1 para integração no **servidor oficial**: [pacote ZIP 0.3.1](dist/aetherius-residencias-0.3.1.zip) · [SHA256](dist/aetherius-residencias-0.3.1.zip.sha256) · [instruções de integração](implementacao/README.md).

A primeira etapa permanece restrita a **Breezehome, Vlindrel Hall, Hjerim, Proudspire Manor e Honeyside**. DLC e mods continuam em [etapas futuras](implementacao/catalogo/etapas-futuras/README.md). Nenhuma venda foi ativada por esta entrega.

## Fluxo atualizado em 03/11/2026

- **Chave pessoal vinculada ao perfil:** aparece em INVENTÁRIO do CORE UI, categoria Chaves, sem ações de movimentação. Não é inserida no inventário nativo transferível; portanto não compõe baús, saque ou comércio. Não há reposição manual. Suspensão por impostos ou revogação de permissões retira a projeção da chave.
- **Entrada direta com E:** dono, familiares e visitantes cadastrados entram quando autorizados; não existe botão “Entrar”. Imóvel privado não abre painel de compra para terceiros; mostra “Residência privada”. Imóveis anunciados ou retomados mostram a oferta aos compradores.
- **Até 5 visitantes cadastrados:** familiares contam nas cinco vagas, com no máximo dois familiares; o dono não conta. Remover alguém libera uma vaga.
- **TAB → Propriedades:** único ponto de entrada do gerenciamento. Exibe impostos, acesso público, visitantes, familiares e anúncio de venda. O comando `/casa` foi retirado.
- **Até dois familiares:** recebem chave e acesso aos armazenamentos. Visitantes cadastrados entram sem acesso aos recipientes. A porta pública permite entrada de terceiros, sem acesso a armazenamento.
- **Remoção com confirmação:** corta imediatamente os direitos no servidor. Quem já está dentro continua podendo sair. A revisão de permissões também impede alterações feitas por uma tela antiga.
- **Venda em Septims:** anúncio por valor inteiro informado pelo dono, com confirmação. O vendedor mantém uso normal enquanto os impostos estiverem regulares. Compra debita o comprador e credita o vendedor na mesma transação; a casa e os itens guardados passam ao comprador. Todos os membros e chaves anteriores são revogados.

## Imposto residencial

| Momento sem pagamento | Resultado |
|---|---|
| Antes do vencimento | Pagamento indisponível |
| 15 dias | Primeiro imposto disponível: 10% do valor base em Septims |
| 30 dias | Dois impostos acumulados; chaves, entradas e armazenamento suspensos |
| 45 dias | Três impostos acumulados; imóvel volta à compra pelo preço cadastrado |
| Quitação antes de nova compra | Paga toda a dívida e recupera a chave e a casa |
| Nova compra antes da quitação | Antigo dono perde o imóvel e os itens que permaneceram nele |

O imposto é sempre em Septims, inclusive quando a aquisição original foi em Diademas. Fração de Septim é arredondada para cima. A dívida continua acumulando a cada 15 dias; não é congelada na terceira quinzena. Sem dívida, o pagamento fica indisponível; com dívida, quita todas as parcelas vencidas. Na retomada por inadimplência não há pagamento ao antigo dono; na venda voluntária há crédito integral do preço anunciado. [Regras e contratos detalhados](implementacao/REGRAS-0.3.md).

## Estado e validação

O usuário informou que a compra por Septims e Diademas foi validada no servidor. Esse relato não comprova qual revisão está instalada e não equivale a homologar esta atualização. O adaptador de cash usado pela equipe precisa ser preservado na integração; a cópia recebida aqui ainda não o contém.

A versão 0.3.1 foi preparada a partir das fontes recebidas: conferência de sintaxe, estrutura do catálogo, preparação do integrador sem aplicar alterações e integridade do pacote. Os testes automatizados incluídos e a homologação desta versão devem ser executados pela equipe na infraestrutura oficial. Não houve acesso remoto, implantação, início de servidor local, migração de banco ou movimentação de saldos.

A atualização requer a migração `002_household_tax.sql`, configuração do catálogo com proteção dos interiores, build do servidor TypeScript e distribuição do cliente/CORE UI. É uma atualização conjunta; não basta substituir o JavaScript do painel.

[Catálogo e pendências das casas](implementacao/catalogo/IMOVEIS.md) · [Changelog](implementacao/CHANGELOG.md) · [Fontes](fontes.json)
