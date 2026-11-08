import { mkdir, copyFile, rm, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES } from './manifest.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'dist');
await rm(target, { recursive: true, force: true });
for (const name of PUBLIC_FILES) {
  const destination = resolve(target, name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, name), destination);
}
await copyFile(resolve(root, '.nojekyll'), resolve(target, '.nojekyll'));
const html = await readFile(resolve(target, 'index.html'), 'utf8');
if (!html.includes('6a2ccbd6') || !html.includes('unreviewed and undocumented is unfinished')) throw new Error('Contrato visual ausente do build.');
console.log(`Distribuição estática: ${PUBLIC_FILES.length + 1} arquivos explícitos em dist/.`);
