// server.mjs — Serveur de la Table de Tarot, sans dépendance (Node.js 18 et plus).
//   - Sert l'application installable (dist/pwa : page, manifeste, service worker, icônes).
//   - Relaie les parties en ligne sur /ws (WebSocket écrit à la main, RFC 6455) :
//     une table = un code de 4 lettres ; l'hôte fait tourner la partie, le serveur ne fait que transmettre.
// Lancer : node server/server.mjs   (port : variable PORT, 8080 par défaut)
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'pwa');
const PORT = Number(process.env.PORT) || 8080;
const MAX_MSG = 512 * 1024;          // un état de partie fait quelques Ko
const MAX_GUESTS = 4;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8'
};

/* ---------------------------------------------------------------- fichiers statiques */
async function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('not a file');
    const ext = extname(file);
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }).end(); return; }   // le gros fichier du jeu n'est renvoyé que s'il a changé
    const body = await readFile(file);
    res.writeHead(200, {
      ETag: etag,
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      // la page et le service worker sont toujours revérifiés ; le reste peut rester en cache
      'Cache-Control': ext === '.html' || path.endsWith('sw.js') || ext === '.webmanifest' ? 'no-cache' : 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
}

/* ---------------------------------------------------------------- WebSocket minimal */
function accept(key) { return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64'); }

function frame(opcode, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([0x80 | opcode, len])
    : len < 65536 ? Buffer.from([0x80 | opcode, 126, len >> 8, len & 255])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(len), 2); return b; })();
  return Buffer.concat([head, payload]);
}

class Client {
  constructor(socket) {
    this.id = crypto.randomUUID().slice(0, 8);
    this.socket = socket; this.buf = Buffer.alloc(0); this.frags = []; this.alive = true; this.room = null; this.role = null;
    socket.on('data', d => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => socket.destroy());
  }
  send(obj) { if (!this.socket.destroyed) this.socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); }
  close() { if (!this.socket.destroyed) { this.socket.write(frame(8, Buffer.alloc(0))); this.socket.end(); } }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG) { this.close(); return; }
      if (!masked) { this.close(); return; }                     // un client doit masquer ses trames
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 8) { this.close(); return; }
      if (op === 9) { this.socket.write(frame(10, data)); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 0) {
        this.frags.push(data);
        if (!fin) continue;
        const text = Buffer.concat(this.frags).toString('utf8'); this.frags = [];
        let msg; try { msg = JSON.parse(text); } catch { continue; }
        this.alive = true;
        handle(this, msg);
      }
    }
  }
  onClose() { leave(this); }
}

/* ---------------------------------------------------------------- tables */
const rooms = new Map();          // code -> { host: Client, guests: Map<id, Client> }
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  for (;;) {
    const c = Array.from({ length: 4 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join('');
    if (!rooms.has(c)) return c;
  }
}

function handle(c, m) {
  if (m.t === 'create' && !c.room) {
    const code = newCode();
    rooms.set(code, { host: c, guests: new Map() });
    c.room = code; c.role = 'host';
    c.send({ t: 'created', room: code, id: c.id });
    return;
  }
  if (m.t === 'join' && !c.room) {
    const code = String(m.room || '').toUpperCase().trim();
    const r = rooms.get(code);
    if (!r) { c.send({ t: 'error', code: 'room', msg: 'Aucune table avec ce code.' }); return; }
    if (r.guests.size >= MAX_GUESTS) { c.send({ t: 'error', code: 'full', msg: 'Cette table est complète.' }); return; }
    c.room = code; c.role = 'guest'; r.guests.set(c.id, c);
    c.send({ t: 'joined', room: code, id: c.id });
    r.host.send({ t: 'join', from: c.id, name: String(m.name || '').slice(0, 14), avatar: String(m.avatar || ''), token: String(m.token || '').slice(0, 40) });
    return;
  }
  const r = c.room && rooms.get(c.room); if (!r) return;
  if (m.t === 'to' && c.role === 'host') {                           // hôte -> un invité ou tous
    const targets = m.to === 'all' ? [...r.guests.values()] : [r.guests.get(m.to)].filter(Boolean);
    for (const g of targets) g.send({ t: 'msg', data: m.data });
    return;
  }
  if (m.t === 'kick' && c.role === 'host') { const g = r.guests.get(m.to); if (g) { g.send({ t: 'error', code: 'kick', msg: m.msg || "L'hôte a fermé votre place." }); g.close(); } return; }
  if (m.t === 'host' && c.role === 'guest') { r.host.send({ t: 'msg', from: c.id, data: m.data }); return; }
}

function leave(c) {
  const r = c.room && rooms.get(c.room); if (!r) return;
  if (c.role === 'host') {
    for (const g of r.guests.values()) { g.send({ t: 'closed', msg: "L'hôte a quitté la table." }); g.close(); }
    rooms.delete(c.room);
  } else {
    r.guests.delete(c.id);
    r.host.send({ t: 'leave', from: c.id });
  }
  c.room = null;
}

/* ---------------------------------------------------------------- serveur */
const clients = new Set();
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveStatic(req, res);
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept(key)}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);
  const c = new Client(socket);
  clients.add(c);
  socket.on('close', () => clients.delete(c));
});
// battement : on ferme les connexions mortes (téléphone en veille, réseau coupé)
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) { c.socket.destroy(); continue; }
    c.alive = false;
    if (!c.socket.destroyed) c.socket.write(frame(9, Buffer.alloc(0)));
  }
}, 25000).unref();

server.listen(PORT, () => console.log(`Table de Tarot : http://localhost:${PORT}  (tables en ligne sur /ws)`));
