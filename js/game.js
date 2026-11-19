/* game.js — Déroulement d'une donne : distribution, classement, enchères, appel du roi, chien, jeu, décompte. */
let G = null, pending = null, SESSION = 0, FAST = false;

function log(m) { G.log.unshift(m); if (G.log.length > 80) G.log.pop(); }
function wait(ms, tok) {
  return new Promise(r => setTimeout(r, ms * (FAST ? 0.4 : 1))).then(() => { if (tok !== SESSION) throw 'abort'; });
}
function ask(seat, type, tok) {
  // place tenue par un joueur en ligne : la question part vers son appareil
  if (seat >= 0 && Online.isRemote(seat)) return Online.askRemote(seat, type).then(v => { if (tok !== SESSION) throw 'abort'; return v; });
  return new Promise(res => { pending = { seat, type, resolve: res }; render(); })
    .then(v => { if (tok !== SESSION) throw 'abort'; return v; });
}
function answer(v) {
  const p = pending; if (!p) return;
  pending = null;
  if (p.seat >= 0 && G.humans.length > 1) G.reveal[p.seat] = false;
  p.resolve(v);
}

function deal() {
  if (G.tutorial) { Tutor.guidedDeal(); return; }      // didacticiel : main préparée
  for (;;) {
    const d = shuffle(makeDeck()); const cs = G.n === 5 ? 3 : 6; const hs = (78 - cs) / G.n;
    G.chienSize = cs; G.chien = d.slice(0, cs); G.hands = [];
    for (let i = 0; i < G.n; i++) G.hands.push(d.slice(cs + i * hs, cs + (i + 1) * hs));   // non classées : on les classe à l'écran
    const ps = G.hands.findIndex(h => { const t = h.filter(c => c.s === 'T'); return t.length === 1 && t[0].r === 1 && !h.some(c => c.s === 'E'); });
    if (ps < 0) return;
    log(`${G.names[ps]} a le Petit sec : on redistribue.`);
  }
}

/* resume = une donne sauvegardée au début d'un pli (Save.applyDeal), à reprendre avant de continuer normalement */
async function runGame(resume) {
  const tok = ++SESSION;
  try {
    if (resume) { Save.applyDeal(resume); render(); await playTricks(tok, resume.trickNo, resume.leader); await endDeal(tok); }
    for (;;) { Save.store(-1); await playDeal(tok); }
  } catch (e) { if (e !== 'abort') console.error(e); }
}

async function playDeal(tok) {
  const n = G.n;
  G.dealNo++;
  Object.assign(G, {
    phase: 'deal', bids: Array(n).fill(null), best: 0, taker: -1, contract: null, called: null, partner: -1, partnerKnown: false,
    trick: [], trickNo: 0, piles: Array.from({ length: n }, () => []), adj: Array(n).fill(0), chienCards: null, lastTrick: null,
    result: null, suitLed: {}, pab: null, winFlash: -1, gather: -1, freshId: null, turn: -1, played: [], ecartIds: null, say: {}, celebrated: false, raised: null,
    voids: Array.from({ length: n }, () => ({ S: false, H: false, C: false, D: false, T: false })),
    poignees: [], chelem: false, attTricks: 0, hands0len: 0, showPoig: null,
    sel: new Set(), newIds: new Set()
  });
  deal();
  log(`Donne ${G.dealNo} : ${G.names[G.dealer]} distribue.`);
  G.anim = 'deal'; render(); G.anim = null;
  await wait(1500, tok);
  G.hands.forEach(sortCards);            // classement animé (FLIP 3D)
  render();
  await wait(800, tok);

  /* Enchères */
  G.phase = 'bid';
  for (let i = 0; i < n; i++) {
    const p = (G.dealer + 1 + i) % n; G.turn = p; render();
    let b;
    if (G.isHuman[p]) b = await ask(p, 'bid', tok); else { await wait(750, tok); b = G.tutorial ? 0 : aiBid(p); }   // didacticiel : les autres passent
    G.bids[p] = b; if (b > G.best) { G.best = b; G.taker = p; }
    G.say[p] = b ? BIDN[b] + ' !' : 'Passe';
    log(`${G.names[p]} : ${BIDN[b]}.`); render();
  }
  if (G.taker < 0) {
    log('Tout le monde passe : on redistribue.'); G.phase = 'allpass'; render();
    await wait(1600, tok); G.dealer = (G.dealer + 1) % n; G.dealNo--; return;
  }
  G.contract = CONTRACTS[G.best]; const t = G.taker;
  G.say = { [t]: 'Je prends !' };
  log(`${G.names[t]} prend une ${G.contract.name}.`);

  /* Appel du roi (à 5) */
  if (n === 5) {
    G.phase = 'call'; G.turn = t; render();
    let id;
    if (G.isHuman[t]) id = await ask(t, 'call', tok); else { await wait(900, tok); id = aiCall(t); }
    G.called = id; G.say = { [t]: `Le ${HNAME[CARD[id].r]} de ${SYM[id[0]]} !` };
    const holder = G.hands.findIndex(h => h.some(c => c.id === id));
    G.partner = holder >= 0 ? holder : t;
    log(`${G.names[t]} appelle ${cardName(CARD[id])}.`);
  } else G.partner = t;

  /* Chien */
  G.chienCards = G.chien.slice(); G.say = {};
  if (G.contract.k <= 2) {
    G.phase = 'chien'; G.turn = t; render(); await wait(2400, tok);
    G.hands[t].push(...G.chien); sortCards(G.hands[t]);
    let ec;
    if (G.isHuman[t]) {
      G.newIds = new Set(G.chien.map(c => c.id)); G.phase = 'discard';
      ec = await ask(t, 'discard', tok); G.newIds = new Set();
    } else { G.phase = 'discard'; render(); ec = aiDiscard(t); await wait(900, tok); }
    G.hands[t] = G.hands[t].filter(c => !ec.includes(c)); G.piles[t].push(...ec);
    G.ecartIds = ec.map(c => c.id);
    const shown = ec.filter(c => c.s === 'T');
    log(`${G.names[t]} fait son écart${shown.length ? ' (atout montré : ' + shown.map(shortName).join(', ') + ')' : ''}.`);
  } else if (G.contract.k === 3) { G.piles[t].push(...G.chien); log('Le chien va au preneur, sans être retourné.'); }
  else log('Le chien va à la défense, sans être retourné.');
  G.chienCards = null;

  /* Chelem : le preneur peut l'annoncer avant la première carte ; il entame alors */
  G.chienCards = null;
  G.hands0len = G.hands[t].length;
  let chel;
  if (G.tutorial) chel = false; else if (G.isHuman[t]) chel = await ask(t, 'chelem', tok); else chel = aiChelem(t);
  if (chel) { G.chelem = true; G.say = { [t]: 'Chelem !' }; log(`${G.names[t]} annonce le chelem : il doit remporter tous les plis.`); render(); await wait(1400, tok); }

  /* Jeu de la carte */
  await playTricks(tok, 0, G.chelem ? t : (G.dealer + 1) % n);
  await endDeal(tok);
}

async function playTricks(tok, from, leader) {
  const n = G.n, nT = G.hands0len;
  G.phase = 'play';
  for (let k = from; k < nT; k++) {
    G.trickNo = k; G.trick = []; G.winFlash = -1; G.gather = -1; if (k) G.say = {};
    Save.store(leader);
    for (let i = 0; i < n; i++) {
      const p = (leader + i) % n; G.turn = p; render();
      if (k === 0) await offerPoignee(tok, p);
      let c;
      if (G.isHuman[p]) c = await ask(p, 'play', tok); else { await wait(650, tok); c = aiPlay(p); }
      G.raised = null;
      playCard(p, c); render();
    }
    let w = trickState().bestP;
    // chelem : l'Excuse du camp preneur, menée au dernier pli après tous les autres plis, remporte ce pli
    const lead = G.trick[0];
    if (k === nT - 1 && lead.c.s === 'E' && isAtt(lead.p) && G.attTricks === k) w = lead.p;
    if (isAtt(w)) G.attTricks++;
    G.winFlash = w; G.turn = -1; render();
    await wait(G.coach ? 2400 : 1000, tok);           // avec les conseils, le temps de lire l'explication du pli
    G.gather = w; render();               // le pli vole vers le gagnant
    await wait(520, tok);
    collect(w, k === nT - 1); leader = w; G.gather = -1;
  }
}

/* annonce d'une poignée au moment de jouer sa première carte */
async function offerPoignee(tok, p) {
  const opts = poigneeOptions(p); if (!opts.length) return;
  const level = G.isHuman[p] ? await ask(p, 'poignee', tok) : aiPoignee(p);
  if (level < 0 || level === undefined) return;
  const cards = poigneeCards(p, level);
  G.poignees.push({ p, level, cards: ids(cards) });
  G.showPoig = { p, level, cards: ids(cards) };
  G.say = Object.assign({}, G.say, { [p]: POIGNEE_NAME[level][0].toUpperCase() + POIGNEE_NAME[level].slice(1) + ' !' });
  log(`${G.names[p]} annonce une ${POIGNEE_NAME[level]} (${cards.length} atouts montrés).`);
  render(); await wait(2600, tok);
  G.showPoig = null; render();
}

async function endDeal(tok) {
  G.trick = []; G.turn = -1;
  score(); if (!G.tutorial) Stats.afterDeal(); G.phase = 'score'; G.say = {};
  await ask(-1, 'next', tok);
  if (G.tutorial) await Tutor.finish(tok);
  G.dealer = (G.dealer + 1) % G.n;
}

function playCard(p, c) {
  const led = ledSuit();
  if (led && c.s !== 'E') {               // mémoriser les coupes pour l'IA experte
    if (c.s !== led) { G.voids[p][led] = true; if (c.s !== 'T') G.voids[p].T = true; }
    if (led === 'T' && c.s !== 'T') G.voids[p].T = true;
  }
  G.hands[p] = G.hands[p].filter(x => x !== c);
  G.trick.push({ p, c }); G.played.push(c.id); G.freshId = c.id;
  if (G.called && c.id === G.called && !G.partnerKnown && G.partner !== G.taker) {
    G.partnerKnown = true; G.say = { [p]: "C'est moi !" }; log(`${G.names[p]} joue ${cardName(c)} : c'est le partenaire.`);
  }
}

function collect(w, last) {
  const ls = ledSuit(); if (ls && ls !== 'T') G.suitLed[ls] = (G.suitLed[ls] || 0) + 1;
  const e = G.trick.find(x => x.c.s === 'E');
  for (const x of G.trick) {
    // l'Excuse reste à son camp (échangée contre une carte basse), sauf au dernier pli
    if (x.c.s === 'E' && x.p !== w && !last) { G.piles[x.p].push(x.c); G.adj[x.p] -= 0.5; G.adj[w] += 0.5; }
    else G.piles[w].push(x.c);
  }
  if (last && G.trick.some(x => x.c.id === 'T1')) G.pab = { w };
  log(`${G.names[w]} remporte le pli${e && e.p !== w && !last ? ' (Excuse gardée par ' + G.names[e.p] + ')' : ''}.`);
  G.lastTrick = { cards: G.trick.slice(), w }; G.trick = [];
}
