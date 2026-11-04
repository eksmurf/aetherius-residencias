# Atualização para Residências 0.3.6

No TAB, Propriedades preserva a barra superior do CORE e mostra o painel da casa sobre o cenário do jogo. Ao sair, o CORE recupera a apresentação do menu seguinte. A oferta de compra e a confirmação passam a ter até 640 px de largura, texto principal de 18 px e ações em verde. Na revenda, a confirmação informa que os itens guardados acompanham a casa.

## Integração pela equipe

Para atualizar a partir da 0.3.5, distribuir os arquivos `client/properties/properties.js` e `properties.css` no módulo Propriedades do CORE, e `client/residences/app.js` e `style.css` na interface de compra. Regerar os artefatos do cliente usados pelo launcher. A revisão é de interface. Para partir de versões anteriores, aplicar também as etapas do [guia da 0.3.5](ATUALIZACAO-0.3.5.md).

No cliente oficial, abrir TAB → Propriedades, conferir a visibilidade do cenário atrás do painel e fechar pelo X ou ESC. Abrir outro módulo e conferir seu tema. Em uma casa anunciada, conferir preço e legibilidade na porta, avançar para a confirmação e testar Voltar e Fechar. A prévia foi conferida no navegador com as fontes recebidas do CORE. A validação dentro do jogo cabe à equipe.
