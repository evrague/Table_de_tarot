/* anim.js — Animations 3D.
   - Main en éventail : à la distribution les cartes s'envolent et se retournent une à une ;
     au classement et quand l'éventail se resserre, chaque carte pivote autour de la main (rotation + arc en profondeur).
   - Tapis : parallaxe 3D qui suit la souris (désactivée au tactile et si l'utilisateur limite les animations).
   Les autres animations (distribution sur le tapis, carte jouée qui se retourne, pli ramassé, confettis) sont en CSS. */
const Anim = (() => {
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ok = el => !reduce() && typeof el.animate === 'function';

  /* angle de chaque carte de l'éventail, par identifiant */
  function capture(root) {
    const m = new Map();
    root.querySelectorAll('.fan .slot[data-id]').forEach(el => m.set(el.dataset.id, +el.dataset.a));
    return m;
  }

  function dealIn(root) {
    root.querySelectorAll('.fan .slot').forEach((el, i) => {
      if (!ok(el)) return;
      const a = +el.dataset.a;
      el.animate([
        { transform: `rotate(0deg) translate3d(0,-260px,260px) rotateX(70deg) rotateY(180deg)`, opacity: 0 },
        { transform: `rotate(${a * 0.5}deg) translate3d(0,-80px,120px) rotateY(60deg)`, opacity: 1, offset: 0.6 },
        { transform: `rotate(${a}deg)`, opacity: 1 }
      ], { duration: 640, delay: i * 45, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
    });
  }

  function flip(root, before) {
    if (!before || !before.size) return;
    let k = 0;
    root.querySelectorAll('.fan .slot[data-id]').forEach(el => {
      if (!ok(el)) return;
      const a1 = +el.dataset.a, a0 = before.get(el.dataset.id);
      if (a0 === undefined) {          // carte nouvelle (le chien) : elle arrive d'en haut en se retournant
        el.animate([
          { transform: `rotate(${a1}deg) translate3d(0,-200px,200px) rotateY(180deg)`, opacity: 0 },
          { transform: `rotate(${a1}deg)`, opacity: 1 }
        ], { duration: 620, delay: 150 + (k++) * 90, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
        return;
      }
      if (Math.abs(a1 - a0) < 0.3) return;
      const lift = Math.min(70, 16 + Math.abs(a1 - a0) * 1.4);
      el.animate([
        { transform: `rotate(${a0}deg)` },
        { transform: `rotate(${(a0 + a1) / 2}deg) translate3d(0,${-lift}px,${lift}px) rotateX(18deg)`, offset: 0.5 },
        { transform: `rotate(${a1}deg)` }
      ], { duration: 620, delay: Math.min(380, (k++) * 16), easing: 'cubic-bezier(.3,.7,.2,1)' });
    });
  }

  /* parallaxe du tapis */
  let rx = 0, ry = 0;
  function tiltStyle() { return `--px:${rx.toFixed(2)}deg;--py:${ry.toFixed(2)}deg`; }
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || reduce()) return;
    const st = document.querySelector('.stage'); if (!st) return;
    const r = st.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    if (Math.abs(x) > 1 || Math.abs(y) > 1) { rx = ry = 0; } else { rx = -y * 6; ry = x * 8; }
    st.style.setProperty('--px', rx.toFixed(2) + 'deg'); st.style.setProperty('--py', ry.toFixed(2) + 'deg');
  }, { passive: true });

  /* main en éventail : légère inclinaison 3D et reflet de lumière qui suit la souris */
  let glare = null;
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || reduce()) return;
    const fan = e.target.closest && e.target.closest('.fan');
    document.querySelectorAll('.fan').forEach(f => { if (f !== fan) { f.style.removeProperty('--fx'); f.style.removeProperty('--fy'); } });
    const deco = document.querySelector('.fan-deco');
    if (deco && deco.offsetParent) {
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      deco.style.setProperty('--dy', (x * 40).toFixed(1) + 'deg'); deco.style.setProperty('--dx', (-y * 26).toFixed(1) + 'deg');
    }
    if (!fan) { if (glare) glare.classList.remove('glare'); glare = null; return; }
    const r = fan.getBoundingClientRect();
    fan.style.setProperty('--fx', (-((e.clientY - r.top) / r.height - 0.5) * 10).toFixed(2) + 'deg');
    fan.style.setProperty('--fy', (((e.clientX - r.left) / r.width - 0.5) * 14).toFixed(2) + 'deg');
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const c = hit && hit.closest('.fan .card');
    if (glare && glare !== c) glare.classList.remove('glare');
    glare = c;
    if (c) {
      const cr = c.getBoundingClientRect();
      c.classList.add('glare');
      c.style.setProperty('--gx', ((e.clientX - cr.left) / cr.width * 100).toFixed(0) + '%');
      c.style.setProperty('--gy', ((e.clientY - cr.top) / cr.height * 100).toFixed(0) + '%');
    }
  }, { passive: true });

  return { capture, dealIn, flip, reduce, tiltStyle };
})();
