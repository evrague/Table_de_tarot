// test/simulate.mjs — joue des centaines de donnes entre IA pour vérifier les règles :
// cartes jouées toujours permises, 91 points au total, scores à somme nulle, aucune carte perdue.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = ['js/cards.js', 'js/rules.js', 'js/ai.js'].map(p => readFileSync(join(root, p), 'utf8')).join('\n');

const harness = `
var G = null; function log(){}
var STATS = { poignees: 0, chelemAnnonce: 0, chelemFait: 0 };
${code}
function simDeal(n, level){
  G = { n, level, scores: Array(n).fill(0), history: [], dealNo: 1, dealer: 0, log: [] };
  for (;;) {
    const d = shuffle(makeDeck()); const cs = n === 5 ? 3 : 6, hs = (78 - cs) / n;
    Object.assign(G, { chienSize: cs, chien: d.slice(0, cs), hands: [], bids: [], best: 0, taker: -1, called: null, partner: -1,
      partnerKnown: false, trick: [], trickNo: 0, piles: Array.from({length:n},()=>[]), adj: Array(n).fill(0), suitLed: {}, pab: null,
      played: [], ecartIds: null, voids: Array.from({length:n},()=>({S:0,H:0,C:0,D:0,T:0})), turn: -1,
      poignees: [], chelem: false, attTricks: 0, hands0len: 0 });
    for (let i = 0; i < n; i++) G.hands.push(sortCards(d.slice(cs + i*hs, cs + (i+1)*hs)));
    for (let i = 0; i < n; i++) { const p = (G.dealer+1+i)%n; const b = aiBid(p); if (b > G.best) { G.best = b; G.taker = p; } }
    if (G.taker >= 0) break;
  }
  const t = G.taker; G.contract = CONTRACTS[G.best];
  if (n === 5) { G.called = aiCall(t); const h = G.hands.findIndex(x => x.some(c => c.id === G.called)); G.partner = h >= 0 ? h : t; } else G.partner = t;
  if (G.contract.k <= 2) {
    G.hands[t].push(...G.chien); sortCards(G.hands[t]);
    const ec = aiDiscard(t);
    if (ec.length !== G.chienSize) throw new Error('écart de mauvaise taille');
    if (ec.some(c => isOud(c) || (c.s !== 'T' && c.r === 14))) throw new Error('écart interdit');
    G.hands[t] = G.hands[t].filter(c => !ec.includes(c)); G.piles[t].push(...ec); G.ecartIds = ec.map(c => c.id);
  } else if (G.contract.k === 3) G.piles[t].push(...G.chien);
  G.hands0len = G.hands[t].length;
  G.chelem = aiChelem(t); if (G.chelem) STATS.chelemAnnonce++;
  let leader = G.chelem ? t : (G.dealer + 1) % n; const nT = G.hands0len;
  for (let k = 0; k < nT; k++) {
    G.trickNo = k; G.trick = [];
    for (let i = 0; i < n; i++) {
      const p = (leader + i) % n; G.turn = p;
      if (k === 0) { const lv = aiPoignee(p); if (lv >= 0) { const pc = poigneeCards(p, lv); if (pc.length !== POIGNEE[n][lv]) throw new Error('poignée mal montrée'); G.poignees.push({p, level: lv}); STATS.poignees++; } }
      const L = legal(p); const c = aiPlay(p);
      if (!L.includes(c)) throw new Error('carte non permise : ' + c.id);
      const led = ledSuit();
      if (led && c.s !== 'E') { if (c.s !== led) { G.voids[p][led] = 1; if (c.s !== 'T') G.voids[p].T = 1; } if (led === 'T' && c.s !== 'T') G.voids[p].T = 1; }
      G.hands[p] = G.hands[p].filter(x => x !== c); G.trick.push({p, c}); G.played.push(c.id);
      if (c.id === G.called) G.partnerKnown = true;
    }
    let w = trickState().bestP; const last = k === nT - 1;
    const lead = G.trick[0]; if (last && lead.c.s === 'E' && isAtt(lead.p) && G.attTricks === k) w = lead.p;
    if (isAtt(w)) G.attTricks++;
    const ls = ledSuit(); if (ls && ls !== 'T') G.suitLed[ls] = (G.suitLed[ls]||0) + 1;
    for (const x of G.trick) { if (x.c.s === 'E' && x.p !== w && !last) { G.piles[x.p].push(x.c); G.adj[x.p] -= .5; G.adj[w] += .5; } else G.piles[w].push(x.c); }
    if (last && G.trick.some(x => x.c.id === 'T1')) G.pab = { w };
    leader = w;
  }
  const cards = G.piles.flat().length + (G.contract.k === 4 ? G.chien.length : 0);
  if (cards !== 78) throw new Error('cartes perdues : ' + cards);
  let total = G.piles.flat().reduce((a,c)=>a+pts(c),0) + G.adj.reduce((a,b)=>a+b,0) + (G.contract.k === 4 ? G.chien.reduce((a,c)=>a+pts(c),0) : 0);
  if (Math.abs(total - 91) > 1e-9) throw new Error('total ' + total);
  score();
  if (G.scores.reduce((a,b)=>a+b,0) !== 0) throw new Error('scores non nuls');
  if (G.attTricks === G.hands0len) STATS.chelemFait++;
  const h = G.history.at(-1); if (!h.chelem || h.poignees.length !== G.poignees.length) throw new Error('historique incomplet');
  return G.result;
}
/* donne arrangée : le preneur (siège 0) a l'Excuse et les atouts du 5 au 21 ; il doit annoncer et réussir le chelem */
function forcedChelem(level){
  const n = 4;
  const strong = ['E'].concat(Array.from({length:17}, (_, i) => 'T' + (21 - i))).map(id => CARD[id]);
  const rest = shuffle(makeDeck().filter(c => !strong.includes(CARD[c.id]))).map(c => CARD[c.id]);
  G = { n, level, scores: Array(n).fill(0), history: [], dealNo: 1, dealer: 3, log: [], chienSize: 6, chien: rest.slice(0, 6),
    hands: [sortCards(strong.slice()), sortCards(rest.slice(6, 24)), sortCards(rest.slice(24, 42)), sortCards(rest.slice(42, 60))],
    bids: [], best: 3, taker: 0, partner: 0, called: null, partnerKnown: false, trick: [], trickNo: 0, piles: [[],[],[],[]], adj: [0,0,0,0],
    suitLed: {}, pab: null, played: [], ecartIds: null, voids: Array.from({length:n},()=>({S:0,H:0,C:0,D:0,T:0})), turn: -1,
    poignees: [], chelem: false, attTricks: 0, hands0len: 18, contract: CONTRACTS[3] };
  G.piles[0].push(...G.chien);
  G.chelem = aiChelem(0);
  if (!G.chelem) throw new Error("l'IA aurait dû annoncer le chelem");
  let leader = 0;
  for (let k = 0; k < 18; k++) {
    G.trickNo = k; G.trick = [];
    for (let i = 0; i < n; i++) { const p = (leader + i) % n; const c = aiPlay(p); if (!legal(p).includes(c)) throw new Error('carte non permise'); G.hands[p] = G.hands[p].filter(x => x !== c); G.trick.push({p, c}); G.played.push(c.id); }
    let w = trickState().bestP; const last = k === 17;
    const lead = G.trick[0]; if (last && lead.c.s === 'E' && isAtt(lead.p) && G.attTricks === k) w = lead.p;
    if (isAtt(w)) G.attTricks++;
    for (const x of G.trick) { if (x.c.s === 'E' && x.p !== w && !last) { G.piles[x.p].push(x.c); G.adj[x.p] -= .5; G.adj[w] += .5; } else G.piles[w].push(x.c); }
    leader = w;
  }
  if (G.attTricks !== 18) throw new Error('chelem non réalisé : ' + G.attTricks + ' plis');
  if (!G.piles[0].some(c => c.s === 'E')) throw new Error("l'Excuse aurait dû gagner le dernier pli");
  score();
  if (G.result.chel !== 400) throw new Error('prime de chelem ' + G.result.chel);
  if (G.scores.reduce((a,b)=>a+b,0) !== 0) throw new Error('scores non nuls');
  return G.result;
}
`;
const ctx = vm.createContext({ console, Math });
vm.runInContext(harness, ctx);

for (const level of ['weak', 'mid', 'expert']) {
  for (const n of [3, 4, 5]) {
    let wins = 0, N = 300;
    for (let i = 0; i < N; i++) { const r = vm.runInContext(`simDeal(${n}, '${level}')`, ctx); if (r.win) wins++; }
    console.log(`${level.padEnd(7)} à ${n} : ${N} donnes OK, contrats réussis ${Math.round(wins / N * 100)} %`);
  }
}
console.log('Poignées annoncées :', vm.runInContext('STATS.poignees', ctx), '· chelems annoncés :', vm.runInContext('STATS.chelemAnnonce', ctx), '· chelems réalisés :', vm.runInContext('STATS.chelemFait', ctx));
for (const level of ['mid', 'expert']) for (let i = 0; i < 50; i++) vm.runInContext(`forcedChelem('${level}')`, ctx);
console.log('Chelem arrangé : annoncé, réalisé avec l\'Excuse au dernier pli, +400 points (100 donnes OK)');
