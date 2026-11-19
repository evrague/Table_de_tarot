/* ai.js — Joueurs gérés par l'ordinateur, trois niveaux.
   Faible        : annonces approximatives, joue souvent au hasard parmi les cartes permises.
   Intermédiaire : heuristiques classiques (charger le partenaire, gagner au plus juste, sauver le Petit).
   Expert        : compte les cartes, repère les coupes (couleurs manquantes), joue les maîtresses,
                   ne charge que si le pli ne peut plus être pris. */

/* ---------- Évaluation de la main (méthode à points courante : prise ≈ 40, garde ≈ 56…) ---------- */
function strength(h) {
  let s = 0;
  const has = id => h.some(c => c.id === id);
  const tr = h.filter(c => c.s === 'T'); const nt = tr.length;
  if (has('T21')) s += 10;
  if (has('E')) s += 8;
  if (has('T1')) s += nt >= 6 ? 9 : nt >= 4 ? 6 : 2;
  s += nt * 2 + tr.filter(c => c.r >= 16).length * 1.5;
  for (const su of SUITS) {
    const cs = h.filter(c => c.s === su);
    const R = cs.some(c => c.r === 14), D = cs.some(c => c.r === 13);
    s += R && D ? 10 : R ? 6 : D ? 3 : 0;
    if (cs.some(c => c.r === 12)) s += 2;
    if (cs.some(c => c.r === 11)) s += 1;
    if (cs.length === 0) s += nt >= 5 ? 6 : 3;
    else if (cs.length === 1) s += 3;
    else if (cs.length >= 5) s += (cs.length - 4) * 2;
  }
  return s * 18 / h.length;
}

function aiBid(p) {
  const lv = G.level;
  const noise = lv === 'weak' ? 14 : lv === 'mid' ? 3 : 1;
  const shift = lv === 'weak' ? 4 : 0;
  const s = strength(G.hands[p]) + (Math.random() * 2 - 1) * noise - shift;
  const k = s >= 81 ? 4 : s >= 71 ? 3 : s >= 56 ? 2 : s >= 40 ? 1 : 0;
  return k > G.best ? k : 0;
}

function aiCall(p) {
  const h = G.hands[p]; const o = callOptions(p);
  if (G.level === 'weak') return o[Math.floor(Math.random() * o.length)];
  // appeler dans la couleur où l'on est le plus long (on pourra servir le partenaire)
  return o.reduce((a, b) => (h.filter(c => c.s === b[0]).length > h.filter(c => c.s === a[0]).length ? b : a));
}

function aiDiscard(p) {
  const h = G.hands[p], k = G.chienSize;
  const len = s => h.filter(c => c.s === s).length;
  let cand = h.filter(c => c.s !== 'T' && c.s !== 'E' && c.r !== 14);
  if (G.level === 'weak') shuffle(cand);
  else cand.sort((a, b) => len(a.s) - len(b.s) || b.r - a.r);   // se couper dans les couleurs courtes, mettre les points à l'abri
  let out = cand.slice(0, k);
  if (out.length < k) out = out.concat(h.filter(c => c.s === 'T' && !isOud(c)).sort((a, b) => a.r - b.r).slice(0, k - out.length));
  return out;
}

const cost = c => (c.s === 'T' ? (c.r === 1 ? 50 : c.r === 21 ? 60 : 2 + c.r * 0.3) : pts(c) * 2 + c.r * 0.05);

/* ---------- Mémoire de jeu (expert) ---------- */
function unseen(v) {
  const mine = new Set(G.hands[v].map(c => c.id));
  const known = new Set(G.played);
  if (v === G.taker && G.ecartIds) G.ecartIds.forEach(id => known.add(id));
  return ALL_IDS.filter(id => !known.has(id) && !mine.has(id)).map(id => CARD[id]);
}
function seatsAfter() {
  const leader = G.trick.length ? G.trick[0].p : G.turn;
  const out = [];
  for (let i = G.trick.length + 1; i < G.n; i++) out.push((leader + i) % G.n);
  return out;
}
/* Un adversaire placé après moi peut-il encore prendre ce pli si `best` le mène ? */
function threat(v, best, led, after) {
  const opps = after.filter(o => !isAlly(v, o));
  if (!opps.length) return false;
  const un = unseen(v);
  const anyTrump = un.some(c => c.s === 'T');
  if (best.s === 'T') return un.some(c => c.s === 'T' && c.r > best.r) && opps.some(o => !G.voids[o].T);
  const higher = un.some(c => c.s === led && c.r > best.r);
  const suitLeft = un.filter(c => c.s === led).length;
  return opps.some(o =>
    (!G.voids[o][led] && higher) ||
    ((G.voids[o][led] || suitLeft < after.length) && !G.voids[o].T && anyTrump));
}

/* ---------- Jeu de la carte ---------- */
/* poignée : l'ordinateur annonce la plus forte ; au niveau faible il oublie parfois */
function aiPoignee(p) {
  const o = poigneeOptions(p); if (!o.length) return -1;
  if (G.level === 'weak' && Math.random() < 0.35) return -1;
  return o.at(-1);
}
/* chelem : seulement avec une main écrasante (atouts maîtres, couleurs tenues par les rois) */
function aiChelem(p) {
  if (G.level === 'weak') return false;
  const h = G.hands[p], tr = h.filter(c => c.s === 'T'), outside = 21 - tr.length;
  let top = 0; for (let r = 21; r >= 1 && h.some(c => c.s === 'T' && c.r === r); r--) top++;
  const plain = h.filter(c => c.s !== 'T' && c.s !== 'E');
  return tr.length >= outside + 3 && top >= Math.min(outside, 7) && plain.every(c => c.r >= 13 && h.some(k => k.s === c.s && k.r === 14));
}

function aiPlay(p) {
  let L = legal(p);
  // chelem annoncé : l'Excuse du preneur est gardée pour le dernier pli, où elle gagne
  if (G.chelem && isAtt(p)) {
    const ex = L.find(c => c.s === 'E');
    if (ex) { if (G.hands[p].length === 1) return ex; const rest = L.filter(c => c.s !== 'E'); if (rest.length) L = rest; }
  }
  if (L.length === 1) return L[0];
  if (G.level === 'weak' && Math.random() < 0.6) {
    const pool = L.filter(c => c.s !== 'E' || G.hands[p].length <= 2);
    return (pool.length ? pool : L)[Math.floor(Math.random() * (pool.length || L.length))];
  }
  return G.level === 'expert' ? playExpert(p, L) : playMid(p, L);
}

function aiLead(p, L) {
  const h = G.hands[p];
  const trumps = L.filter(c => c.s === 'T'), plain = L.filter(c => c.s !== 'T');
  if (isAtt(p) && trumps.length >= Math.ceil(h.length / 2)) {
    const t = trumps.filter(c => c.r > 1 && c.r !== 21); if (t.length) return maxBy(t, c => c.r);
  }
  const kings = plain.filter(c => c.r === 14 && !G.suitLed[c.s]);
  if (kings.length) return kings[0];
  if (plain.length) {
    const cnt = s => h.filter(c => c.s === s).length;
    const s = maxBy([...new Set(plain.map(c => c.s))], cnt);
    return minBy(plain.filter(c => c.s === s), c => c.r);
  }
  const t = trumps.filter(c => c.r !== 1); return t.length ? minBy(t, c => c.r) : trumps[0];
}

function loseCheap(nonE, exc) {
  const low = minBy(nonE, cost);
  if (exc && cost(low) >= 5 && (low.s !== 'T' || low.r === 1)) return exc;
  const np = nonE.filter(c => !(c.s === 'T' && c.r === 1));
  return minBy(np.length ? np : nonE, cost);
}
function charge(nonE) {
  const plain = nonE.filter(c => c.s !== 'T');
  if (plain.length) return maxBy(plain, c => pts(c) * 10 + c.r);
  const petit = nonE.find(c => c.s === 'T' && c.r === 1); if (petit) return petit;
  return minBy(nonE, cost);
}

function playMid(p, L) {
  const h = G.hands[p], tr = G.trick, after = G.n - tr.length - 1;
  const exc = L.find(c => c.s === 'E'); const nonE = L.filter(c => c.s !== 'E');
  if (exc && h.length <= 2) return exc;
  if (!nonE.length) return exc;
  if (!tr.length) return aiLead(p, nonE);
  const { best, bestP, led } = trickState();
  const allyWin = best ? isAlly(p, bestP) : false;
  const W = nonE.filter(c => beats(c, best, led));
  const trickPts = tr.reduce((a, x) => a + pts(x.c), 0);
  if (allyWin) {
    const trumped = tr.some(x => x.c.s === 'T');
    const safe = after === 0 || (best.s === 'T' && best.r >= 18) || (best.s !== 'T' && best.r >= 13 && after <= 1 && !trumped);
    if (safe) return charge(nonE);
  } else if (W.length) {
    if (after === 0) {
      const petit = W.find(c => c.s === 'T' && c.r === 1); if (petit) return petit;
      const pw = W.filter(c => c.s !== 'T'); if (pw.length) return maxBy(pw, c => pts(c) * 10 + c.r);
      return minBy(W, c => (c.r === 21 ? 100 : c.r));
    }
    const pw = W.filter(c => c.s !== 'T');
    if (pw.length) { const k = pw.find(c => c.r === 14); if (k && (G.suitLed[k.s] || 0) <= 1) return k; }
    const tw = W.filter(c => c.s === 'T');
    if (tw.length) {
      const np = tw.filter(c => c.r !== 1); const pool = np.length ? np : tw;
      return trickPts >= 5 ? maxBy(pool, c => c.r) : minBy(pool, c => c.r);
    }
  }
  return loseCheap(nonE, exc);
}

function playExpert(p, L) {
  const h = G.hands[p], tr = G.trick;
  const exc = L.find(c => c.s === 'E'); const nonE = L.filter(c => c.s !== 'E');
  if (exc && h.length <= 2) return exc;
  if (!nonE.length) return exc;
  const after = seatsAfter();
  if (!tr.length) return leadExpert(p, nonE, after);
  const { best, bestP, led } = trickState();
  const allyWin = best ? isAlly(p, bestP) : false;
  const trickPts = tr.reduce((a, x) => a + pts(x.c), 0);
  if (allyWin && !threat(p, best, led, after)) return charge(nonE);
  if (!allyWin) {
    const W = nonE.filter(c => beats(c, best, led));
    if (W.length) {
      // gagner à coup sûr avec la carte la moins chère
      const sure = W.filter(c => !threat(p, c, led, after));
      if (sure.length) {
        const petit = sure.find(c => c.s === 'T' && c.r === 1); if (petit) return petit;
        const ps = sure.filter(c => c.s !== 'T'); if (ps.length) return maxBy(ps, c => pts(c) * 10 + c.r);
        return minBy(sure, c => (c.r === 21 ? 30 : c.r));
      }
      if (trickPts >= 6) { const np = W.filter(c => !(c.s === 'T' && c.r === 1)); if (np.length) return maxBy(np, c => (c.s === 'T' ? c.r : 0)); }
    }
  }
  return loseCheap(nonE, exc);
}

function leadExpert(p, L, after) {
  const h = G.hands[p];
  const trumps = L.filter(c => c.s === 'T'), plain = L.filter(c => c.s !== 'T');
  const un = unseen(p);
  // 1. le preneur long à l'atout fait tomber les atouts adverses, en commençant par ses maîtres
  if (isAtt(p) && trumps.length >= Math.ceil(h.length / 2) && un.some(c => c.s === 'T')) {
    const t = trumps.filter(c => c.r > 1);
    const master = t.filter(c => !un.some(u => u.s === 'T' && u.r > c.r));
    if (master.length) return minBy(master, c => c.r);
    const mid = t.filter(c => c.r !== 21); if (mid.length) return maxBy(mid, c => c.r);
  }
  // 2. jouer une carte maîtresse que personne ne peut couper
  const masters = plain.filter(c => !threat(p, c, c.s, after));
  if (masters.length) return maxBy(masters, c => pts(c));
  // 3. en défense, faire couper le preneur là où il est coupé
  if (!isAtt(p) && G.taker >= 0) {
    const cut = plain.filter(c => G.voids[G.taker][c.s] && c.r < 11);
    if (cut.length) return minBy(cut, c => c.r);
  }
  // 4. sinon petite carte de la couleur la plus longue
  if (plain.length) {
    const cnt = s => h.filter(c => c.s === s).length;
    const s = maxBy([...new Set(plain.map(c => c.s))], cnt);
    return minBy(plain.filter(c => c.s === s), c => c.r);
  }
  const t = trumps.filter(c => c.r !== 1); return t.length ? minBy(t, c => c.r) : trumps[0];
}
