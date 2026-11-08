# Roteiro de Vídeo — contrato 1.0

Aplicativo estático de planejamento local. A sequência narrativa e a lista de gravação derivam do mesmo projeto. O aplicativo não gera nem edita vídeo, não mede mídia, não estima a duração de fala e não agenda pessoas. Todos os tempos representam a duração prevista no vídeo, informada por quem prepara o roteiro.

## Documento JSON

O documento aceita exatamente as chaves abaixo. Campos ausentes, campos adicionais, tipos diferentes dos descritos e versões desconhecidas são recusados.

```js
{
  schemaVersion: 1,
  title: "Um café, três planos",
  objective: "Apresentar uma caneca fictícia em um vídeo curto.",
  notes: "Exemplo fictício.",
  aspectRatio: "16:9",
  targetMs: 45000,
  scenes: [{
    id: "cena-01",
    title: "A primeira luz",
    visual: "A caneca vazia sobre a mesa.",
    audio: "Som ambiente; sem fala.",
    location: "Bancada",
    setup: "Tripé",
    framing: "close",
    durationMs: 8000,
    notes: "Conferir reflexos.",
    reference: null
  }]
}
```

- `schemaVersion`: inteiro `1`.
- `aspectRatio`: `16:9`, `9:16` ou `1:1`. Indica a orientação planejada e não modifica a imagem de referência.
- `targetMs`: `null` ou inteiro positivo de até `14400000` ms, equivalente a quatro horas.
- `scenes`: array de zero a 40 cenas. Um projeto vazio é válido, mas sua duração total permanece incompleta.
- `id`: identificador único que atende a `[A-Za-z0-9_-]{1,64}`. Edições e mudanças de posição preservam esse identificador.
- `framing`: `aberto`, `medio`, `close`, `detalhe` ou `livre`.
- `durationMs`: `null` ou inteiro positivo de até `3600000` ms, equivalente a uma hora por cena. Ausência de duração é diferente de zero; zero não é uma duração de cena válida.
- `reference`: `null` ou uma referência PNG no formato descrito a seguir.

Os títulos de projeto e cena aceitam até 120 unidades UTF-16, o mesmo critério de `maxlength` no navegador. O título do projeto precisa conter algum caractere diferente de espaço em branco; o título da cena pode ficar vazio. `objective` e `notes` do projeto aceitam até 2000 unidades UTF-16. `visual`, `audio` e `notes` de cada cena também aceitam até 2000. `location` e `setup` aceitam até 120.

Todas as strings precisam ser Unicode bem formado. São recusados NUL, controles ASCII diferentes de TAB, LF e CR, DEL, U+FFFE e U+FFFF. Texto livre é preservado sem normalização Unicode, sem aparar espaços e sem reescrever quebras de linha. Somente `location` e `setup` têm seus espaços externos removidos. O agrupamento compara esses valores canônicos por igualdade exata, com distinção entre maiúsculas e minúsculas.

Inteiros devem ser exatos e seguros; booleanos e strings numéricas não substituem números. A soma das durações conhecidas tem teto estrutural de `144000000` ms, equivalente a 40 horas. Objetos de entrada precisam conter somente dados JSON; propriedades acessoras, símbolos, arrays com lacunas e propriedades adicionais não são aceitos.

## Referências incorporadas

```js
{
  name: "caneca.png",
  mime: "image/png",
  dataUrl: "data:image/png;base64,...",
  width: 800,
  height: 600
}
```

As cinco chaves são obrigatórias. `name` deve conter algum caractere diferente de espaço em branco e aceitar até 120 unidades UTF-16. O nome é preservado como informado. `mime` precisa ser `image/png`. A data URL usa o prefixo exato `data:image/png;base64,` e base64 canônica, sem espaços ou quebras de linha, inclusive nos bits de preenchimento.

Cada referência aceita até `1048576` bytes (1 MiB), largura e altura inteiras de 1 a 800 e até `640000` pixels. O total incorporado no projeto aceita até `12582912` bytes (12 MiB) e `12000000` pixels. Cada ocorrência conta para essas quotas, inclusive quando cenas duplicadas compartilham um objeto imutável de referência.

`validateProject` confere a estrutura da data URL, a base64, a assinatura PNG, o primeiro bloco IHDR, seus parâmetros básicos e a correspondência entre as dimensões declaradas e as do cabeçalho. Essa checagem não decodifica pixels nem comprova a integridade completa do PNG. A aplicação precisa decodificar todas as referências antes de aceitar uma importação e conferir suas dimensões reais.

O texto JSON de entrada e a serialização canônica têm limite de `18874368` bytes UTF-8 (18 MiB). A serialização usa a ordem de chaves descrita acima, indentação de dois espaços e um LF final.

## `src/model.mjs`

O núcleo não usa DOM, relógio, armazenamento ou rede. Seus documentos canônicos são profundamente congelados, sem modificar nem congelar os objetos de origem. Um cache privado pode reaproveitar projetos, cenas e referências que o próprio núcleo já validou; um objeto externo não ganha confiança apenas por estar congelado. Edições validam os campos alterados e usam tamanhos já calculados para evitar recodificar imagens ou serializar o projeto inteiro a cada tecla.

### Criação, validação e backup

- `ProjectError`: erro com `code` estável e mensagem em português brasileiro.
- `LIMITS`: objeto congelado com os tetos numéricos. Inclui `maxScenes`, `maxSceneMs`, `maxTargetMs`, `maxTimelineMs`, `maxSourceBytes`, `maxSourcePixels`, `maxImageSide`, `maxImageBytes`, `maxImagePixels`, `maxTotalImageBytes`, `maxTotalPixels` e `maxProjectBytes`.
- `validateProject(value)`: devolve um documento canônico profundamente congelado; recusa chaves extras, identificadores repetidos e violações dos limites.
- `parseProject(text)`: mede os bytes UTF-8 antes de `JSON.parse`, valida o documento inteiro e devolve o resultado canônico. Uma falha não altera o documento anterior.
- `serializeProject(project)`: valida o projeto e devolve seu JSON determinístico, indentado com dois espaços e LF final. Confere o teto UTF-8 da saída.
- `createProject()`: cria título `Meu roteiro`, textos vazios, `aspectRatio: '16:9'`, `targetMs: null` e `scenes: []`.
- `createScene(id)`: cria uma cena com o ID informado, textos vazios, `framing: 'livre'`, `durationMs: null` e `reference: null`.

### Edições imutáveis

- `updateProject(project, patch)`: aceita somente `title`, `objective`, `notes`, `aspectRatio` e `targetMs`.
- `addScene(project, id, afterId = null)`: adiciona ao final quando `afterId` é `null`; caso contrário, insere após a cena indicada. Recusa um ID já usado.
- `updateScene(project, id, patch)`: aceita somente campos da cena diferentes de `id`, valida a mudança e preserva as demais cenas.
- `moveScene(project, id, delta)`: aceita `delta` igual a `-1` ou `1`. Na borda, devolve o mesmo projeto; um ID inexistente é um erro.
- `duplicateScene(project, id, newId)`: insere uma cena independente logo após a origem, com um novo ID. Os dados são mantidos; a referência profundamente imutável pode ser compartilhada.
- `removeScene(project, id)`: devolve um projeto sem a cena indicada. A interface guarda o documento anterior para desfazer uma remoção até a próxima alteração.

### Tempos exatos

`parseDuration(text, { maxMs = LIMITS.maxSceneMs } = {})` devolve milissegundos inteiros ou `null`. A entrada precisa ser uma string; strings vazias ou compostas somente de espaços externos viram `null`. Valores `null`, `undefined`, números e outros tipos são recusados.

Após aparar os espaços externos, o parser aceita somente dígitos ASCII e uma das seguintes formas:

- Segundos inteiros ou decimais: de um a sete dígitos, com ponto ou vírgula e de uma a três casas opcionais. Exemplos: `8`, `8,5`, `0.001`.
- `MM:SS`, com fração opcional nos segundos. Exemplo: `1:02,003`.
- `HH:MM:SS`, com fração opcional nos segundos. Exemplo: `1:00:00`.

O primeiro componente antes de `:` tem de um a três dígitos. Todos os componentes posteriores têm exatamente dois dígitos e variam de `00` a `59`. Sinais, expoentes, espaços internos e frações fora dos segundos são recusados. A fração é interpretada por operações inteiras, sem usar ponto flutuante para convertê-la.

O resultado precisa estar entre 1 ms e `maxMs`. A opção `maxMs` aceita um inteiro positivo até `LIMITS.maxTargetMs`; a interface usa essa opção para a meta de até quatro horas. Sem a opção, o teto é de uma hora.

`formatTime(ms)` aceita `null` ou um inteiro de zero a `144000000`. `null` vira `—`; até 59 minutos usa `MM:SS`; a partir de uma hora usa `HH:MM:SS`. Uma fração diferente de zero é exibida com vírgula e exatamente três dígitos. Exemplos: `00:00`, `01:02,003`, `01:00:00`. O formato não é SMPTE e não inclui frames.

### Sequência e gravação

`deriveTimeline(project)` devolve:

```js
{
  rows: [{ number, scene, startMs, endMs, pendingBefore }],
  knownMs,
  missingCount,
  complete,
  totalMs,
  targetMs,
  deltaMs
}
```

`number` começa em 1 e corresponde à posição narrativa. `pendingBefore` é a quantidade de durações ausentes antes da linha. A primeira cena sem duração ainda pode ter `startMs` conhecido, mas seu `endMs` é `null`. Todos os inícios e fins posteriores ficam `null`, mesmo para cenas com duração definida. `knownMs` continua somando todas as durações informadas.

`complete` só é `true` quando há pelo menos uma cena e todas têm duração. Sem cenas, `complete` é `false`, `totalMs` é `null`, `knownMs` é zero e `missingCount` é zero. `deltaMs` vale `totalMs - targetMs` somente quando o roteiro está completo e existe uma meta; nos demais casos é `null`.

`deriveRecordingPlan(project)` devolve `{ groups, timeline }`. Cada grupo tem `{ location, setups: [{ setup, rows }] }`. Os locais aparecem na ordem de sua primeira ocorrência; dentro de cada local, as preparações seguem a mesma regra. Cada linha conserva seu número e seus tempos narrativos originais. A derivação não reorganiza o projeto.

Local e preparação vazios permanecem como strings vazias no domínio. A interface e as exportações podem apresentá-los como `Local a definir` e `Preparação a definir`. Não há inferência de equivalência entre grafias.

## `src/export.mjs`

Exports:

- `toMarkdown(project, { mode = 'narrative' } = {})`.
- `toCSV(project, { mode = 'recording' } = {})`.
- `printMarkup(project, { mode = 'narrative' } = {})`.

`mode` aceita somente `narrative` ou `recording`. Todas as funções começam validando o documento, sem mutação nem rede. As exportações incluem informações textuais, tempos, locais, preparações, pendências, meta e quantidade de cenas. No modo de gravação, a ordem é agrupada, mas o número de cada cena continua sendo o narrativo.

Markdown e CSV representam referências gráficas somente por nome e dimensões. As imagens completas ficam no backup JSON e na impressão. O Markdown escapa conteúdo arbitrário do usuário para que ele não se transforme em HTML, links, imagens ou outra estrutura de Markdown.

O CSV usa uma linha por cena, aspas em todos os campos e finais de linha CRLF. Campos textuais que começam, após espaços em branco, por `=`, `+`, `-` ou `@` recebem um apóstrofo de proteção. Duração em segundos é um decimal canônico exato. Início e fim ficam vazios quando indefinidos. Um projeto vazio produz somente o cabeçalho.

As colunas fixas, nesta ordem, são:

```text
projeto,visao,cena,id,titulo,local,preparacao,enquadramento,inicio,fim,duracao_segundos,duracao_pendente,imagem_acao,audio,observacoes,referencia,formato,meta,notas_projeto,objetivo,tempo_conhecido,total_previsto,duracoes_pendentes,quantidade_cenas
```

`printMarkup` devolve um fragmento HTML sem scripts, com a classe `print-report`. Todo conteúdo do usuário, inclusive atributos, é escapado. Data URLs de imagens vêm somente de referências PNG validadas. O relatório inclui título, objetivo, orientação planejada, duração conhecida e total, meta, pendências, notas, cenas com todos os campos e suas imagens de referência. Roteiro vazio, durações pendentes e ausência de meta são explicitados. A impressão usa a superfície nativa do navegador.

## Imagens e aplicação

Arquivos de referência de entrada podem ser PNG ou JPEG, com até 8 MiB e 16 milhões de pixels. O cabeçalho é inspecionado antes da decodificação. SVG, GIF e outros formatos são recusados. A orientação EXIF é respeitada pelo navegador. A imagem é normalizada localmente como PNG sRGB, sem ampliação, com lado máximo de 800 pixels e até 1 MiB.

Só uma coleta de imagem é processada por vez. URLs temporárias são revogadas ao trocar o documento. Na importação JSON, todas as referências são decodificadas sequencialmente e suas dimensões reais são verificadas antes da substituição atômica do projeto. Uma falha preserva o trabalho anterior. Uma importação assíncrona não pode substituir edições feitas depois de seu início. Estados de carregamento e erro ficam visíveis, sem repetir conteúdo privado no console.

O editor preserva um rascunho inválido de duração; ele não volta silenciosamente ao valor anterior. Exportar, salvar e trocar de cena exigem resolver esse rascunho. Textos da cena, seleção, lista e faixa de tempos permanecem associados pelo ID. A reordenação funciona por botões e não exige arraste. A remoção oferece desfazer até a próxima alteração; a duplicação cria um novo ID.

Abrir arquivo, abrir exemplo ou criar um novo roteiro pede confirmação quando há conteúdo a substituir. A ação `Novo roteiro` sempre cria um documento vazio. O exemplo é identificado como fictício, com seis cenas sobre um café e uma caneca sem marcas e todas as durações definidas; ele nunca reutiliza dados do usuário.

Não existe salvamento automático. O navegador lê somente arquivos escolhidos pela pessoa. O JSON inclui as imagens normalizadas e é o backup completo para continuar em outro navegador. Esta versão não guarda conteúdo em `localStorage`, IndexedDB ou cookies.

## Entrega e verificação

A distribuição usa HTML, CSS e módulos ES estáticos, código original sob MIT, documentação em português, fontes locais com licença OFL e exemplos gráficos originais. Não inclui segredos, conteúdo de cliente ou dados pessoais embutidos.

`npm test` deve passar em Node 22 e 24. A cobertura inclui propriedades de tempos e agrupamentos, estabilidade dos bytes do backup, limites e base64, escapes e CSV, importação atômica e regressões dos controles. A verificação em navegador contempla computador e celular, escolha real de arquivo, downloads reais e impressão nativa.

O build copia apenas uma lista explícita de arquivos de distribuição para `dist`. A entrega inclui GitHub Pages, ZIP de fontes, ZIP estático e `SHA256SUMS`. O README principal do perfil do usuário é preservado.
