/**
 * Leitura local explícita e normalização limitada de imagens.
 * Adaptado de folha-de-contato/src/image-io.mjs (MIT):
 * https://github.com/martinlofranodeoliveira/folha-de-contato
 * Copyright (c) 2026 Contribuidores da LOFRANO TECNOLOGIA.
 * A licença MIT e seu aviso são preservados no arquivo LICENSE deste projeto.
 */
import { LIMITS, ProjectError, addScene, createProject, updateScene, validateProject } from './model.mjs';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_PREFIX = 'data:image/png;base64,';
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2]);
const MAX_JPEG_SEGMENTS = 4096;
const fail = (code, message) => { throw new ProjectError(code, message); };

function dimensions(width, height, maxPixels) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0
      || width * height > maxPixels) {
    fail('image_dimensions', 'A imagem excede o limite de pixels ou tem dimensões inválidas.');
  }
}

/** Inspeciona somente o cabeçalho; a decodificação real permanece obrigatória. */
export function inspectSource(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('image_source', 'Escolha um arquivo PNG ou JPEG válido.');
  if (bytes.byteLength > LIMITS.maxSourceBytes) fail('image_size', 'Cada imagem original pode ter até 8 MiB.');
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    if (bytes.byteLength < 33) fail('image_header', 'O cabeçalho da imagem está incompleto.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(8) !== 13 || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) {
      fail('image_header', 'O cabeçalho PNG não tem o formato esperado.');
    }
    const width = view.getUint32(16), height = view.getUint32(20);
    dimensions(width, height, LIMITS.maxSourcePixels);
    const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
    if (!validDepths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) {
      fail('image_header', 'O cabeçalho PNG não tem o formato esperado.');
    }
    return { mime: 'image/png', width, height };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('image_format', 'Use imagens PNG ou JPEG; outros formatos não são aceitos.');
  let offset = 2;
  for (let segment = 0; segment < MAX_JPEG_SEGMENTS && offset < bytes.length; segment += 1) {
    if (bytes[offset++] !== 0xff) fail('image_header', 'O cabeçalho JPEG não tem o formato esperado.');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (JPEG_SOF.has(marker)) {
      if (length < 8) break;
      const components = bytes[offset + 7];
      if (![1, 3, 4].includes(components) || length !== 8 + 3 * components || bytes[offset + 2] !== 8) break;
      const height = bytes[offset + 3] * 256 + bytes[offset + 4];
      const width = bytes[offset + 5] * 256 + bytes[offset + 6];
      dimensions(width, height, LIMITS.maxSourcePixels);
      return { mime: 'image/jpeg', width, height };
    }
    // SOFs lossless, diferenciais e aritméticos não fazem parte deste perfil.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) break;
    offset += length;
  }
  fail('image_header', 'Não foi possível ler um cabeçalho JPEG suportado.');
}

function discardCanvas(canvas) {
  try { if (canvas) { canvas.width = 1; canvas.height = 1; } } catch { /* Liberação de melhor esforço. */ }
}

function createCanvas(width, height) {
  if (!globalThis.document?.createElement) fail('browser_support', 'Este navegador não oferece o processamento de imagens necessário.');
  const canvas = document.createElement('canvas');
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!context) fail('browser_support', 'Este navegador não oferece o processamento de imagens necessário.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    return { canvas, context };
  } catch (error) {
    discardCanvas(canvas);
    operational(error, 'browser_support', 'Este navegador não oferece o processamento de imagens necessário.');
  }
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob || blob.type !== 'image/png' || !Number.isSafeInteger(blob.size) || blob.size <= 0) {
          return reject(new ProjectError('image_encode', 'Não foi possível gerar a imagem PNG.'));
        }
        if (blob.size > LIMITS.maxImageBytes) {
          return reject(new ProjectError('image_size', 'O PNG gerado excede o limite de 1 MiB.'));
        }
        resolve(blob);
      }, 'image/png');
    } catch {
      reject(new ProjectError('image_encode', 'Não foi possível gerar a imagem PNG.'));
    }
  });
}

function pngData(bytes) {
  const parts = [];
  for (let index = 0; index < bytes.length; index += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
  }
  return PNG_PREFIX + btoa(parts.join(''));
}

function pngBytes(data) {
  const decoded = atob(data.slice(PNG_PREFIX.length));
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}

function safeName(value) {
  const cleaned = Array.from(typeof value === 'string' ? value : 'imagem.png', char => {
    const point = char.codePointAt(0);
    return point < 32 || point === 127 || point === 0xfffe || point === 0xffff
      || (point >= 0xd800 && point <= 0xdfff) ? ' ' : char;
  }).join('').replace(/\s+/gu, ' ').trim() || 'imagem.png';
  let name = '';
  for (const char of cleaned) {
    if (name.length + char.length > 120) break;
    name += char;
  }
  return name.trim() || 'imagem.png';
}

function canonicalReference(reference) {
  const id = 'validacao-imagem';
  return updateScene(addScene(createProject(), id), id, { reference }).scenes[0].reference;
}

function operational(error, code, message) {
  if (error instanceof ProjectError) throw error;
  throw new ProjectError(code, message);
}

/** Recorta um bitmap já decodificado; o chamador continua responsável por fechá-lo. */
export async function normalizeBitmapRegion(bitmap, region, name = 'imagem.png') {
  let canvas;
  try {
    dimensions(bitmap?.width, bitmap?.height, LIMITS.maxSourcePixels);
    const { x, y, width: sourceWidth, height: sourceHeight } = region ?? {};
    if (![x, y, sourceWidth, sourceHeight].every(Number.isSafeInteger) || x < 0 || y < 0
        || sourceWidth <= 0 || sourceHeight <= 0 || x + sourceWidth > bitmap.width || y + sourceHeight > bitmap.height) {
      fail('image_dimensions', 'A região da imagem tem dimensões inválidas.');
    }
    const scale = Math.min(1, LIMITS.maxImageSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const drawing = createCanvas(width, height);
    canvas = drawing.canvas;
    drawing.context.drawImage(bitmap, x, y, sourceWidth, sourceHeight, 0, 0, width, height);
    const blob = await canvasPng(canvas);
    const normalized = new Uint8Array(await blob.arrayBuffer());
    if (normalized.byteLength !== blob.size || normalized.byteLength > LIMITS.maxImageBytes) {
      fail('image_encode', 'Não foi possível ler o PNG gerado completo.');
    }
    const header = inspectSource(normalized);
    if (header.mime !== 'image/png' || header.width !== width || header.height !== height) {
      fail('image_encode', 'O PNG gerado não tem as dimensões esperadas.');
    }
    return canonicalReference({ name: safeName(name), mime: 'image/png', dataUrl: pngData(normalized), width, height });
  } catch (error) {
    operational(error, 'image_encode', 'Não foi possível preparar a imagem PNG.');
  } finally {
    discardCanvas(canvas);
  }
}

export async function normalizeLocalFile(file) {
  let bitmap;
  try {
    if (!file || typeof file.arrayBuffer !== 'function' || !Number.isSafeInteger(file.size) || file.size <= 0) {
      fail('image_source', 'Escolha um arquivo PNG ou JPEG válido.');
    }
    if (file.size > LIMITS.maxSourceBytes) fail('image_size', 'Cada imagem original pode ter até 8 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) fail('image_read', 'Não foi possível ler o arquivo de imagem completo.');
    const source = inspectSource(bytes);
    if (typeof globalThis.createImageBitmap !== 'function') fail('browser_support', 'Este navegador não oferece o processamento de imagens necessário.');
    bitmap = await createImageBitmap(new Blob([bytes], { type: source.mime }), { imageOrientation: 'from-image' });
    dimensions(bitmap.width, bitmap.height, LIMITS.maxSourcePixels);
    const same = bitmap.width === source.width && bitmap.height === source.height;
    // O navegador aplica a orientação de metadados; trocar os eixos não muda
    // o orçamento de pixels e não requer interpretar/rotacionar EXIF duas vezes.
    const oriented = bitmap.width === source.height && bitmap.height === source.width;
    if (!same && !oriented) fail('image_dimensions', 'As dimensões decodificadas não correspondem ao cabeçalho da imagem.');
    return await normalizeBitmapRegion(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, file.name);
  } catch (error) {
    operational(error, 'image_decode', 'Não foi possível decodificar a imagem. Use outro arquivo PNG ou JPEG.');
  } finally {
    try { bitmap?.close(); } catch { /* Liberação de melhor esforço. */ }
  }
}

/** Valida toda a estrutura e depois decodifica as referências, uma por vez. */
export async function validateEmbeddedImages(rawProject) {
  const project = validateProject(rawProject);
  if (!project.scenes.some(scene => scene.reference)) return project;
  if (typeof globalThis.createImageBitmap !== 'function') fail('browser_support', 'Este navegador não oferece o processamento de imagens necessário.');
  for (const scene of project.scenes) {
    if (!scene.reference) continue;
    let bitmap;
    try {
      const reference = scene.reference;
      bitmap = await createImageBitmap(new Blob([pngBytes(reference.dataUrl)], { type: 'image/png' }), { imageOrientation: 'from-image' });
      if (bitmap.width !== reference.width || bitmap.height !== reference.height) {
        fail('image_dimensions', 'Uma imagem do projeto tem dimensões diferentes das declaradas.');
      }
    } catch (error) {
      operational(error, 'image_decode', 'Não foi possível decodificar uma imagem do projeto. O projeto anterior foi preservado.');
    } finally {
      try { bitmap?.close(); } catch { /* Liberação de melhor esforço. */ }
    }
  }
  return project;
}
