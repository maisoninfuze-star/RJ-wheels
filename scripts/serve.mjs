// Tiny static server for local preview of dist/ (mirrors trailing-slash + 404 behaviour).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  let file = join(DIST, p);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
  catch {
    if (!extname(p) && !p.endsWith('/') && await stat(join(DIST, p, 'index.html')).catch(() => null)) { res.writeHead(301, { Location: p + '/' }).end(); return; }
  }
  try {
    const body = await readFile(file);
    const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    // Range requests: Safari will not play <video> without them.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      let start = range[1] === '' ? body.length - Number(range[2]) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (start < 0) start = 0;
      if (start > end || start >= body.length) { res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 }).end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': body.length }).end(body);
  } catch {
    const nf = p.startsWith('/en/') ? '/en/404.html' : '/404.html';
    res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(await readFile(join(DIST, nf)));
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
