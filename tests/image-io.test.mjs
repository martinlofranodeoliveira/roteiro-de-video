import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { LIMITS, ProjectError, addScene, createProject, updateScene } from '../src/model.mjs';
import { inspectSource, normalizeBitmapRegion, normalizeLocalFile, validateEmbeddedImages } from '../src/image-io.mjs';

const errorCode = code => error => error instanceof ProjectError && error.code === code;
const localFile = (bytes, name = 'referencia.png') => ({ size: bytes.byteLength, name, arrayBuffer: async () => bytes.slice().buffer });

// Fixtures PNG originais com pixels/chunks reais; os codecs do navegador são
// simulados só nos testes de fronteira, não apresentados como prova de decodificação.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4, 'ascii');
  bytes.set(data, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, data.length + 8)), data.length + 8);
  return bytes;
}
function realPng(width = 2, height = 3) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) rows.set([180, 80, 30, 255], y * (1 + width * 4) + 1 + x * 4);
  }
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
function pngHeader(width, height) {
  const bytes = realPng();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}
function jpegHeader(width = 3, height = 2, marker = 0xc0) {
  // Não é um JPEG completo: fixture exclusiva do inspetor de cabeçalho.
  return new Uint8Array([255,216, 255,225,0,6,69,120,105,102, 255,marker,0,17,8,
    height >> 8,height & 255,width >> 8,width & 255,3,1,17,0,2,17,1,3,17,1,255,217]);
}
function imageProject(sizes = [[2, 3], [5, 4], [3, 3]]) {
  let project = createProject();
  for (const [index, [width, height]] of sizes.entries()) {
    const id = `imagem-${index}`;
    project = updateScene(addScene(project, id), id, { reference: {
      name: `${id}.png`, mime: 'image/png', width, height,
      dataUrl: 'data:image/png;base64,' + Buffer.from(realPng(width, height)).toString('base64'),
    } });
  }
  return project;
}

async function browser(options, callback) {
  const keys = ['document', 'createImageBitmap'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const state = { decoded: [], bitmaps: [], canvases: [], draws: [], contexts: [] };
  const values = {
    createImageBitmap: async (blob, settings) => {
      if (options.requirePreviousClosed) assert.ok(state.bitmaps.every(bitmap => bitmap.closed));
      const index = state.decoded.length;
      state.decoded.push({ blob, settings });
      await Promise.resolve();
      if (options.decodeReject === index) throw new Error('PRIVATE_DECODE_BACKEND');
      const [width, height] = options.sizes?.[index] ?? options.sizes?.at(-1) ?? [2, 3];
      const bitmap = { width, height, closed: false, close() { this.closed = true; } };
      state.bitmaps.push(bitmap);
      return bitmap;
    },
    document: { createElement(name) {
      assert.equal(name, 'canvas');
      const canvas = {
        width: 0, height: 0,
        getContext(kind, settings) {
          state.contexts.push({ kind, settings });
          if (options.contextThrow) throw new Error('PRIVATE_CONTEXT_BACKEND');
          if (options.noContext) return null;
          return { drawImage(...args) {
            if (options.drawReject) throw new Error('PRIVATE_DRAW_BACKEND');
            state.draws.push(args);
          } };
        },
        toBlob(callback, type) {
          assert.equal(type, 'image/png');
          if (options.encodeThrow) throw new Error('PRIVATE_ENCODE_BACKEND');
          if (options.encodeNull) return callback(null);
          if (options.encodeSize) return callback(new Blob([new Uint8Array(options.encodeSize)], { type: 'image/png' }));
          const width = options.encodedDimensions?.[0] ?? this.width;
          const height = options.encodedDimensions?.[1] ?? this.height;
          callback(new Blob([options.encodedBytes ?? realPng(width, height)], { type: options.encodedMime ?? 'image/png' }));
        },
      };
      state.canvases.push(canvas);
      return canvas;
    } },
  };
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: values[key] });
    if (options.noDecoder) delete globalThis.createImageBitmap;
    return await callback(state);
  } finally {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

test('inspeciona PNG e JPEG baseline/estendido/progressivo inclusive em subarray', () => {
  const png = realPng(4, 7);
  const surrounded = new Uint8Array(png.length + 8); surrounded.set(png, 5);
  assert.deepEqual(inspectSource(surrounded.subarray(5, 5 + png.length)), { mime: 'image/png', width: 4, height: 7 });
  for (const marker of [0xc0, 0xc1, 0xc2]) {
    assert.deepEqual(inspectSource(jpegHeader(1200, 800, marker)), { mime: 'image/jpeg', width: 1200, height: 800 });
  }
});

test('rejeita tipo, formato, bytes excedentes e cabeçalhos PNG malformados', () => {
  for (const input of [null, {}, 'PNG', new ArrayBuffer(10)]) assert.throws(() => inspectSource(input), errorCode('image_source'));
  for (const bytes of [new Uint8Array(), new Uint8Array([60,115,118,103,62]), new Uint8Array([71,73,70,56,57,97])]) {
    assert.throws(() => inspectSource(bytes), errorCode('image_format'));
  }
  assert.throws(() => inspectSource(new Uint8Array(LIMITS.maxSourceBytes + 1)), errorCode('image_size'));
  assert.throws(() => inspectSource(realPng().subarray(0, 32)), errorCode('image_header'));
  for (const [offset, value] of [[11,12], [12,0], [24,3], [25,5], [26,1], [27,1], [28,2]]) {
    const bytes = realPng(); bytes[offset] = value;
    assert.throws(() => inspectSource(bytes), errorCode('image_header'));
  }
});

test('o limite exato de 16 milhões de pixels é verificado antes da decodificação', () => {
  assert.deepEqual(inspectSource(pngHeader(4000, 4000)), { mime: 'image/png', width: 4000, height: 4000 });
  for (const bytes of [pngHeader(4000, 4001), pngHeader(0, 4), jpegHeader(4000, 4001), jpegHeader(3, 0)]) {
    assert.throws(() => inspectSource(bytes), errorCode('image_dimensions'));
  }
});

test('a travessia JPEG recusa segmentos truncados, SOF não suportado e contagem excessiva', () => {
  for (const bytes of [jpegHeader().subarray(0, 15), new Uint8Array([255,216,255,225,0,1]),
    new Uint8Array([255,216,255,218,0,2]), jpegHeader(2,3,0xc3), new Uint8Array([255,216,0])]) {
    assert.throws(() => inspectSource(bytes), errorCode('image_header'));
  }
  const tail = jpegHeader().subarray(2);
  const markers = new Uint8Array(2 + 4097 * 4 + tail.length);
  markers.set([255,216]);
  for (let offset = 2; offset < 2 + 4097 * 4; offset += 4) markers.set([255,225,0,2], offset);
  markers.set(tail, 2 + 4097 * 4);
  assert.throws(() => inspectSource(markers), errorCode('image_header'));
});

test('normalização pequena preserva dimensões, limpa nome e retorna referência canônica', async () => {
  await browser({ sizes: [[2,3]] }, async state => {
    const reference = await normalizeLocalFile(localFile(realPng(), '  meu\u0000-café\uffff.png\n'));
    assert.deepEqual(Object.keys(reference), ['name', 'mime', 'dataUrl', 'width', 'height']);
    assert.equal(reference.name, 'meu -café .png');
    assert.equal(reference.mime, 'image/png');
    assert.ok(Object.isFrozen(reference));
    assert.deepEqual([reference.width, reference.height], [2,3]);
    assert.deepEqual(state.decoded[0].settings, { imageOrientation: 'from-image' });
    assert.equal(state.decoded[0].blob.type, 'image/png');
    assert.deepEqual(state.draws[0].slice(1), [0,0,2,3,0,0,2,3]);
    assert.deepEqual(state.contexts[0], { kind: '2d', settings: { colorSpace: 'srgb' } });
    assert.ok(state.bitmaps[0].closed);
    assert.ok(state.canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
    assert.deepEqual(inspectSource(new Uint8Array(Buffer.from(reference.dataUrl.split(',')[1], 'base64'))), { mime: 'image/png', width: 2, height: 3 });
  });
});

test('JPEG orientado pelo navegador pode trocar eixos e é reduzido para no máximo 800px', async () => {
  await browser({ sizes: [[1200,1600]] }, async state => {
    const reference = await normalizeLocalFile(localFile(jpegHeader(1600,1200), 'café.jpg'));
    assert.deepEqual([reference.width, reference.height], [600,800]);
    assert.deepEqual(state.decoded[0].settings, { imageOrientation: 'from-image' });
    assert.equal(state.decoded[0].blob.type, 'image/jpeg');
    assert.deepEqual(state.draws[0].slice(1), [0,0,1200,1600,0,0,600,800]);
    assert.ok(state.bitmaps[0].closed);
  });
});

test('nome com pares Unicode é limitado sem partir surrogate e nome vazio ganha fallback', async () => {
  await browser({}, async () => {
    const reference = await normalizeLocalFile(localFile(realPng(), '😀'.repeat(90)));
    assert.equal(reference.name, '😀'.repeat(60));
    assert.equal((await normalizeLocalFile(localFile(realPng(), '\u0000\ud800\uffff'))).name, 'imagem.png');
  });
});

test('arquivo inválido, tamanho falso e excesso de pixels nunca chegam ao decoder', async () => {
  await browser({}, async state => {
    await assert.rejects(normalizeLocalFile(null), errorCode('image_source'));
    await assert.rejects(normalizeLocalFile(localFile(new Uint8Array([1,2,3]))), errorCode('image_format'));
    await assert.rejects(normalizeLocalFile({ size: LIMITS.maxSourceBytes + 1, arrayBuffer() { throw Error('READ'); } }), errorCode('image_size'));
    await assert.rejects(normalizeLocalFile({ size: 10, arrayBuffer: async () => new ArrayBuffer(3) }), errorCode('image_read'));
    await assert.rejects(normalizeLocalFile(localFile(pngHeader(4000,4001))), errorCode('image_dimensions'));
    assert.equal(state.decoded.length, 0);
  });
});

test('falhas de decoder/canvas/PNG são sanitizadas e liberam todos os recursos disponíveis', async () => {
  const cases = [
    [{ decodeReject: 0 }, 'image_decode'], [{ noDecoder: true }, 'browser_support'],
    [{ sizes: [[8,9]] }, 'image_dimensions'],
    [{ noContext: true }, 'browser_support'], [{ contextThrow: true }, 'browser_support'],
    [{ drawReject: true }, 'image_encode'], [{ encodeNull: true }, 'image_encode'],
    [{ encodeThrow: true }, 'image_encode'], [{ encodedMime: 'image/jpeg' }, 'image_encode'],
    [{ encodeSize: LIMITS.maxImageBytes + 1 }, 'image_size'], [{ encodedDimensions: [1,1] }, 'image_encode'],
    [{ encodedBytes: new Uint8Array([1,2,3]) }, 'image_format'],
  ];
  for (const [options, code] of cases) await browser(options, async state => {
    await assert.rejects(normalizeLocalFile(localFile(realPng())), error => errorCode(code)(error) && !error.message.includes('PRIVATE_'));
    assert.ok(state.bitmaps.every(bitmap => bitmap.closed));
    assert.ok(state.canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  });
});

test('recorte de painel verifica limites e preserva a propriedade do bitmap do chamador', async () => {
  await browser({}, async state => {
    const bitmap = { width: 1536, height: 1024, close() { assert.fail('Não deve fechar bitmap externo'); } };
    const reference = await normalizeBitmapRegion(bitmap, { x: 1024, y: 512, width: 512, height: 512 }, 'Cena 6.png');
    assert.deepEqual([reference.width, reference.height], [512,512]);
    assert.deepEqual(state.draws[0].slice(1), [1024,512,512,512,0,0,512,512]);
    const draws = state.draws.length;
    for (const region of [null, { x: -1, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 1 },
      { x: 1025, y: 512, width: 512, height: 512 }, { x: 0.5, y: 0, width: 1, height: 1 }]) {
      await assert.rejects(normalizeBitmapRegion(bitmap, region), errorCode('image_dimensions'));
    }
    assert.equal(state.draws.length, draws);
    assert.equal(state.decoded.length, 0);
    assert.ok(state.canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  });
});

test('referências incorporadas são realmente solicitadas ao decoder sequencialmente e fechadas', async () => {
  const project = imageProject();
  await browser({ sizes: [[2,3], [5,4], [3,3]], requirePreviousClosed: true }, async state => {
    assert.equal(await validateEmbeddedImages(project), project);
    assert.equal(state.decoded.length, 3);
    assert.ok(state.bitmaps.every(bitmap => bitmap.closed));
    assert.ok(state.decoded.every(({ blob, settings }) => blob.type === 'image/png' && settings.imageOrientation === 'from-image'));
  });
});

test('falha na segunda imagem aborta antes da terceira e não altera o projeto original', async () => {
  const project = imageProject();
  const before = JSON.stringify(project);
  for (const options of [{ sizes: [[2,3], [4,5]] }, { sizes: [[2,3]], decodeReject: 1 }]) {
    await browser(options, async state => {
      await assert.rejects(validateEmbeddedImages(project), error => error instanceof ProjectError && !error.message.includes('PRIVATE_'));
      assert.equal(state.decoded.length, 2);
      assert.ok(state.bitmaps.every(bitmap => bitmap.closed));
    });
  }
  assert.equal(JSON.stringify(project), before);
});

test('estrutura inválida falha antes de decodificar e projeto sem imagens dispensa decoder', async () => {
  await browser({ noDecoder: true }, async state => {
    const empty = createProject();
    assert.equal(await validateEmbeddedImages(empty), empty);
    assert.equal(await validateEmbeddedImages(addScene(empty, 'sem-imagem')).then(project => project.scenes.length), 1);
    await assert.rejects(validateEmbeddedImages(imageProject()), errorCode('browser_support'));
    assert.equal(state.decoded.length, 0);
  });
  await browser({}, async state => {
    await assert.rejects(validateEmbeddedImages({ ...createProject(), extra: true }), ProjectError);
    const raw = JSON.parse(JSON.stringify(imageProject()));
    raw.scenes[1].reference.width = 2;
    await assert.rejects(validateEmbeddedImages(raw), ProjectError);
    assert.equal(state.decoded.length, 0);
  });
});
