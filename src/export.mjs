// Copyright (c) 2026 Lofrano Tecnologia. MIT License.
import {
  validateProject,
  deriveTimeline,
  deriveRecordingPlan,
  formatTime,
} from './model.mjs';

const MODE_LABELS = Object.freeze({ narrative: 'Narrativa', recording: 'Gravação' });
const FRAMING_LABELS = Object.freeze({
  aberto: 'Aberto', medio: 'Médio', close: 'Close', detalhe: 'Detalhe', livre: 'Livre',
});
const CSV_COLUMNS = Object.freeze([
  'projeto', 'visao', 'cena', 'id', 'titulo', 'local', 'preparacao', 'enquadramento',
  'inicio', 'fim', 'duracao_segundos', 'duracao_pendente', 'imagem_acao', 'audio',
  'observacoes', 'referencia', 'formato', 'meta', 'notas_projeto', 'objetivo',
  'tempo_conhecido', 'total_previsto', 'duracoes_pendentes', 'quantidade_cenas',
]);
const PLANNING_NOTE = 'Tempo previsto no vídeo, informado no roteiro; não é medição de arquivo nem tempo de gravação.';
const REFERENCE_NOTE = 'Referências gráficas: Markdown e CSV incluem somente nome e dimensões. O JSON é o backup completo; a impressão inclui as imagens.';

function checkedMode(mode) {
  if (mode !== 'narrative' && mode !== 'recording') {
    throw new TypeError('A visão deve ser narrative ou recording.');
  }
  return mode;
}

function context(value, mode) {
  const project = validateProject(value);
  checkedMode(mode);
  if (mode === 'recording') {
    const plan = deriveRecordingPlan(project);
    return { project, timeline: plan.timeline, groups: plan.groups };
  }
  return { project, timeline: deriveTimeline(project), groups: null };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

// Escape syntax before Markdown parsing. Punctuation in user text cannot open
// links, images, code, tables, headings or raw HTML. Only our own <br> is markup.
function escapeMarkdown(value) {
  return String(value).replace(/\r\n|\r|\n|[&<>\\`*_{}\[\]()#+.!|:=@~\-]/g, (character) => {
    if (character === '\r\n' || character === '\r' || character === '\n') return '<br>\n';
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    return `\\${character}`;
  });
}

function shownText(text, fallback = 'Não informado.') {
  return text === '' ? fallback : text;
}

function referenceText(reference) {
  return reference ? `${reference.name} (${reference.width} × ${reference.height} px)` : 'Sem referência.';
}

function durationText(durationMs) {
  return durationMs === null ? 'Pendente' : formatTime(durationMs);
}

function positionText(value) {
  return value === null ? 'Indefinido' : formatTime(value);
}

function pendingText(timeline) {
  if (!timeline.rows.length) return 'Roteiro vazio: adicione cenas para calcular o total previsto.';
  if (!timeline.missingCount) return 'Nenhuma duração pendente.';
  const count = timeline.missingCount;
  return `${count} ${count === 1 ? 'cena com duração pendente' : 'cenas com duração pendente'}. O total previsto e os tempos posteriores à primeira pendência estão indefinidos.`;
}

function deltaText(timeline) {
  if (timeline.targetMs === null) return 'Sem meta de duração.';
  if (timeline.deltaMs === null) return 'Comparação com a meta pendente até completar as durações.';
  if (timeline.deltaMs === 0) return 'O total previsto corresponde à meta.';
  return `${formatTime(Math.abs(timeline.deltaMs))} ${timeline.deltaMs > 0 ? 'acima' : 'abaixo'} da meta.`;
}

function summaryFields(project, timeline, mode) {
  return [
    ['Visão', MODE_LABELS[mode]],
    ['Quantidade de cenas', String(timeline.rows.length)],
    ['Orientação planejada', project.aspectRatio],
    ['Duração conhecida', formatTime(timeline.knownMs)],
    ['Total previsto', timeline.complete ? formatTime(timeline.totalMs) : 'Indefinido'],
    ['Meta de duração', project.targetMs === null ? 'Sem meta' : formatTime(project.targetMs)],
  ];
}

function sceneFields(row) {
  const { scene } = row;
  return [
    ['ID', scene.id],
    ['Local', shownText(scene.location, 'Local a definir')],
    ['Preparação', shownText(scene.setup, 'Preparação a definir')],
    ['Enquadramento', FRAMING_LABELS[scene.framing]],
    ['Início no vídeo', positionText(row.startMs)],
    ['Fim no vídeo', positionText(row.endMs)],
    ['Duração prevista', durationText(scene.durationMs)],
    ['Imagem / ação', shownText(scene.visual)],
    ['Áudio / fala', shownText(scene.audio)],
    ['Observações', shownText(scene.notes)],
    ['Referência', referenceText(scene.reference)],
  ];
}

function sceneMarkdown(row, level) {
  const title = shownText(row.scene.title, 'Sem título');
  const lines = [`${'#'.repeat(level)} Cena ${row.number} — ${escapeMarkdown(title)}`, ''];
  for (const [label, text] of sceneFields(row)) lines.push(`**${label}:** ${escapeMarkdown(text)}`, '');
  if (row.pendingBefore) lines.push('Posição no vídeo pendente: há duração ausente antes desta cena.', '');
  return lines.join('\n');
}

/** Human-readable planning document; images themselves remain in JSON/print. */
export function toMarkdown(value, { mode = 'narrative' } = {}) {
  const { project, timeline, groups } = context(value, mode);
  const lines = [`# ${escapeMarkdown(project.title)}`, ''];
  for (const [label, text] of summaryFields(project, timeline, mode)) lines.push(`**${label}:** ${escapeMarkdown(text)}`, '');
  lines.push(pendingText(timeline), '', deltaText(timeline), '', PLANNING_NOTE, '', REFERENCE_NOTE, '',
    '## Objetivo', '', escapeMarkdown(shownText(project.objective)), '',
    '## Notas do projeto', '', escapeMarkdown(shownText(project.notes)), '',
    mode === 'narrative' ? '## Sequência narrativa' : '## Lista de gravação', '');
  if (!timeline.rows.length) lines.push('Nenhuma cena neste roteiro.', '');
  if (groups) {
    for (const group of groups) {
      lines.push(`### Local — ${escapeMarkdown(shownText(group.location, 'Local a definir'))}`, '');
      for (const preparation of group.setups) {
        lines.push(`#### Preparação — ${escapeMarkdown(shownText(preparation.setup, 'Preparação a definir'))}`, '');
        for (const row of preparation.rows) lines.push(sceneMarkdown(row, 5));
      }
    }
  } else {
    for (const row of timeline.rows) lines.push(sceneMarkdown(row, 3));
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function secondsText(durationMs) {
  if (durationMs === null) return '';
  const whole = Math.floor(durationMs / 1000);
  const fraction = String(durationMs % 1000).padStart(3, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function csvField(value, textual = true) {
  let text = String(value);
  // Protect text cells even when an expression follows tabs, newlines or spaces.
  if (textual && /^\s*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** RFC-style quoted CSV with explicit scene numbers and exact decimal seconds. */
export function toCSV(value, { mode = 'recording' } = {}) {
  const { project, timeline, groups } = context(value, mode);
  const rows = groups ? groups.flatMap((group) => group.setups.flatMap((setup) => setup.rows)) : timeline.rows;
  const output = [CSV_COLUMNS.map((column) => csvField(column)).join(',')];
  for (const row of rows) {
    const { scene } = row;
    const cells = [
      project.title, mode === 'narrative' ? 'narrativa' : 'gravação', row.number, scene.id,
      scene.title, scene.location, scene.setup, scene.framing,
      row.startMs === null ? '' : formatTime(row.startMs),
      row.endMs === null ? '' : formatTime(row.endMs),
      secondsText(scene.durationMs), scene.durationMs === null ? 'sim' : 'não',
      scene.visual, scene.audio, scene.notes, referenceText(scene.reference), project.aspectRatio,
      project.targetMs === null ? 'Sem meta' : formatTime(project.targetMs),
      project.notes, project.objective, formatTime(timeline.knownMs),
      timeline.complete ? formatTime(timeline.totalMs) : '', timeline.missingCount, rows.length,
    ];
    output.push(cells.map((cell, index) => csvField(cell, ![2, 10, 22, 23].includes(index))).join(','));
  }
  return `${output.join('\r\n')}\r\n`;
}

function printFields(fields) {
  return `<dl>${fields.map(([label, text]) => `<div><dt>${escapeHTML(label)}</dt><dd class="print-text">${escapeHTML(text)}</dd></div>`).join('')}</dl>`;
}

function sceneMarkup(row, level) {
  const scene = row.scene;
  const reference = scene.reference;
  const image = reference
    ? `<figure><img src="${escapeHTML(reference.dataUrl)}" alt="${escapeHTML(reference.name)}" width="${reference.width}" height="${reference.height}"><figcaption class="print-text">${escapeHTML(referenceText(reference))}</figcaption></figure>`
    : '';
  return `<section class="print-scene"><h${level} class="print-text">Cena ${row.number} — ${escapeHTML(shownText(scene.title, 'Sem título'))}</h${level}>${printFields(sceneFields(row))}${row.pendingBefore ? '<p>Posição no vídeo pendente: há duração ausente antes desta cena.</p>' : ''}${image}</section>`;
}

/** Safe HTML fragment. The caller supplies print CSS and the native print UI. */
export function printMarkup(value, { mode = 'narrative' } = {}) {
  const { project, timeline, groups } = context(value, mode);
  let scenes = '';
  if (!timeline.rows.length) scenes = '<p>Nenhuma cena neste roteiro.</p>';
  if (groups) {
    for (const group of groups) {
      scenes += `<section class="print-location"><h3 class="print-text">Local — ${escapeHTML(shownText(group.location, 'Local a definir'))}</h3>`;
      for (const preparation of group.setups) {
        scenes += `<section class="print-setup"><h4 class="print-text">Preparação — ${escapeHTML(shownText(preparation.setup, 'Preparação a definir'))}</h4>${preparation.rows.map((row) => sceneMarkup(row, 5)).join('')}</section>`;
      }
      scenes += '</section>';
    }
  } else scenes += timeline.rows.map((row) => sceneMarkup(row, 3)).join('');
  return `<article class="print-report"><header><h1 class="print-text">${escapeHTML(project.title)}</h1>${printFields(summaryFields(project, timeline, mode))}<p>${escapeHTML(pendingText(timeline))}</p><p>${escapeHTML(deltaText(timeline))}</p><p>${PLANNING_NOTE}</p></header><section><h2>Objetivo</h2><p class="print-text">${escapeHTML(shownText(project.objective))}</p></section><section><h2>Notas do projeto</h2><p class="print-text">${escapeHTML(shownText(project.notes))}</p></section><section><h2>${mode === 'narrative' ? 'Sequência narrativa' : 'Lista de gravação'}</h2>${scenes}</section></article>`;
}
