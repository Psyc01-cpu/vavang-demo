// Petit serveur statique pour les tests et la démonstration locale : node tests/serveur.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
export function demarrer(port = 4173) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(racine, p);
    if (!f.startsWith(racine) || /node_modules|\.env/.test(f)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('introuvable'); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
  });
  return new Promise(ok => s.listen(port, '127.0.0.1', () => ok(s)));
}
if (process.argv[1] && process.argv[1].endsWith('serveur.mjs')) { const port = Number(process.argv[2]) || 4173; demarrer(port).then(() => console.log('http://127.0.0.1:' + port)); }
