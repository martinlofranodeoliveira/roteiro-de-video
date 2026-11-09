---
name: Roteiro de Vídeo
description: Régua de montagem clara para preparar cenas, tempos e gravação.
colors:
  ground: '#e8ecec'
  paper: '#fff'
  ink: '#223c4a'
  muted: '#526772'
  line: '#b8c5cb'
  soft: '#f3f6f6'
  accent: '#066b8c'
  accent-hover: '#04556f'
  selected: '#e6f1f4'
  pending: '#8c4a0b'
  pending-bg: '#fff1d9'
  error: '#a02d25'
  focus: '#b75d10'
  measure: '#2a4e60'
typography:
  display:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 29px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.025em
  headline:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.025em
  title:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 21px
    fontWeight: 600
    letterSpacing: -0.02em
  body:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 16px
    fontWeight: 400
  label:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
  field:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  button:
    fontFamily: Barlow, Arial, sans-serif
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.2
rounded:
  square: '0'
  ruler: 1px
  field: 3px
  control: 4px
  panel: 5px
  dialog: 8px
spacing:
  compact: 4px
  related: 8px
  control: 10px
  group: 12px
  field: 16px
  mobile: 18px
  section: 20px
  wide: 28px
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.paper}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: 8px 13px
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: 8px 13px
  button-secondary-hover:
    backgroundColor: '{colors.selected}'
  button-danger:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.error}'
    rounded: '{rounded.control}'
    padding: 7px 9px
  button-text:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0'
  button-icon:
    backgroundColor: '{colors.soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: 8px
  field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.field}'
    rounded: '{rounded.field}'
    padding: 9px 10px
  view-tabs:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: 8px 17px
  view-tabs-selected:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
  editor:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
  scene-row:
    backgroundColor: transparent
    textColor: '{colors.ink}'
    rounded: '{rounded.square}'
    padding: 10px 7px
  scene-row-selected:
    backgroundColor: '{colors.paper}'
  time-ruler:
    backgroundColor: '{colors.measure}'
    rounded: '{rounded.control}'
    padding: 3px
  ruler-cell:
    backgroundColor: '#edf2f3'
    textColor: '{colors.ink}'
    rounded: '{rounded.ruler}'
    padding: 6px 11px
  ruler-cell-selected:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.paper}'
  ruler-cell-pending:
    backgroundColor: '{colors.pending-bg}'
    textColor: '{colors.pending}'
---

# Design System: Roteiro de Vídeo

## Overview

**Creative North Star: "Régua de montagem"**

A Régua de montagem é a metáfora adotada pelo agente: bancada cinza, papel branco, tinta azul e uma sequência numerada que acompanha a edição. A direção é uma hipótese de execução após perguntas sem resposta para este projeto; não representa aprovação específica do usuário. Este documento registra a implementação existente em modo de extração, com base em styles.css, index.html e src/app.mjs.

O ambiente é claro, compacto e operacional. Divisórias contínuas organizam as cenas; o editor branco mantém a cena escolhida próxima da lista em telas largas. Números estáveis e tempos tabulares orientam a consulta. A identidade institucional aparece no vínculo com a LOFRANO TECNOLOGIA, sem transformar o espaço de trabalho em uma capa promocional.

**Key Characteristics:**
- Régua numerada conectada à seleção da cena.
- Superfícies planas e divisórias contínuas.
- Azul para ação e seleção; âmbar para duração pendente.
- Barlow local, pesos regular e seminegrito, tempos tabulares.

## Colors

A paleta combina azul petróleo, cinzas frios e sinais quentes de estado. Os valores normativos estão no frontmatter; os nomes abaixo descrevem seu uso, sem criar outra escala.

### Primary

- **Azul de operação** (`accent`): ações principais, links, marca, caret e cena atual na régua.
- **Azul de resposta** (`accent-hover`): hover da ação principal e dos links.
- **Azul lavado** (`selected`): resposta de hover dos botões comuns.

### Secondary

- **Âmbar de pendência** (`pending`): duração ainda não definida, acompanhada por texto.
- **Papel âmbar** (`pending-bg`): célula com duração pendente na régua.
- **Âmbar de foco** (`focus`): contorno de teclado global, distinto da seleção da cena.

### Tertiary

- **Vermelho de correção** (`error`): remoção, mensagem de campo e borda de entrada inválida. O vermelho tem função semântica, sem acrescentar uma cor de marca.

### Neutral

- **Bancada cinza** (`ground`): fundo de toda a aplicação.
- **Papel branco** (`paper`): cabeçalho, campos, editor e linha selecionada.
- **Tinta petróleo** (`ink`): texto principal e aba ativa.
- **Tinta auxiliar** (`muted`): ajuda, descrições, placeholders e metadados; corresponde à correção final de contraste já incorporada à fonte.
- **Divisória fria** (`line`): separação de cenas, bordas e barras de trabalho.
- **Papel auxiliar** (`soft`): controles de reordenação e estado vazio.
- **Base da régua** (`measure`): moldura contínua que conecta as células.

As famílias Secondary e Tertiary acima são sinais existentes de pendência, foco e erro. Não autorizam novas combinações decorativas. Os tons pontuais de hover, aviso, miniatura e backdrop continuam definidos pelo CSS dos respectivos componentes, sem promoção a primitivas globais. As rampas OKLCH do sidecar são oito amostras derivadas para visualizar cada cor; não são uma escala adicional da implementação.

**The Estado explícito Rule.** Pendência combina cor com texto. A seleção mantém uma segunda pista visual: contorno na lista ou sublinhado na célula da régua.

## Typography

**Display Font:** Barlow, com Arial e sans-serif como alternativas.
**Body Font:** a mesma família; arquivos locais nos pesos regular e seminegrito.

**Character:** letras econômicas, leitura direta e hierarquia pelo tamanho e pelo peso. Não há fonte ornamental nem família monoespaçada; os números de cena e de tempo usam a variante tabular da própria Barlow.

### Hierarchy

- **Display** (`display`): título editável do projeto, com entreletra ligeiramente fechada. A cascata final reduz o tamanho para 28px até 1050px e 27px até 760px.
- **Headline** (`headline`): nome do aplicativo no cabeçalho; aumenta para 25px no celular.
- **Title** (`title`): título da lista. O título do editor usa 19px no computador e o mesmo nível da lista no celular.
- **Body** (`body`): base da interface. Descrições de lista usam 14px; resumos de tempo usam 17px no computador e 16px no celular.
- **Label** (`label`): rótulos de campos; no celular passam a 14px.
- **Field** (`field`): valores de inputs, selects e textareas; no celular passam a 16px.
- **Button** (`button`): controles de ação com peso seminegrito. O botão de texto do rodapé é regular.

A escala é funcional e discreta, sem proporção matemática declarada. Títulos de cena usam 17px no computador e 16px nas larguras até 1050px. Tempos da régua e números de cena recebem algarismos tabulares. O texto de ação na linha fica em uma linha com truncamento; o valor integral permanece no editor. O estado vazio limita sua explicação a 44ch.

**The Número estável Rule.** Preserve o número narrativo e os algarismos tabulares nas duas organizações da lista.

## Layout

A área principal é centralizada, com largura máxima de 1448px, laterais de 28px e início vertical final de 18px. O cabeçalho usa a mesma linha útil de conteúdo e borda inferior. A ordem visual é título do projeto, resumo de duração, régua, controles de visão e espaço de trabalho.

O espaço de trabalho é uma grade de lista flexível e editor de 340px, com intervalo de 28px. A partir de 1450px, o editor tem 370px e o intervalo passa a 34px. Até 1050px, usa editor de 310px, intervalo de 20px e laterais de 22px. O editor é sticky a 18px do topo, com altura máxima da janela menos 36px e rolagem própria; seu cabeçalho também permanece visível.

Até 760px, cabeçalho e conteúdo passam a uma coluna, com laterais de 18px. As ações de arquivo formam uma grade; as abas ocupam toda a largura e as ações ficam abaixo delas. O editor vem após a lista, perde a posição sticky e a rolagem interna. Escolher uma cena leva ao editor com rolagem suave, ou imediata quando há preferência por movimento reduzido. O título e a identificação de rascunho ou exemplo permanecem visíveis.

A régua tem moldura compacta, altura mínima final de 52px e rolagem horizontal. Cada célula cresce a partir de uma base de 100px; no celular a base é 96px e há encaixe por proximidade. As linhas de cena usam quatro colunas: número, miniatura, descrição e tempo. A miniatura passa de 100×68px a 116×76px nas telas largas e a 70×64px no celular. Os intervalos se comprimem junto com as colunas.

O ritmo de espaçamento usa os valores recorrentes do frontmatter, sem criar uma escala externa. A densidade final aproxima a régua e os campos do primeiro quadro: intervalo vertical de 14px até o espaço de trabalho no computador e 17px no celular. Os pares de campos permanecem em duas colunas, com intervalo de 10px.

O diálogo troca suas ações para coluna invertida até 430px. A impressão é uma superfície própria em A4, margem de 15mm, fundo branco e tipografia em pontos; preserva texto e referências, evita quebrar uma cena internamente e não imprime os controles da aplicação.

## Elevation & Depth

A profundidade vem principalmente do contraste entre a bancada, o papel e as divisórias. A lista e o editor não usam sombra externa. Dados do roteiro, menu de exportação e diálogo podem sobrepor o plano; apenas esses elementos recebem sombras externas. O backdrop do diálogo escurece o contexto.

### Shadow Vocabulary

- **Dados do roteiro** (`0 10px 36px #223c4a33`): painel suspenso dos dados gerais.
- **Exportação** (`0 8px 30px #223c4a30`): opções do menu de exportação.
- **Confirmação** (`0 18px 60px #152d3c59`): diálogo modal.
- **Pendência selecionada** (`inset 0 0 0 2px var(--accent)`): contorno interno da célula pendente atual; sinal de estado, sem elevação.

**The Bancada plana Rule.** Lista, régua e editor permanecem sem sombra externa em repouso; a sombra externa pertence aos conteúdos que se abrem acima da bancada.

## Shapes

Predominam retângulos e cantos discretos. Os raios do frontmatter distinguem a célula quase reta da régua, os campos, os controles, o painel do editor e o diálogo. A lista usa raio zero e borda inferior contínua; não é um conjunto de cartões independentes. Miniaturas e referências recortam o conteúdo dentro de áreas retangulares, sem moldura ornamental.

Bordas comuns têm 1px. A seleção da cena usa contorno azul de 2px para dentro da linha. O foco global de teclado usa contorno âmbar de 3px com afastamento de 3px; na linha já selecionada, a especificidade da regra de seleção mantém o contorno azul de 2px também durante o foco. Ícones lineares usam traço arredondado e cor herdada; botões comuns usam ícones de 18px, e o marcador de referência vazia tem 29px.

## Components

### Buttons

Controles compactos, com rótulo direto e cantos discretos. A base tem altura mínima de 40px, peso seminegrito, borda de divisória e preenchimento definido no frontmatter. O primário preenche de azul as ações de baixar o projeto e adicionar cena; o hover aprofunda o azul. O secundário permanece branco e recebe fundo azul lavado no hover. O botão Novo tem fundo e borda transparentes dentro da navegação de arquivo.

A ação Remover usa texto vermelho, fundo de alerta pálido no hover e alinhamento ao final da linha de ações. Duplicar e Remover ficam mais compactos no computador e ganham altura mínima de 40px no celular. Os controles de mover cena são botões de ícone com rótulo acessível, fundo auxiliar, largura mínima de 38px e altura mínima de 36px. O botão de texto do rodapé usa sublinhado afastado e peso regular. A desabilitação reduz a opacidade a 0,45 e usa cursor indisponível; todos preservam foco visível quando focalizáveis.

### Inputs / Fields

Campos brancos, com borda fria, rótulo persistente acima e texto alinhado à esquerda. Inputs e selects têm altura mínima de 39px; textareas permitem redimensionar verticalmente entre 66px e 400px. Placeholders usam a tinta auxiliar. O foco segue o contorno global, sem trocar o rótulo por placeholder. Campo inválido combina borda vermelha, fundo pálido e mensagem textual; a aplicação marca o primeiro campo inválido com aria-invalid.

O título do projeto é um input editorial sem caixa, com borda inferior azul no hover ou foco. Não se aplica esse tratamento aos campos comuns. A referência gráfica é opcional, aparece com ajuste integral no editor e recorte de preenchimento nas miniaturas da lista. Sem referência, usa símbolo de imagem e texto; a área tem 90px no computador e 180px no celular na cascata final.

### Navigation

As abas Sequência e Gravação são adjacentes, com fundo transparente e seleção em tinta petróleo com texto branco. A aplicação mantém aria-selected e um único ponto de tabulação; setas, Home e End mudam a visão e o foco. No celular as duas abas dividem a largura disponível. A navegação de arquivo permanece separada dos controles de visão.

O menu de exportação usa details/summary, seta de borda e itens textuais. O painel de dados gerais também usa details/summary, ancorado à direita no computador e fixo com margens laterais no celular. Escape fecha os dois.

### Cards / Containers

O editor é o painel branco recorrente, com borda de divisória, raio próprio e cabeçalho separado. Fieldset usa preenchimento de 16px no computador e 18px no celular. Não há componente genérico de card nem chips nesta implementação. Avisos operacionais aparecem em faixa compacta, e erros trocam para fundo e texto de alerta, mantendo a mensagem em texto.

O diálogo de substituição é um modal nativo, com largura máxima de 460px e preenchimento de 26px. A ação inicial é continuar editando; a ação azul confirma a substituição. O estado vazio tem explicação curta e ações explícitas, sem ilustração decorativa.

### Régua e linha de cena

A régua é o componente de assinatura: cada botão reúne número, intervalo previsto e duração. A célula atual recebe azul e um sublinhado âmbar que se revela em 0,28s com curva cubic-bezier(.16,1,.3,1). Uma célula pendente conserva seu fundo âmbar ao ser escolhida e ganha contorno interno azul. A preferência por movimento reduzido desliga a animação. A régua escolhe cenas; não reproduz vídeo.

A linha de cena é um botão de largura integral com número, referência, título, trecho de ação, local/enquadramento e tempo. Hover clareia a superfície e reforça a divisória; aria-pressed ativa papel branco e contorno azul. Tempos indefinidos mantêm texto explícito. A visão de gravação acrescenta títulos de local e preparação, preservando a mesma linha e o número narrativo. Os exemplos no sidecar representam estados visuais existentes; a interação de seleção e sincronização depende da aplicação, sem JavaScript embutido nos exemplos.

## Do's and Don'ts

### Do:
- Do preservar o número da história na régua e na lista, inclusive na visão de gravação.
- Do mostrar “Pendente” ou “Início indef.” quando o tempo não puder ser calculado.
- Do usar os tokens extraídos e o foco visível também nos botões de ícone.
- Do manter rótulos explícitos, ações de mover por botão e indicação do exemplo fictício.
- Do conservar a lista e o editor em sequência vertical no celular, com a régua rolável.

### Don't:
- Don't converter a lista contínua em cartões flutuantes com sombras recorrentes.
- Don't representar duração ausente como zero nem exibir um total completo após a primeira pendência.
- Don't usar o âmbar de pendência como decoração de chamadas comuns.
- Don't acrescentar animações de reprodução, cabeçote ou trilhas de mídia à régua de planejamento.
- Don't atribuir a direção visual ou estas descrições a uma aprovação do usuário que não foi registrada.
