/* online.js — Parties en ligne entre plusieurs appareils.
   Principe : l'appareil qui crée la table (l'hôte) fait tourner la partie comme d'habitude ; chaque invité occupe
   une place. Quand c'est à un invité de décider, l'hôte lui envoie la question ; l'invité répond, l'hôte vérifie
   la réponse et continue. Après chaque affichage, l'hôte envoie à chaque invité ce que SA place a le droit de voir
   (sa main, le nombre de cartes des autres, la table). Le serveur (server/server.mjs) ne fait que relayer.
   Un invité qui se déconnecte est remplacé par l'ordinateur ; s'il revient avec le même appareil, il reprend sa place. */
const Online = (() => {
  let ws = null, role = null, room = null, lastError = '', wanted = false, joinArgs = null, retries = 0;
  const peers = new Map();          // hôte : id de connexion -> { name, avatar, token, seat }
  const asks = new Map();           // hôte : place -> { type, resolve }
  let lobbyInfo = null;             // invité : liste des joueurs reçue de l'hôte
  let mySeat = -1;                  // invité : sa place

  const TOKEN = (() => {
    try {
      let t = localStorage.getItem('tarot-token');
      if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('tarot-token', t); }
      return t;
    } catch (e) { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  })();

  function serverURL() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    if (!/^https?:$/.test(location.protocol) || !location.host) return null;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  const available = () => !!serverURL() && typeof WebSocket === 'function';

  function connect() {
    return new Promise((res, rej) => {
      let done = false;
      try { ws = new WebSocket(serverURL()); } catch (e) { rej(new Error('Serveur injoignable.')); return; }
      ws.onopen = () => { done = true; res(); };
      ws.onerror = () => { if (!done) rej(new Error('Serveur injoignable.')); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
      ws.onclose = () => onClose();
    });
  }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  /* ------------------------------------------------------------ actions */
  async function create() {
    reset(); wanted = true; role = 'host';
    try { await connect(); send({ t: 'create' }); } catch (e) { lastError = e.message; role = null; }
    changed();
  }
  async function join(code, name, avatar) {
    reset(); wanted = true; role = 'guest'; joinArgs = { room: code.toUpperCase().trim(), name, avatar };
    try { await connect(); send({ t: 'join', ...joinArgs, token: TOKEN }); } catch (e) { lastError = e.message; role = null; }
    changed();
  }
  function leave() {
    wanted = false;
    if (ws) { try { ws.close(); } catch (e) { /* déjà fermée */ } }
    reset();
  }
  function reset() { ws = null; role = null; room = null; lastError = ''; peers.clear(); asks.clear(); lobbyInfo = null; mySeat = -1; retries = 0; }

  /* ------------------------------------------------------------ réception */
  function onMsg(m) {
    if (m.t === 'created' || m.t === 'joined') { room = m.room; lastError = ''; retries = 0; changed(); return; }
    if (m.t === 'error') { lastError = m.msg; if (m.code !== 'kick') { wanted = false; } changed(); if (m.code === 'kick') ended(m.msg); return; }
    if (m.t === 'closed') { wanted = false; ended(m.msg); return; }
    if (role === 'host') {
      if (m.t === 'join') hostJoin(m);
      else if (m.t === 'leave') hostLeave(m.from);
      else if (m.t === 'msg') hostMsg(m.from, m.data);
    } else if (m.t === 'msg') guestMsg(m.data);
  }
  function onClose() {
    const wasRole = role;
    if (!wanted) return;
    if (wasRole === 'guest' && joinArgs && retries < 10) {           // l'invité retente : l'hôte lui rendra sa place
      retries++;
      onlineToast('Connexion perdue, nouvelle tentative…');
      setTimeout(async () => {
        if (!wanted) return;
        try { await connect(); send({ t: 'join', ...joinArgs, token: TOKEN }); } catch (e) { onClose(); }
      }, 1500 * retries);
      return;
    }
    if (wasRole === 'host' && G && G.remote) {
      G.remote.forEach((id, s) => { if (id) { G.isHuman[s] = false; G.remote[s] = null; } });
      asks.forEach((a, s) => { asks.delete(s); a.resolve(aiAnswer(a.type, s)); });
      onlineToast("Connexion au serveur perdue : l'ordinateur joue pour les autres places.");
      role = null; return;
    }
    if (wasRole) ended('Connexion au serveur perdue.');
  }

  /* ------------------------------------------------------------ hôte */
  function hostJoin(m) {
    if (G && G.remote) {                       // partie en cours : seul un joueur déconnecté peut revenir
      const s = G.tokens.findIndex((t, i) => t && t === m.token && !G.remote[i]);
      if (s < 0) { send({ t: 'kick', to: m.from, msg: 'La partie a déjà commencé.' }); return; }
      peers.set(m.from, { name: G.names[s], avatar: G.avatars[s], token: m.token, seat: s });
      G.remote[s] = m.from; G.isHuman[s] = true;
      log(`${G.names[s]} est de retour.`);
      onlineToast(`${G.names[s]} est de retour.`);
      render();
      return;
    }
    const n = setupN;
    if (peers.size >= n - 1) { send({ t: 'kick', to: m.from, msg: 'Cette table est complète.' }); return; }
    peers.set(m.from, { name: m.name || 'Invité', avatar: HUMAN_AVATARS.includes(m.avatar) ? m.avatar : 'pistolero', token: m.token, seat: -1 });
    changed(); hostLobby();
  }
  function hostLeave(id) {
    const p = peers.get(id); if (!p) return;
    if (G && G.remote && p.seat >= 0) {
      const s = p.seat;
      G.remote[s] = null; G.isHuman[s] = false;
      log(`${p.name} a perdu la connexion : l'ordinateur joue à sa place.`);
      onlineToast(`${p.name} a perdu la connexion : l'ordinateur joue à sa place.`);
      const a = asks.get(s); if (a) { asks.delete(s); a.resolve(aiAnswer(a.type, s)); }
      peers.delete(id);
      render();
      return;
    }
    peers.delete(id); changed(); hostLobby();
  }
  function hostMsg(from, d) {
    if (!d || d.kind !== 'answer' || !G || !G.remote) return;
    const s = G.remote.indexOf(from); if (s < 0 || s !== d.seat) return;
    const a = asks.get(s); if (!a || a.type !== d.type) return;
    asks.delete(s);
    a.resolve(decode(a.type, s, d.value));
  }
  /* la liste des joueurs, envoyée aux invités pendant l'attente */
  function hostLobby() {
    send({ t: 'to', to: 'all', data: { kind: 'lobby', n: setupN, level: setupLevel, players: lobbyPlayers() } });
  }
  function lobbyPlayers() {
    const me = { name: (setupNames[0] || '').trim() || 'Joueur 1', avatar: setupAvatars[0], host: true };
    return [me, ...[...peers.values()].map(p => ({ name: p.name, avatar: p.avatar }))];
  }
  /* l'hôte lance la partie : il prend la place 0, les invités les suivantes, l'ordinateur le reste */
  function startGame() {
    const n = setupN, list = lobbyPlayers(), guests = [...peers.entries()];
    const names = [], avatars = [], isHuman = Array(n).fill(false), remote = Array(n).fill(null), tokens = Array(n).fill(null);
    const used = new Set();
    const uniq = nm => { let x = nm, k = 2; while (used.has(x)) x = `${nm} ${k++}`; used.add(x); return x; };
    names.push(uniq(list[0].name)); avatars.push(list[0].avatar); isHuman[0] = true;
    guests.forEach(([id, p], j) => {
      const s = j + 1; p.seat = s;
      names.push(uniq(p.name)); avatars.push(p.avatar); isHuman[s] = true; remote[s] = id; tokens[s] = p.token;
    });
    let ai = 0;
    while (names.length < n) {
      while (used.has(AI_NAMES[ai])) ai++;
      names.push(uniq(AI_NAMES[ai])); avatars.push(AI_AVATAR[AI_NAMES[ai]]); ai++;
    }
    G = { n, humans: [0], isHuman, names, avatars, level: setupLevel, scores: Array(n).fill(0), dealer: n - 1, dealNo: 0,
      history: [], log: [], reveal: {}, sel: new Set(), newIds: new Set(), turn: -1, phase: 'idle', say: {}, remote, tokens, viewSeat: 0 };
    log(`Table ${room} : ${names.join(', ')}.`);
  }
  const isRemote = s => !!(role === 'host' && G && G.remote && G.remote[s]);
  function askRemote(seat, type) {
    return new Promise(resolve => { asks.set(seat, { type, resolve }); render(); });
  }
  /* réponse d'un invité : vérifiée ; une réponse invalide est remplacée par le choix de l'ordinateur */
  function decode(type, s, v) {
    const h = G.hands[s];
    if (type === 'bid') return Number.isInteger(v) && v >= 0 && v <= 4 && (v === 0 || v > G.best) ? v : 0;
    if (type === 'call') return callOptions(s).includes(v) ? v : aiCall(s);
    if (type === 'discard') {
      const cards = Array.isArray(v) ? v.map(id => h.find(c => c.id === id)).filter(Boolean) : [];
      return cards.length === G.chienSize && new Set(cards).size === cards.length && cards.every(ecartAllowed) ? cards : aiDiscard(s);
    }
    if (type === 'play') { const c = h.find(x => x.id === v); return c && legal(s).includes(c) ? c : aiPlay(s); }
    if (type === 'poignee') return v === -1 || poigneeOptions(s).includes(v) ? v : -1;
    if (type === 'chelem') return v === true;
    return null;
  }
  function aiAnswer(type, s) {
    return { bid: () => aiBid(s), call: () => aiCall(s), discard: () => aiDiscard(s), play: () => aiPlay(s),
      poignee: () => aiPoignee(s), chelem: () => aiChelem(s) }[type]();
  }
  /* ce que la place s a le droit de voir */
  function viewFor(s) {
    return {
      seat: s, n: G.n, isHuman: G.isHuman, names: G.names, avatars: G.avatars, level: G.level, scores: G.scores, history: G.history,
      dealer: G.dealer, dealNo: G.dealNo, log: G.log.slice(0, 14), phase: G.phase, bids: G.bids, best: G.best, taker: G.taker,
      k: G.contract ? G.contract.k : 0, called: G.called, partnerKnown: G.partnerKnown,
      partner: G.n < 5 || G.partnerKnown || s === G.partner || G.phase === 'score' ? G.partner : -2,
      hand: G.hands ? G.hands[s].map(c => c.id) : [], counts: G.hands ? G.hands.map(h => h.length) : [],
      piles: G.piles ? G.piles.map(p => p.length) : [], trick: (G.trick || []).map(x => ({ p: x.p, id: x.c.id })), trickNo: G.trickNo,
      lastTrick: G.lastTrick ? { w: G.lastTrick.w, cards: G.lastTrick.cards.map(x => ({ p: x.p, id: x.c.id })) } : null,
      chienCards: G.chienCards ? G.chienCards.map(c => c.id) : null, chienSize: G.chienSize,
      newIds: s === G.taker && G.newIds ? [...G.newIds] : [], say: G.say, winFlash: G.winFlash, gather: G.gather, freshId: G.freshId,
      anim: G.anim, turn: G.turn, result: G.result, pab: G.pab, poignees: G.poignees || [], showPoig: G.showPoig, chelem: G.chelem,
      hands0len: G.hands0len, ask: asks.has(s) ? asks.get(s).type : null, room
    };
  }
  function sync() {
    if (role !== 'host' || !G || !G.remote) return;
    G.remote.forEach((id, s) => { if (id) send({ t: 'to', to: id, data: { kind: 'state', v: viewFor(s) } }); });
  }

  /* ------------------------------------------------------------ invité */
  function guestMsg(d) {
    if (!d) return;
    if (d.kind === 'lobby') { lobbyInfo = d; changed(); return; }
    if (d.kind === 'state') applyView(d.v);
  }
  function applyView(v) {
    const prev = G && G.online === 'guest' ? G : null;
    const same = prev && prev.dealNo === v.dealNo;
    mySeat = v.seat;
    G = {
      online: 'guest', viewSeat: v.seat, n: v.n, humans: [v.seat], isHuman: v.isHuman, names: v.names, avatars: v.avatars, level: v.level,
      scores: v.scores, history: v.history, dealer: v.dealer, dealNo: v.dealNo, log: v.log, phase: v.phase, bids: v.bids, best: v.best,
      taker: v.taker, contract: v.k ? CONTRACTS[v.k] : null, called: v.called, partner: v.partner, partnerKnown: v.partnerKnown,
      hands: v.counts.map((cnt, i) => (i === v.seat ? v.hand.map(id => CARD[id]) : Array(cnt).fill(null))),
      piles: v.piles.map(c => Array(c).fill(null)), trick: v.trick.map(x => ({ p: x.p, c: CARD[x.id] })), trickNo: v.trickNo,
      lastTrick: v.lastTrick ? { w: v.lastTrick.w, cards: v.lastTrick.cards.map(x => ({ p: x.p, c: CARD[x.id] })) } : null,
      chienCards: v.chienCards ? v.chienCards.map(id => CARD[id]) : null, chienSize: v.chienSize, newIds: new Set(v.newIds),
      say: v.say || {}, winFlash: v.winFlash, gather: v.gather, freshId: v.freshId, anim: v.anim, turn: v.turn, result: v.result,
      pab: v.pab, poignees: v.poignees, showPoig: v.showPoig, chelem: v.chelem, hands0len: v.hands0len, reveal: { [v.seat]: true },
      sel: same && prev.phase === 'discard' && v.phase === 'discard' ? prev.sel : new Set(),
      raised: same && v.ask === 'play' && prev.trickNo === v.trickNo ? prev.raised : null,
      celebrated: same && prev.phase === 'score' && v.phase === 'score' ? prev.celebrated : false,
      room: v.room
    };
    pending = v.ask ? { seat: v.seat, type: v.ask, resolve: val => reply(v.ask, val) } : null;
    if ($('#game').hidden) { closeLobby(); $('#setup').hidden = true; $('#game').hidden = false; window.scrollTo(0, 0); }
    render();
  }
  function reply(type, val) {
    const value = type === 'play' ? val && val.id : type === 'discard' ? val.map(c => c.id) : val;
    send({ t: 'host', data: { kind: 'answer', seat: mySeat, type, value } });
    render();                                   // les boutons de la question disparaissent tout de suite
  }

  /* ------------------------------------------------------------ interface */
  function changed() { if (typeof drawLobby === 'function') drawLobby(); }
  function ended(msg) {
    const wasPlaying = G && (G.online === 'guest' || G.remote);
    reset(); wanted = false;
    if (wasPlaying && G && G.online === 'guest') { G = null; pending = null; }
    onlineToast(msg || 'La table est fermée.');
    if (typeof drawLobby === 'function') drawLobby();
    if (G === null) { closeLobby(); showSetup(); }
  }

  return {
    available, create, join, leave, startGame, isRemote, askRemote, sync, hostLobby,
    get role() { return role; }, get room() { return room; }, get error() { return lastError; },
    get guests() { return [...peers.values()]; }, get lobby() { return lobbyInfo; }, get mySeat() { return mySeat; }
  };
})();
