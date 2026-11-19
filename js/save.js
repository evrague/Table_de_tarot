/* save.js — Sauvegarde de la partie et statistiques, dans le navigateur (localStorage, sur cet appareil).
   - La partie est sauvegardée au début de chaque pli et entre deux donnes : « Reprendre » repart du pli en cours.
     Une donne interrompue pendant les enchères ou l'écart est redistribuée.
   - Les statistiques de la partie se calculent à partir de la feuille de marque ; celles des joueurs physiques
     se cumulent d'une partie à l'autre, par prénom. */
const SAVE_KEY = 'tarot-partie-v1', STATS_KEY = 'tarot-stats-v1';

const Store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* stockage indisponible */ } }
};
const ids = cards => cards.map(c => c.id);
const cardsOf = list => list.map(id => CARD[id]);

const Save = {
  /* leader >= 0 : sauvegarde au début d'un pli ; sinon entre deux donnes */
  store(leader) {
    if (!G || G.remote || G.online) return;          // une partie en ligne ne se reprend pas seule
    const snap = {
      v: 1, savedAt: Date.now(),
      meta: { n: G.n, humans: G.humans, isHuman: G.isHuman, names: G.names, avatars: G.avatars, level: G.level },
      scores: G.scores, history: G.history, dealer: G.dealer, dealNo: G.dealNo, log: G.log.slice(0, 20), deal: null
    };
    if (leader >= 0 && G.phase === 'play') {
      snap.deal = {
        trickNo: G.trickNo, leader, hands: G.hands.map(ids), piles: G.piles.map(ids), adj: G.adj,
        taker: G.taker, partner: G.partner, partnerKnown: G.partnerKnown, called: G.called, k: G.contract.k, best: G.best, bids: G.bids,
        suitLed: G.suitLed, played: G.played, voids: G.voids, ecartIds: G.ecartIds, chienSize: G.chienSize, chien: ids(G.chien),
        poignees: (G.poignees || []).map(x => ({ p: x.p, level: x.level, cards: x.cards })), chelem: G.chelem, attTricks: G.attTricks,
        hands0len: G.hands0len, lastTrick: G.lastTrick ? { w: G.lastTrick.w, cards: G.lastTrick.cards.map(x => ({ p: x.p, id: x.c.id })) } : null
      };
    }
    Store.set(SAVE_KEY, snap);
  },
  load() { const s = Store.get(SAVE_KEY); return s && s.v === 1 && s.meta ? s : null; },
  clear() { Store.del(SAVE_KEY); },
  /* reconstruit G depuis une sauvegarde ; renvoie la donne à reprendre (ou null) */
  restore(s) {
    const m = s.meta;
    G = { n: m.n, humans: m.humans, isHuman: m.isHuman, names: m.names, avatars: m.avatars, level: m.level,
      scores: s.scores, history: s.history, dealer: s.dealer, dealNo: s.dealNo, log: s.log || [], reveal: {},
      sel: new Set(), newIds: new Set(), turn: -1, phase: 'idle', say: {} };
    log(`Partie reprise (donne ${s.deal ? s.dealNo : s.dealNo + 1}).`);
    return s.deal;
  },
  /* remet en place une donne sauvegardée au début d'un pli */
  applyDeal(d) {
    const n = G.n;
    Object.assign(G, {
      phase: 'play', trick: [], trickNo: d.trickNo, hands: d.hands.map(cardsOf), piles: d.piles.map(cardsOf), adj: d.adj,
      taker: d.taker, partner: d.partner, partnerKnown: d.partnerKnown, called: d.called, contract: CONTRACTS[d.k], best: d.best, bids: d.bids,
      suitLed: d.suitLed, played: d.played, voids: d.voids, ecartIds: d.ecartIds, chienSize: d.chienSize, chien: cardsOf(d.chien),
      poignees: d.poignees || [], chelem: d.chelem, attTricks: d.attTricks || 0, hands0len: d.hands0len,
      lastTrick: d.lastTrick ? { w: d.lastTrick.w, cards: d.lastTrick.cards.map(x => ({ p: x.p, c: CARD[x.id] })) } : null,
      chienCards: null, result: null, pab: null, winFlash: -1, gather: -1, freshId: null, turn: -1, say: {}, celebrated: false, raised: null,
      showPoig: null, sel: new Set(), newIds: new Set()
    });
    G.hands.forEach(sortCards);
    if (G.piles.length !== n) throw new Error('sauvegarde invalide');
  }
};

const Stats = {
  /* statistiques de la partie en cours, calculées depuis la feuille de marque */
  game() {
    return G.names.map((name, i) => {
      const H = G.history, took = H.filter(h => h.t === i), won = took.filter(h => h.win);
      const pts = H.map(h => h.d[i]);
      return {
        name, human: G.isHuman[i], deals: H.length, takes: took.length, wins: won.length,
        called: H.filter(h => h.pa === i && h.t !== i).length,
        points: G.scores[i], avg: H.length ? G.scores[i] / H.length : 0, best: pts.length ? Math.max(...pts) : 0,
        poignees: H.reduce((a, h) => a + (h.poignees || []).filter(x => x.p === i).length, 0),
        chelems: took.filter(h => h.chelem && h.chelem.fait).length,
        byContract: [1, 2, 3, 4].map(k => took.filter(h => h.k === k).length)
      };
    });
  },
  all() { return Store.get(STATS_KEY) || {}; },
  /* une nouvelle partie commence : on compte une partie de plus pour chaque joueur physique */
  newGame() {
    const all = this.all();
    G.humans.forEach(s => { const r = all[G.names[s]] || (all[G.names[s]] = this.blank()); r.games++; });
    Store.set(STATS_KEY, all);
  },
  blank() { return { games: 0, deals: 0, takes: 0, wins: 0, points: 0, best: 0, poignees: 0, chelems: 0 }; },
  /* à la fin de chaque donne */
  afterDeal() {
    const all = this.all(), h = G.history.at(-1); if (!h) return;
    G.humans.forEach(s => {
      const r = all[G.names[s]] || (all[G.names[s]] = this.blank());
      r.deals++; r.points += h.d[s]; r.best = Math.max(r.best, h.d[s]);
      if (h.t === s) { r.takes++; if (h.win) r.wins++; if (h.chelem && h.chelem.fait) r.chelems++; }
      r.poignees += (h.poignees || []).filter(x => x.p === s).length;
    });
    Store.set(STATS_KEY, all);
  },
  reset() { Store.del(STATS_KEY); }
};
