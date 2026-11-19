/* tutor.js — Didacticiel et conseils.
   1. Une leçon illustrée en 7 étapes (les cartes, les bouts, leur valeur, le contrat, les enchères, le jeu de la carte).
   2. Une donne guidée à 4 joueurs : votre main est préparée pour vous faire prendre une Garde, annoncer une poignée
      et couper ; Gaston, le professeur, commente chaque étape et fait briller la carte qu'il conseille.
   3. Les mêmes conseils peuvent être affichés pendant une partie normale (bouton « Conseils »). */
const Tutor = (() => {
  const TEACHER = 'gaston';
  let slide = 0, cache = { key: '', ids: [] };

  /* ------------------------------------------------------------ la leçon */
  const c = id => cardHTML(CARD[id]);
  const row = ids => `<div class="les-cards">${ids.map(c).join('')}</div>`;
  const slides = () => [
    { t: 'Le jeu de 78 cartes', b: `<p>Quatre couleurs de 14 cartes : Roi, Dame, Cavalier, Valet, puis du 10 au 1.</p>${row(['S14', 'H13', 'C12', 'D11', 'S10', 'H1'])}
        <p>21 atouts, numérotés de 1 à 21 : ils battent toutes les couleurs. Et l'Excuse, une carte à part.</p>${row(['T5', 'T12', 'T20', 'E'])}` },
    { t: 'Les trois bouts', b: `${row(['T1', 'T21', 'E'])}<p>Le <b>Petit</b> (1 d'atout), le <b>21</b> et l'<b>Excuse</b>. Ce sont les cartes les plus précieuses : plus le preneur en gagne, moins il a de points à faire.</p>` },
    { t: 'Ce que valent les cartes', b: `<table class="les-t"><tbody><tr><td>Bouts et rois</td><td>4,5 points</td></tr><tr><td>Dame</td><td>3,5 points</td></tr><tr><td>Cavalier</td><td>2,5 points</td></tr><tr><td>Valet</td><td>1,5 point</td></tr><tr><td>Toutes les autres cartes</td><td>0,5 point</td></tr></tbody></table><p>Le jeu entier vaut 91 points. On les compte en fin de donne dans les plis gagnés.</p>` },
    { t: 'Le contrat', b: `<p>Un joueur, le <b>preneur</b>, joue seul contre tous les autres (à 5, avec un partenaire secret). Il doit gagner un minimum de points, selon le nombre de bouts dans ses plis :</p><table class="les-t"><tbody><tr><td>0 bout</td><td>56 points</td></tr><tr><td>1 bout</td><td>51 points</td></tr><tr><td>2 bouts</td><td>41 points</td></tr><tr><td>3 bouts</td><td>36 points</td></tr></tbody></table>` },
    { t: 'Les enchères', b: `<p>Chacun parle à son tour. Celui qui annonce le plus haut devient preneur.</p><table class="les-t"><tbody><tr><td>Petite</td><td>× 1, il prend le chien</td></tr><tr><td>Garde</td><td>× 2, il prend le chien</td></tr><tr><td>Garde sans le chien</td><td>× 4, le chien lui revient sans être vu</td></tr><tr><td>Garde contre le chien</td><td>× 6, le chien va à la défense</td></tr></tbody></table><p>Le <b>chien</b> : les cartes mises de côté à la distribution. En Petite ou en Garde, le preneur les prend puis en écarte autant.</p>` },
    { t: 'Le jeu de la carte', b: `<ol class="les-l"><li><b>Fournir</b> : on joue la couleur demandée si on en a.</li><li><b>Couper</b> : sinon, on joue un atout.</li><li><b>Monter</b> : à l'atout, on joue plus fort que l'atout déjà posé si on peut.</li><li>Sans la couleur ni atout, on joue ce qu'on veut.</li></ol><p>Le pli revient au plus fort atout, sinon à la plus forte carte de la couleur demandée. L'<b>Excuse</b> se joue à tout moment : elle ne gagne pas le pli mais reste à son camp.</p>` },
    { t: 'À vous de jouer', b: `<p>Vous allez jouer une donne à 4. Votre main a été préparée pour vous faire tout essayer : prendre une Garde, faire l'écart, annoncer une poignée, couper.</p><p>Gaston vous guide à chaque étape, et la carte qu'il conseille brille. Vous restez libre de jouer autre chose.</p>` }
  ];
  let SLIDES = [];
  function open() {
    slide = 0; SLIDES = slides();          // construites à l'ouverture : le dessin des cartes (ui.js) est alors chargé
    let m = $('#lesson');
    if (!m) { m = document.createElement('div'); m.id = 'lesson'; m.className = 'modal'; document.body.appendChild(m); }
    m.hidden = false; draw();
  }
  function close() { const m = $('#lesson'); if (m) m.hidden = true; }
  function draw() {
    const m = $('#lesson'); if (!m) return;
    const S = SLIDES[slide], last = slide === SLIDES.length - 1;
    m.innerHTML = `<div class="modal-card lesson-card" role="dialog" aria-modal="true" aria-labelledby="lesTitle">
      <header class="modal-head"><div class="les-who"><i class="mav">${avatarSVG(TEACHER, last ? 'happy' : 'neutral')}</i><div><div class="eyebrow">Didacticiel · ${slide + 1} sur ${SLIDES.length}</div><h2 id="lesTitle">${S.t}</h2></div></div>
      <button class="btn ghost" data-act="les-close" type="button">Fermer</button></header>
      <div class="les-body">${S.b}</div>
      <div class="les-dots" aria-hidden="true">${SLIDES.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>
      <div class="les-nav">${slide ? '<button class="btn ghost" data-act="les-prev" type="button">Précédent</button>' : '<button class="btn ghost" data-act="les-play" type="button">Passer la leçon</button>'}
      ${last ? '<button class="btn primary" data-act="les-play" type="button">Jouer la donne guidée</button>' : '<button class="btn primary" data-act="les-next" type="button">Suivant</button>'}</div></div>`;
    const b = m.querySelector('.les-nav .primary'); if (b) b.focus();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'tutorial') open();
    else if (a === 'les-close') close();
    else if (a === 'les-next') { slide = Math.min(SLIDES.length - 1, slide + 1); draw(); }
    else if (a === 'les-prev') { slide = Math.max(0, slide - 1); draw(); }
    else if (a === 'les-play') { close(); startGuided(); }
    else if (a === 'tut-again') { closeEnd(); open(); }
    else if (a === 'tut-real') { closeEnd(); SESSION++; pending = null; G = null; Music.stop(); showSetup(); }
    else if (a === 'coach') { if (G) { G.coach = !G.coach; render(); } }
  });
  document.addEventListener('keydown', e => {
    const m = $('#lesson'); if (!m || m.hidden) return;
    if (e.key === 'ArrowRight') { slide = Math.min(SLIDES.length - 1, slide + 1); draw(); }
    if (e.key === 'ArrowLeft') { slide = Math.max(0, slide - 1); draw(); }
    if (e.key === 'Escape') close();
  });

  /* ------------------------------------------------------------ la donne guidée */
  // votre main : 9 atouts + l'Excuse (simple poignée à 4), le 21 et l'Excuse (2 bouts), deux rois, pas de carreau (pour couper)
  const HAND = ['T21', 'T19', 'T17', 'T15', 'T14', 'T12', 'T10', 'T8', 'T5', 'E', 'H14', 'H13', 'H7', 'H3', 'C14', 'C9', 'C2', 'S4'];
  const CHIEN = ['D2', 'S14', 'T3', 'H11', 'C5', 'D9'];
  function startGuided() {
    const name = (setupNames[0] || '').trim() || 'Joueur 1';
    G = { n: 4, humans: [0], isHuman: [true, false, false, false], names: [name, 'Odette', 'Marcel', 'Simone'],
      avatars: [setupAvatars[0], 'odette', 'marcel', 'simone'], level: 'mid', scores: [0, 0, 0, 0], dealer: 3, dealNo: 0,
      history: [], log: [], reveal: {}, sel: new Set(), newIds: new Set(), turn: -1, phase: 'idle', say: {}, tutorial: true, coach: true };
    pending = null; FAST = false;
    Music.choose(setupMusic);
    $('#setup').hidden = true; $('#game').hidden = false;
    window.scrollTo(0, 0);
    runGame();
  }
  /* distribution préparée : votre main et le chien sont fixes, le reste est mélangé */
  function guidedDeal() {
    const fixed = new Set(HAND.concat(CHIEN));
    for (;;) {
      const rest = shuffle(makeDeck().filter(x => !fixed.has(x.id)));
      G.chienSize = 6; G.chien = CHIEN.map(id => CARD[id]);
      G.hands = [shuffle(HAND.map(id => CARD[id]))];
      for (let i = 0; i < 3; i++) G.hands.push(rest.slice(i * 18, (i + 1) * 18));
      if (!G.hands.some(h => { const t = h.filter(x => x.s === 'T'); return t.length === 1 && t[0].r === 1 && !h.some(x => x.s === 'E'); })) return;
    }
  }
  let endResolve = null;
  function finish(tok) {
    return new Promise(res => {
      endResolve = res;
      let m = $('#tutEnd');
      if (!m) { m = document.createElement('div'); m.id = 'tutEnd'; m.className = 'modal'; document.body.appendChild(m); }
      const r = G.result;
      m.innerHTML = `<div class="modal-card lesson-card" role="dialog" aria-modal="true" aria-labelledby="endTitle">
        <header class="modal-head"><div class="les-who"><i class="mav">${avatarSVG(TEACHER, 'happy')}</i><div><div class="eyebrow">Didacticiel terminé</div><h2 id="endTitle">${r && r.win ? 'Bravo, contrat réussi !' : 'Bien joué, et maintenant à vous !'}</h2></div></div></header>
        <div class="les-body"><p>Vous savez maintenant prendre, faire l'écart, annoncer une poignée et jouer la carte. ${r && !r.win ? 'Cette fois le contrat a chuté : cela arrive, même avec une belle main. ' : ''}En partie normale, le bouton <b>Conseils</b> en haut du tapis rappelle Gaston quand vous le voulez.</p></div>
        <div class="les-nav"><button class="btn ghost" data-act="tut-again" type="button">Revoir la leçon</button><button class="btn primary" data-act="tut-real" type="button">Jouer une vraie partie</button></div></div>`;
      m.hidden = false;
      m.querySelector('.primary').focus();
    }).then(() => { throw 'abort'; });
  }
  function closeEnd() { const m = $('#tutEnd'); if (m) m.hidden = true; if (endResolve) { const r = endResolve; endResolve = null; r(); } }

  /* ------------------------------------------------------------ les conseils de Gaston */
  /* la carte (ou les cartes de l'écart) que l'ordinateur expert jouerait à votre place */
  function suggest() {
    if (!G || !G.coach || !pending || pending.seat < 0 || G.online === 'guest') return [];
    const s = pending.seat, key = `${G.dealNo}|${pending.type}|${G.trickNo}|${G.trick ? G.trick.length : 0}|${G.hands[s].length}`;
    if (cache.key === key) return cache.ids;
    let ids = [];
    const lv = G.level;
    try {
      G.level = 'expert';
      if (pending.type === 'play') ids = [aiPlay(s).id];
      else if (pending.type === 'discard') { G.level = 'mid'; ids = aiDiscard(s).map(x => x.id); }
    } finally { G.level = lv; }
    cache = { key, ids };
    return ids;
  }
  const nm = i => esc(G.names[i]);
  const suitWord = s => ({ S: 'pique', H: 'cœur', C: 'trèfle', D: 'carreau', T: 'atout' })[s];
  function playAdvice(s) {
    const tr = G.trick, h = G.hands[s];
    const hint = suggest()[0], hc = hint && CARD[hint];
    const tip = hc ? ` Gaston conseille ${cardName(hc)} (elle brille).` : '';
    if (!tr.length) {
      if (G.tutorial && G.trickNo === 0) return `C'est vous qui entamez le premier pli : jouez la carte de votre choix. Avec beaucoup d'atouts, le preneur commence souvent par faire tomber ceux des adversaires.${tip}`;
      return `Vous entamez : toutes vos cartes sont jouables.${tip}`;
    }
    const led = ledSuit();
    if (!led) return `Seule l'Excuse a été jouée : vous pouvez jouer n'importe quelle carte.${tip}`;
    const hasSuit = h.some(x => x.s === led), hasT = h.some(x => x.s === 'T');
    const hiT = Math.max(0, ...tr.filter(x => x.c.s === 'T').map(x => x.c.r));
    const exc = h.some(x => x.s === 'E') ? " L'Excuse reste toujours jouable." : '';
    if (led === 'T') {
      if (!hasT) return `On joue atout et vous n'en avez plus : vous pouvez vous défausser de n'importe quelle carte.${tip}`;
      return h.some(x => x.s === 'T' && x.r > hiT) ? `On joue atout : vous devez monter, c'est-à-dire jouer un atout plus fort que le ${hiT}.${exc}${tip}` : `On joue atout, mais vous n'avez rien de plus fort que le ${hiT} : jouez un petit atout.${exc}${tip}`;
    }
    if (hasSuit) return `La couleur demandée est ${SYM[led]} ${suitWord(led)} : vous devez fournir du ${suitWord(led)}.${exc}${tip}`;
    if (hasT) return `Vous n'avez plus de ${suitWord(led)} : vous devez couper avec un atout${hiT ? `, plus fort que le ${hiT} si vous pouvez` : ''}.${exc}${tip}`;
    return `Ni ${suitWord(led)} ni atout : vous pouvez vous défausser. On donne une carte qui vaut des points si le pli est pour son camp, sinon une petite.${tip}`;
  }
  function trickReason() {
    const w = G.winFlash, wc = G.trick.find(x => x.p === w); if (!wc) return '';
    const { led } = trickState();
    const why = wc.c.s === 'T' ? (G.trick.filter(x => x.c.s === 'T').length > 1 ? "c'est l'atout le plus fort du pli" : "c'est le seul atout du pli") : `c'est la plus forte carte de ${suitWord(led)}, et personne n'a coupé`;
    const val = G.trick.reduce((a, x) => a + pts_(x.c), 0);
    return `${nm(w)} remporte le pli avec ${cardName(wc.c)} : ${why}. Ce pli vaut ${num(val)} point${val >= 2 ? 's' : ''}.`;
  }
  const pts_ = x => pts(x);
  function scoreText() {
    const r = G.result; if (!r) return '';
    const att = r.t === 0 ? 'Vous' : nm(r.t);
    const per = Math.abs(r.res), def = G.n - 1 - (r.pa !== r.t ? 1 : 0);
    return `${att} aviez ${r.oud} bout${r.oud > 1 ? 's' : ''} : il fallait ${r.need} points. ${r.t === 0 ? 'Vous en avez fait' : 'Le preneur en a fait'} ${num(r.ap)}, donc le contrat ${r.win ? 'est réussi' : 'chute'} de ${num(Math.abs(r.diff))}. Le calcul : (25 + ${Math.round(Math.abs(r.diff))}) × ${r.mult} pour la ${G.contract.name}${r.pab ? `, ${r.pab > 0 ? 'plus' : 'moins'} ${Math.abs(r.pab)} pour le Petit au bout` : ''}${r.poig ? `, ${r.poig > 0 ? 'plus' : 'moins'} ${Math.abs(r.poig)} pour la poignée` : ''}${r.chel ? `, ${r.chel > 0 ? 'plus' : 'moins'} ${Math.abs(r.chel)} pour le chelem` : ''} = ${per} points, ${r.win ? 'gagnés' : 'perdus'} face à chacun des ${def} défenseurs.`;
  }
  function text() {
    const me = pending && pending.seat === 0, h = G.hands ? G.hands[0] : [];
    const tut = G.tutorial;
    if (G.phase === 'deal') return tut ? 'Je distribue : 18 cartes à chacun des 4 joueurs, et 6 cartes au chien, au centre. Vos cartes se rangent toutes seules par couleur.' : 'Distribution des cartes.';
    if (G.phase === 'bid') {
      if (me && pending.type === 'bid') {
        const t = trumpCount(0), b = h.filter(isOud).length, k = h.filter(x => x.r === 14 && x.s !== 'T').length;
        const s = strength(h);
        const adv = s >= 71 ? 'Votre main est très forte : une Garde sans le chien se tente.' : s >= 56 ? 'C’est une belle main : annoncez une Garde.' : s >= 40 ? 'Une Petite est raisonnable.' : 'Votre main est faible : passez.';
        return `À vous de parler. Vous avez ${t} atouts (Excuse comprise), ${b} bout${b > 1 ? 's' : ''} et ${k} roi${k > 1 ? 's' : ''}. ${adv}${tut ? ' Pour ce didacticiel, prenez une Garde.' : ''}`;
      }
      return G.turn >= 0 ? `${nm(G.turn)} réfléchit à son annonce.` : 'Enchères.';
    }
    if (G.phase === 'call') return 'À 5 joueurs, le preneur appelle un roi : celui qui l’a devient son partenaire, sans le dire.';
    if (G.phase === 'chien') return G.taker === 0 ? 'Voici le chien, montré à tous. Il va rejoindre votre main.' : `${nm(G.taker)} prend le chien.`;
    if (G.phase === 'discard') {
      if (me && pending.type === 'discard') return `Écartez ${G.chienSize} cartes : elles compteront pour vous en fin de donne. Interdit : les rois et les bouts. Conseil : videz une couleur courte pour pouvoir couper, et mettez à l'abri une dame ou un cavalier. Les cartes conseillées brillent.`;
      return `${nm(G.taker)} fait son écart.`;
    }
    if (me && pending.type === 'poignee') return `Vous avez ${trumpCount(0)} atouts : à ${G.n} joueurs, cela fait une ${POIGNEE_NAME[poigneeOptions(0).at(-1)]}. L'annoncer rapporte une prime au camp qui gagne, mais montre vos atouts aux adversaires.${G.tutorial ? ' Ici, annoncez-la pour voir.' : ''}`;
    if (me && pending.type === 'chelem') return 'Le chelem consiste à remporter tous les plis. Il rapporte gros mais c’est très rare : jouez sans annonce.';
    if (G.phase === 'play') {
      if (G.showPoig) return `${nm(G.showPoig.p)} montre ses atouts à toute la table : c'est l'annonce de la poignée.`;
      if (G.winFlash >= 0) return trickReason();
      if (me && pending.type === 'play') return playAdvice(0);
      return G.turn >= 0 ? `${nm(G.turn)} joue.` : '';
    }
    if (G.phase === 'score') return scoreText();
    return '';
  }
  function coachHTML() {
    if (!G || !G.coach || G.online === 'guest' && !pending) return '';
    const t = text(); if (!t) return '';
    const mood = G.phase === 'score' ? (G.result && G.result.d[0] >= 0 ? 'happy' : 'sad') : G.winFlash >= 0 ? 'happy' : pending && pending.seat === 0 ? 'think' : 'neutral';
    return `<div class="coach" role="status" aria-live="polite"><i class="mav">${avatarSVG(TEACHER, mood)}</i><div><b>${G.tutorial ? 'Gaston, votre professeur' : 'Conseil de Gaston'}</b><p>${t}</p></div></div>`;
  }

  return { open, guidedDeal, finish, suggest, coachHTML, get active() { return !!(G && G.tutorial); } };
})();
