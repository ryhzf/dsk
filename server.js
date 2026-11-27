import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT ?? '4173', 10);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function safePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  const absolute = resolve(join(ROOT, relative));
  if (absolute !== ROOT && !absolute.startsWith(`${ROOT}${sep}`)) {
    return null;
  }
  return absolute;
}

const server = createServer(async (request, response) => {
  const urlPath = request.url ?? '/';
  const target = safePath(urlPath === '/' ? '/index.html' : urlPath);

  if (!target) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    let filePath = target;
    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Reddit Archive demo: http://${HOST}:${PORT}`);
});
