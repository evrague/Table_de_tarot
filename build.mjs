// build.mjs — assemble les sources en un seul fichier HTML (aucune dépendance).
//   dist/tarot.html     : page autonome, à ouvrir directement ou à mettre en ligne
//   dist/fragment.html  : même contenu sans <html>/<head>/<body> (pour l'intégrer dans une autre page)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(root, p), 'utf8');

const inline = html => html
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`)
  .replace(/<script src="((?:js|assets)\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}</script>`);

const src = read('index.html');
const full = inline(src);
const pick = (s, tag) => s.split(`<!-- build:${tag} -->`)[1].split(`<!-- /build:${tag} -->`)[0].trim();
const fragment = inline(pick(src, 'head') + '\n' + pick(src, 'body'));

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/tarot.html'), full);
writeFileSync(join(root, 'dist/fragment.html'), fragment);
console.log(`dist/tarot.html ${(full.length / 1024).toFixed(1)} Ko · dist/fragment.html ${(fragment.length / 1024).toFixed(1)} Ko`);

// dist/pwa : la version installable, servie par server/server.mjs (manifeste, service worker, icônes)
const pwa = join(root, 'dist/pwa');
mkdirSync(join(pwa, 'icons'), { recursive: true });
const pwaHead = ['<link rel="manifest" href="manifest.webmanifest">', '<link rel="icon" href="icons/favicon-32.png" sizes="32x32">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">', '<meta name="apple-mobile-web-app-title" content="Tarot">'].join('\n');
const pwaHtml = full.replace('<!-- build:head -->', pwaHead + '\n<!-- build:head -->');
const version = createHash('sha1').update(pwaHtml).digest('hex').slice(0, 10);
writeFileSync(join(pwa, 'index.html'), pwaHtml);
writeFileSync(join(pwa, 'sw.js'), read('pwa/sw.js').replace('__BUILD__', version));
copyFileSync(join(root, 'pwa/manifest.webmanifest'), join(pwa, 'manifest.webmanifest'));
for (const f of readdirSync(join(root, 'assets/icons'))) copyFileSync(join(root, 'assets/icons', f), join(pwa, 'icons', f));
console.log(`dist/pwa/ version ${version} (à servir avec : npm start)`);
