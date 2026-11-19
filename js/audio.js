/* audio.js — Musique d'ambiance, au choix : Western (original), Classique (Bach, Pachelbel), Pop (original).
   Les morceaux sont mixés à l'avance avec de vrais instruments enregistrés (tools/compose_music.py et compose_pieces.py)
   et embarqués dans assets/music.js (MUSIC_TRACKS). Lecture en boucle sans coupure, fondu enchaîné au changement. */
const Music = (() => {
  let ctx = null, master = null, cur = null, on = false, track = 'western';
  const buffers = {}, loading = {};
  const VOLUME = 0.42;
  const tracks = () => (typeof MUSIC_TRACKS === 'object' ? MUSIC_TRACKS : {});

  function bytes(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function decode(id) {
    if (buffers[id]) return Promise.resolve(buffers[id]);
    if (!loading[id]) {
      loading[id] = new Promise((res, rej) => ctx.decodeAudioData(bytes(tracks()[id].b64), res, rej))   // forme à rappels : anciens Safari
        .then(b => { buffers[id] = b; return b; })
        .catch(e => { delete loading[id]; throw e; });
    }
    return loading[id];
  }
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  }
  function fadeOut(node, sec) {
    if (!node) return;
    const t = ctx.currentTime;
    node.gain.gain.cancelScheduledValues(t); node.gain.gain.setValueAtTime(node.gain.gain.value, t);
    node.gain.gain.linearRampToValueAtTime(0, t + sec);
    setTimeout(() => { try { node.src.stop(); node.src.disconnect(); node.gain.disconnect(); } catch (e) { /* déjà arrêtée */ } }, sec * 1000 + 100);
  }
  function play(id) {
    const buffer = buffers[id]; if (!buffer || !on || track !== id) return;
    const loopLen = tracks()[id].loop || buffer.duration;
    // certains décodeurs gardent le délai de l'encodeur MP3 (≈ 25 ms) : on décale la boucle d'autant
    const offset = Math.max(0, Math.min(0.0251, buffer.duration - loopLen));
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buffer; src.loop = true;
    src.loopStart = offset; src.loopEnd = offset + Math.min(loopLen, buffer.duration - offset);
    gain.gain.value = 0; src.connect(gain); gain.connect(master);
    src.start(0, offset);
    const t = ctx.currentTime; gain.gain.linearRampToValueAtTime(VOLUME, t + 2);
    fadeOut(cur, 1.5);
    cur = { src, gain, id };
  }
  function start(id) {
    if (id && tracks()[id]) track = id;
    try {
      ensureCtx(); ctx.resume();
      on = true;
      if (cur && cur.id === track) return;
      const want = track;
      decode(want).then(() => play(want)).catch(() => { on = false; if (typeof render === 'function') render(); });
    } catch (e) { on = false; }
  }
  function stop() {
    on = false;
    if (ctx) { fadeOut(cur, 0.8); cur = null; }
  }
  /* choisir une ambiance : un identifiant de morceau, ou 'off' */
  function choose(id) { if (id === 'off') stop(); else start(id); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && on && ctx) ctx.resume(); });
  return {
    start, stop, choose,
    toggle() { on ? stop() : start(); return on; },
    get on() { return on; }, get track() { return track; },
    list: () => Object.entries(tracks()).map(([id, t]) => ({ id, label: t.label }))
  };
})();
