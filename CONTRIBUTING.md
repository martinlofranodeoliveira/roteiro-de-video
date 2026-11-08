# Contribuir com o Roteiro de Vídeo

Mudanças devem preservar o caminho entre planejamento e gravação: uma cena mantém sua identidade ao editar, mover ou trocar de visão; uma duplicação recebe um novo identificador. Leia [SPEC.md](SPEC.md) para o contrato dos dados e [PRODUCT.md](PRODUCT.md) para o escopo do produto.

## Preparação

Faça um fork ou clone do repositório e use Node.js 22 ou 24. Não há dependências npm para instalar.

```sh
npm run dev
```

Abra `http://127.0.0.1:4179/`. A aplicação usa módulos ES e carrega o exemplo da mesma origem; faça a revisão por HTTP.

## Onde mudar

| Arquivo | Responsabilidade |
| --- | --- |
| `src/model.mjs` | Esquema, limites, edição imutável, tempos, sequência e agrupamento |
| `src/controller.mjs` | Sessão de edição, seleção, desfazer e substituição assíncrona |
| `src/draft.mjs` | Entrada dos controles e manutenção de rascunhos inválidos |
| `src/image-io.mjs` | Cabeçalhos, decodificação e normalização local de PNG/JPEG |
| `src/export.mjs` | Markdown, CSV e fragmento de impressão |
| `src/demo.mjs` | Exemplo fictício e suas referências |
| `src/app.mjs`, `index.html`, `styles.css` | Interface, foco, downloads e impressão nativa |
| `scripts/manifest.mjs` | Lista explícita de arquivos publicados em `dist/` |

Mantenha o núcleo independente de DOM, rede e armazenamento. Não substitua duração pendente por zero nem use cálculos em ponto flutuante para converter frações de segundo. O agrupamento de gravação deve preservar os números e os tempos narrativos. Mudanças no esquema ou nos limites precisam atualizar o contrato, os exemplos e as verificações correspondentes.

Textos importados são dados, inclusive quando parecem HTML, Markdown ou fórmulas. Preserve os escapes das exportações, a proteção dos campos CSV e a validação das referências antes de trocar o documento. Não insira texto livre como HTML na interface.

## Verificar uma mudança

```sh
npm test
npm run build
npm run check
```

Adicione os arquivos públicos ao índice Git antes da checagem: ela trabalha somente com a árvore rastreada deste repositório, exige `.git` na raiz e recusa arquivos privados ou links simbólicos. `dist/`, `local/` e arquivos de máquina não devem ser rastreados. O build não transforma o código; ele copia a lista explícita, incluindo licenças e exemplos.

Use testes que demonstrem o comportamento alterado. Para mudanças de interface ou processamento de imagem, confira também no navegador:

- Projeto vazio, exemplo e arquivo JSON real escolhido pelo controle de arquivos; importação inválida deve preservar o trabalho aberto.
- Edição e reordenação com teclado, foco visível, duplicação, remoção e desfazer; seleção e campos precisam continuar associados à mesma cena.
- Duração ausente ou inválida, frações de milissegundo, meta e mudança entre Sequência e Gravação.
- Download real de JSON e sua reabertura com imagens; Markdown e CSV da visão ativa.
- PNG/JPEG real dentro dos limites e erro de arquivo recusado, sem substituir a referência anterior.
- Computador e largura de celular, sem conteúdo ou ações inacessíveis; preferência de movimento reduzido.
- Diálogo de impressão com imagens e várias páginas. Registre navegador, sistema e opções usados; a disponibilidade de PDF e a paginação variam.

Esta é uma lista de revisão, não uma declaração de que todos os navegadores foram certificados. Descreva no PR o que foi efetivamente executado e qualquer limitação restante.

## Exemplos, licenças e relatos

Use apenas conteúdo sintético em testes e exemplos. Não anexe roteiros de clientes, dados pessoais, credenciais ou caminhos de sua máquina. Para regenerar os exemplos textuais, use o JSON publicado com `toMarkdown(project)` e `toCSV(project)`; os padrões da API são narrativa para Markdown e gravação para CSV. A interface passa explicitamente a visão ativa. Preserve o LF final do JSON/Markdown e o CRLF do CSV.

Documente a origem de novos recursos e mantenha seus avisos de licença em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Mudanças na folha de demonstração devem atualizar também [assets/DEMO.md](assets/DEMO.md) e seus dados de proveniência.

Abra issues com passos reproduzíveis, resultado esperado, resultado observado e um exemplo mínimo fictício. Falhas que exijam um relato privado seguem [SECURITY.md](SECURITY.md). Ao enviar um PR, explique o comportamento final e as verificações feitas, com capturas de interface quando ajudarem a revisar a mudança.
