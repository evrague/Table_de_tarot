/* pwa.js — Installer le jeu comme une application (PWA).
   Le service worker et le manifeste n'existent que dans la version servie par le serveur du jeu (dist/pwa).
   Chrome, Edge et Android proposent un bouton « Installer » ; sur iPhone et iPad, on explique le chemin dans Safari. */
const PWA = (() => {
  let deferred = null, ready = false;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function register() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || !document.querySelector('link[rel="manifest"]')) return;
    navigator.serviceWorker.register('sw.js').then(() => { ready = true; draw(); }).catch(() => { /* hébergement sans service worker */ });
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; draw(); });
  window.addEventListener('appinstalled', () => { deferred = null; draw(); if (typeof onlineToast === 'function') onlineToast('Application installée.'); });
  function draw() {
    const box = document.getElementById('installBox'); if (!box) return;
    if (standalone() || (!deferred && !(ready && ios))) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = deferred
      ? '<span class="ql">Application</span><button class="btn" data-act="install" type="button">Installer l’application</button><p class="hint">Elle s’ouvre ensuite en plein écran et fonctionne sans réseau (sauf le jeu en ligne).</p>'
      : '<span class="ql">Application</span><p class="hint">Pour installer le jeu sur cet iPhone ou cet iPad : dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».</p>';
  }
  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* refus */ }
    deferred = null; draw();
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="install"]'); if (b) install(); });
  register();
  return { draw, install, get standalone() { return standalone(); } };
})();
