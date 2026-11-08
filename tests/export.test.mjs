import test from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown, toCSV, printMarkup } from '../src/export.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYxQAAAAASUVORK5CYII=';
const COLUMNS = [
  'projeto', 'visao', 'cena', 'id', 'titulo', 'local', 'preparacao', 'enquadramento',
  'inicio', 'fim', 'duracao_segundos', 'duracao_pendente', 'imagem_acao', 'audio',
  'observacoes', 'referencia', 'formato', 'meta', 'notas_projeto', 'objetivo',
  'tempo_conhecido', 'total_previsto', 'duracoes_pendentes', 'quantidade_cenas',
];

function scene(id, patch = {}) {
  return {
    id, title: '', visual: '', audio: '', location: '', setup: '', framing: 'livre',
    durationMs: null, notes: '', reference: null, ...patch,
  };
}

function project(scenes = [], patch = {}) {
  return {
    schemaVersion: 1, title: 'Roteiro de teste', objective: '', notes: '',
    aspectRatio: '16:9', targetMs: null, scenes, ...patch,
  };
}

function groupingFixture() {
  return project([
    scene('a', { title: 'Abertura', location: 'Mesa', setup: 'Tripé', durationMs: 1250 }),
    scene('b', { title: 'Passagem', location: 'Janela', setup: 'Manual' }),
    scene('c', { title: 'Detalhe', location: 'Mesa', setup: 'Manual', durationMs: 3600000 }),
    scene('d', { title: 'Fecho', location: 'Mesa', setup: 'Tripé', durationMs: 2000 }),
  ], { targetMs: 3605000 });
}

// A deliberately separate strict CSV reader: records must be CRLF-terminated,
// every field quoted, quotes doubled, and line breaks inside fields preserved.
function readCSV(source) {
  const records = [];
  let position = 0;
  while (position < source.length) {
    const record = [];
    while (true) {
      assert.equal(source[position++], '"', 'field opens with a quote');
      let field = '';
      let closed = false;
      while (position < source.length) {
        const character = source[position++];
        if (character !== '"') field += character;
        else if (source[position] === '"') { field += '"'; position++; }
        else { closed = true; break; }
      }
      assert.ok(closed, 'field closes');
      record.push(field);
      if (source[position] === ',') { position++; continue; }
      assert.equal(source.slice(position, position + 2), '\r\n', 'records end with CRLF');
      position += 2;
      break;
    }
    records.push(record);
  }
  return records;
}

function csvObjects(source) {
  const [header, ...rows] = readCSV(source);
  assert.deepEqual(header, COLUMNS);
  for (const row of rows) assert.equal(row.length, COLUMNS.length);
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]])));
}

function markdownNumbers(source, level) {
  return [...source.matchAll(new RegExp(`^${'#'.repeat(level)} Cena (\\d+)`, 'gm'))].map((match) => Number(match[1]));
}

function printNumbers(source) {
  return [...source.matchAll(/<h[35] class="print-text">Cena (\d+)/g)].map((match) => Number(match[1]));
}

test('narrative and recording exports preserve handwritten order and original numbers', () => {
  const value = groupingFixture();
  assert.deepEqual(markdownNumbers(toMarkdown(value), 3), [1, 2, 3, 4]);
  assert.deepEqual(markdownNumbers(toMarkdown(value, { mode: 'recording' }), 5), [1, 4, 3, 2]);
  assert.deepEqual(csvObjects(toCSV(value)).map((row) => row.cena), ['1', '4', '3', '2']);
  assert.deepEqual(csvObjects(toCSV(value, { mode: 'narrative' })).map((row) => row.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(printNumbers(printMarkup(value)), [1, 2, 3, 4]);
  assert.deepEqual(printNumbers(printMarkup(value, { mode: 'recording' })), [1, 4, 3, 2]);
});

test('CSV has exact known timing, a pending duration, and no invented later positions', () => {
  const rows = csvObjects(toCSV(groupingFixture(), { mode: 'narrative' }));
  assert.deepEqual(rows.map((row) => [row.inicio, row.fim, row.duracao_segundos, row.duracao_pendente]), [
    ['00:00', '00:01,250', '1.25', 'não'],
    ['00:01,250', '', '', 'sim'],
    ['', '', '3600', 'não'],
    ['', '', '2', 'não'],
  ]);
  for (const row of rows) {
    assert.equal(row.tempo_conhecido, '01:00:03,250');
    assert.equal(row.total_previsto, '');
    assert.equal(row.duracoes_pendentes, '1');
    assert.equal(row.quantidade_cenas, '4');
    assert.equal(row.meta, '01:00:05');
    assert.equal(row.visao, 'narrativa');
  }
});

test('CSV contains every project and scene text field with independent parsing', () => {
  const value = project([scene('take_1', {
    title: 'Título, "com aspas"', location: 'Bancada', setup: 'Luz lateral', framing: 'medio',
    durationMs: 1001, visual: 'Linha um\nLinha dois, com vírgula.', audio: 'Fala: "olá".\r\nSom.',
    notes: 'Não remover os espaços:  dois.\tFim',
    reference: { name: 'referência.png', mime: 'image/png', dataUrl: PNG, width: 1, height: 1 },
  })], {
    title: 'Projeto, "com aspas"', objective: 'Objetivo\ncom duas linhas',
    notes: 'Nota\r\ncom CRLF', aspectRatio: '9:16', targetMs: 2000,
  });
  assert.deepEqual(csvObjects(toCSV(value))[0], {
    projeto: 'Projeto, "com aspas"', visao: 'gravação', cena: '1', id: 'take_1',
    titulo: 'Título, "com aspas"', local: 'Bancada', preparacao: 'Luz lateral', enquadramento: 'medio',
    inicio: '00:00', fim: '00:01,001', duracao_segundos: '1.001', duracao_pendente: 'não',
    imagem_acao: 'Linha um\nLinha dois, com vírgula.', audio: 'Fala: "olá".\r\nSom.',
    observacoes: 'Não remover os espaços:  dois.\tFim', referencia: 'referência.png (1 × 1 px)',
    formato: '9:16', meta: '00:02', notas_projeto: 'Nota\r\ncom CRLF',
    objetivo: 'Objetivo\ncom duas linhas', tempo_conhecido: '00:01,001',
    total_previsto: '00:01,001', duracoes_pendentes: '0', quantidade_cenas: '1',
  });
});

test('CSV protects text formulas after whitespace without changing decimal values', () => {
  const value = project([scene('formulas', {
    title: '=1+1', location: '\t+SUM(A1)', setup: ' -2', visual: '\n@cmd',
    audio: '\u00a0=HYPERLINK("https://invalid")', notes: ' \r\n+9', durationMs: 100,
    reference: { name: '=image.png', mime: 'image/png', dataUrl: PNG, width: 1, height: 1 },
  })], { title: ' @Projeto', objective: '-Objetivo', notes: '\t=nota' });
  const row = csvObjects(toCSV(value))[0];
  assert.equal(row.projeto, "' @Projeto");
  assert.equal(row.titulo, "'=1+1");
  // Location and setup are canonical trimmed fields in the document contract.
  assert.equal(row.local, "'+SUM(A1)");
  assert.equal(row.preparacao, "'-2");
  assert.equal(row.imagem_acao, "'\n@cmd");
  assert.equal(row.audio, "'\u00a0=HYPERLINK(\"https://invalid\")");
  assert.equal(row.observacoes, "' \r\n+9");
  assert.equal(row.referencia, "'=image.png (1 × 1 px)");
  assert.equal(row.objetivo, "'-Objetivo");
  assert.equal(row.notas_projeto, "'\t=nota");
  assert.equal(row.duracao_segundos, '0.1');
});

test('Markdown and print include all free text, fields, pending notes and target metadata', () => {
  const value = project([
    scene('one', { title: 'Cena única', visual: 'Ação completa', audio: 'Áudio completo',
      location: 'Local completo', setup: 'Preparação completa', framing: 'detalhe', notes: 'Nota da cena' }),
    scene('two', { durationMs: 1500 }),
  ], { objective: 'Objetivo completo', notes: 'Notas completas do projeto', aspectRatio: '1:1', targetMs: 6000 });
  for (const output of [toMarkdown(value), printMarkup(value)]) {
    const text = output.replace(/\\:/g, ':');
    for (const expected of ['Cena única', 'Ação completa', 'Áudio completo', 'Local completo',
      'Preparação completa', 'Detalhe', 'Nota da cena', 'Objetivo completo', 'Notas completas do projeto',
      'Duração conhecida', '00:01,500', '00:06', 'Total previsto', 'Indefinido',
      '1 cena com duração pendente', 'tempos posteriores', 'Comparação com a meta pendente',
      'Posição no vídeo pendente', 'tempo de gravação', 'Não informado', 'Sem referência']) {
      assert.ok(text.includes(expected), expected);
    }
  }
  assert.match(toMarkdown(value), /Orientação planejada:\*\* 1\\:1/);
  assert.match(printMarkup(value), /Orientação planejada<\/dt><dd class="print-text">1:1/);
});

test('complete totals compare against target precisely above, below and equal', () => {
  const base = project([scene('a', { durationMs: 1250 }), scene('b', { durationMs: 2750 })], { targetMs: 5000 });
  for (const render of [toMarkdown, printMarkup]) {
    assert.ok(render(base).includes('00:01 abaixo da meta.'));
    assert.ok(render({ ...base, targetMs: 3000 }).includes('00:01 acima da meta.'));
    assert.ok(render({ ...base, targetMs: 4000 }).includes('O total previsto corresponde à meta.'));
    assert.ok(render({ ...base, targetMs: null }).includes('Sem meta de duração.'));
  }
  const rows = csvObjects(toCSV(base));
  assert.deepEqual(rows.map((row) => [row.inicio, row.fim, row.total_previsto]), [
    ['00:00', '00:01,250', '00:04'], ['00:01,250', '00:04', '00:04'],
  ]);
});

test('an empty project has only the CSV header and explicit empty prose', () => {
  const value = project();
  assert.deepEqual(readCSV(toCSV(value)), [COLUMNS]);
  for (const render of [toMarkdown, printMarkup]) {
    for (const mode of ['narrative', 'recording']) {
      const output = render(value, { mode });
      assert.ok(output.includes('Roteiro vazio: adicione cenas para calcular o total previsto.'));
      assert.ok(output.includes('Nenhuma cena neste roteiro.'));
      assert.ok(output.includes('Sem meta'));
      assert.ok(output.includes('Indefinido'));
    }
  }
});

test('grouping uses exact location and setup names, including empty names', () => {
  const value = project([
    scene('a', { location: '', setup: '' }),
    scene('b', { location: 'mesa', setup: 'tripé' }),
    scene('c', { location: 'Mesa', setup: 'Tripé' }),
    scene('d', { location: '', setup: 'Tripé' }),
    scene('e', { location: '', setup: '' }),
  ]);
  assert.deepEqual(csvObjects(toCSV(value)).map((row) => row.id), ['a', 'e', 'd', 'b', 'c']);
  assert.deepEqual(markdownNumbers(toMarkdown(value, { mode: 'recording' }), 5), [1, 5, 4, 2, 3]);
  assert.ok(printMarkup(value, { mode: 'recording' }).includes('Local a definir'));
  assert.ok(toMarkdown(value, { mode: 'recording' }).includes('Preparação a definir'));
});

test('Markdown user text cannot introduce HTML, links, images, code, or headings', () => {
  const payload = '# <script>alert("x")</script> &copy;\n![imagem](https://example.invalid/a)\n[link](javascript:alert(1))\n`código` **forte** _itálico_\n---\nwww.example.invalid @alguém';
  const output = toMarkdown(project([scene('safe', { title: payload.slice(0, 100), visual: payload })], { objective: payload }));
  assert.ok(output.includes('\\# &lt;script&gt;alert\\("x"\\)&lt;/script&gt; &amp;copy;'));
  assert.ok(output.includes('\\!\\[imagem\\]\\(https\\://example\\.invalid/a\\)'));
  assert.ok(output.includes('\\[link\\]\\(javascript\\:alert\\(1\\)\\)'));
  assert.ok(output.includes('\\`código\\` \\*\\*forte\\*\\* \\_itálico\\_'));
  assert.ok(output.includes('<br>\n\\-\\-\\-<br>'));
  assert.ok(output.includes('www\\.example\\.invalid \\@alguém'));
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('![imagem]'));
  assert.ok(!output.includes('[link]('));
});

test('references are metadata in Markdown/CSV and safe embedded PNGs in print', () => {
  const name = '\'"><img src=https://invalid onerror=alert(1)>.png';
  const value = project([scene('safe', {
    title: '</h3><script>alert(1)</script>', visual: '<iframe src="https://invalid"></iframe>',
    reference: { name, mime: 'image/png', dataUrl: PNG, width: 1, height: 1 },
  })], { title: '<svg onload=alert(1)>', objective: '& < > " \'', notes: 'Texto\ncom linha' });
  const markdown = toMarkdown(value);
  const csv = toCSV(value);
  assert.ok(!markdown.includes('data:image'));
  assert.ok(!csv.includes('data:image'));
  assert.ok(markdown.includes('1 × 1 px'));
  assert.ok(csvObjects(csv)[0].referencia.endsWith('(1 × 1 px)'));
  const html = printMarkup(value);
  assert.ok(html.startsWith('<article class="print-report">'));
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.ok(html.includes(`src="${PNG}"`));
  assert.ok(html.includes('alt="&#39;&quot;&gt;&lt;img src=https://invalid onerror=alert(1)&gt;.png" width="1" height="1"'));
  assert.ok(html.includes('&lt;/h3&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&amp; &lt; &gt; &quot; &#39;'));
  assert.ok(!/<(?:script|svg|iframe)\b/i.test(html));
  assert.ok(!/\son(?:load|error)=["']/i.test(html));
});

test('every exporter validates documents and mode before producing output', () => {
  const invalids = [
    null, { ...project(), extension: true }, { ...project(), schemaVersion: 2 },
    project([scene('duplicate'), scene('duplicate')]),
    project([scene('bad', { durationMs: 0 })]),
    project([scene('remote', { reference: { name: 'x', mime: 'image/png', dataUrl: 'https://invalid/x.png', width: 1, height: 1 } })]),
  ];
  for (const render of [toMarkdown, toCSV, printMarkup]) {
    for (const invalid of invalids) assert.throws(() => render(invalid));
    for (const mode of ['unknown', '', null, 0, {}, '__proto__']) assert.throws(() => render(project(), { mode }), TypeError);
  }
});

test('exporting both views does not mutate the input document', () => {
  const value = groupingFixture();
  const before = JSON.stringify(value);
  for (const render of [toMarkdown, toCSV, printMarkup]) {
    render(value, { mode: 'narrative' });
    render(value, { mode: 'recording' });
  }
  assert.equal(JSON.stringify(value), before);
  assert.equal(Object.isFrozen(value), false);
  assert.deepEqual(value.scenes.map((item) => item.id), ['a', 'b', 'c', 'd']);
});
