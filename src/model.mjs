/** Núcleo original do Roteiro de Vídeo. Licença MIT. Sem DOM, armazenamento ou rede. */

export const LIMITS = Object.freeze({
  maxScenes: 40,
  maxSceneMs: 3_600_000,
  maxTargetMs: 14_400_000,
  maxTimelineMs: 144_000_000,
  maxSourceBytes: 8_388_608,
  maxSourcePixels: 16_000_000,
  maxImageSide: 800,
  maxImageBytes: 1_048_576,
  maxImagePixels: 640_000,
  maxTotalImageBytes: 12_582_912,
  maxTotalPixels: 12_000_000,
  maxProjectBytes: 18_874_368,
});

export class ProjectError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
  }
}

const PROJECT_KEYS = ['schemaVersion', 'title', 'objective', 'notes', 'aspectRatio', 'targetMs', 'scenes'];
const SCENE_KEYS = ['id', 'title', 'visual', 'audio', 'location', 'setup', 'framing', 'durationMs', 'notes', 'reference'];
const REFERENCE_KEYS = ['name', 'mime', 'dataUrl', 'width', 'height'];
const PROJECT_PATCH_KEYS = PROJECT_KEYS.filter((key) => !['schemaVersion', 'scenes'].includes(key));
const SCENE_PATCH_KEYS = SCENE_KEYS.filter((key) => key !== 'id');
const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);
const FRAMINGS = new Set(['aberto', 'medio', 'close', 'detalhe', 'livre']);
const PNG_PREFIX = 'data:image/png;base64,';
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const encoder = new TextEncoder();

// A confiança vem exclusivamente desta validação, nunca de Object.isFrozen externo.
const trustedProjects = new WeakSet();
const trustedScenes = new WeakSet();
const trustedReferences = new WeakSet();
const projectStats = new WeakMap();
const sceneStats = new WeakMap();
const referenceStats = new WeakMap();

function fail(code, message) {
  throw new ProjectError(code, message);
}

function record(value, keys, label, { patch = false } = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail('INVALID_OBJECT', `${label} deve ser um objeto simples.`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if ((!patch && ownKeys.length !== keys.length)
    || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    fail('INVALID_KEYS', `${label} contém campos ausentes ou não permitidos.`);
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_OBJECT', `${label} deve conter somente dados JSON.`);
    }
  }
  return value;
}

function sceneArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('INVALID_SCENES', 'A lista de cenas deve ser um array.');
  }
  if (value.length > LIMITS.maxScenes) {
    fail('LIMIT_SCENES', `O projeto permite até ${LIMITS.maxScenes} cenas.`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1) {
    fail('INVALID_SCENES', 'A lista de cenas não pode conter lacunas ou campos extras.');
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('INVALID_SCENES', 'A lista de cenas deve conter somente dados JSON, sem lacunas.');
    }
  }
  return value;
}

function textField(value, maxLength, label, { required = false, trim = false } = {}) {
  if (typeof value !== 'string') fail('INVALID_TEXT', `${label} deve ser texto.`);
  // Limites em unidades UTF-16, iguais a maxlength nos campos do navegador.
  if (value.length > maxLength) fail('LIMIT_TEXT', `${label} excede ${maxLength} caracteres.`);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code < 32 && ![9, 10, 13].includes(code)) || code === 127 || code === 0xfffe || code === 0xffff) {
      fail('INVALID_TEXT', `${label} contém um caractere não permitido.`);
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('INVALID_TEXT', `${label} contém Unicode malformado.`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail('INVALID_TEXT', `${label} contém Unicode malformado.`);
    }
  }
  if (required && value.trim().length === 0) fail('REQUIRED_TEXT', `${label} não pode ficar vazio.`);
  return trim ? value.trim() : value;
}

function enumField(value, values, label) {
  if (!values.has(value)) fail('INVALID_ENUM', `${label} não é uma opção válida.`);
  return value;
}

function boundedInteger(value, max, label, { nullable = false, zero = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1) || value > max) {
    fail('INVALID_INTEGER', `${label} deve ser um inteiro ${zero ? 'não negativo' : 'positivo'} até ${max}.`);
  }
  return value;
}

function sceneId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    fail('INVALID_ID', 'O identificador da cena deve ter de 1 a 64 letras ASCII, números, hífen ou sublinhado.');
  }
  return value;
}

const jsonBytes = (value) => encoder.encode(JSON.stringify(value)).length;

// Tamanho exato da formatação JSON de dois espaços, sem construir imagens novamente.
function objectBytes(entries, depth) {
  if (entries.length === 0) return 2;
  return 2 + entries.reduce((sum, [key, size]) => sum + 2 * (depth + 1) + jsonBytes(key) + 2 + size, 0)
    + (entries.length - 1) * 2 + 1 + 2 * depth + 1;
}

function arrayBytes(sizes, depth) {
  if (sizes.length === 0) return 2;
  return 2 + sizes.reduce((sum, size) => sum + 2 * (depth + 1) + size, 0)
    + (sizes.length - 1) * 2 + 1 + 2 * depth + 1;
}

function pngHeader(encoded) {
  const bytes = new Uint8Array(33);
  let offset = 0;
  for (let index = 0; offset < bytes.length; index += 4) {
    const a = BASE64.indexOf(encoded[index]);
    const b = BASE64.indexOf(encoded[index + 1]);
    const c = BASE64.indexOf(encoded[index + 2]);
    const d = BASE64.indexOf(encoded[index + 3]);
    const bits = a * 262144 + b * 4096 + c * 64 + d;
    bytes[offset++] = Math.floor(bits / 65536);
    if (offset < bytes.length) bytes[offset++] = Math.floor(bits / 256) % 256;
    if (offset < bytes.length) bytes[offset++] = bits % 256;
  }
  return bytes;
}

function uint32(bytes, offset) {
  return bytes[offset] * 16777216 + bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
}

function validateReference(value) {
  if (value === null) return null;
  if (trustedReferences.has(value)) return value;
  record(value, REFERENCE_KEYS, 'A referência');
  const name = textField(value.name, 120, 'O nome da referência', { required: true });
  if (value.mime !== 'image/png') fail('INVALID_REFERENCE', 'A referência deve estar normalizada como PNG.');
  const width = boundedInteger(value.width, LIMITS.maxImageSide, 'A largura da referência');
  const height = boundedInteger(value.height, LIMITS.maxImageSide, 'A altura da referência');
  const pixels = width * height;
  if (pixels > LIMITS.maxImagePixels) fail('LIMIT_IMAGE_PIXELS', 'A referência excede o limite de pixels.');
  if (typeof value.dataUrl !== 'string' || !value.dataUrl.startsWith(PNG_PREFIX)) {
    fail('INVALID_REFERENCE', 'A referência deve usar uma data URL PNG base64 canônica.');
  }
  const encoded = value.dataUrl.slice(PNG_PREFIX.length);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const bytes = encoded.length / 4 * 3 - padding;
  if (bytes > LIMITS.maxImageBytes) fail('LIMIT_IMAGE_BYTES', 'A referência excede 1 MiB.');
  if (encoded.length % 4 !== 0 || bytes < 33 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    || (padding === 2 && BASE64.indexOf(encoded.at(-3)) % 16 !== 0)
    || (padding === 1 && BASE64.indexOf(encoded.at(-2)) % 4 !== 0)) {
    fail('INVALID_BASE64', 'A referência contém base64 inválida ou não canônica.');
  }
  const header = pngHeader(encoded);
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
    || uint32(header, 8) !== 13 || String.fromCharCode(...header.slice(12, 16)) !== 'IHDR') {
    fail('INVALID_PNG', 'A referência não possui assinatura e cabeçalho IHDR PNG válidos.');
  }
  if (uint32(header, 16) !== width || uint32(header, 20) !== height) {
    fail('INVALID_PNG_DIMENSIONS', 'As dimensões declaradas não correspondem ao cabeçalho PNG.');
  }
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!depths[header[25]]?.includes(header[24]) || header[26] !== 0 || header[27] !== 0 || header[28] > 1) {
    fail('INVALID_PNG', 'A referência possui parâmetros IHDR PNG inválidos.');
  }
  // A checagem acima é estrutural. A aplicação ainda precisa decodificar os pixels.
  const reference = Object.freeze({ name, mime: 'image/png', dataUrl: value.dataUrl, width, height });
  const size = objectBytes(REFERENCE_KEYS.map((key) => [key, jsonBytes(reference[key])]), 3);
  referenceStats.set(reference, { bytes, pixels, size });
  trustedReferences.add(reference);
  return reference;
}

function projectField(key, value) {
  switch (key) {
    case 'title': return textField(value, 120, 'O título do projeto', { required: true });
    case 'objective': return textField(value, 2000, 'O objetivo');
    case 'notes': return textField(value, 2000, 'As notas do projeto');
    case 'aspectRatio': return enumField(value, ASPECT_RATIOS, 'A orientação');
    case 'targetMs': return boundedInteger(value, LIMITS.maxTargetMs, 'A meta', { nullable: true });
    default: fail('INVALID_KEYS', 'O campo do projeto não é permitido.');
  }
}

function sceneField(key, value) {
  switch (key) {
    case 'id': return sceneId(value);
    case 'title': return textField(value, 120, 'O título da cena');
    case 'visual': return textField(value, 2000, 'A imagem e ação');
    case 'audio': return textField(value, 2000, 'O áudio');
    case 'location': return textField(value, 120, 'O local', { trim: true });
    case 'setup': return textField(value, 120, 'A preparação', { trim: true });
    case 'framing': return enumField(value, FRAMINGS, 'O enquadramento');
    case 'durationMs': return boundedInteger(value, LIMITS.maxSceneMs, 'A duração', { nullable: true });
    case 'notes': return textField(value, 2000, 'As observações da cena');
    case 'reference': return validateReference(value);
    default: fail('INVALID_KEYS', 'O campo da cena não é permitido.');
  }
}

function sealScene(fields) {
  const scene = Object.freeze(Object.fromEntries(SCENE_KEYS.map((key) => [key, fields[key]])));
  const reference = scene.reference === null ? { bytes: 0, pixels: 0 } : referenceStats.get(scene.reference);
  const size = objectBytes(SCENE_KEYS.map((key) => [key,
    key === 'reference' && scene.reference !== null ? reference.size : jsonBytes(scene[key])]), 2);
  sceneStats.set(scene, { bytes: reference.bytes, pixels: reference.pixels, size });
  trustedScenes.add(scene);
  return scene;
}

function validateScene(value) {
  if (trustedScenes.has(value)) return value;
  record(value, SCENE_KEYS, 'A cena');
  return sealScene(Object.fromEntries(SCENE_KEYS.map((key) => [key, sceneField(key, value[key])])));
}

function sealProject(fields, scenes) {
  let bytes = 0;
  let pixels = 0;
  let knownMs = 0;
  const sizes = [];
  for (const scene of scenes) {
    const stats = sceneStats.get(scene);
    bytes += stats.bytes;
    pixels += stats.pixels;
    knownMs += scene.durationMs ?? 0;
    sizes.push(stats.size);
  }
  if (bytes > LIMITS.maxTotalImageBytes) fail('LIMIT_TOTAL_IMAGE_BYTES', 'As referências excedem o total de 12 MiB.');
  if (pixels > LIMITS.maxTotalPixels) fail('LIMIT_TOTAL_PIXELS', 'As referências excedem o total de 12 milhões de pixels.');
  if (knownMs > LIMITS.maxTimelineMs) fail('LIMIT_TIMELINE', 'A duração conhecida excede o limite estrutural de 40 horas.');
  const sceneList = Object.freeze([...scenes]);
  const project = Object.freeze({
    schemaVersion: 1,
    title: fields.title,
    objective: fields.objective,
    notes: fields.notes,
    aspectRatio: fields.aspectRatio,
    targetMs: fields.targetMs,
    scenes: sceneList,
  });
  const size = objectBytes(PROJECT_KEYS.map((key) => [key,
    key === 'scenes' ? arrayBytes(sizes, 1) : jsonBytes(project[key])]), 0) + 1;
  if (size > LIMITS.maxProjectBytes) fail('LIMIT_PROJECT_BYTES', 'O JSON do projeto excede 18 MiB.');
  projectStats.set(project, { bytes, pixels, size });
  trustedProjects.add(project);
  return project;
}

export function validateProject(value) {
  if (trustedProjects.has(value)) return value;
  record(value, PROJECT_KEYS, 'O projeto');
  if (value.schemaVersion !== 1) fail('SCHEMA_VERSION', 'Esta versão do documento não é suportada.');
  const fields = Object.fromEntries(PROJECT_PATCH_KEYS.map((key) => [key, projectField(key, value[key])]));
  const scenes = sceneArray(value.scenes).map(validateScene);
  const ids = new Set();
  for (const scene of scenes) {
    if (ids.has(scene.id)) fail('DUPLICATE_ID', 'O projeto contém identificadores de cena repetidos.');
    ids.add(scene.id);
  }
  return sealProject(fields, scenes);
}

export function parseProject(text) {
  if (typeof text !== 'string') fail('INVALID_PROJECT_TEXT', 'O arquivo JSON deve ser texto.');
  if (encoder.encode(text).length > LIMITS.maxProjectBytes) fail('LIMIT_PROJECT_BYTES', 'O arquivo JSON excede 18 MiB.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail('INVALID_JSON', 'O arquivo não contém um JSON válido.');
  }
  return validateProject(value);
}

export function serializeProject(value) {
  const project = validateProject(value);
  if (projectStats.get(project).size > LIMITS.maxProjectBytes) fail('LIMIT_PROJECT_BYTES', 'O JSON do projeto excede 18 MiB.');
  const text = `${JSON.stringify(project, null, 2)}\n`;
  if (encoder.encode(text).length > LIMITS.maxProjectBytes) fail('LIMIT_PROJECT_BYTES', 'O JSON do projeto excede 18 MiB.');
  return text;
}

export function createProject() {
  return sealProject({ title: 'Meu roteiro', objective: '', notes: '', aspectRatio: '16:9', targetMs: null }, []);
}

export function createScene(id) {
  return sealScene({
    id: sceneId(id), title: '', visual: '', audio: '', location: '', setup: '', framing: 'livre', durationMs: null,
    notes: '', reference: null,
  });
}

export function updateProject(value, patch) {
  const project = validateProject(value);
  record(patch, PROJECT_PATCH_KEYS, 'A alteração do projeto', { patch: true });
  const fields = { ...project };
  for (const key of Object.keys(patch)) fields[key] = projectField(key, patch[key]);
  if (Object.keys(patch).every((key) => fields[key] === project[key])) return project;
  return sealProject(fields, project.scenes);
}

function findScene(project, id) {
  sceneId(id);
  const index = project.scenes.findIndex((scene) => scene.id === id);
  if (index === -1) fail('SCENE_NOT_FOUND', 'A cena não foi encontrada no projeto.');
  return index;
}

function requireCapacity(project) {
  if (project.scenes.length >= LIMITS.maxScenes) fail('LIMIT_SCENES', `O projeto permite até ${LIMITS.maxScenes} cenas.`);
}

function requireNewId(project, id) {
  sceneId(id);
  if (project.scenes.some((scene) => scene.id === id)) fail('DUPLICATE_ID', 'Já existe uma cena com este identificador.');
}

export function addScene(value, id, afterId = null) {
  const project = validateProject(value);
  requireCapacity(project);
  requireNewId(project, id);
  const index = afterId === null ? project.scenes.length : findScene(project, afterId) + 1;
  const scenes = [...project.scenes];
  scenes.splice(index, 0, createScene(id));
  return sealProject(project, scenes);
}

export function updateScene(value, id, patch) {
  const project = validateProject(value);
  const index = findScene(project, id);
  record(patch, SCENE_PATCH_KEYS, 'A alteração da cena', { patch: true });
  const scene = project.scenes[index];
  const fields = { ...scene };
  for (const key of Object.keys(patch)) fields[key] = sceneField(key, patch[key]);
  if (Object.keys(patch).every((key) => fields[key] === scene[key])) return project;
  const scenes = [...project.scenes];
  scenes[index] = sealScene(fields);
  return sealProject(project, scenes);
}

export function moveScene(value, id, delta) {
  const project = validateProject(value);
  const index = findScene(project, id);
  if (delta !== -1 && delta !== 1) fail('INVALID_DELTA', 'O deslocamento deve ser -1 ou 1.');
  const next = index + delta;
  if (next < 0 || next >= project.scenes.length) return project;
  const scenes = [...project.scenes];
  [scenes[index], scenes[next]] = [scenes[next], scenes[index]];
  return sealProject(project, scenes);
}

export function duplicateScene(value, id, newId) {
  const project = validateProject(value);
  const index = findScene(project, id);
  requireCapacity(project);
  requireNewId(project, newId);
  const copy = sealScene({ ...project.scenes[index], id: newId });
  const scenes = [...project.scenes];
  scenes.splice(index + 1, 0, copy);
  return sealProject(project, scenes);
}

export function removeScene(value, id) {
  const project = validateProject(value);
  const index = findScene(project, id);
  return sealProject(project, project.scenes.filter((_, sceneIndex) => sceneIndex !== index));
}

export function parseDuration(text, { maxMs = LIMITS.maxSceneMs } = {}) {
  if (typeof text !== 'string') fail('INVALID_DURATION', 'A duração deve ser informada como texto.');
  boundedInteger(maxMs, LIMITS.maxTargetMs, 'O limite de duração');
  const token = text.trim();
  if (token === '') return null;
  let seconds;
  let fraction;
  const plain = /^(\d{1,7})(?:[.,](\d{1,3}))?$/.exec(token);
  if (plain) {
    seconds = Number(plain[1]);
    fraction = plain[2];
  } else {
    const clock = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?(?:[.,](\d{1,3}))?$/.exec(token);
    if (!clock) fail('INVALID_DURATION', 'Use segundos, MM:SS ou HH:MM:SS, com até três casas decimais.');
    seconds = clock[3] === undefined
      ? Number(clock[1]) * 60 + Number(clock[2])
      : Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    fraction = clock[4];
  }
  const ms = seconds * 1000 + (fraction ? Number(fraction.padEnd(3, '0')) : 0);
  if (ms < 1 || ms > maxMs) fail('INVALID_DURATION', `A duração deve estar entre 1 ms e ${formatTime(maxMs)}.`);
  return ms;
}

export function formatTime(ms) {
  if (ms === null) return '—';
  boundedInteger(ms, LIMITS.maxTimelineMs, 'O tempo', { zero: true });
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  const padded = (value) => String(value).padStart(2, '0');
  const clock = hours > 0 ? `${padded(hours)}:${padded(minutes)}:${padded(remainder)}` : `${padded(minutes)}:${padded(remainder)}`;
  const fraction = ms % 1000;
  return fraction === 0 ? clock : `${clock},${String(fraction).padStart(3, '0')}`;
}

export function deriveTimeline(value) {
  const project = validateProject(value);
  let knownMs = 0;
  let missingCount = 0;
  const rows = project.scenes.map((scene, index) => {
    const pendingBefore = missingCount;
    const startMs = pendingBefore === 0 ? knownMs : null;
    const endMs = startMs !== null && scene.durationMs !== null ? startMs + scene.durationMs : null;
    if (scene.durationMs === null) missingCount += 1;
    else knownMs += scene.durationMs;
    return Object.freeze({ number: index + 1, scene, startMs, endMs, pendingBefore });
  });
  const complete = rows.length > 0 && missingCount === 0;
  const totalMs = complete ? knownMs : null;
  return Object.freeze({
    rows: Object.freeze(rows), knownMs, missingCount, complete, totalMs,
    targetMs: project.targetMs,
    deltaMs: complete && project.targetMs !== null ? totalMs - project.targetMs : null,
  });
}

export function deriveRecordingPlan(value) {
  const timeline = deriveTimeline(value);
  const locations = new Map();
  for (const row of timeline.rows) {
    const { location, setup } = row.scene;
    if (!locations.has(location)) locations.set(location, new Map());
    const setups = locations.get(location);
    if (!setups.has(setup)) setups.set(setup, []);
    setups.get(setup).push(row);
  }
  const groups = [...locations].map(([location, setups]) => Object.freeze({
    location,
    setups: Object.freeze([...setups].map(([setup, rows]) => Object.freeze({ setup, rows: Object.freeze(rows) }))),
  }));
  return Object.freeze({ groups: Object.freeze(groups), timeline });
}
