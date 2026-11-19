/* ui.js — Interface : accueil, mains en éventail, tapis 3D avec avatars, feuille de marque. */

let setupH = 1, setupN = 4, setupLevel = 'mid', setupMusic = 'western', setupNames = ['', ''], setupAvatars = ['sherif', 'joueuse'];
let lastPointer = 'mouse', raisedAtDown = null;
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; raisedAtDown = G ? G.raised : null; }, { capture: true, passive: true });

/* la carte réellement sous le doigt (les navigateurs tactiles « corrigent » parfois la cible vers une voisine) */
function cardUnder(x, y) {
  const h = document.elementFromPoint(x, y);
  const c = h && h.closest('.fan .card[data-act="pick"]');
  return c || null;
}
/* au doigt, glisser sur l'éventail lève la carte survolée */
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' || !G || !pending || pending.type !== 'play' || !e.target.closest || !e.target.closest('.fan')) return;
  const c = cardUnder(e.clientX, e.clientY);
  if (!c || c.dataset.id === G.raised) return;
  G.raised = c.dataset.id;
  document.querySelectorAll('.fan .card.raised').forEach(x => x.classList.remove('raised'));
  c.classList.add('raised');
}, { passive: true });

/* ---------- Cartes ---------- */
function cardHTML(c, cls = '', attrs = '') {
  return cardFace(c, cls, attrs).slice(0, -6) + '<span class="sheen"></span></div>';   // reflet de lumière
}
function cardFace(c, cls = '', attrs = '') {
  const a = `data-id="${c.id}" aria-label="${esc(cardName(c))}" ${attrs}`;
  if (c.s === 'E') return `<div class="card excuse ${cls}" ${a}><span class="ix">★</span><span class="mid">★</span><span class="cap">EXCUSE</span></div>`;
  if (c.s === 'T') return `<div class="card trump ${isOud(c) ? 'oud' : ''} ${cls}" ${a}><span class="ix">${c.r}</span><span class="mid"><b>${c.r}</b></span></div>`;
  const lab = HON[c.r] || c.r;
  return `<div class="card ${RED[c.s] ? 'red' : ''} ${c.r > 10 ? 'hon' : ''} ${cls}" ${a}><span class="ix">${lab}<i>${SYM[c.s]}</i></span><span class="mid">${c.r > 10 ? `<b>${lab}</b>` : ''}${SYM[c.s]}</span></div>`;
}
const backHTML = (cls = '') => `<div class="card back ${cls}" aria-hidden="true"></div>`;
/* carte à deux faces pour les retournements en 3D */
const card3D = c => `<div class="c3d"><div class="face">${cardHTML(c)}</div><div class="face rear">${backHTML()}</div></div>`;

function roleTags(s, viewer) {
  const t = [];
  if (s === G.dealer) t.push('<span class="tag">Donneur</span>');
  if (G.taker === s && G.phase !== 'bid' && G.phase !== 'deal') t.push(`<span class="tag taker">Preneur${G.contract ? ' · ' + BIDN[G.contract.k] : ''}</span>`);
  if (G.n === 5 && G.partner === s && s !== G.taker && (G.partnerKnown || viewer === s)) t.push('<span class="tag part">Appelé</span>');
  return t.join('');
}

function moodOf(s) {
  if (G.phase === 'score' && G.result) return G.result.d[s] > 0 ? 'joy' : G.result.d[s] < 0 ? 'cry' : 'neutral';
  if (G.winFlash === s || G.gather === s) return 'happy';
  if (G.turn === s && !G.isHuman[s] && G.phase !== 'deal') return 'think';
  return 'neutral';
}

function render() {
  if (!G) return;
  if (G.remote) Online.sync();                  // hôte d'une table en ligne : chaque invité reçoit ce que sa place voit
  renderPanel($('#panelL'), G.humans[0], 1);
  if (G.humans.length > 1) renderPanel($('#panelR'), G.humans[1], 2); else renderSide($('#panelR'));
  renderCenter();
  G.freshId = null; G.anim = null;
}
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (G && !$('#game').hidden) render(); }, 150); });

/* ---------- Main en éventail ---------- */
function fanLayout(n, W) {
  const cw = Math.round(Math.max(50, Math.min(76, W * 0.2)));
  const ch = Math.round(cw * 1.58);
  const A = n <= 1 ? 0 : Math.min(140, Math.max(36, (n - 1) * 9));            // ouverture totale, en degrés
  const half = A / 2 * Math.PI / 180;
  // rayon pivot → centre de la carte, pour que l'éventail tienne dans la largeur
  let R = half > 0 ? (W / 2 - (cw / 2) * Math.cos(half) - 4) / Math.sin(half) - ch / 2 : ch;
  R = Math.max(ch * 0.55, Math.min(R, ch * 1.6));
  const top = 26;                                                               // place pour la carte soulevée
  const pivotY = top + R + ch / 2;
  const angles = Array.from({ length: n }, (_, i) => (n <= 1 ? 0 : -A / 2 + (A * i) / (n - 1)));
  const cardBottom = pivotY - (R - ch / 2);
  return { cw, ch, R, pivotY, cardBottom, height: Math.round(Math.max(cardBottom + 74, pivotY + 12)), angles };
}

/* main dessinée qui tient les cartes : doigts derrière, pouce et paume devant */
function handSVG(skin, sleeve, layer) {
  const d = shade(skin, -0.2);
  if (layer === 'back') return `<svg class="grip back" viewBox="0 0 160 110" aria-hidden="true">
      <path d="M96 40 C104 30 116 30 118 40 C122 33 132 35 132 45 C138 41 146 46 142 56 C140 66 132 78 120 86 L96 70 Z" fill="${d}"/></svg>`;
  return `<svg class="grip front" viewBox="0 0 160 110" aria-hidden="true">
      <path d="M44 70 C42 54 56 44 72 46 L98 50 C112 52 118 62 112 72 C122 74 124 88 112 92 L70 100 C54 100 46 86 44 70 Z" fill="${skin}"/>
      <path d="M58 56 C64 44 80 36 92 38 C100 39 102 46 96 50 C88 54 80 56 74 62 Z" fill="${skin}" stroke="${d}" stroke-width="1.2"/>
      <path d="M90 41 C93 40 96 42 95 45" fill="none" stroke="${shade(skin, 0.35)}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M70 72 C80 70 92 70 104 74 M72 82 C82 80 94 80 106 84" fill="none" stroke="${d}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
      <path d="M40 92 C44 86 58 84 70 88 L74 112 L34 112 Z" fill="${sleeve}"/><path d="M40 92 C46 88 60 86 70 89" fill="none" stroke="${shade(sleeve, 0.3)}" stroke-width="2"/></svg>`;
}

function fanHTML(s, hand, W, opts = {}) {
  const L = opts.legal, me = opts.me;
  const hints = me ? Tutor.suggest() : [];
  const F = fanLayout(hand.length, W);
  const av = AVATARS[G.avatars[s]];
  const gripTop = Math.round(F.cardBottom - 40);
  let h = `<div class="fan" style="height:${F.height}px;--cw:${F.cw}px"><div class="grip-wrap b" style="top:${gripTop}px">${handSVG(av.skin, av.shirt, 'back')}</div>`;
  hand.forEach((c, i) => {
    let cls = '';
    if (opts.backs) cls = 'back';
    else if (L) cls = L.has(c.id) ? 'playable' : 'dim';
    else if (me && pending.type === 'discard') { cls = ecartAllowed(c) ? 'playable' : 'dim'; if (G.sel.has(c.id)) cls += ' sel'; }
    if (!opts.backs && G.newIds.has(c.id)) cls += ' new';
    if (!opts.backs && hints.includes(c.id) && cls.includes('playable')) cls += ' hint';
    if (G.raised === c.id && L) cls += ' raised';
    const attrs = cls.includes('playable') ? `tabindex="0" role="button" data-act="pick" data-seat="${s}"` : '';
    const a = F.angles[i].toFixed(2);
    h += `<div class="slot" data-id="${c.id}" data-a="${a}" style="top:${F.pivotY - F.R - F.ch / 2}px;transform-origin:50% ${(F.R + F.ch / 2).toFixed(1)}px;transform:rotate(${a}deg);z-index:${i + 1}">${opts.backs ? backHTML() : cardHTML(c, cls, attrs)}</div>`;
  });
  h += `<div class="grip-wrap f" style="top:${gripTop}px">${handSVG(av.skin, av.shirt, 'front')}</div></div>`;
  return h;
}

/* ---------- Panneau d'un joueur physique ---------- */
function renderPanel(el, s, no) {
  const me = pending && pending.seat === s;
  const hidden = G.humans.length > 1 && !G.reveal[s];
  const before = G.anim === 'deal' ? null : Anim.capture(el);
  const W = Math.max(260, (el.clientWidth || 320) - 28);
  el.classList.toggle('active', !!me);
  let status = '', sc = 'wait';
  if (me) {
    sc = '';
    status = { bid: "À vous d'annoncer", call: 'Appelez un roi', discard: `Faites votre écart : ${G.chienSize} cartes`, play: 'À vous de jouer', poignee: 'Annoncer une poignée ?', chelem: 'Annoncer le chelem ?' }[pending.type] || '';
    if (pending.type === 'play' && lastPointer !== 'mouse') status += ' · touchez une carte pour la lever, encore pour la jouer';
  } else if (G.phase === 'deal') status = 'Distribution…';
  else if (G.phase === 'score') status = 'Fin de la donne';
  else if (G.turn >= 0) status = `${G.names[G.turn]} réfléchit…`;

  let h = `<header class="ph"><div class="who"><div class="avatar ${me ? 'live' : ''} m-${moodOf(s)}">${avatarSVG(G.avatars[s], moodOf(s))}</div>
      <div><div class="eyebrow">${G.humans.length > 1 ? 'Joueur ' + no : G.online || G.remote ? 'Votre jeu · table ' + esc(G.online ? G.room || '' : Online.room || '') : 'Votre jeu'}</div><h2>${esc(G.names[s])}</h2></div></div>
      <div class="pscore">${G.scores[s]}<small>points</small></div></header>
    <div class="badges">${roleTags(s, hidden ? -1 : s)}</div>
    <div class="status ${sc}" aria-live="polite">${status}</div>`;
  const hand = G.hands ? G.hands[s] : [];

  if (hidden) {
    if (!hand.length) { el.innerHTML = h; return; }
    h += fanHTML(s, hand, W, { backs: true });
    h += `<div class="actions"><p class="note">${hand.length} cartes, face cachée pour que l'autre joueur ne les voie pas.</p>
      <button class="btn ${me ? 'primary' : ''}" data-act="reveal" data-seat="${s}">${me ? `C'est à vous, ${esc(G.names[s])} : voir mes cartes` : 'Voir mes cartes'}</button></div>`;
    el.innerHTML = h; return;
  }
  const L = me && pending.type === 'play' ? new Set(legal(s).map(c => c.id)) : null;
  if (hand.length) h += fanHTML(s, hand, W, { legal: L, me });
  if (G.called && G.partner === s && s !== G.taker && !G.partnerKnown)
    h += `<p class="note">Vous avez ${cardName(CARD[G.called])} : vous jouez avec ${esc(G.names[G.taker])}, en secret.</p>`;

  h += '<div class="actions">';
  if (me && pending.type === 'bid') {
    const tut = G.tutorial;                          // didacticiel : seule la Garde est proposée
    h += `<div class="bids"><button class="btn" data-act="bid" data-v="0" ${tut ? 'disabled' : ''}>Passe</button>`;
    for (let k = G.best + 1; k <= 4; k++) h += `<button class="btn ${tut && k === 2 ? 'primary hint-btn' : ''}" data-act="bid" data-v="${k}" ${tut && k !== 2 ? 'disabled' : ''}>${CONTRACTS[k].name}</button>`;
    h += '</div><p class="note">Petite ×1 · Garde ×2 · Garde sans ×4 · Garde contre ×6</p>';
  }
  if (me && pending.type === 'poignee') {
    const t = trumpCount(s);
    h += `<p class="note">Vous avez ${t} atouts (Excuse comprise). La prime va au camp qui gagne le contrat ; les atouts annoncés sont montrés à tous.</p><div class="bids">`
      + poigneeOptions(s).map(l => `<button class="btn" data-act="poignee" data-v="${l}">${POIGNEE_NAME[l][0].toUpperCase() + POIGNEE_NAME[l].slice(1)} · ${POIGNEE[G.n][l]} atouts · ${POIGNEE_BONUS[l]} pts</button>`).join('')
      + `<button class="btn ghost" data-act="poignee" data-v="-1">Ne pas annoncer</button></div>`;
  }
  if (me && pending.type === 'chelem') {
    h += `<p class="note">Le chelem, c'est remporter tous les plis : +400 points si vous réussissez, −200 sinon. Vous entamez le premier pli. Réussi sans annonce, il rapporte 200 points.</p>
      <div class="bids"><button class="btn" data-act="chelem" data-v="1">Annoncer le chelem</button><button class="btn primary" data-act="chelem" data-v="0">Jouer sans annonce</button></div>`;
  }
  if (me && pending.type === 'call') {
    h += '<div class="bids">' + callOptions(s).map(id => {
      const nm = HNAME[CARD[id].r];
      return `<button class="btn" data-act="call" data-id="${id}">${nm[0].toUpperCase() + nm.slice(1)} de ${SYM[id[0]]} ${SNAME[id[0]]}</button>`;
    }).join('') + '</div>';
  }
  if (me && pending.type === 'discard') {
    h += `<p class="note">Touchez ${G.chienSize} cartes à écarter (pastille dorée : cartes du chien). Interdits : rois et bouts. L'atout n'est permis que si vous n'avez pas assez d'autres cartes.</p>
      <button class="btn primary" data-act="ecart" ${G.sel.size === G.chienSize ? '' : 'disabled'}>Valider l'écart (${G.sel.size}/${G.chienSize})</button>`;
  }
  if (G.humans.length > 1 && !me) h += `<button class="btn ghost" data-act="hide" data-seat="${s}">Cacher mes cartes</button>`;
  h += '</div>';
  el.innerHTML = h;
  if (G.anim === 'deal') Anim.dealIn(el); else Anim.flip(el, before);
}

/* ---------- Troisième colonne quand un seul joueur physique ---------- */
function renderSide(el) {
  el.classList.remove('active');
  let h = `<header class="ph"><div><div class="eyebrow">Table</div><h2>Journal</h2></div></header>`;
  if (G.lastTrick) h += `<div><div class="eyebrow" style="margin-bottom:6px">Dernier pli · ${esc(G.names[G.lastTrick.w])}</div><div class="lastpli">${G.lastTrick.cards.map(x => cardHTML(x.c)).join('')}</div></div>`;
  h += `<ul class="journal">${G.log.slice(0, 12).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
  h += `<details class="rules"><summary>Barème</summary><div class="bareme">
    <span>0 bout</span><b>56 points</b><span>1 bout</span><b>51 points</b><span>2 bouts</span><b>41 points</b><span>3 bouts</span><b>36 points</b>
    <span>Bouts, rois</span><b>4,5</b><span>Dame · Cavalier · Valet</span><b>3,5 · 2,5 · 1,5</b><span>Autres cartes</span><b>0,5</b></div>
    <p class="note" style="margin-top:8px">Score : (25 + écart) × multiplicateur, plus 10 × multiplicateur pour le Petit au bout.</p></details>`;
  el.innerHTML = h;
}

/* ---------- Tapis ---------- */
/* chandelier en laiton à trois bougies ; les flammes vacillent (CSS .flame) */
function candelabraSVG(side) {
  const u = 'cd' + side;
  const cup = (x, y) => `<path d="M${x - 7} ${y} Q${x} ${y + 7} ${x + 7} ${y} Z" fill="url(#${u}b)"/><ellipse cx="${x}" cy="${y}" rx="8" ry="2.2" fill="#f2d48a"/>`;
  const candle = (x, y, h, d) => `<rect x="${x - 3.6}" y="${y - h}" width="7.2" height="${h}" rx="1.4" fill="url(#${u}w)"/>
    <path d="M${x - 3.6} ${y - h + 2} q2 4 0 7 M${x + 2} ${y - h + 1} q1.5 3 0 5" stroke="#efe6cf" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M${x} ${y - h} v-3" stroke="#2a2018" stroke-width="1"/>
    <g class="flame" style="animation-delay:${d}s;transform-origin:${x}px ${y - h - 2}px"><path d="M${x} ${y - h - 17} C${x + 5} ${y - h - 9} ${x + 4.5} ${y - h - 2} ${x} ${y - h - 1.5} C${x - 4.5} ${y - h - 2} ${x - 5} ${y - h - 9} ${x} ${y - h - 17} Z" fill="url(#${u}f)"/>
    <ellipse cx="${x}" cy="${y - h - 5}" rx="1.6" ry="3.2" fill="#fff7d6"/></g>`;
  return `<svg class="candelabra" viewBox="0 0 100 150" aria-hidden="true"><defs>
    <linearGradient id="${u}b" x1="0" x2="1"><stop offset="0" stop-color="#7a5418"/><stop offset=".35" stop-color="#f3d27a"/><stop offset=".6" stop-color="#c8962f"/><stop offset="1" stop-color="#5e3f10"/></linearGradient>
    <linearGradient id="${u}w" x1="0" x2="1"><stop offset="0" stop-color="#e9dcbc"/><stop offset=".4" stop-color="#fffaf0"/><stop offset="1" stop-color="#cbbd98"/></linearGradient>
    <radialGradient id="${u}f" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#ffc34d"/><stop offset="1" stop-color="#ff6a1a" stop-opacity=".85"/></radialGradient></defs>
    <ellipse cx="50" cy="146" rx="24" ry="4" fill="#000" opacity=".35"/>
    <path d="M30 145 Q50 128 70 145 Z" fill="url(#${u}b)"/><path d="M44 132 L46 96 L54 96 L56 132 Z" fill="url(#${u}b)"/>
    <ellipse cx="50" cy="112" rx="6" ry="3.5" fill="url(#${u}b)"/><ellipse cx="50" cy="96" rx="7" ry="3" fill="url(#${u}b)"/>
    <path d="M50 92 C34 92 20 88 18 74 M50 92 C66 92 80 88 82 74" stroke="url(#${u}b)" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M47 96 L48 66 L52 66 L53 96 Z" fill="url(#${u}b)"/>
    ${cup(18, 74)}${cup(82, 74)}${cup(50, 64)}
    ${candle(18, 74, 26, 0)}${candle(82, 74, 22, 0.37)}${candle(50, 64, 32, 0.71)}</svg>`;
}
let SRX = 38;   // rayon horizontal des places, réduit sur les écrans étroits
/* place vue depuis cet appareil : la sienne toujours en bas */
const rel = i => (i - (G.viewSeat || 0) + G.n) % G.n;
function pilePos(i) { const a = (90 - rel(i) * 360 / G.n - 30) * Math.PI / 180; const r = SRX < 38 ? 22 : 25; return [50 + r * Math.cos(a), 50 + r * 1.05 * Math.sin(a)]; }
function seatPos(i, rx, ry) { const a = (90 - rel(i) * 360 / G.n) * Math.PI / 180; return [50 + rx * Math.cos(a), 50 + ry * Math.sin(a)]; }

function renderCenter() {
  const el = $('#center');
  SRX = (el.clientWidth || 600) < 520 ? 29 : 38;
  let c = '';
  if (G.contract) c = `<b>${esc(G.names[G.taker])}</b> · ${G.contract.name}${G.called ? ` · appelle ${cardName(CARD[G.called])}` : ''}${G.chelem ? ' · <b>chelem annoncé</b>' : ''}${(G.poignees || []).map(x => ` · ${POIGNEE_NAME[x.level]} de ${esc(G.names[x.p])}`).join('')}`;
  else if (G.phase === 'bid') c = G.best ? `Meilleure annonce : <b>${BIDN[G.best]}</b> (${esc(G.names[G.taker])})` : 'Enchères en cours';
  else if (G.phase === 'deal') c = 'Distribution';
  // barre du haut : construite une seule fois, pour ne pas refermer la liste de musique pendant qu'on choisit
  if (!$('#topbar')) {
    el.innerHTML = `<div class="topbar" id="topbar"><div class="brand">Le <em>Tarot</em></div><div class="contract" id="contractInfo"></div>
      <div class="tools">
        <label class="musicsel"><span aria-hidden="true">♪</span><select id="musicGame" class="sel" aria-label="Musique">${[...Music.list(), { id: 'off', label: 'Sans musique' }].map(t => `<option value="${t.id}">${t.id === 'off' ? 'Muet' : t.label.replace('Classique : ', '')}</option>`).join('')}</select></label>
        <button class="btn ghost" data-act="speed" id="speedBtn"></button>
        <button class="btn ghost" data-act="coach" id="coachBtn" aria-pressed="false">Conseils</button>
        <button class="btn ghost" data-act="stats">Statistiques</button>
        <button class="btn ghost" data-act="newgame" id="newgameBtn">Nouvelle partie</button></div></div><div class="center-body" id="centerBody"></div>`;
  }
  $('#contractInfo').innerHTML = `<span class="eyebrow">Donne ${G.dealNo} · IA ${LEVELS[G.level].toLowerCase()}</span><br>${c}`;
  $('#speedBtn').textContent = FAST ? 'Rapide' : 'Normal';
  $('#speedBtn').hidden = G.online === 'guest';
  $('#coachBtn').setAttribute('aria-pressed', G.coach ? 'true' : 'false');                         // l'hôte règle la vitesse
  $('#newgameBtn').textContent = G.online || G.remote ? 'Quitter la table' : 'Nouvelle partie';
  const ms = $('#musicGame');
  if (document.activeElement !== ms) ms.value = Music.on ? Music.track : 'off';
  let h = Tutor.coachHTML();                         // Gaston, le professeur (didacticiel ou bouton Conseils)

  // lumière : faisceau de la lampe qui balance, poussière dans le faisceau, flaque de lumière sur le tapis
  // lumière : deux chandeliers posés sur la table, flaques de lumière chaude qui vacillent sur le tapis
  h += `<div class="stage" style="${Anim.tiltStyle()}"><div class="felt"><div class="lightmap" aria-hidden="true"><div class="cpool l"></div><div class="cpool r"></div></div>`;
  for (const [side, cx] of [['l', 12], ['r', 88]])
    h += `<div class="candle ${side}" style="left:${cx}%;top:6%" aria-hidden="true"><div class="candle-in"><div class="halo"></div>${candelabraSVG(side)}</div></div>`;
  // projecteur sur le joueur dont c'est le tour
  if (G.turn >= 0 && G.phase !== 'score') {
    const [x, y] = seatPos(G.turn, SRX, 40);
    h += `<div class="spot ${G.lastSpot !== G.turn ? 'in' : ''}" style="left:${x}%;top:${y}%" aria-hidden="true"></div>`;
  }
  G.lastSpot = G.phase === 'score' ? -1 : G.turn;
  // plis gagnés : un tas de cartes en 3D devant chaque joueur
  if (G.piles && (G.phase === 'play' || G.phase === 'score')) {
    for (let i = 0; i < G.n; i++) {
      const k = Math.min(9, Math.ceil(G.piles[i].length / Math.max(3, G.n - 1)));
      if (!k) continue;
      const [x, y] = pilePos(i);
      h += `<div class="pile" style="left:${x}%;top:${y}%" title="${G.piles[i].length} cartes">${Array.from({ length: k }, (_, j) => `<div class="card back" style="--k:${j};--r:${((j * 47 + i * 13) % 14) - 7}deg"></div>`).join('')}</div>`;
    }
  }
  // places : avatars debout face à vous, bulles de parole
  for (let i = 0; i < G.n; i++) {
    const [x, y] = seatPos(i, SRX, 40);
    const turn = G.turn === i && G.phase !== 'score';
    const nc = G.hands ? G.hands[i].length : 0;
    const say = G.say && G.say[i];
    const big = rel(i) !== 0;            // les autres joueurs : bustes debout au bord de la table ; vous (en bas) : médaillon
    const face = x < 45 ? 18 : x > 55 ? -18 : 0;   // tournés vers le centre du tapis
    const shx = (-(x - 50) / 40 * 14).toFixed(1);  // ombre projetée à l'opposé du chandelier le plus proche
    h += `<div class="seat ${big ? 'big' : ''} ${turn ? 'turn' : ''} ${G.gather === i ? 'collect' : ''} ${G.isHuman[i] ? 'human' : ''} ${y < 50 ? 'far' : 'near'}" style="left:${x}%;top:${y}%;--face:${face}deg;--shx:${shx}px">
      <div class="seat-in">
        ${say ? `<div class="bubble">${esc(say)}</div>` : ''}
        ${turn && !G.isHuman[i] && !say ? '<div class="bubble dots"><i></i><i></i><i></i></div>' : ''}
        <div class="avatar ${big ? 'bust3d' : ''} m-${moodOf(i)}">${avatarSVG(G.avatars[i], moodOf(i), { bust: big })}</div>
        <div class="plate"><span class="nm">${esc(G.names[i])}</span><span class="sub">${nc} cartes · ${G.scores[i]} pts</span>${roleTags(i, -1) ? `<div class="badges">${roleTags(i, -1)}</div>` : ''}</div>
      </div></div>`;
  }
  if (G.phase === 'play') {
    G.trick.forEach(t => {
      const [x, y] = seatPos(t.p, 19, 17);
      const [sx, sy] = seatPos(t.p, SRX, 40);
      let style = `left:${x}%;top:${y}%;--shx:${(-(x - 50) / 40 * 12).toFixed(1)}px;--dx:${((sx - x) * 7).toFixed(0)}%;--dy:${((sy - y) * 7).toFixed(0)}%;--rz:${(t.p * 37 % 30) - 15}deg`;
      let cls = '';
      if (t.c.id === G.freshId) cls += ' fresh';
      if (G.winFlash === t.p) cls += ' win';
      if (G.gather >= 0) {
        const [gx, gy] = pilePos(G.gather);
        style += `;--fx:${x}%;--fy:${y}%;--tx:${gx}%;--ty:${gy}%`; cls += ' gather';
      }
      if (G.winFlash === t.p && G.gather < 0) h += `<div class="burst" style="left:${x}%;top:${y}%" aria-hidden="true"></div>`;
      h += `<div class="tc${cls}" style="${style}">${card3D(t.c)}</div>`;
    });
    if (!G.trick.length && G.turn >= 0 && !G.showPoig) h += `<div class="msg"><p>Pli ${G.trickNo + 1} · ${esc(G.names[G.turn])} entame</p></div>`;
  } else if (G.phase === 'deal') {
    h += `<div class="msg"><div class="deck3d">${backHTML()}${backHTML()}${backHTML()}</div><p>${esc(G.names[G.dealer])} distribue</p></div>`;
    if (G.anim === 'deal') {           // paquets de cartes qui volent du donneur vers chaque joueur
      const [fx, fy] = seatPos(G.dealer, 30, 31);
      const packets = G.n * 4;
      for (let k = 0; k < packets + 2; k++) {
        const to = k < packets ? (G.dealer + 1 + k) % G.n : -1;
        const [tx, ty] = to >= 0 ? seatPos(to, 36, 37) : [50 + (k - packets) * 4, 50];
        h += `<div class="fly" style="--fx:${fx}%;--fy:${fy}%;--tx:${tx}%;--ty:${ty}%;--d:${k * 34}ms;--spin:${(k % 2 ? 1 : -1) * (160 + k * 7)}deg">${backHTML()}</div>`;
      }
    }
  } else if (G.phase === 'bid') {
    h += `<div class="msg"><h3>Enchères</h3><p>${G.turn >= 0 ? esc(G.names[G.turn]) + ' parle' : ''}</p></div>`;
  } else if (G.phase === 'allpass') {
    h += `<div class="msg"><h3>Tout le monde passe</h3><p>Nouvelle distribution…</p></div>`;
  } else if (G.phase === 'call') {
    h += `<div class="msg"><h3>${esc(G.names[G.taker])} prend</h3><p>Appel d'un roi…</p></div>`;
  } else if ((G.phase === 'chien' || G.phase === 'discard') && G.chienCards) {
    h += `<div class="msg"><h3>Le chien</h3><div class="cards">${G.chienCards.map((x, i) => `<div class="flipin" style="--i:${i}">${card3D(x)}</div>`).join('')}</div><p>${G.phase === 'discard' ? esc(G.names[G.taker]) + ' fait son écart' : 'Il revient à ' + esc(G.names[G.taker])}</p></div>`;
  }
  if (G.showPoig) {
    const P = G.showPoig;
    h += `<div class="poig-show" role="status"><b>${esc(G.names[P.p])} montre une ${POIGNEE_NAME[P.level]}</b><div class="poig-cards">${P.cards.map((id, i) => `<div class="flipin" style="--i:${i % 8}">${cardHTML(CARD[id])}</div>`).join('')}</div></div>`;
  }
  h += '</div>';
  if (G.phase === 'score' && G.result) {
    const r = G.result;
    if (r.win && !G.celebrated && !Anim.reduce()) {
      h += '<div class="confetti" aria-hidden="true">' + Array.from({ length: 34 }, (_, i) => {
        const suit = ['♠', '♥', '♣', '♦', '★'][i % 5];
        return `<span style="--x:${(i * 37) % 100}%;--d:${(i % 9) * 0.12}s;--r:${(i * 53) % 360}deg;--t:${2.2 + (i % 5) * 0.35}s" class="${i % 5 === 1 || i % 5 === 3 ? 'red' : ''}">${suit}</span>`;
      }).join('') + '</div>';
    }
    G.celebrated = true;
    h += `<div class="rays ${r.win ? 'won' : 'lost'}" aria-hidden="true"></div>`;
    h += `<div class="result ${r.win ? 'won' : 'lost'}" role="dialog" aria-label="Résultat de la donne">
      <div class="res-head">
      <h3 class="${r.win ? 'ok' : 'ko'}">${r.win ? 'Contrat réussi' : 'Contrat chuté'} de ${num(Math.abs(r.diff))} point${Math.abs(r.diff) >= 2 ? 's' : ''}</h3></div>
      <div class="podium">${r.d.map((v, i) => { const m = v > 0 ? 'joy' : v < 0 ? 'cry' : 'neutral'; return `<figure class="pod ${v > 0 ? 'win' : v < 0 ? 'lose' : ''}" style="--k:${i}"><div class="avatar m-${m}">${avatarSVG(G.avatars[i], m)}</div><figcaption>${esc(G.names[i])}<b class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${sgn(v)}</b></figcaption></figure>`; }).join('')}</div>
      <dl class="kv">
        <dt>Preneur</dt><dd>${esc(G.names[r.t])}${r.pa !== r.t ? ' avec ' + esc(G.names[r.pa]) : G.n === 5 ? ' (seul)' : ''}</dd>
        <dt>Contrat</dt><dd>${G.contract.name} (×${r.mult})</dd>
        <dt>Bouts</dt><dd>${r.oud} → ${r.need} points requis</dd>
        <dt>Réalisé</dt><dd>${num(r.ap)} points</dd>
        <dt>Petit au bout</dt><dd>${G.pab ? (r.pab > 0 ? "pour l'attaque" : 'pour la défense') + ` (${sgn(r.pab)})` : 'non'}</dd>
        <dt>Poignées</dt><dd>${(G.poignees || []).length ? G.poignees.map(x => `${POIGNEE_NAME[x.level]} de ${esc(G.names[x.p])}`).join(', ') + ` (${sgn(r.poig)} pour l'attaque)` : 'aucune'}</dd>
        <dt>Chelem</dt><dd>${G.chelem ? (r.chel > 0 ? 'annoncé et réussi' : 'annoncé, chuté') : r.chel > 0 ? 'réussi sans annonce' : r.chel < 0 ? 'chelem de la défense' : 'non'}${r.chel ? ` (${sgn(r.chel)})` : ''}</dd>
        <dt>Calcul</dt><dd>${r.win ? '' : '−'}(25 + ${Math.round(Math.abs(r.diff))}) × ${r.mult}${r.pab ? ` ${r.pab > 0 ? '+' : '−'} ${Math.abs(r.pab)}` : ''}${r.poig ? ` ${r.poig > 0 ? '+' : '−'} ${Math.abs(r.poig)}` : ''}${r.chel ? ` ${r.chel > 0 ? '+' : '−'} ${Math.abs(r.chel)}` : ''} = ${sgn(r.res)} par défenseur</dd>
      </dl>

      <div>${G.online === 'guest' ? `<p class="note">${esc(G.names[0])} lance la donne suivante.</p>` : '<button class="btn primary" data-act="next">Donne suivante</button>'}</div></div>`;
  }
  h += '</div>';

  const hist = G.history.slice(-6);
  h += `<div class="sheet"><table><caption>Feuille de marque</caption><thead><tr><th>Donne</th><th>Contrat</th>${G.names.map(nm => `<th>${esc(nm)}</th>`).join('')}</tr></thead><tbody>`;
  if (!hist.length) h += `<tr><td colspan="${G.n + 2}" style="text-align:left;color:var(--mute)">Aucune donne terminée pour l'instant.</td></tr>`;
  for (const r of hist) h += `<tr><td>${r.no}</td><td>${esc(G.names[r.t])} · ${BIDN[r.k]} ${r.win ? '✓' : '✗'}${(r.poignees || []).length ? ' · P' : ''}${r.chelem && (r.chelem.annonce || r.chelem.fait) ? ' · Ch' : ''}</td>${r.d.map(v => `<td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${sgn(v)}</td>`).join('')}</tr>`;
  h += `</tbody><tfoot><tr><td>Total</td><td></td>${G.scores.map(v => `<td>${v}</td>`).join('')}</tr></tfoot></table></div>`;
  if (G.humans.length > 1) h += `<div class="sheet log2"><ul class="journal">${G.log.slice(0, 6).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  $('#centerBody').innerHTML = h;
}

/* ---------- Interactions ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'speed') { FAST = !FAST; render(); return; }
  if (act === 'newgame') { SESSION++; pending = null; G = null; Online.leave(); Music.stop(); showSetup(); return; }
  if (act === 'online-create') { if (!Online.available()) return; openLobby(); Online.create(); return; }
  if (act === 'online-join') {
    const code = ($('#joinCode').value || '').trim();
    if (code.length !== 4) { $('#onlineHint').textContent = 'Le code de la table fait 4 lettres.'; $('#joinCode').focus(); return; }
    openLobby(); Online.join(code, (setupNames[0] || '').trim() || 'Joueur', setupAvatars[0]); return;
  }
  if (act === 'online-cancel') { Online.leave(); closeLobby(); return; }
  if (act === 'online-start') { startOnline(); return; }
  if (act === 'stats') { openStats(); return; }
  if (act === 'close-stats') { closeStats(); return; }
  if (act === 'reset-stats') { Stats.reset(); openStats(); return; }
  if (act === 'resume') { resumeGame(); return; }
  if (act === 'discard-save') { Save.clear(); showSetup(); return; }
  if (act === 'avatar') { setupAvatars[+b.dataset.who] = b.dataset.id; showSetup(); return; }
  if (!G) return;
  const seat = +b.dataset.seat;
  if (act === 'reveal') { G.reveal[seat] = true; render(); return; }
  if (act === 'hide') { G.reveal[seat] = false; render(); return; }
  if (!pending) return;
  if (act === 'bid' && pending.type === 'bid') { answer(+b.dataset.v); return; }
  if (act === 'call' && pending.type === 'call') { answer(b.dataset.id); return; }
  if (act === 'next' && pending.type === 'next') { answer(true); return; }
  if (act === 'poignee' && pending.type === 'poignee') { answer(+b.dataset.v); return; }
  if (act === 'chelem' && pending.type === 'chelem') { answer(b.dataset.v === '1'); return; }
  if (act === 'ecart' && pending.type === 'discard' && G.sel.size === G.chienSize) {
    const ec = G.hands[pending.seat].filter(c => G.sel.has(c.id)); G.sel = new Set(); answer(ec); return;
  }
  if (act === 'pick') {
    if (lastPointer !== 'mouse' && performance.now() - touchPicked < 700) return;   // déjà traité au lever du doigt
    pickCard(seat, b.dataset.id, lastPointer !== 'mouse');
  }
});
function pickCard(seat, id, touch) {
  if (!G || !pending || pending.seat !== seat) return;
  const c = G.hands[seat].find(x => x.id === id); if (!c) return;
  if (pending.type === 'play') {
    if (!legal(seat).includes(c)) return;
    // au doigt : un premier toucher lève la carte, le second la joue
    if (touch && raisedAtDown !== c.id) { G.raised = c.id; render(); return; }
    answer(c); return;
  }
  if (pending.type === 'discard') {
    if (G.sel.has(c.id)) G.sel.delete(c.id);
    else if (ecartAllowed(c) && G.sel.size < G.chienSize) G.sel.add(c.id);
    render();
  }
}
/* au doigt, on lit la carte sous le point de contact réel au moment où le doigt se lève */
let touchPicked = 0;
document.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' || !e.target.closest || !e.target.closest('.fan')) return;
  const c = cardUnder(e.clientX, e.clientY); if (!c) return;
  touchPicked = performance.now();
  pickCard(+c.dataset.seat, c.dataset.id, true);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-act]')) { e.preventDefault(); lastPointer = 'mouse'; e.target.click(); }
});

/* ---------- Accueil ---------- */
const LEVEL_HINT = {
  weak: 'Joue souvent au hasard. Idéal pour apprendre.',
  mid: 'Joue proprement : charge son partenaire, protège le Petit.',
  expert: 'Compte les cartes et repère les coupes.'
};
function showSetup() {
  $('#game').hidden = true; $('#setup').hidden = false;
  document.querySelectorAll('#segH button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.h === setupH));
  document.querySelectorAll('#segN button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === setupN));
  document.querySelectorAll('#segL button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === setupLevel));
  $('#levelHint').textContent = LEVEL_HINT[setupLevel];
  $('#music').value = setupMusic;
  // un prénom et un avatar par joueur physique
  const box = $('#who');
  if (box.dataset.n !== String(setupH)) {
    box.dataset.n = setupH;
    box.innerHTML = Array.from({ length: setupH }, (_, w) => `<div class="who-row">
      <input id="name${w}" maxlength="14" placeholder="Joueur ${w + 1}" aria-label="Prénom du joueur ${w + 1}" autocomplete="off" value="${esc(setupNames[w] || '')}">
      <div class="picker" role="radiogroup" aria-label="Avatar du joueur ${w + 1}" id="pick${w}"></div></div>`).join('');
    box.querySelectorAll('input').forEach((inp, w) => inp.addEventListener('input', () => { setupNames[w] = inp.value; drawMini(); }));
  }
  for (let w = 0; w < setupH; w++) {
    $('#pick' + w).innerHTML = HUMAN_AVATARS.map(id => {
      const taken = setupAvatars.some((x, j) => j !== w && j < setupH && x === id);
      return `<button type="button" class="pick ${setupAvatars[w] === id ? 'on' : ''}" role="radio" aria-checked="${setupAvatars[w] === id}" data-act="avatar" data-who="${w}" data-id="${id}" ${taken ? 'disabled' : ''} title="${AVATARS[id].label}">${avatarSVG(id, setupAvatars[w] === id ? 'happy' : 'neutral')}<span>${AVATARS[id].label}</span></button>`;
    }).join('');
  }
  drawMini();
  const sv = Save.load(), box2 = $('#resumeBox');
  if (sv) {
    const lead = sv.meta.names.map((nm, i) => ({ nm, v: sv.scores[i] })).sort((a, b) => b.v - a.v);
    box2.innerHTML = `<div><b>Partie en cours sur cet appareil</b><p class="hint">${sv.meta.n} joueurs · ${sv.deal ? `donne ${sv.dealNo}, pli ${sv.deal.trickNo + 1}` : `${sv.history.length} donne${sv.history.length > 1 ? 's' : ''} jouée${sv.history.length > 1 ? 's' : ''}`} · ${new Date(sv.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
      <p class="hint">${lead.map(x => `${esc(x.nm)} ${x.v}`).join(' · ')}</p></div>
      <div class="resume-actions"><button class="btn primary" data-act="resume" type="button">Reprendre la partie</button><button class="btn ghost" data-act="discard-save" type="button">Effacer</button></div>`;
    box2.hidden = false;
  } else box2.hidden = true;
}
function resumeGame() {
  const sv = Save.load(); if (!sv) { showSetup(); return; }
  let deal;
  try { deal = Save.restore(sv); } catch (e) { Save.clear(); showSetup(); return; }
  pending = null;
  Music.choose(setupMusic);
  $('#setup').hidden = true; $('#game').hidden = false;
  window.scrollTo(0, 0);
  runGame(deal);
}

/* ---------- Statistiques ---------- */
function openStats() {
  let m = $('#statsModal');
  if (!m) { m = document.createElement('div'); m.id = 'statsModal'; m.className = 'modal'; document.body.appendChild(m); }
  const pct = (a, b) => (b ? Math.round(a / b * 100) + ' %' : '—');
  let h = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="statsTitle"><header class="modal-head"><h2 id="statsTitle">Statistiques</h2><button class="btn ghost" data-act="close-stats" type="button">Fermer</button></header>`;
  if (G) {
    const S = Stats.game();
    h += `<h3>Cette partie · ${G.history.length} donne${G.history.length > 1 ? 's' : ''}</h3><div class="sheet"><table><thead><tr><th>Joueur</th><th>Prises</th><th>Réussies</th><th>Petite · Garde · GS · GC</th><th>Appelé</th><th>Poignées</th><th>Chelems</th><th>Points</th><th>Par donne</th><th>Meilleure</th></tr></thead><tbody>`
      + S.map(x => `<tr><td>${esc(x.name)}${x.human ? '' : ' <span class="tag">IA</span>'}</td><td>${x.takes}</td><td>${x.wins} (${pct(x.wins, x.takes)})</td><td>${x.byContract.join(' · ')}</td><td>${G.n === 5 ? x.called : '—'}</td><td>${x.poignees}</td><td>${x.chelems}</td><td class="${x.points > 0 ? 'pos' : x.points < 0 ? 'neg' : ''}">${sgn(x.points)}</td><td>${x.deals ? (x.avg < 0 ? '−' : '') + num(Math.abs(x.avg)) : '—'}</td><td>${x.deals ? sgn(x.best) : '—'}</td></tr>`).join('')
      + `</tbody></table></div>`;
  }
  const A = Object.entries(Stats.all());
  h += `<h3>Toutes les parties sur cet appareil</h3>`;
  if (!A.length) h += `<p class="hint">Rien encore : les statistiques des joueurs physiques s'ajoutent à la fin de chaque donne.</p>`;
  else h += `<div class="sheet"><table><thead><tr><th>Joueur</th><th>Parties</th><th>Donnes</th><th>Prises</th><th>Réussies</th><th>Poignées</th><th>Chelems</th><th>Points</th><th>Par donne</th><th>Meilleure</th></tr></thead><tbody>`
    + A.map(([nm, x]) => `<tr><td>${esc(nm)}</td><td>${x.games}</td><td>${x.deals}</td><td>${x.takes}</td><td>${x.wins} (${pct(x.wins, x.takes)})</td><td>${x.poignees}</td><td>${x.chelems}</td><td class="${x.points > 0 ? 'pos' : x.points < 0 ? 'neg' : ''}">${sgn(x.points)}</td><td>${x.deals ? (x.points < 0 ? '−' : '') + num(Math.abs(x.points / x.deals)) : '—'}</td><td>${x.deals ? sgn(x.best) : '—'}</td></tr>`).join('')
    + `</tbody></table></div><div><button class="btn ghost" data-act="reset-stats" type="button">Remettre à zéro</button></div>`;
  h += `</div>`;
  m.innerHTML = h; m.hidden = false;
  m.querySelector('[data-act="close-stats"]').focus();
}
function closeStats() { const m = $('#statsModal'); if (m) m.hidden = true; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStats(); });
document.addEventListener('click', e => { if (e.target.id === 'statsModal') closeStats(); });
function drawMini() {
  const humans = setupH === 1 ? [0] : [0, Math.floor(setupN / 2)];
  let ai = 0, hi = 0, h = '';
  for (let i = 0; i < setupN; i++) {
    const a = (90 - i * 360 / setupN) * Math.PI / 180;
    const x = 50 + 40 * Math.cos(a), y = 50 + 36 * Math.sin(a);
    const isH = humans.includes(i);
    const label = isH ? ((setupNames[hi] || '').trim() || `Joueur ${hi + 1}`) : AI_NAMES[ai];
    const av = isH ? setupAvatars[hi] : AI_AVATAR[AI_NAMES[ai]];
    h += `<span class="mseat ${isH ? 'h' : ''}" style="left:${x}%;top:${y}%"><i class="mav">${avatarSVG(av)}</i><b>${esc(label)}</b><small>${isH ? 'vous' : 'IA'}</small></span>`;
    if (isH) hi++; else ai++;
  }
  $('#minitable').innerHTML = h;
  const nai = setupN - setupH;
  $('#summary').textContent = `${setupH} joueur${setupH > 1 ? 's' : ''} et ${nai} place${nai > 1 ? 's' : ''} pour l'ordinateur.${setupN === 5 ? ' À 5, le preneur appelle un roi.' : ''}`;
}
$('#segH').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setupH = +b.dataset.h; showSetup(); } });
$('#segN').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setupN = +b.dataset.n; showSetup(); } });
$('#segL').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setupLevel = b.dataset.l; showSetup(); } });
function saveMusic(v) { setupMusic = v; try { localStorage.setItem('tarot-music', v); } catch (e) { /* stockage indisponible */ } }
try { const m = localStorage.getItem('tarot-music'); if (m) setupMusic = m; } catch (e) { /* stockage indisponible */ }
$('#music').addEventListener('change', e => { saveMusic(e.target.value); });
document.addEventListener('change', e => {
  if (e.target.id !== 'musicGame') return;
  saveMusic(e.target.value); Music.choose(e.target.value);
});
$('#start').addEventListener('click', () => {
  const n = setupN; const humans = setupH === 1 ? [0] : [0, Math.floor(n / 2)];
  const names = [], avatars = []; let ai = 0;
  for (let i = 0; i < n; i++) {
    const hi = humans.indexOf(i);
    if (hi >= 0) { names.push((setupNames[hi] || '').trim() || `Joueur ${hi + 1}`); avatars.push(setupAvatars[hi]); }
    else { names.push(AI_NAMES[ai]); avatars.push(AI_AVATAR[AI_NAMES[ai]]); ai++; }
  }
  const isHuman = Array(n).fill(false); humans.forEach(s => { isHuman[s] = true; });
  G = { n, humans, isHuman, names, avatars, level: setupLevel, scores: Array(n).fill(0), dealer: n - 1, dealNo: 0, history: [], log: [], reveal: {},
    sel: new Set(), newIds: new Set(), turn: -1, phase: 'idle', say: {} };
  pending = null;
  Save.clear(); Stats.newGame();
  Music.choose(setupMusic);
  $('#setup').hidden = true; $('#game').hidden = false;
  window.scrollTo(0, 0);
  runGame();
});
showSetup();

/* ---------- Jeu en ligne : salle d'attente ---------- */
function openLobby() {
  let m = $('#lobby');
  if (!m) { m = document.createElement('div'); m.id = 'lobby'; m.className = 'modal'; document.body.appendChild(m); }
  m.hidden = false; drawLobby();
}
function closeLobby() { const m = $('#lobby'); if (m) m.hidden = true; }
function drawLobby() {
  const m = $('#lobby'); if (!m || m.hidden) return;
  const row = (p, sub) => `<li class="lob-p"><i class="mav">${avatarSVG(p.avatar || 'pistolero')}</i><span><b>${esc(p.name)}</b><small>${sub}</small></span></li>`;
  let h = '<div class="modal-card lobby-card" role="dialog" aria-modal="true" aria-labelledby="lobbyTitle"><header class="modal-head"><h2 id="lobbyTitle">Table en ligne</h2><button class="btn ghost" data-act="online-cancel" type="button">' + (Online.role === 'host' ? 'Fermer la table' : 'Quitter') + '</button></header>';
  if (Online.error) h += `<p class="lob-err" role="alert">${esc(Online.error)}</p>`;
  if (!Online.room && !Online.error) h += '<p class="hint">Connexion au serveur…</p>';
  if (Online.role === 'host' && Online.room) {
    const n = setupN, guests = Online.guests, ai = n - 1 - guests.length;
    h += `<p class="hint">Donnez ce code aux autres joueurs. Ils ouvrent le jeu à la même adresse, choisissent « Rejoindre » et tapent :</p>
      <div class="lob-code" aria-label="Code de la table">${Online.room.split('').map(ch => `<span>${ch}</span>`).join('')}</div>
      <ul class="lob-list">${row({ name: (setupNames[0] || '').trim() || 'Joueur 1', avatar: setupAvatars[0] }, 'vous, hôte')}${guests.map(p => row(p, 'en ligne')).join('')}${Array.from({ length: Math.max(0, ai) }, () => `<li class="lob-p empty"><i class="mav">?</i><span><b>Place libre</b><small>l'ordinateur jouera ici</small></span></li>`).join('')}</ul>
      <p class="hint">${n} joueurs · ordinateur ${LEVELS[setupLevel].toLowerCase()} · ces réglages se changent à l'accueil.</p>
      <button class="btn primary go" data-act="online-start" type="button">Commencer la partie</button>`;
  }
  if (Online.role === 'guest' && Online.room) {
    const L = Online.lobby;
    h += `<p class="hint">Vous êtes à la table <b>${esc(Online.room)}</b>. La partie commence quand l'hôte la lance.</p>`;
    if (L) h += `<ul class="lob-list">${L.players.map(p => row(p, p.host ? 'hôte' : 'en ligne')).join('')}${Array.from({ length: Math.max(0, L.n - L.players.length) }, () => `<li class="lob-p empty"><i class="mav">?</i><span><b>Place libre</b><small>l'ordinateur jouera ici</small></span></li>`).join('')}</ul><p class="hint">${L.n} joueurs · ordinateur ${LEVELS[L.level].toLowerCase()}</p>`;
  }
  h += '</div>';
  m.innerHTML = h;
}
function startOnline() {
  if (Online.role !== 'host' || !Online.room) return;
  Online.startGame();
  closeLobby();
  pending = null;
  Stats.newGame();
  Music.choose(setupMusic);
  $('#setup').hidden = true; $('#game').hidden = false;
  window.scrollTo(0, 0);
  runGame();
}
let toastT = 0;
function onlineToast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200);
}
/* l'encart « Jouer en ligne » de l'accueil */
function drawOnlineBox() {
  const ok = Online.available();
  document.querySelectorAll('[data-act="online-create"],[data-act="online-join"],#joinCode').forEach(el => { el.disabled = !ok; });
  $('#onlineHint').textContent = ok ? 'Le prénom et l\'avatar choisis à l\'étape 4 sont utilisés.' : 'Le jeu en ligne fonctionne depuis l\'adresse du serveur du jeu (voir README). Ici, il n\'est pas disponible.';
}
drawOnlineBox();
