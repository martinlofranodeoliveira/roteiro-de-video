import { createProject, parseProject, serializeProject, formatTime, deriveTimeline, deriveRecordingPlan, LIMITS, ProjectError } from './model.mjs';
import { createController } from './controller.mjs';
import { editDraft } from './draft.mjs';
import { normalizeLocalFile, validateEmbeddedImages } from './image-io.mjs';
import { loadDemoProject } from './demo.mjs';
import { toMarkdown, toCSV, printMarkup } from './export.mjs';

const $ = id => document.getElementById(id);
const controller = createController();
const rows = new Map(), rulerCells = new Map();
let renderedProject = null, renderedSelection = null, dirty = false, isExample = false;
const sceneDraftErrors = new Map(), projectDraftErrors = new Map();
let preparedPrint = null, preparedMode = null;
const framing = { livre: 'Livre', aberto: 'Aberto', medio: 'Médio', close: 'Close', detalhe: 'Detalhe' };
const projectFields = ['project-title', 'project-objective', 'project-notes', 'project-aspect', 'project-target'];
const sceneFields = ['scene-title', 'scene-visual', 'scene-audio', 'scene-duration', 'scene-framing', 'scene-location', 'scene-setup', 'scene-notes'];

function notify(text, error = false) {
  $('notice').textContent = text;
  $('notice').hidden = !text;
  $('notice').classList.toggle('is-error', error);
}
function errorMessage(error) {
  return error instanceof ProjectError ? error.message : 'Não foi possível concluir. O roteiro atual foi preservado; tente novamente.';
}
function attempt(action) {
  try { return action(); }
  catch (error) { notify(errorMessage(error), true); return undefined; }
}
async function attemptAsync(action) {
  try { return await action(); }
  catch (error) { notify(errorMessage(error), true); return undefined; }
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name); svg.append(use);
  return svg;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function newId() { return 'cena-' + crypto.randomUUID(); }
function sourceLabel() { $('source-label').textContent = isExample ? 'Exemplo fictício' : dirty ? 'Rascunho alterado' : 'Rascunho local'; }
function meaningful(project) {
  return project.scenes.length > 0 || project.title !== 'Meu roteiro' || project.aspectRatio !== '16:9' || Boolean(project.objective || project.notes || project.targetMs);
}
async function confirmReplace() {
  controller.requireReady();
  if (!meaningful(controller.snapshot().project)) return true;
  const dialog = $('replace-dialog');
  dialog.returnValue = 'cancel';
  return await new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'replace'), { once: true });
    dialog.showModal();
  });
}
$('cancel-replace').addEventListener('click', () => $('replace-dialog').close('cancel'));
$('confirm-replace').addEventListener('click', () => $('replace-dialog').close('replace'));
function secondsInput(value) {
  if (value === null) return '';
  const whole = Math.floor(value / 1000), remainder = value % 1000;
  return String(whole) + (remainder ? ',' + String(remainder).padStart(3, '0').replace(/0+$/, '') : '');
}
function fillProject(project) {
  projectDraftErrors.clear();
  $('project-title').value = project.title;
  $('project-objective').value = project.objective;
  $('project-notes').value = project.notes;
  $('project-aspect').value = project.aspectRatio;
  $('project-target').value = project.targetMs === null ? '' : formatTime(project.targetMs);
}
function fillEditor(scene) {
  sceneDraftErrors.clear();
  if (!scene) { for (const id of sceneFields) $(id).value = id === 'scene-framing' ? 'livre' : ''; return; }
  $('scene-title').value = scene.title;
  $('scene-visual').value = scene.visual;
  $('scene-audio').value = scene.audio;
  $('scene-duration').value = secondsInput(scene.durationMs);
  $('scene-framing').value = scene.framing;
  $('scene-location').value = scene.location;
  $('scene-setup').value = scene.setup;
  $('scene-notes').value = scene.notes;
}
function displayReference(scene) {
  const reference = scene?.reference;
  const image = $('reference-preview');
  if (reference) {
    if (image.getAttribute('src') !== reference.dataUrl) image.src = reference.dataUrl;
    image.alt = 'Referência da cena: ' + reference.name;
  } else { image.removeAttribute('src'); image.alt = ''; }
  image.hidden = !reference;
  $('reference-placeholder').hidden = Boolean(reference);
  $('remove-reference').hidden = !reference;
  $('choose-reference').textContent = reference ? 'Trocar referência' : 'Adicionar imagem';
}
function createRow(id) {
  const button = element('button', 'scene-row'); button.type = 'button'; button.dataset.sceneId = id;
  const number = element('span', 'scene-number');
  const thumb = element('span', 'scene-thumb');
  const copy = element('span', 'scene-copy');
  const title = element('strong'), snippet = element('span', 'scene-snippet'), place = element('span', 'scene-place');
  copy.append(title, snippet, place);
  const time = element('span', 'scene-time'), duration = element('span'), from = element('small'); time.append(duration, from);
  button.append(number, thumb, copy, time);
  button.addEventListener('click', () => chooseScene(id));
  return { button, number, thumb, title, snippet, place, time, duration, from, reference: undefined };
}
function updateRow(row, selectedId) {
  const { scene, number, startMs } = row;
  let ui = rows.get(scene.id);
  if (!ui) { ui = createRow(scene.id); rows.set(scene.id, ui); }
  ui.number.textContent = String(number).padStart(2, '0');
  ui.title.textContent = scene.title || 'Cena sem título';
  ui.snippet.textContent = scene.visual || scene.audio || 'Descreva o que aparece e o que se ouve.';
  ui.place.textContent = (scene.location || 'Local a definir') + ' · ' + framing[scene.framing];
  ui.duration.textContent = scene.durationMs === null ? 'Pendente' : formatTime(scene.durationMs);
  ui.from.textContent = startMs === null ? 'Início indef.' : 'De ' + formatTime(startMs);
  ui.time.classList.toggle('is-pending', scene.durationMs === null);
  ui.button.setAttribute('aria-pressed', String(scene.id === selectedId));
  ui.button.setAttribute('aria-label', `Cena ${number}: ${scene.title || 'sem título'}, ${scene.durationMs === null ? 'duração pendente' : formatTime(scene.durationMs)}`);
  if (ui.reference !== scene.reference) {
    ui.thumb.replaceChildren();
    if (scene.reference) { const image = element('img'); image.src = scene.reference.dataUrl; image.alt = ''; image.width = 100; image.height = 68; ui.thumb.append(image); }
    else ui.thumb.append(icon('image'));
    ui.reference = scene.reference;
  }
  return ui.button;
}
function renderRuler(timeline, selectedId) {
  const fragment = document.createDocumentFragment();
  const active = document.activeElement;
  const focusId = active?.parentElement === $('time-ruler') ? active.dataset.sceneId : null;
  const valid = new Set(timeline.rows.map(row => row.scene.id));
  for (const [id] of rulerCells) if (!valid.has(id)) rulerCells.delete(id);
  for (const row of timeline.rows) {
    const { scene } = row;
    let cell = rulerCells.get(scene.id);
    if (!cell) {
      const button = element('button', 'ruler-cell'); button.type = 'button'; button.dataset.sceneId = scene.id;
      const number = element('strong'), times = element('span'), duration = element('small');
      button.append(number, times, duration); button.addEventListener('click', () => chooseScene(scene.id));
      cell = { button, number, times, duration }; rulerCells.set(scene.id, cell);
    }
    cell.number.textContent = String(row.number).padStart(2, '0');
    cell.times.textContent = formatTime(row.startMs) + ' → ' + formatTime(row.endMs);
    cell.duration.textContent = scene.durationMs === null ? 'Duração pendente' : formatTime(scene.durationMs) + ' no vídeo';
    cell.button.classList.toggle('is-pending', scene.durationMs === null);
    cell.button.setAttribute('aria-current', String(scene.id === selectedId));
    cell.button.setAttribute('aria-label', `Editar cena ${row.number}: ${scene.title || 'sem título'}`);
    fragment.append(cell.button);
  }
  $('time-ruler').replaceChildren(fragment);
  if (focusId) rulerCells.get(focusId)?.button.focus({ preventScroll: true });
}
function renderList(state, timeline) {
  const fragment = document.createDocumentFragment();
  const focusId = document.activeElement?.classList.contains('scene-row') ? document.activeElement.dataset.sceneId : null;
  const ids = new Set(timeline.rows.map(row => row.scene.id));
  for (const [id] of rows) if (!ids.has(id)) rows.delete(id);
  if (state.mode === 'narrative') for (const row of timeline.rows) fragment.append(updateRow(row, state.selectedId));
  else {
    for (const group of deriveRecordingPlan(state.project).groups) {
      fragment.append(element('h3', 'location-heading', group.location || 'Local a definir'));
      for (const setup of group.setups) {
        fragment.append(element('h4', 'setup-heading', setup.setup || 'Preparação a definir'));
        for (const row of setup.rows) fragment.append(updateRow(row, state.selectedId));
      }
    }
  }
  $('scene-list').replaceChildren(fragment);
  if (focusId) rows.get(focusId)?.button.focus({ preventScroll: true });
}
function render(state) {
  const { project, selectedId, mode } = state;
  const changed = project !== renderedProject;
  if (changed) { dirty = true; isExample = false; preparedPrint = null; $('print-root').replaceChildren(); }
  const timeline = deriveTimeline(project), scene = project.scenes.find(item => item.id === selectedId);
  const index = project.scenes.findIndex(item => item.id === selectedId);
  $('time-summary').textContent = timeline.complete ? `Duração prevista ${formatTime(timeline.totalMs)}` : project.scenes.length ? `${formatTime(timeline.knownMs)} definidos · total pendente` : 'Adicione cenas para planejar a duração.';
  $('target-summary').textContent = project.targetMs === null ? 'Sem meta de duração' : `Meta ${formatTime(project.targetMs)}` + (timeline.deltaMs === null ? '' : timeline.deltaMs === 0 ? ' · duração atingida' : timeline.deltaMs > 0 ? ` · ${formatTime(timeline.deltaMs)} acima` : ` · ${formatTime(-timeline.deltaMs)} disponíveis`);
  $('pending-summary').textContent = timeline.missingCount ? `${timeline.missingCount} ${timeline.missingCount === 1 ? 'cena sem duração' : 'cenas sem duração'}. Os tempos posteriores à primeira pendência ficam indefinidos.` : project.scenes.length ? 'Tempos informados por você; a faixa organiza cenas e não reproduz vídeo.' : 'Defina a duração agora ou deixe-a pendente.';
  $('pending-summary').classList.toggle('has-pending', timeline.missingCount > 0);
  renderRuler(timeline, selectedId); renderList(state, timeline);
  $('scene-count').textContent = project.scenes.length + (project.scenes.length === 1 ? ' cena' : ' cenas');
  $('sequence-title').textContent = mode === 'narrative' ? 'A ordem da história' : 'O plano de gravação';
  $('view-description').textContent = mode === 'narrative' ? 'As cenas seguem a ordem em que aparecem no vídeo.' : 'Locais e preparações iguais ficam juntos. O número continua sendo o da história.';
  $('view-narrative').setAttribute('aria-selected', String(mode === 'narrative'));
  $('view-recording').setAttribute('aria-selected', String(mode === 'recording'));
  $('view-narrative').tabIndex = mode === 'narrative' ? 0 : -1;
  $('view-recording').tabIndex = mode === 'recording' ? 0 : -1;
  $('scene-list').setAttribute('aria-labelledby', mode === 'narrative' ? 'view-narrative' : 'view-recording');
  $('empty-state').hidden = project.scenes.length !== 0;
  $('scene-list').hidden = project.scenes.length === 0;
  $('scene-fields').disabled = !scene;
  $('editor-empty').hidden = Boolean(scene);
  $('scene-fields').hidden = !scene;
  $('editor-title').textContent = scene ? 'Editar cena ' + String(index + 1).padStart(2, '0') : 'Escolha uma cena';
  $('move-up').disabled = !scene || index === 0;
  $('move-down').disabled = !scene || index === project.scenes.length - 1;
  $('add-scene').disabled = project.scenes.length >= LIMITS.maxScenes;
  $('duplicate-scene').disabled = project.scenes.length >= LIMITS.maxScenes;
  $('undo-remove').hidden = !state.canUndo;
  for (const id of ['open-project', 'choose-reference', 'load-example', 'load-example-empty']) $(id).disabled = state.busy || (id === 'choose-reference' && !scene);
  if (selectedId !== renderedSelection) fillEditor(scene);
  displayReference(scene);
  for (const [key, id, errors] of [['project', 'project-error', projectDraftErrors], ['scene', 'scene-error', sceneDraftErrors]]) {
    $(id).textContent = state.issues[key] || ''; $(id).hidden = !state.issues[key];
    for (const field of key === 'project' ? projectFields : sceneFields) $(field).removeAttribute('aria-invalid');
    const invalidField = errors.keys().next().value;
    if (state.issues[key] && invalidField) $(invalidField).setAttribute('aria-invalid', 'true');
  }
  if (changed) {
    for (const [id, key] of [['locations', 'location'], ['setups', 'setup']]) {
      const values = [...new Set(project.scenes.map(item => item[key]).filter(Boolean))];
      $(id).replaceChildren(...values.map(value => { const option = element('option'); option.value = value; return option; }));
    }
  }
  sourceLabel(); renderedProject = project; renderedSelection = selectedId;
}
controller.subscribe(render);
fillProject(controller.snapshot().project); render(controller.snapshot()); dirty = false; sourceLabel();

function editProject(event) {
  if (editDraft(controller, 'project', event.target.id, event.target.value, projectDraftErrors) && !sceneDraftErrors.size && $('notice').classList.contains('is-error')) notify('');
}
function editScene(event) {
  if (editDraft(controller, 'scene', event.target.id, event.target.value, sceneDraftErrors) && !projectDraftErrors.size && $('notice').classList.contains('is-error')) notify('');
}
for (const id of projectFields) $(id).addEventListener('input', editProject);
for (const id of sceneFields) $(id).addEventListener('input', editScene);
function chooseScene(id) {
  attempt(() => {
    controller.select(id);
    if (matchMedia('(max-width:760px)').matches) $('editor').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  });
}
function add() { attempt(() => { controller.add(newId()); $('scene-title').focus(); notify('Cena adicionada. Preencha a ação, o áudio e a duração prevista.'); }); }
$('add-scene').addEventListener('click', add); $('add-first').addEventListener('click', add);
$('move-up').addEventListener('click', () => attempt(() => controller.move(-1)));
$('move-down').addEventListener('click', () => attempt(() => controller.move(1)));
$('duplicate-scene').addEventListener('click', () => attempt(() => { controller.duplicate(newId()); notify('Cena duplicada após a original.'); }));
$('remove-scene').addEventListener('click', () => attempt(() => { controller.remove(); notify('Cena removida. Você pode desfazer até a próxima alteração.'); }));
$('undo-remove').addEventListener('click', () => attempt(() => { controller.undoRemove(); notify('Cena restaurada.'); }));
for (const mode of ['narrative', 'recording']) $('view-' + mode).addEventListener('click', () => attempt(() => controller.setMode(mode)));
document.querySelector('.view-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const mode = ['ArrowLeft', 'Home'].includes(event.key) ? 'narrative' : 'recording';
  attempt(() => { controller.setMode(mode); $('view-' + mode).focus(); });
});
$('new-project').addEventListener('click', () => attemptAsync(async () => {
  if (!(await confirmReplace())) return;
  controller.replace(createProject()); fillProject(controller.snapshot().project); notify('Novo roteiro. Adicione a primeira cena para começar.');
}));
async function example({ initial = false } = {}) {
  if (!initial && !(await confirmReplace())) return;
  notify('Preparando o exemplo fictício e suas seis referências…');
  await controller.replaceAsync(loadDemoProject);
  fillProject(controller.snapshot().project); fillEditor(controller.snapshot().project.scenes.find(scene => scene.id === controller.snapshot().selectedId)); isExample = true; dirty = false; sourceLabel();
  notify(initial ? '' : 'Exemplo fictício carregado. Você pode adaptá-lo ou começar um roteiro vazio.');
}
for (const id of ['load-example', 'load-example-empty']) $(id).addEventListener('click', () => attemptAsync(() => example()));
$('open-project').addEventListener('click', () => attempt(() => { controller.requireReady(); $('project-file').click(); }));
$('project-file').addEventListener('change', () => {
  const file = $('project-file').files?.[0]; $('project-file').value = '';
  if (!file) return;
  attemptAsync(async () => {
    if (!(await confirmReplace())) return;
    notify('Conferindo o JSON e as referências…');
    await controller.replaceAsync(async () => {
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > LIMITS.maxProjectBytes) throw new ProjectError('FILE_SIZE', 'O JSON deve ter conteúdo e no máximo 18 MiB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length !== file.size || (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191)) throw new ProjectError('FILE_ENCODING', 'Use um JSON completo em UTF-8 sem BOM.');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new ProjectError('FILE_ENCODING', 'Use um JSON em UTF-8 sem bytes inválidos.'); }
      return await validateEmbeddedImages(parseProject(text));
    });
    fillProject(controller.snapshot().project); fillEditor(controller.snapshot().project.scenes.find(scene => scene.id === controller.snapshot().selectedId)); dirty = false; isExample = false; sourceLabel(); notify('Projeto aberto. O arquivo de origem foi preservado.');
  });
});
$('choose-reference').addEventListener('click', () => attempt(() => { controller.requireReady(); $('reference-file').click(); }));
$('reference-file').addEventListener('change', () => {
  const file = $('reference-file').files?.[0]; $('reference-file').value = '';
  if (!file) return;
  attemptAsync(async () => { notify('Preparando a referência…'); await controller.referenceAsync(() => normalizeLocalFile(file)); notify('Referência incorporada ao roteiro. Ela seguirá junto no JSON.'); });
});
$('remove-reference').addEventListener('click', () => attempt(() => { controller.requireReady(); controller.editScene({ reference: null }); notify('Referência retirada desta cena.'); }));
function download(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function closeExport() { $('export-menu').open = false; $('export-menu').querySelector('summary').focus(); }
$('save-project').addEventListener('click', () => attempt(() => {
  controller.requireReady(); download(serializeProject(controller.snapshot().project), 'roteiro-de-video.json', 'application/json;charset=utf-8');
  dirty = false; sourceLabel(); notify('JSON gerado. Confira o download antes de fechar esta página.');
}));
for (const [id, format, suffix, mime] of [['export-markdown', toMarkdown, 'md', 'text/markdown;charset=utf-8'], ['export-csv', toCSV, 'csv', 'text/csv;charset=utf-8']]) {
  $(id).addEventListener('click', () => attempt(() => {
    controller.requireReady(); const { project, mode } = controller.snapshot();
    download(format(project, { mode }), 'roteiro-' + (mode === 'recording' ? 'gravacao' : 'sequencia') + '.' + suffix, mime);
    closeExport(); notify('Plano exportado. Para guardar também as imagens, baixe o projeto JSON.');
  }));
}
function buildPrint() {
  controller.requireReady(); const { project, mode } = controller.snapshot();
  if (preparedPrint !== project || preparedMode !== mode) {
    $('print-root').innerHTML = printMarkup(project, { mode }); preparedPrint = project; preparedMode = mode;
  }
}
$('print-plan').addEventListener('click', () => attemptAsync(async () => {
  buildPrint(); closeExport();
  for (const image of $('print-root').querySelectorAll('img')) await image.decode();
  window.print();
}));
window.addEventListener('beforeprint', () => {
  try { buildPrint(); }
  catch { $('print-root').textContent = 'Corrija os campos destacados no roteiro antes de imprimir.'; preparedPrint = null; }
});
window.addEventListener('beforeunload', event => {
  if (Object.keys(controller.snapshot().issues).length || (dirty && meaningful(controller.snapshot().project))) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('project-details').open = false; $('export-menu').open = false; } });
attemptAsync(() => example({ initial: true }));
