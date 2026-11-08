# Segurança e arquivos do roteiro

O Roteiro de Vídeo é uma aplicação estática. A página, os módulos, as fontes e a imagem do exemplo são carregados do servidor que a hospeda. Textos e arquivos escolhidos são processados no navegador; esta aplicação não oferece backend para recebê-los, autenticação ou telemetria. Links externos abrem serviços com suas próprias condições.

## Guardar e compartilhar

Não há salvamento automático, cookies de projeto, `localStorage` ou IndexedDB. O documento permanece na memória da aba. **Baixar JSON** inicia um download explícito; o aplicativo não consegue confirmar a gravação final pelo sistema operacional. Confira sua cópia antes de fechar ou recarregar a página.

O JSON contém título, objetivo, notas, textos das cenas, locais, preparações, nomes das referências e seus PNGs normalizados. É um backup completo, **sem anonimização ou criptografia**. Markdown e CSV levam textos e metadados das imagens; a impressão leva também as imagens. Revise o conteúdo antes de compartilhar qualquer saída.

A imagem de origem é decodificada e redesenhada como um PNG reduzido. O arquivo original não é incorporado integralmente; o nome da referência e o conteúdo visual permanecem. Essa normalização não remove informações que aparecem nos próprios pixels e não constitui anonimização.

## Entradas aceitas

PNG/JPEG de entrada têm limites de bytes e pixels, inspeção do cabeçalho e decodificação pelo navegador. O PNG normalizado também tem limites por imagem e por projeto. Não são aceitos SVG, GIF, URLs externas de referência ou código como imagens. Os valores exatos estão em [SPEC.md](SPEC.md).

O JSON usa esquema fechado, inteiros seguros, limites UTF-8, identificadores únicos e base64 canônica. A validação estrutural confere assinatura e IHDR dos PNGs, mas não valida integralmente todos os blocos ou pixels. A interface decodifica todas as referências e confere as dimensões reais antes de substituir o projeto. Erros ou uma leitura concluída depois de novas edições preservam o documento atual.

Esses limites reduzem a entrada aceita; não são uma sandbox de memória nem uma auditoria dos decodificadores do navegador. A decodificação, o canvas, o download e o diálogo de impressão dependem do navegador e do sistema operacional.

## Saídas e distribuição

A interface trata texto livre como texto. Markdown escapa a sintaxe fornecida pelo usuário; a impressão escapa texto e atributos e usa somente PNGs validados. O CSV coloca todos os campos entre aspas e acrescenta apóstrofo aos textos que podem iniciar fórmulas, inclusive depois de espaços em branco. Não remova essas proteções ao adaptar as exportações.

O build copia somente a lista explícita de arquivos públicos. A checagem inspeciona os arquivos rastreados deste repositório e procura alguns padrões de credenciais, arquivos privados e caminhos pessoais. Ela não lê arquivos de autenticação da máquina e não comprova, sozinha, ausência de segredos ou dados pessoais. Revise o diff e use exemplos sintéticos.

## Relatar uma falha

Para um problema sem informação confidencial, abra uma [issue](https://github.com/martinlofranodeoliveira/roteiro-de-video/issues) com versão, navegador, passos, resultado observado e esperado. Anexe somente uma reprodução mínima fictícia.

Se o relato revelar uma falha explorável ou depender de dados confidenciais, use o relato privado da aba **Security**, quando disponível. Se esse recurso não estiver habilitado, use o contato indicado no [site da LOFRANO TECNOLOGIA](https://lofranotecnologia.com.br) para combinar um canal privado antes de enviar arquivos. Não publique senhas, tokens, dados pessoais ou imagens de terceiros na issue.

Não há prazo de resposta ou garantia de suporte estabelecidos.
