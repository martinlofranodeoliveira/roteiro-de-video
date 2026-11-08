# Referências do exemplo fictício

O arquivo `demo-storyboard.png` é uma imagem original gerada por inteligência artificial para o exemplo **“Um café, três planos”**. As cenas, a caneca e a cozinha são fictícias. A folha tem aparência fotográfica; não documenta uma sessão de fotos, uma marca, um cliente ou uma gravação real. Não foi utilizado banco de imagens externo.

## Proveniência

- Método: ferramenta nativa `image_gen.imagegen`, modo integrado, geração nova sem imagem de referência.
- Data: 8 de novembro de 2026.
- Arquivo: `assets/demo-storyboard.png`.
- Dimensões: 1536 × 1024 pixels; PNG RGB de 8 bits.
- Organização: três colunas por duas linhas, sem margens ou intervalos; seis regiões de 512 × 512 pixels.
- SHA-256: `26462f2cf1a8b4f667b573ec03d719d2b0e95c88d4dc8e48c9d0e0f144c049ce`.
- A cópia entregue preserva os bytes da saída original; nenhum retoque, recorte ou redimensionamento manual foi aplicado à folha.
- O aplicativo poderá extrair e normalizar cada painel localmente para compor as referências portáteis do exemplo.
- Uso: recurso original integrante do projeto, sob sua licença MIT.

## Ordem dos painéis

A leitura é da esquerda para a direita, começando pela linha superior.

| Cena | Região (x, y, largura, altura) | Referência visual |
| --- | --- | --- |
| 1 | 0, 0, 512, 512 | Caneca vazia sob a primeira luz. |
| 2 | 512, 0, 512, 512 | Detalhe do café moído em uma colher, próximo da caneca. |
| 3 | 1024, 0, 512, 512 | Água vertida no filtro sobre a caneca; mão anônima recortada. |
| 4 | 0, 512, 512, 512 | Detalhe do café gotejando para a caneca. |
| 5 | 512, 512, 512, 512 | Caneca cheia junto da janela, em plano próximo. |
| 6 | 1024, 512, 512, 512 | Caneca cheia em enquadramento mais aberto da bancada. |

## Prompt final

O prompt abaixo foi enviado à ferramenta nativa. O título é citado apenas como contexto e não aparece na imagem.

```text
Use case: photorealistic-natural.
Asset type: an original fictional photographic storyboard reference sheet for a local short-video planning demo, titled in application text "Um café, três planos"; put no title or other text inside the image.
Primary request: one landscape 3:2 raster contact sheet at 1536×1024 with EXACTLY six equal square photographic panels in a strict 3-column by 2-row grid. Each panel is 512×512. Panels touch edge-to-edge: no gutters, no margins, no borders, no frames. Straight vertical divisions exactly one-third and two-thirds across; straight horizontal division halfway down. Each individual panel must be a separate film production still, with no internal collage.
Scene continuity: one quiet home kitchen, same pale warm-gray matte stone counter, same small rounded terracotta ceramic mug with a single curved handle and unbranded matte earthenware surface, consistent warm natural morning window light from the left. A simple pale neutral kitchen background, softly out of focus. Restrained natural colors. Realistic ceramic pores, coffee surface, tiny splashes where appropriate. No human faces. Hands may appear only anonymously cropped in the pouring scene. Not advertising illustration: convincing real photographic production stills, tactile and observational, natural lens depth and photographic exposure.
Panel order, read across first row then second row:
1 top left: establishing close shot of the EMPTY terracotta mug on the pale gray counter, handle at right, warm window light and a soft shadow.
2 top middle: a macro/detail shot of dry ground coffee in a small plain metal spoon just beside the same terracotta mug; coffee particles are realistic and brown, quiet counter background, no hand required.
3 top right: medium close shot of an anonymous cropped hand using a plain unbranded metal kettle to pour a thin clear stream of hot water into a white paper filter in a simple unbranded ceramic pour-over dripper placed directly above the SAME terracotta mug. Physically plausible stable arrangement; mug visible.
4 bottom left: close detail shot from low side angle of dark brewed coffee dripping from the base of the same dripper into the same terracotta mug, subtle realistic translucent steam, photographic steam not cartoon swirls.
5 bottom middle: close shot of the FILLED terracotta mug near the window; dripper removed, brown coffee surface visible, warm sidelight, same counter and mug handle.
6 bottom right: quiet wider closing shot of the same filled terracotta mug alone on the same counter with more negative space and pale window light; no dripper or kettle in shot.
Constraints: exact six square panels, coherent mug geometry and kitchen/material/lighting across every image; no text, no numbers, no labels, no logos, no brands, no watermarks; no extra mug, no duplicate handles, no impossible pouring, no cartoon steam; no visible grid lines, no white separators, no outer border. Opaque background.
```
