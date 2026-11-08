import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, posix, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES } from './manifest.mjs';
import { LIMITS, parseProject, serializeProject, deriveTimeline } from '../src/model.mjs';
import { toMarkdown, toCSV } from '../src/export.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const run = promisify(execFile);
const git = async (...args) => (await run('git', ['-C', root, ...args], { maxBuffer: 4 * 1024 * 1024 })).stdout;
const relativeName = (name) => typeof name === 'string' && name.length > 0
  && !name.includes('\\') && !name.includes('\0') && !name.startsWith('/')
  && name === posix.normalize(name) && !name.split('/').some(part => part === '..' || part === '.git');

// Não procurar um repositório ancestral nem percorrer arquivos locais não rastreados.
const gitEntry = await lstat(resolve(root, '.git')).catch(() => { throw new Error('Execute a checagem em um checkout Git com .git nesta raiz.'); });
assert(!gitEntry.isSymbolicLink() && (gitEntry.isDirectory() || gitEntry.isFile()), '.git precisa identificar este checkout, sem link simbólico.');
assert.equal(await realpath((await git('rev-parse', '--show-toplevel')).trim()), root, 'A raiz Git precisa ser a raiz deste projeto.');
const tracked = (await git('ls-files', '--cached', '-z')).split('\0').filter(Boolean);
assert(tracked.length > 0, 'Adicione os arquivos públicos ao índice Git antes de verificar.');
assert.equal(new Set(tracked).size, tracked.length, 'O índice Git contém caminhos repetidos ou conflitos.');
const trackedSet = new Set(tracked);
const source = new Map();
const textExtensions = new Set(['.html', '.css', '.mjs', '.js', '.json', '.md', '.txt', '.csv', '.yml', '.yaml', '.svg']);
const privatePath = /(?:^|\/)(?:local|node_modules|dist|coverage|playwright-report|\.codex|\.cache|\.ssh|\.aws|\.config)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|auth\.json|credentials(?:[^/]*)\.json|id_(?:rsa|ed25519)|[^/]*\.(?:pem|p12|pfx))(?:$|\/)/i;
const credential = /github_pat_[A-Za-z0-9_]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
const personalPath = /\/(?:home|Users)\/[A-Za-z0-9_.-]+\/|[A-Za-z]:\\Users\\[^\\\r\n]+\\/;
const personalDocument = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;

for (const name of tracked) {
  assert(relativeName(name), `Caminho rastreado inválido: ${name}`);
  assert(!privatePath.test(name), `Arquivo privado ou gerado no índice: ${name}`);
  const info = await lstat(resolve(root, name));
  assert(info.isFile() && !info.isSymbolicLink(), `Somente arquivos regulares podem ser publicados: ${name}`);
  assert.equal(await realpath(resolve(root, name)), resolve(root, name), `Diretório simbólico em caminho rastreado: ${name}`);
  assert(info.size <= LIMITS.maxProjectBytes, `Arquivo acima de 18 MiB: ${name}`);
  const bytes = await readFile(resolve(root, name));
  source.set(name, bytes);
  if (textExtensions.has(extname(name)) || !extname(name)) {
    const text = bytes.toString('utf8');
    assert(!credential.test(text), `Padrão de credencial em ${name}`);
    assert(!personalPath.test(text), `Caminho pessoal em ${name}`);
    assert(!personalDocument.test(text), `Padrão de documento pessoal em ${name}`);
  }
}

assert.equal(new Set(PUBLIC_FILES).size, PUBLIC_FILES.length, 'A lista pública contém duplicatas.');
const publicFiles = new Set([...PUBLIC_FILES, '.nojekyll']);
for (const name of publicFiles) {
  assert(relativeName(name), `Caminho inválido na distribuição: ${name}`);
  assert(trackedSet.has(name), `Arquivo de distribuição ausente do índice Git: ${name}`);
}
for (const required of [
  'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md',
  'LICENSE', 'SPEC.md', 'PRODUCT.md', 'package.json',
  'scripts/build.mjs', 'scripts/check.mjs', 'scripts/manifest.mjs', 'scripts/serve.mjs',
  '.github/workflows/ci.yml', '.github/workflows/pages.yml',
]) assert(trackedSet.has(required), `Arquivo obrigatório ausente do índice Git: ${required}`);
for (const required of [
  'index.html', 'styles.css', 'src/app.mjs', 'assets/BARLOW-LICENSE.txt', 'assets/DEMO.md',
  'LICENSE', 'THIRD_PARTY_NOTICES.md',
  'examples/roteiro-exemplo.json', 'examples/roteiro-exemplo.md', 'examples/roteiro-exemplo.csv',
]) assert(publicFiles.has(required), `Arquivo obrigatório ausente da distribuição: ${required}`);
for (const name of tracked.filter(name => name.startsWith('src/') && name.endsWith('.mjs'))) {
  assert(publicFiles.has(name), `Módulo de execução fora da distribuição: ${name}`);
}

const distribution = [];
async function listDistribution(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    assert(!entry.isSymbolicLink(), `Link simbólico em dist/: ${name}`);
    if (entry.isDirectory()) await listDistribution(resolve(directory, entry.name), name + '/');
    else { assert(entry.isFile(), `Entrada irregular em dist/: ${name}`); distribution.push(name); }
  }
}
const distInfo = await lstat(resolve(root, 'dist'));
assert(distInfo.isDirectory() && !distInfo.isSymbolicLink(), 'dist/ precisa ser um diretório regular dentro do projeto.');
await listDistribution(resolve(root, 'dist'));
assert.deepEqual(distribution.sort(), [...publicFiles].sort(), 'dist/ deve conter somente a lista explícita de distribuição.');
for (const name of publicFiles) {
  assert.deepEqual(await readFile(resolve(root, 'dist', name)), source.get(name), `Bytes de distribuição diferentes da fonte: ${name}`);
}

let checkedReferences = 0;
function localReference(from, value, { module = false, externalLink = false } = {}) {
  const raw = value.trim();
  if (!raw || raw.startsWith('#')) return;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) || raw.startsWith('//')) {
    assert(externalLink && /^https:\/\//.test(raw), `Recurso externo ou esquema não permitido em ${from}: ${raw}`);
    return;
  }
  assert(!raw.startsWith('/'), `Use caminho relativo para publicação em subdiretório: ${from} → ${raw}`);
  if (module) assert(/^\.\.?\//.test(raw), `Importação precisa ser relativa: ${from} → ${raw}`);
  const path = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
  const target = posix.normalize(posix.join(posix.dirname(from), path));
  assert(relativeName(target) && publicFiles.has(target), `Referência fora da distribuição: ${from} → ${raw}`);
  checkedReferences += 1;
}

for (const name of PUBLIC_FILES) {
  if (!/\.(?:mjs|html|css)$/.test(name)) continue;
  const text = source.get(name).toString('utf8');
  if (name.endsWith('.mjs')) {
    const staticImports = /\b(?:import|export)\s+(?:\{[^}]*\}|\*\s+as\s+[\w$]+|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[\w$]+))?)\s+from\s*['"]([^'"]+)['"]/g;
    const sideEffectImports = /\bimport\s*['"]([^'"]+)['"]/g;
    const dynamicImports = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
    const urlAssets = /\bnew\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g;
    for (const match of text.matchAll(staticImports)) localReference(name, match[1], { module: true });
    for (const match of text.matchAll(sideEffectImports)) localReference(name, match[1], { module: true });
    const dynamicMatches = [...text.matchAll(dynamicImports)];
    assert.equal(dynamicMatches.length, [...text.matchAll(/\bimport\s*\(/g)].length, `Importação dinâmica precisa usar literal verificável: ${name}`);
    for (const match of dynamicMatches) localReference(name, match[2], { module: true });
    const urlMatches = [...text.matchAll(urlAssets)];
    assert.equal(urlMatches.length, [...text.matchAll(/\bnew\s+URL\s*\(/g)].length, `Asset de módulo precisa usar literal relativo a import.meta.url: ${name}`);
    for (const match of urlMatches) localReference(name, match[2]);
  }
  if (name.endsWith('.html')) {
    for (const tag of text.matchAll(/<([A-Za-z][\w:-]*)\b[^>]*>/g)) {
      for (const attribute of tag[0].matchAll(/\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        localReference(name, attribute[2] ?? attribute[3] ?? attribute[4], { externalLink: tag[1].toLowerCase() === 'a' && attribute[1] === 'href' });
      }
    }
  }
  if (name.endsWith('.css')) {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g)) localReference(name, match[1] ?? match[2] ?? match[3]);
    for (const match of text.matchAll(/@import\s+["']([^"']+)["']/g)) localReference(name, match[1]);
  }
}

const html = source.get('index.html').toString('utf8');
const packageInfo = JSON.parse(source.get('package.json').toString('utf8'));
for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  assert.equal(Object.keys(packageInfo[field] || {}).length, 0, 'A distribuição não deve exigir instalação de dependências npm.');
}
assert(html.includes('Content-Security-Policy'), 'A política CSP precisa acompanhar o HTML.');
assert(!/<script\b(?![^>]*\bsrc=)[^>]*>\s*[^<\s]/i.test(html), 'Scripts executáveis precisam ser módulos externos.');
assert(html.includes('6a2ccbd6') && html.includes('unreviewed and undocumented is unfinished'), 'Contrato visual ausente do HTML.');

const exampleBytes = source.get('examples/roteiro-exemplo.json');
const example = parseProject(new TextDecoder('utf-8', { fatal: true }).decode(exampleBytes));
assert.deepEqual(Buffer.from(serializeProject(example)), exampleBytes, 'O exemplo JSON precisa ter bytes canônicos, inclusive LF final.');
assert.deepEqual(Buffer.from(toMarkdown(example)), source.get('examples/roteiro-exemplo.md'), 'O exemplo Markdown diverge da exportação narrativa.');
assert.deepEqual(Buffer.from(toCSV(example)), source.get('examples/roteiro-exemplo.csv'), 'O exemplo CSV diverge da exportação de gravação.');
assert.equal(example.title, 'Um café, três planos');
assert.match(example.notes, /Exemplo fictício/);
assert.equal(example.scenes.length, 6);
assert(example.scenes.every(scene => scene.reference?.width === 512 && scene.reference?.height === 512), 'As seis referências do exemplo precisam estar incorporadas.');
const timeline = deriveTimeline(example);
assert.equal(timeline.complete, true);
assert.equal(timeline.totalMs, 35_000);
assert.equal(timeline.targetMs, 40_000);

const demo = source.get('assets/demo-storyboard.png');
assert.equal(demo.readUInt32BE(16), 1536);
assert.equal(demo.readUInt32BE(20), 1024);
const demoHash = createHash('sha256').update(demo).digest('hex');
assert(source.get('assets/DEMO.md').toString('utf8').includes(demoHash), 'Atualize a proveniência da imagem de demonstração.');
assert(source.get('assets/BARLOW-LICENSE.txt').toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1'), 'Aviso OFL ausente.');

console.log(JSON.stringify({
  trackedFilesChecked: tracked.length,
  staticFilesChecked: publicFiles.size,
  localReferencesChecked: checkedReferences,
  sourceBytesMatch: true,
  examplesMatchExports: true,
  exampleJSONBytes: exampleBytes.length,
}));
