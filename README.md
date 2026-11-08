# Roteiro de Vídeo

Planeje a história e leve as mesmas cenas para a gravação. Um aplicativo aberto da [LOFRANO TECNOLOGIA](https://lofranotecnologia.com.br), com edição local no navegador.

[Abrir aplicativo](https://martinlofranodeoliveira.github.io/roteiro-de-video/) · [Código e issues](https://github.com/martinlofranodeoliveira/roteiro-de-video)

A visão **Sequência** organiza as cenas na ordem do vídeo. A visão **Gravação** agrupa locais e preparações iguais, mantendo o número narrativo de cada cena. Os dois planos vêm do mesmo projeto: mudar de visão não duplica nem reorganiza seus dados.

## Do primeiro plano ao arquivo de gravação

1. Explore o exemplo fictício que abre com o aplicativo, ou escolha **Novo** para começar vazio.
2. Em **Dados do roteiro**, informe objetivo, formato planejado, meta opcional e notas.
3. Adicione cenas com imagem/ação, fala/áudio, duração prevista, local, preparação e enquadramento. Cada cena pode ter uma imagem de referência.
4. Use as setas para mudar a ordem da história. É possível duplicar cenas e desfazer uma remoção até a próxima alteração.
5. Confira **Gravação** para reunir tomadas por local e preparação. As grafias são comparadas exatamente, com distinção entre maiúsculas e minúsculas; apenas os espaços externos são removidos.
6. Escolha **Baixar JSON** para guardar o trabalho. Em **Exportar plano**, Markdown, CSV e impressão usam a visão ativa.

**Não há salvamento automático.** Fechar ou recarregar a página pode perder alterações. O aplicativo solicita um download; confira o arquivo na pasta de downloads antes de fechar. Para continuar, abra o JSON salvo em outro navegador ou computador.

## Como ler os tempos

A duração é o tempo previsto da cena **no vídeo**, informado por você. Não é medição de mídia, estimativa de fala ou tempo de trabalho da gravação. O aplicativo não gera, reproduz ou edita vídeos.

Digite segundos (`8`, `8,5`, `8.125`), minutos e segundos (`1:02,003`) ou horas (`1:00:00`). Os cálculos usam milissegundos inteiros; não há contagem de frames nem formato SMPTE.

Deixe a duração vazia para definir depois. Uma duração ausente fica **pendente**, sem virar zero. O início da primeira cena pendente ainda pode ser conhecido; seu fim e os tempos seguintes ficam indefinidos. A soma das durações informadas continua visível, mas o total e a diferença para a meta só ficam completos quando todas as cenas têm duração. Um roteiro vazio também tem total incompleto.

## O que cada saída leva

| Saída | Uso | Imagens |
| --- | --- | --- |
| JSON | Backup completo e continuação da edição | PNGs normalizados incorporados ao arquivo |
| Markdown | Plano legível em editores de texto e repositórios | Nome e dimensões de cada referência |
| CSV | Uma linha por cena para consulta em planilha | Nome e dimensões de cada referência |
| Impressão | Relatório da visão ativa, com todos os campos | Referências incorporadas |

A impressão abre o diálogo nativo do navegador. Salvar em PDF depende das opções oferecidas pelo navegador e pelo sistema; não há um gerador de PDF próprio. A paginação também depende dessas opções.

O CSV usa vírgulas, campos entre aspas e linhas CRLF. Textos que poderiam iniciar fórmulas de planilha recebem um apóstrofo de proteção. Markdown e CSV não substituem o backup JSON.

## Imagens e limites

- Até 40 cenas, uma hora por cena e meta de até quatro horas.
- Entrada de referência: PNG ou JPEG, até 8 MiB e 16 milhões de pixels. Outros formatos são recusados.
- Cada imagem é redesenhada localmente como PNG sRGB, sem ampliação, com lado de até 800 pixels e tamanho de até 1 MiB.
- Referências incorporadas: até 12 MiB e 12 milhões de pixels no conjunto. Duplicar uma cena também conta para esses limites.
- Projeto JSON: até 18 MiB, em UTF-8 sem BOM, com o esquema fechado descrito em [SPEC.md](SPEC.md).

O arquivo original da imagem permanece intacto. O JSON guarda a versão normalizada e o nome da referência. Imagens e textos podem conter informação sensível; revise o que vai compartilhar. Uma importação inválida preserva o projeto aberto. Veja os detalhes em [SECURITY.md](SECURITY.md).

O aplicativo não usa conta, cookies, `localStorage` ou IndexedDB para guardar roteiros. A página, as fontes e o exemplo vêm do servidor estático; os arquivos escolhidos são processados no navegador e não são enviados por esta aplicação.

## Exemplo aberto

**Um café, três planos** tem seis cenas, 35 segundos previstos e meta de 40 segundos. A caneca, a cozinha e a narrativa são fictícias. As referências foram geradas por IA para esta demonstração; a origem e o prompt estão em [assets/DEMO.md](assets/DEMO.md).

- [Projeto JSON com seis imagens](examples/roteiro-exemplo.json)
- [Sequência em Markdown](examples/roteiro-exemplo.md)
- [Plano de gravação em CSV](examples/roteiro-exemplo.csv)

Os exemplos textuais são conferidos contra as funções de exportação. O JSON é portátil; a folha original do exemplo não é necessária para reabri-lo.

## Executar e verificar

Use Node.js 22 ou superior. Não há dependências npm nem etapa de instalação.

```sh
npm run dev
```

Abra `http://127.0.0.1:4179/`. A porta pode ser alterada com `ROTEIRO_PORT`. Sirva por HTTP; abrir o HTML por duplo clique não é o fluxo suportado para módulos e carregamento do exemplo.

```sh
npm test
npm run build
npm run check
```

O build produz `dist/` somente com os arquivos explícitos em [scripts/manifest.mjs](scripts/manifest.mjs). A checagem exige um checkout Git deste repositório: examina somente arquivos rastreados, procura padrões de credenciais e caminhos pessoais, confere o conjunto e os bytes da distribuição, suas referências locais e a consistência dos exemplos. Não é uma auditoria integral de segurança.

A integração contínua executa testes, build e checagem em Node 22 e 24. O fluxo de Pages publica a distribuição da branch `main`. Instruções para mudanças e verificações de navegador estão em [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenças

Código e documentação sob [MIT](LICENSE). As fontes Barlow usam SIL Open Font License 1.1. A adaptação do módulo de imagens e os recursos gráficos estão identificados em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
