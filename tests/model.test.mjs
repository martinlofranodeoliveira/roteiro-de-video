import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProjectError, LIMITS, validateProject, parseProject, serializeProject, createProject, createScene,
  updateProject, addScene, updateScene, moveScene, duplicateScene, removeScene,
  parseDuration, formatTime, deriveTimeline, deriveRecordingPlan,
} from '../src/model.mjs';

function rejectsCode(callback, code) {
  assert.throws(callback, (error) => error instanceof ProjectError && (!code || error.code === code));
}

const raw = (project = createProject()) => JSON.parse(serializeProject(project));

function projectWith(scenes, patch = {}) {
  return validateProject({ ...raw(), ...patch, scenes: scenes.map((scene, index) => ({ ...createScene(`s${index}`), ...scene })) });
}

// Só um IHDR estrutural: os testes de domínio não afirmam decodificar pixels.
function structuralPNG(width = 1, height = 1, size = 33) {
  const bytes = Buffer.alloc(size);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  return { name: 'Referência original.png', mime: 'image/png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, width, height };
}

function mutatePNG(reference, offset, value) {
  const bytes = Buffer.from(reference.dataUrl.split(',')[1], 'base64');
  bytes[offset] = value;
  return { ...reference, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
}

test('criação vazia é canônica, profundamente imutável e incompleta', () => {
  const project = createProject();
  assert.equal(project.title, 'Meu roteiro');
  assert.equal(project.aspectRatio, '16:9');
  assert.equal(project.targetMs, null);
  assert.deepEqual(project.scenes, []);
  assert.ok(Object.isFrozen(project));
  assert.ok(Object.isFrozen(project.scenes));
  assert.equal(validateProject(project), project);
  assert.deepEqual(deriveTimeline(project), {
    rows: [], knownMs: 0, missingCount: 0, complete: false, totalMs: null, targetMs: null, deltaMs: null,
  });
  assert.deepEqual(deriveRecordingPlan(project).groups, []);
  assert.ok(Object.isFrozen(LIMITS));
});

test('validação clona a entrada, mantém texto livre e apara somente local/preparação', () => {
  const source = { ...raw(), title: '  Café 🍵  ', notes: '\tNota\ncom\rtexto  ', scenes: [{
    ...createScene('original'), title: '  título  ', visual: '  e\u0301  ', audio: '\n  silêncio\t',
    location: '  Mesa  ', setup: '\tTripé\n', reference: structuralPNG(),
  }] };
  const project = validateProject(source);
  assert.notEqual(project, source);
  assert.notEqual(project.scenes[0], source.scenes[0]);
  assert.notEqual(project.scenes[0].reference, source.scenes[0].reference);
  assert.equal(project.title, '  Café 🍵  ');
  assert.equal(project.scenes[0].visual, '  e\u0301  ');
  assert.equal(project.scenes[0].audio, '\n  silêncio\t');
  assert.equal(project.scenes[0].location, 'Mesa');
  assert.equal(project.scenes[0].setup, 'Tripé');
  assert.equal(source.scenes[0].location, '  Mesa  ');
  assert.ok(!Object.isFrozen(source));
  assert.ok(!Object.isFrozen(source.scenes[0].reference));
  assert.ok(Object.isFrozen(project.scenes[0]));
  assert.ok(Object.isFrozen(project.scenes[0].reference));
  source.scenes[0].reference.name = 'Alterado';
  assert.equal(project.scenes[0].reference.name, 'Referência original.png');
  assert.throws(() => { project.scenes[0].title = 'mutação'; }, TypeError);
});

test('backup tem ordem canônica, LF final e bytes estáveis depois de reabrir', () => {
  const reference = structuralPNG();
  const project = projectWith([{ id: 'B_1', title: 'Café "especial"', durationMs: 1001, reference }], {
    targetMs: 2000, notes: '\tç\r\n🍵',
  });
  const reversed = Object.fromEntries(Object.entries(raw(project)).reverse());
  reversed.scenes[0] = Object.fromEntries(Object.entries(reversed.scenes[0]).reverse());
  reversed.scenes[0].reference = Object.fromEntries(Object.entries(reference).reverse());
  const serialized = serializeProject(reversed);
  assert.ok(serialized.startsWith('{\n  "schemaVersion": 1,\n  "title":'));
  assert.ok(serialized.endsWith('}\n'));
  assert.equal(serializeProject(parseProject(serialized)), serialized);
  assert.equal(serializeProject(project), serialized);
});

test('esquema recusa versões, chaves extras, campos ausentes e tipos não portáteis', () => {
  for (const value of [null, [], 1, true, 'texto', new Date()]) rejectsCode(() => validateProject(value), 'INVALID_OBJECT');
  rejectsCode(() => validateProject({ ...raw(), schemaVersion: 2 }), 'SCHEMA_VERSION');
  rejectsCode(() => validateProject({ ...raw(), schemaVersion: true }), 'SCHEMA_VERSION');
  rejectsCode(() => validateProject({ ...raw(), extra: '' }), 'INVALID_KEYS');
  const missing = raw(); delete missing.notes;
  rejectsCode(() => validateProject(missing), 'INVALID_KEYS');
  rejectsCode(() => projectWith([{ extra: true }]), 'INVALID_KEYS');
  rejectsCode(() => projectWith([{ reference: { ...structuralPNG(), extra: 1 } }]), 'INVALID_KEYS');
  const withSymbol = { ...raw(), [Symbol('extra')]: 1 };
  rejectsCode(() => validateProject(withSymbol), 'INVALID_KEYS');
  const accessor = raw();
  Object.defineProperty(accessor, 'title', { enumerable: true, get() { assert.fail('Não executar getter externo'); } });
  rejectsCode(() => validateProject(accessor), 'INVALID_OBJECT');
  const hidden = raw(); Object.defineProperty(hidden, 'title', { value: 'Título', enumerable: false });
  rejectsCode(() => validateProject(hidden), 'INVALID_OBJECT');
  const hole = raw(); hole.scenes = Array(1);
  rejectsCode(() => validateProject(hole), 'INVALID_SCENES');
  const extraArray = raw(); extraArray.scenes.extra = 1;
  rejectsCode(() => validateProject(extraArray), 'INVALID_SCENES');
  const nullPrototype = Object.assign(Object.create(null), raw());
  assert.equal(validateProject(nullPrototype).title, 'Meu roteiro');
});

test('congelar objetos externos não passa pela confiança privada', () => {
  rejectsCode(() => validateProject(Object.freeze({ ...raw(), targetMs: -1 })), 'INVALID_INTEGER');
  rejectsCode(() => projectWith([{ reference: Object.freeze({ ...structuralPNG(), dataUrl: 'inválido' }) }]), 'INVALID_REFERENCE');
  const source = Object.freeze({ ...raw(), scenes: Object.freeze([Object.freeze({ ...createScene('x'), title: '\ud800' })]) });
  rejectsCode(() => validateProject(source), 'INVALID_TEXT');
});

test('limites e caracteres de texto são explícitos, sem normalização Unicode', () => {
  assert.equal(updateProject(createProject(), { title: 'x'.repeat(120) }).title.length, 120);
  rejectsCode(() => updateProject(createProject(), { title: 'x'.repeat(121) }), 'LIMIT_TEXT');
  rejectsCode(() => updateProject(createProject(), { title: ' \n\t ' }), 'REQUIRED_TEXT');
  for (const value of [null, undefined, 4, false]) rejectsCode(() => updateProject(createProject(), { objective: value }), 'INVALID_TEXT');
  for (const char of ['\0', '\u0001', '\u000b', '\u000c', '\u001f', '\u007f', '\ufffe', '\uffff', '\ud800', '\udc00', '\ud800a']) {
    rejectsCode(() => updateProject(createProject(), { notes: `antes${char}depois` }), 'INVALID_TEXT');
  }
  const scene = projectWith([{ title: '', visual: 'x'.repeat(2000), audio: '\t\n\r', notes: 'e\u0301😀' }]).scenes[0];
  assert.equal(scene.visual.length, 2000);
  assert.equal(scene.notes, 'e\u0301😀');
  rejectsCode(() => projectWith([{ notes: 'x'.repeat(2001) }]), 'LIMIT_TEXT');
  rejectsCode(() => projectWith([{ location: 'x'.repeat(121) }]), 'LIMIT_TEXT');
  rejectsCode(() => projectWith([{ framing: 'Close' }]), 'INVALID_ENUM');
  rejectsCode(() => updateProject(createProject(), { aspectRatio: '4:3' }), 'INVALID_ENUM');
});

test('IDs estritos e únicos sobrevivem a todas as edições', () => {
  assert.equal(createScene('A_a-09').id, 'A_a-09');
  assert.equal(createScene('a'.repeat(64)).id.length, 64);
  for (const id of ['', 'a'.repeat(65), 'cena 1', 'á', '.', null, 1]) rejectsCode(() => createScene(id), 'INVALID_ID');
  rejectsCode(() => projectWith([{ id: 'igual' }, { id: 'igual' }]), 'DUPLICATE_ID');
  const project = addScene(createProject(), 'existente');
  rejectsCode(() => addScene(project, 'existente'), 'DUPLICATE_ID');
  rejectsCode(() => duplicateScene(project, 'existente', 'existente'), 'DUPLICATE_ID');
  rejectsCode(() => updateScene(project, 'existente', { id: 'outra' }), 'INVALID_KEYS');
  for (const operation of [
    () => addScene(project, 'nova', 'ausente'), () => updateScene(project, 'ausente', {}),
    () => moveScene(project, 'ausente', 1), () => duplicateScene(project, 'ausente', 'nova'),
    () => removeScene(project, 'ausente'),
  ]) rejectsCode(operation, 'SCENE_NOT_FOUND');
});

test('operações são imutáveis, preservam identidades não alteradas e ordem por ID', () => {
  const original = projectWith([{ id: 'a', title: 'A', reference: structuralPNG() }, { id: 'b', title: 'B' }]);
  const withTail = addScene(original, 'c');
  const inserted = addScene(withTail, 'd', 'a');
  assert.deepEqual(inserted.scenes.map((scene) => scene.id), ['a', 'd', 'b', 'c']);
  assert.equal(inserted.scenes[0], original.scenes[0]);
  const edited = updateScene(inserted, 'b', { visual: 'B só mudou aqui', durationMs: 250 });
  assert.equal(original.scenes[1].visual, '');
  assert.equal(edited.scenes[0], original.scenes[0]);
  assert.equal(updateScene(edited, 'b', { visual: 'B só mudou aqui' }), edited);
  assert.equal(updateScene(edited, 'b', {}), edited);
  assert.equal(updateProject(edited, { title: edited.title }), edited);
  assert.equal(updateProject(edited, {}), edited);
  const moved = moveScene(edited, 'b', -1);
  assert.deepEqual(moved.scenes.map((scene) => scene.id), ['a', 'b', 'd', 'c']);
  assert.equal(moved.scenes[1], edited.scenes[2]);
  assert.equal(moveScene(moved, 'a', -1), moved);
  assert.equal(moveScene(moved, 'c', 1), moved);
  rejectsCode(() => moveScene(moved, 'a', 0), 'INVALID_DELTA');
  rejectsCode(() => moveScene(moved, 'a', true), 'INVALID_DELTA');
  const duplicated = duplicateScene(moved, 'a', 'a-copy');
  assert.deepEqual(duplicated.scenes.map((scene) => scene.id), ['a', 'a-copy', 'b', 'd', 'c']);
  assert.notEqual(duplicated.scenes[1], duplicated.scenes[0]);
  assert.equal(duplicated.scenes[1].reference, duplicated.scenes[0].reference);
  const copyEdited = updateScene(duplicated, 'a-copy', { title: 'Cópia', reference: null });
  assert.equal(copyEdited.scenes[0].title, 'A');
  assert.ok(copyEdited.scenes[0].reference);
  const removed = removeScene(copyEdited, 'a');
  assert.deepEqual(removed.scenes.map((scene) => scene.id), ['a-copy', 'b', 'd', 'c']);
  assert.equal(copyEdited.scenes[0].id, 'a');
  assert.deepEqual(original.scenes.map((scene) => scene.id), ['a', 'b']);
  rejectsCode(() => updateProject(original, { scenes: [] }), 'INVALID_KEYS');
  rejectsCode(() => updateProject(original, { schemaVersion: 2 }), 'INVALID_KEYS');
});

test('40 cenas e 40 horas são limites inclusivos; duração zero não é pendência', () => {
  const project = projectWith(Array.from({ length: 40 }, () => ({ durationMs: LIMITS.maxSceneMs })));
  assert.equal(deriveTimeline(project).totalMs, LIMITS.maxTimelineMs);
  rejectsCode(() => addScene(project, 'extra'), 'LIMIT_SCENES');
  rejectsCode(() => duplicateScene(project, 's0', 'extra'), 'LIMIT_SCENES');
  rejectsCode(() => projectWith(Array.from({ length: 41 }, () => ({}))), 'LIMIT_SCENES');
  for (const value of [0, -1, 1.5, NaN, Infinity, true, '1000', undefined, LIMITS.maxSceneMs + 1]) {
    rejectsCode(() => projectWith([{ durationMs: value }]), 'INVALID_INTEGER');
  }
  assert.equal(projectWith([{ durationMs: 1 }]).scenes[0].durationMs, 1);
  assert.equal(projectWith([{ durationMs: null }]).scenes[0].durationMs, null);
  assert.equal(updateProject(createProject(), { targetMs: LIMITS.maxTargetMs }).targetMs, LIMITS.maxTargetMs);
  for (const value of [0, -1, true, 1.1, LIMITS.maxTargetMs + 1]) rejectsCode(() => updateProject(createProject(), { targetMs: value }), 'INVALID_INTEGER');
});

test('parser de duração usa milissegundos exatos e gramática fechada', () => {
  const cases = new Map([
    ['', null], [' \t\n ', null], ['1', 1000], ['0.001', 1], ['0,01', 10], ['1.1', 1100],
    ['0000001,009', 1009], ['  1:02,003  ', 62003], ['00:59.999', 59999],
    ['1:00:00', 3600000], ['060:00', 3600000], ['3599.999', 3599999], ['3600', 3600000],
  ]);
  for (const [value, expected] of cases) assert.equal(parseDuration(value), expected, value);
  const invalid = ['0', '0,000', '-1', '+1', '1e3', 'Infinity', '.5', '1.', '1,', '1.0000', '1,2.3',
    '1 0', '1 :00', '1:0', '1:60', '1:00:60', '1:000', '1:00:0', '1:00:00:00',
    '1234:00', '00000001', '３', '١', '3600.001', '9999999', '0:00'];
  for (const value of invalid) rejectsCode(() => parseDuration(value), 'INVALID_DURATION');
  for (const value of [null, undefined, 0, true, {}, []]) rejectsCode(() => parseDuration(value), 'INVALID_DURATION');
  assert.equal(parseDuration('4:00:00', { maxMs: LIMITS.maxTargetMs }), LIMITS.maxTargetMs);
  assert.equal(parseDuration('240:00', { maxMs: LIMITS.maxTargetMs }), LIMITS.maxTargetMs);
  rejectsCode(() => parseDuration('4:00:00.001', { maxMs: LIMITS.maxTargetMs }), 'INVALID_DURATION');
  rejectsCode(() => parseDuration('1', { maxMs: LIMITS.maxTargetMs + 1 }), 'INVALID_INTEGER');
});

test('formatação mantém zero, fração inteira, minutos, horas e ausência distintos', () => {
  for (const [ms, expected] of [
    [null, '—'], [0, '00:00'], [1, '00:00,001'], [10, '00:00,010'], [100, '00:00,100'],
    [60000, '01:00'], [3599999, '59:59,999'], [3600000, '01:00:00'], [3600001, '01:00:00,001'],
    [LIMITS.maxTimelineMs, '40:00:00'],
  ]) assert.equal(formatTime(ms), expected);
  for (const value of [-1, 0.5, NaN, Infinity, undefined, true, '1000', LIMITS.maxTimelineMs + 1]) rejectsCode(() => formatTime(value), 'INVALID_INTEGER');
});

test('uma pendência interrompe posições exatas, mas não apaga a duração conhecida', () => {
  const project = projectWith([
    { durationMs: 1200 }, { durationMs: null }, { durationMs: 800 }, { durationMs: null }, { durationMs: 2000 },
  ], { targetMs: 4000 });
  const timeline = deriveTimeline(project);
  assert.equal(timeline.knownMs, 4000);
  assert.equal(timeline.missingCount, 2);
  assert.equal(timeline.complete, false);
  assert.equal(timeline.totalMs, null);
  assert.equal(timeline.deltaMs, null);
  assert.deepEqual(timeline.rows.map(({ startMs, endMs, pendingBefore }) => [startMs, endMs, pendingBefore]), [
    [0, 1200, 0], [1200, null, 0], [null, null, 1], [null, null, 1], [null, null, 2],
  ]);
  const complete = updateScene(updateScene(project, 's1', { durationMs: 100 }), 's3', { durationMs: 200 });
  assert.equal(deriveTimeline(complete).totalMs, 4300);
  assert.equal(deriveTimeline(complete).deltaMs, 300);
  assert.equal(deriveTimeline(updateProject(complete, { targetMs: 5000 })).deltaMs, -700);
  assert.equal(deriveTimeline(updateProject(complete, { targetMs: null })).deltaMs, null);
});

test('gravação agrupa em duas camadas por igualdade exata e mantém números narrativos', () => {
  const project = projectWith([
    { location: ' Mesa ', setup: 'Tripé', durationMs: 10 },
    { location: '', setup: '', durationMs: null },
    { location: 'Mesa', setup: 'Mão', durationMs: 20 },
    { location: 'mesa', setup: 'Tripé', durationMs: 30 },
    { location: 'Mesa', setup: 'Tripé', durationMs: 40 },
    { location: '', setup: 'Tripé', durationMs: 50 },
  ]);
  const before = serializeProject(project);
  const { groups, timeline } = deriveRecordingPlan(project);
  assert.deepEqual(groups.map((group) => group.location), ['Mesa', '', 'mesa']);
  assert.deepEqual(groups[0].setups.map((setup) => setup.setup), ['Tripé', 'Mão']);
  assert.deepEqual(groups[0].setups[0].rows.map((row) => row.number), [1, 5]);
  assert.deepEqual(groups[0].setups[1].rows.map((row) => row.number), [3]);
  assert.deepEqual(groups[1].setups.map((setup) => setup.setup), ['', 'Tripé']);
  assert.equal(groups[0].setups[0].rows[1], timeline.rows[4]);
  assert.equal(groups[0].setups[0].rows[1].startMs, null);
  assert.equal(serializeProject(project), before);
});

test('PNG exige data URL canônica, cabeçalho, dimensões e limites', () => {
  const reference = structuralPNG(800, 800);
  assert.equal(projectWith([{ reference }]).scenes[0].reference.width, 800);
  for (const changed of [
    { mime: 'image/jpeg' }, { name: '' }, { name: ' '.repeat(3) }, { name: 'x'.repeat(121) },
    { width: 0 }, { height: 801 }, { width: 1.5 }, { width: true },
    { dataUrl: reference.dataUrl.replace('image/png', 'image/PNG') },
    { dataUrl: `${reference.dataUrl}\n` }, { dataUrl: reference.dataUrl.replace('base64,', 'base64, ') },
    { dataUrl: 'data:image/png;base64,AAAA' },
  ]) rejectsCode(() => projectWith([{ reference: { ...reference, ...changed } }]));
  rejectsCode(() => projectWith([{ reference: { ...reference, width: 799 } }]), 'INVALID_PNG_DIMENSIONS');
  for (const [offset, value] of [[0, 0], [11, 12], [12, 0], [24, 7], [25, 1], [26, 1], [27, 1], [28, 2]]) {
    rejectsCode(() => projectWith([{ reference: mutatePNG(reference, offset, value) }]), 'INVALID_PNG');
  }
  const padded = structuralPNG(1, 1, 34);
  assert.ok(padded.dataUrl.endsWith('=='));
  // Mesmo conteúdo decodificado com bits extras de preenchimento: não é base64 canônica.
  const nonCanonical = `${padded.dataUrl.slice(0, -3)}B==`;
  rejectsCode(() => projectWith([{ reference: { ...padded, dataUrl: nonCanonical } }]), 'INVALID_BASE64');
  const max = structuralPNG(1, 1, LIMITS.maxImageBytes);
  assert.equal(projectWith([{ reference: max }]).scenes.length, 1);
  rejectsCode(() => projectWith([{ reference: structuralPNG(1, 1, LIMITS.maxImageBytes + 1) }]), 'LIMIT_IMAGE_BYTES');
});

test('quotas contam cada referência incorporada, inclusive cópias compartilhadas', () => {
  const maxReference = projectWith([{ reference: structuralPNG(1, 1, LIMITS.maxImageBytes) }]).scenes[0].reference;
  let project = projectWith(Array.from({ length: 12 }, () => ({ reference: maxReference })));
  assert.ok(Buffer.byteLength(serializeProject(project)) < LIMITS.maxProjectBytes);
  rejectsCode(() => duplicateScene(project, 's0', 'overflow'), 'LIMIT_TOTAL_IMAGE_BYTES');
  project = removeScene(project, 's1');
  assert.equal(duplicateScene(project, 's0', 'allowed').scenes.length, 12);
  const fullPixels = projectWith([{ reference: structuralPNG(800, 800) }]).scenes[0].reference;
  const eighteen = projectWith(Array.from({ length: 18 }, () => ({ reference: fullPixels })));
  assert.equal(eighteen.scenes.length, 18);
  rejectsCode(() => duplicateScene(eighteen, 's0', 'overflow'), 'LIMIT_TOTAL_PIXELS');
  rejectsCode(() => updateScene(addScene(eighteen, 'new'), 'new', { reference: fullPixels }), 'LIMIT_TOTAL_PIXELS');
});

test('editar texto em projeto confiável não serializa novamente a imagem incorporada', () => {
  const original = projectWith([{ reference: structuralPNG(1, 1, LIMITS.maxImageBytes) }]);
  const stringify = JSON.stringify;
  JSON.stringify = (value, ...args) => {
    if (value && typeof value === 'object' && ('scenes' in value || 'dataUrl' in value)) {
      assert.fail('A edição de texto não deve serializar o documento nem a referência inteira.');
    }
    if (typeof value === 'string' && value.length > 2000) {
      assert.fail('A edição de texto não deve codificar novamente uma data URL grande.');
    }
    return stringify(value, ...args);
  };
  try {
    const updated = updateScene(original, 's0', { notes: 'Nova nota' });
    const renamed = updateProject(updated, { title: 'Novo título' });
    assert.equal(renamed.scenes[0].reference, original.scenes[0].reference);
    assert.equal(renamed.scenes[0].notes, 'Nova nota');
    assert.equal(original.scenes[0].notes, '');
  } finally {
    JSON.stringify = stringify;
  }
});

test('parse mede UTF-8 antes de interpretar e falha sem alterar o documento anterior', () => {
  const project = projectWith([{ title: 'Trabalho anterior', durationMs: 100 }]);
  const before = serializeProject(project);
  rejectsCode(() => parseProject('não é JSON'), 'INVALID_JSON');
  rejectsCode(() => parseProject(null), 'INVALID_PROJECT_TEXT');
  const invalid = raw(project); invalid.scenes.push({ ...invalid.scenes[0] });
  rejectsCode(() => parseProject(JSON.stringify(invalid)), 'DUPLICATE_ID');
  const minimal = serializeProject(createProject());
  assert.equal(parseProject(`${minimal}${' '.repeat(LIMITS.maxProjectBytes - Buffer.byteLength(minimal))}`).title, 'Meu roteiro');
  rejectsCode(() => parseProject(`${minimal}${' '.repeat(LIMITS.maxProjectBytes - Buffer.byteLength(minimal) + 1)}`), 'LIMIT_PROJECT_BYTES');
  // A contagem é de bytes, não de unidades UTF-16; o conteúdo não precisa ser analisado.
  rejectsCode(() => parseProject('é'.repeat(Math.floor(LIMITS.maxProjectBytes / 2) + 1)), 'LIMIT_PROJECT_BYTES');
  assert.equal(serializeProject(project), before);
});

test('propriedade: parse/format preservam exatamente milissegundos em 4 horas', () => {
  let state = 0x51ced;
  for (let index = 0; index < 3000; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const ms = 1 + state % LIMITS.maxTargetMs;
    assert.equal(parseDuration(formatTime(ms), { maxMs: LIMITS.maxTargetMs }), ms);
    const seconds = Math.floor(ms / 1000);
    const decimal = `${seconds}.${String(ms % 1000).padStart(3, '0')}`;
    assert.equal(parseDuration(decimal, { maxMs: LIMITS.maxTargetMs }), ms);
  }
});

test('propriedade: tempos e agrupamento conservam toda cena e o mesmo número narrativo', () => {
  let state = 0xcafe;
  const random = (max) => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state % max;
  };
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const count = random(41);
    const scenes = Array.from({ length: count }, (_, index) => ({
      id: `r${index}`, durationMs: random(5) === 0 ? null : random(LIMITS.maxSceneMs) + 1,
      location: ['', 'Mesa', 'mesa', 'Exterior'][random(4)], setup: ['', 'Tripé', 'Mão'][random(3)],
    }));
    const project = projectWith(scenes, { targetMs: random(LIMITS.maxTargetMs) + 1 });
    const serialized = serializeProject(project);
    const { groups, timeline } = deriveRecordingPlan(project);
    const flattened = groups.flatMap((group) => group.setups.flatMap((setup) => setup.rows));
    assert.equal(flattened.length, count);
    assert.equal(new Set(flattened.map((row) => row.scene.id)).size, count);
    assert.deepEqual(flattened.map((row) => row.number).sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index + 1));
    assert.equal(timeline.knownMs, scenes.reduce((sum, scene) => sum + (scene.durationMs ?? 0), 0));
    assert.equal(timeline.missingCount, scenes.filter((scene) => scene.durationMs === null).length);
    let cursor = 0;
    let pending = 0;
    timeline.rows.forEach((row, index) => {
      assert.equal(row.scene.id, scenes[index].id);
      assert.equal(row.pendingBefore, pending);
      assert.equal(row.startMs, pending ? null : cursor);
      assert.equal(row.endMs, pending || row.scene.durationMs === null ? null : cursor + row.scene.durationMs);
      if (row.scene.durationMs === null) pending += 1;
      else cursor += row.scene.durationMs;
    });
    groups.forEach((group) => group.setups.forEach((setup) => setup.rows.forEach((row) => {
      assert.equal(row.scene.location, group.location);
      assert.equal(row.scene.setup, setup.setup);
      assert.equal(row, timeline.rows[row.number - 1]);
    })));
    assert.equal(serializeProject(parseProject(serialized)), serialized);
    assert.equal(serializeProject(project), serialized);
  }
});
