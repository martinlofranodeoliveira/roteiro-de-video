/** Exemplo fictício; os painéis são recortados e normalizados localmente. */
import { createProject, addScene, updateProject, updateScene } from './model.mjs';
import { normalizeBitmapRegion } from './image-io.mjs';

const scenes = [
  { title: 'A primeira luz', visual: 'A caneca vazia recebe a luz da manhã. Aproximar até a borda ocupar o quadro.', audio: 'Som ambiente da cozinha. Sem fala.', location: 'Bancada', setup: 'Tripé baixo', framing: 'close', durationMs: 5000, notes: 'Deixar espaço à direita para o movimento seguinte.' },
  { title: 'O café de perto', visual: 'A colher entra no quadro com o café moído. Registrar o encontro das texturas.', audio: 'Som da colher e do café. “O dia começa por aqui.”', location: 'Bancada', setup: 'Câmera de cima', framing: 'detalhe', durationMs: 6000, notes: 'Preparar o café antes de posicionar a câmera.' },
  { title: 'A água encontra o café', visual: 'Verter a água lentamente sobre o filtro. Manter a caneca visível na parte inferior.', audio: 'Água em primeiro plano. Música instrumental baixa.', location: 'Bancada', setup: 'Tripé baixo', framing: 'medio', durationMs: 8000, notes: 'Gravar o início e o fim do movimento.' },
  { title: 'Pausa para o aroma', visual: 'Acompanhar as últimas gotas e o vapor sobre a superfície do café.', audio: '“Um pequeno intervalo, só seu.”', location: 'Bancada', setup: 'Tripé baixo', framing: 'detalhe', durationMs: 7000, notes: 'Dar tempo para o vapor aparecer contra o fundo.' },
  { title: 'Perto da janela', visual: 'A caneca pronta muda de lugar. A luz revela o esmalte e a cor da cerâmica.', audio: 'A música respira. Manter um pouco do ambiente.', location: 'Janela', setup: 'Câmera na mão', framing: 'close', durationMs: 5000, notes: 'Movimento curto e estável, sem pressa.' },
  { title: 'O convite fica', visual: 'Abrir o quadro e deixar a caneca descansar. O espaço vazio encerra a sequência.', audio: '“Seu próximo café começa com uma pausa.”', location: 'Janela', setup: 'Tripé aberto', framing: 'aberto', durationMs: 4000, notes: 'Segurar o último quadro antes de cortar.' },
];

export async function loadDemoProject() {
  const response = await fetch(new URL('../assets/demo-storyboard.png', import.meta.url));
  if (!response.ok) throw new Error('O exemplo não pôde ser carregado. Tente novamente.');
  const blob = await response.blob();
  if (blob.size > 8 * 1024 * 1024) throw new Error('A imagem do exemplo excede o limite.');
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    if (bitmap.width !== 1536 || bitmap.height !== 1024) throw new Error('A imagem do exemplo tem dimensões inesperadas.');
    let project = updateProject(createProject(), {
      title: 'Um café, três planos', targetMs: 40000, aspectRatio: '16:9',
      objective: 'Apresentar uma caneca fictícia em um vídeo curto, com uma sequência de pequenos gestos.',
      notes: 'Exemplo fictício. Referências visuais originais geradas por IA; não representam uma produção realizada.',
    });
    for (let index = 0; index < scenes.length; index += 1) {
      const id = `cena-${String(index + 1).padStart(2, '0')}`;
      const reference = await normalizeBitmapRegion(bitmap, { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, width: 512, height: 512 }, `referencia-${index + 1}.png`);
      project = updateScene(addScene(project, id), id, { ...scenes[index], reference });
    }
    return project;
  } finally { bitmap.close(); }
}
