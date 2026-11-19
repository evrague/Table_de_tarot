/* cards.js — Le jeu de 78 cartes : données, noms, valeurs. */
const SUITS = ['S', 'H', 'C', 'D'];
const SYM = { S: '♠', H: '♥', C: '♣', D: '♦' };
const SNAME = { S: 'pique', H: 'cœur', C: 'trèfle', D: 'carreau' };
const RED = { H: 1, D: 1 };
const HON = { 11: 'V', 12: 'C', 13: 'D', 14: 'R' };
const HNAME = { 11: 'valet', 12: 'cavalier', 13: 'dame', 14: 'roi' };
const CONTRACTS = [null,
  { k: 1, name: 'Petite', mult: 1 },
  { k: 2, name: 'Garde', mult: 2 },
  { k: 3, name: 'Garde sans le chien', mult: 4 },
  { k: 4, name: 'Garde contre le chien', mult: 6 }];
const BIDN = ['Passe', 'Petite', 'Garde', 'Garde sans', 'Garde contre'];
const NEED = [56, 51, 41, 36];               // points requis selon le nombre de bouts
const AI_NAMES = ['Odette', 'Marcel', 'Simone', 'Gaston', 'Yvonne'];
const LEVELS = { weak: 'Faible', mid: 'Intermédiaire', expert: 'Expert' };
const ORDER = { S: 0, H: 1, C: 2, D: 3, T: 4, E: 5 };

function makeDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 1; r <= 14; r++) d.push({ id: s + r, s, r });
  for (let r = 1; r <= 21; r++) d.push({ id: 'T' + r, s: 'T', r });
  d.push({ id: 'E', s: 'E', r: 0 });
  return d;
}
const CARD = {};
makeDeck().forEach(c => { CARD[c.id] = c; });
const ALL_IDS = Object.keys(CARD);

function pts(c) {
  if (c.s === 'E') return 4.5;
  if (c.s === 'T') return (c.r === 1 || c.r === 21) ? 4.5 : 0.5;
  return c.r === 14 ? 4.5 : c.r === 13 ? 3.5 : c.r === 12 ? 2.5 : c.r === 11 ? 1.5 : 0.5;
}
const isOud = c => c.s === 'E' || (c.s === 'T' && (c.r === 1 || c.r === 21));
function cardName(c) {
  if (c.s === 'E') return "l'Excuse";
  if (c.s === 'T') return c.r === 1 ? 'le Petit' : c.r === 21 ? 'le 21' : `le ${c.r} d'atout`;
  if (c.r > 10) return `le ${HNAME[c.r]} de ${SNAME[c.s]}`;
  return `le ${c.r} de ${SNAME[c.s]}`;
}
function shortName(c) {
  if (c.s === 'E') return 'Excuse';
  if (c.s === 'T') return c.r + ' atout';
  return (HON[c.r] || c.r) + SYM[c.s];
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sortCards = h => h.sort((a, b) => ORDER[a.s] - ORDER[b.s] || a.r - b.r);
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const num = x => String(Math.round(x * 10) / 10).replace('.', ',');
const sgn = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x);
const $ = s => document.querySelector(s);
const minBy = (a, f) => a.reduce((x, y) => (f(y) < f(x) ? y : x));
const maxBy = (a, f) => a.reduce((x, y) => (f(y) > f(x) ? y : x));
