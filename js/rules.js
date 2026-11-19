/* rules.js — Règles de la FFT : cartes jouables, gagnant du pli, écart, décompte. */

function ledSuit() { const x = G.trick.find(x => x.c.s !== 'E'); return x ? x.c.s : null; }

function beats(c, best, led) {
  if (c.s === 'E') return false;
  if (!best) return true;
  if (c.s === 'T') return best.s !== 'T' || c.r > best.r;
  if (best.s === 'T') return false;
  return c.s === led && c.r > best.r;
}

function trickState() {
  const led = ledSuit(); let best = null, bestP = -1;
  for (const x of G.trick) {
    if (x.c.s === 'E') continue;
    if (!best || beats(x.c, best, led)) { best = x.c; bestP = x.p; }
  }
  return { best, bestP, led };
}

/* Cartes que le joueur p a le droit de jouer */
function legal(p) {
  const h = G.hands[p], tr = G.trick;
  if (!tr.length) {
    // À 5 : on n'entame pas la couleur du roi appelé au premier tour, sauf avec le roi lui-même
    if (G.n === 5 && G.trickNo === 0 && G.called) {
      const cs = G.called[0];
      const f = h.filter(c => c.s !== cs || c.id === G.called);
      if (f.length) return f;
    }
    return h.slice();
  }
  const led = ledSuit(); if (!led) return h.slice();
  const exc = h.filter(c => c.s === 'E');
  const hiT = Math.max(0, ...tr.filter(x => x.c.s === 'T').map(x => x.c.r));
  const trumps = h.filter(c => c.s === 'T');
  const mustTrump = () => { const up = trumps.filter(c => c.r > hiT); return (up.length ? up : trumps).concat(exc); };
  if (led === 'T') return trumps.length ? mustTrump() : h.slice();
  const fol = h.filter(c => c.s === led);
  if (fol.length) return fol.concat(exc);
  if (trumps.length) return mustTrump();
  return h.slice();
}

function isAtt(p) { return p === G.taker || p === G.partner; }

/* Ce que le joueur v sait du camp de o (à 5, le partenaire est secret jusqu'à l'apparition du roi) */
function isAlly(v, o) {
  if (v === o) return true;
  const t = G.taker;
  if (G.n < 5) return (v === t) === (o === t);
  if (v === t) return G.partnerKnown && o === G.partner;
  if (v === G.partner) return o === t;
  if (o === t) return false;
  if (G.partnerKnown && o === G.partner) return false;
  return true;
}

function callOptions(p) {
  const h = G.hands[p];
  let o = SUITS.map(s => s + 14).filter(id => !h.some(c => c.id === id));
  if (!o.length) o = SUITS.map(s => s + 13).filter(id => !h.some(c => c.id === id));
  return o;
}

/* Écart : ni roi ni bout ; l'atout seulement si on n'a pas assez d'autres cartes */
function ecartAllowed(c) {
  if (isOud(c) || (c.s !== 'T' && c.r === 14)) return false;
  if (c.s === 'T') {
    const h = G.hands[G.taker];
    const plain = h.filter(x => x.s !== 'T' && x.s !== 'E' && x.r !== 14).length;
    return plain < G.chienSize;
  }
  return true;
}

/* Poignées (FFT) : nombre d'atouts à montrer selon le nombre de joueurs ; l'Excuse peut remplacer un atout */
const POIGNEE = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };
const POIGNEE_NAME = ['simple poignée', 'double poignée', 'triple poignée'];
const POIGNEE_BONUS = [20, 30, 40];
function trumpCount(p) { const h = G.hands[p]; return h.filter(c => c.s === 'T').length + (h.some(c => c.s === 'E') ? 1 : 0); }
function poigneeOptions(p) { const t = trumpCount(p); return POIGNEE[G.n].map((need, i) => (t >= need ? i : -1)).filter(i => i >= 0); }
/* les cartes montrées : les atouts les plus faibles ; l'Excuse seulement s'il manque un atout (elle dit alors qu'il n'en reste pas d'autre) */
function poigneeCards(p, level) {
  const need = POIGNEE[G.n][level], h = G.hands[p];
  const tr = h.filter(c => c.s === 'T').sort((a, b) => (a.r === 1) - (b.r === 1) || a.r - b.r);   // le Petit en dernier recours
  if (tr.length >= need) return tr.slice(0, need);
  return tr.concat(h.filter(c => c.s === 'E'));
}
/* Chelem : annoncé et réussi +400, annoncé et chuté −200, réussi sans annonce +200, chelem de la défense −200 (pour l'attaque) */
function chelemBonus() {
  const total = G.hands0len, att = G.attTricks || 0;
  if (G.chelem) return att === total ? 400 : -200;
  if (att === total) return 200;
  if (att === 0) return -200;
  return 0;
}

/* Décompte de la donne */
function score() {
  const n = G.n, t = G.taker, pa = G.partner;
  const att = new Set([t, pa]);
  let ap = 0, oud = 0;
  for (const s of att) {
    ap += G.piles[s].reduce((a, c) => a + pts(c), 0) + G.adj[s];
    oud += G.piles[s].filter(isOud).length;
  }
  const need = NEED[oud], diff = ap - need, win = diff >= 0;
  const base = 25 + Math.round(Math.abs(diff)), mult = G.contract.mult;
  let pab = 0;
  if (G.pab) pab = (att.has(G.pab.w) ? 1 : -1) * 10 * mult;
  const sign = win ? 1 : -1;
  const poignees = G.poignees || [];
  const poig = poignees.reduce((a, x) => a + POIGNEE_BONUS[x.level], 0);   // la prime va au camp qui gagne le contrat
  const chel = G.hands0len ? chelemBonus() : 0;
  const res = sign * base * mult + pab + sign * poig + chel;
  const d = Array(n).fill(0);
  for (let i = 0; i < n; i++) if (!att.has(i)) d[i] = -res;
  if (pa !== t) { d[t] = 2 * res; d[pa] = res; } else d[t] = res * (n - 1);
  d.forEach((v, i) => { G.scores[i] += v; });
  G.result = { win, diff, ap, need, oud, base, mult, pab, poig: sign * poig, chel, res, d, t, pa };
  G.history.push({ no: G.dealNo, t, pa, k: G.contract.k, win, d, poignees: poignees.map(x => ({ p: x.p, level: x.level })),
    chelem: { annonce: !!G.chelem, fait: (G.attTricks || 0) === G.hands0len, def: G.hands0len > 0 && (G.attTricks || 0) === 0 } });
  if (G.n === 5 && pa !== t) G.partnerKnown = true;
  log(`${win ? 'Contrat réussi' : 'Contrat chuté'} : ${num(ap)} points pour ${need} requis.`);
}
