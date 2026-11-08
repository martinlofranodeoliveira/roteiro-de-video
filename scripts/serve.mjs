import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES } from './manifest.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.ROTEIRO_PORT || 4179);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ROTEIRO_PORT deve estar entre 1024 e 65535.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
    if (!PUBLIC_FILES.includes(file)) { response.writeHead(404).end('Não encontrado.'); return; }
    const bytes = await readFile(resolve(root, file));
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'text/plain; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404).end('Não encontrado.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Roteiro de Vídeo: http://127.0.0.1:${port}/`));
