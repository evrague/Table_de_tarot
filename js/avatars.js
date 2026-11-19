/* avatars.js — Portraits des joueurs, dessinés en SVG (personnages originaux d'un saloon de l'Ouest).
   avatarSVG(id, humeur) : humeur = 'neutral' | 'happy' | 'sad' | 'think'. Les yeux clignent (CSS .eyes). */

const AVATARS = {
  // places tenues par l'ordinateur
  odette:     { label: 'Odette', bg: '#5b3a6b', skin: '#f1c9a5', hair: ['bun', '#cfc9c1'], glasses: true, earrings: 'pearl', shirt: '#7b4b8f', collar: 'lace', blush: true },
  marcel:     { label: 'Marcel', bg: '#6b4a2e', skin: '#d9a074', hair: ['short', '#4a2c17'], hat: ['cowboy', '#5a3b22', '#2a1a0f'], mustache: ['bushy', '#4a2c17'], stubble: true, shirt: '#8f3a2b', collar: 'scarf', scarf: '#d8b04a' },
  simone:     { label: 'Simone', bg: '#8a2f2f', skin: '#f3cfb3', hair: ['bob', '#b5502a'], hat: ['flat', '#1b1a1d', '#b3242b'], lips: '#b3242b', earrings: 'gold', shirt: '#2f5b45', collar: 'choker', blush: true },
  gaston:     { label: 'Gaston', bg: '#2e4a5b', skin: '#e8b48f', hair: ['bald', '#8e8a85'], hat: ['bowler', '#1a1a1c', '#3a3a3e'], mustache: ['handlebar', '#8e8a85'], monocle: true, shirt: '#f1ead7', collar: 'vest', vest: '#2d2a33', tie: '#b3242b' },
  yvonne:     { label: 'Yvonne', bg: '#3e5b3a', skin: '#8d5a3b', hair: ['braids', '#151213'], hat: ['bandana', '#b3242b', '#f1ead7'], earrings: 'hoop', shirt: '#c99a3e', collar: 'none' },
  // au choix des joueurs physiques
  sherif:     { label: 'Shérif', bg: '#26407c', skin: '#e6b48c', hair: ['short', '#5a3a22'], hat: ['cowboy', '#c9a26b', '#5a3b22'], mustache: ['trim', '#5a3a22'], shirt: '#d9cfb8', collar: 'vest', vest: '#5b3c26', badge: true },
  joueuse:    { label: 'Joueuse', bg: '#7a1f3d', skin: '#f0c8a8', hair: ['long', '#1d1716'], hat: ['flat', '#1b1a1d', '#d2a64b'], lips: '#9d1b2c', earrings: 'gold', shirt: '#1b1a1d', collar: 'choker', blush: true },
  pistolero:  { label: 'Pistolero', bg: '#1f3a33', skin: '#c68a62', hair: ['short', '#1d1716'], hat: ['cowboy', '#1d1a19', '#6b4a2e'], stubble: true, beard: ['stubble'], shirt: '#a0522d', collar: 'poncho' },
  rancheuse:  { label: 'Rancheuse', bg: '#8c5a2b', skin: '#f5d4b8', hair: ['braids', '#d9b45a'], hat: ['cowboy', '#7a5230', '#3b2615'], freckles: true, shirt: '#a33232', collar: 'plaid', blush: true },
  prospecteur:{ label: 'Prospecteur', bg: '#55562c', skin: '#e0a882', hair: ['short', '#a9a39a'], hat: ['slouch', '#5d5b3a', '#3d3b25'], beard: ['full', '#b7b1a6'], shirt: '#476a8a', collar: 'suspenders' },
  pianiste:   { label: 'Pianiste', bg: '#3a2f5b', skin: '#a86e4a', hair: ['curly', '#1d1716'], hat: ['bowler', '#5a3b22', '#2a1a0f'], mustache: ['trim', '#1d1716'], shirt: '#efe6d0', collar: 'vest', vest: '#6b2737', tie: '#1b1a1d' }
};
const AI_AVATAR = { Odette: 'odette', Marcel: 'marcel', Simone: 'simone', Gaston: 'gaston', Yvonne: 'yvonne' };
const HUMAN_AVATARS = ['sherif', 'joueuse', 'pistolero', 'rancheuse', 'prospecteur', 'pianiste'];

let _avUid = 0;
function shade(hex, k) {           // assombrit (k<0) ou éclaircit (k>0) une couleur
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function avatarSVG(id, mood = 'neutral', opts = {}) {
  const bust = !!opts.bust;     // buste debout autour de la table : sans médaillon
  const a = AVATARS[id] || AVATARS.sherif;
  const big = mood === 'joy' || mood === 'cry';
  const base = mood === 'joy' ? 'happy' : mood === 'cry' ? 'sad' : mood;
  const u = 'av' + (++_avUid);
  const skinD = shade(a.skin, -0.18), ink = '#1f1915';
  const [hs, hc] = a.hair;
  // volumes : la lumière de la lampe vient d'en haut à gauche
  const hat1 = a.hat ? a.hat[1] : '#000';
  let s = `<svg class="avatar-svg ${big ? mood : ''} ${bust ? 'bust' : ''}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${u}c"><circle cx="50" cy="50" r="50"/></clipPath>
    <radialGradient id="${u}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(a.bg, 0.25)}"/><stop offset="1" stop-color="${shade(a.bg, -0.25)}"/></radialGradient>
    <radialGradient id="${u}sk" cx="40%" cy="32%" r="72%"><stop offset="0" stop-color="${shade(a.skin, 0.22)}"/><stop offset=".55" stop-color="${a.skin}"/><stop offset="1" stop-color="${shade(a.skin, -0.2)}"/></radialGradient>
    <linearGradient id="${u}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(a.shirt, 0.18)}"/><stop offset=".55" stop-color="${a.shirt}"/><stop offset="1" stop-color="${shade(a.shirt, -0.35)}"/></linearGradient>
    <linearGradient id="${u}ht" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${shade(hat1, 0.3)}"/><stop offset=".5" stop-color="${hat1}"/><stop offset="1" stop-color="${shade(hat1, -0.3)}"/></linearGradient>
    <linearGradient id="${u}hr" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${shade(hc, 0.25)}"/><stop offset="1" stop-color="${shade(hc, -0.2)}"/></linearGradient></defs>
    ${bust ? '<g>' : `<g clip-path="url(#${u}c)"><rect width="100" height="100" fill="url(#${u}g)"/>`}`;

  // cheveux longs derrière la tête
  if (hs === 'long' || hs === 'bob') s += `<path d="M27 46 C25 25 40 20 50 21 C61 20 76 25 73 47 L${hs === 'long' ? '77 84 C70 88 63 84 64 74' : '74 63 C70 66 66 64 66 58'} L36 ${hs === 'long' ? 74 : 58} C${hs === 'long' ? '37 84 30 88 23 84' : '34 64 30 66 26 63'} Z" fill="${hc}"/>`;
  if (hs === 'braids') s += [32, 68].map(x => [60, 68, 76, 84].map(y => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="4.8" fill="${hc}" stroke="${shade(hc, -0.25)}" stroke-width=".8"/>`).join('')).join('');

  // épaules et vêtements
  s += bust ? `<path d="M2 100 C3 79 24 70 50 70 C76 70 97 79 98 100 Z" fill="url(#${u}sh)"/>` : `<path d="M10 100 C12 80 30 71 50 71 C70 71 88 80 90 100 Z" fill="url(#${u}sh)"/>`;
  if (a.collar === 'vest') s += `<path d="M10 100 C12 82 24 74 38 72 L47 100 Z M90 100 C88 82 76 74 62 72 L53 100 Z" fill="${a.vest}"/>`;
  if (a.collar === 'poncho') s += `<path d="M10 100 C12 80 30 71 50 71 C70 71 88 80 90 100 Z" fill="none" stroke="${shade(a.shirt, 0.45)}" stroke-width="3" stroke-dasharray="6 4" transform="translate(0 9)"/><path d="M14 93 L86 93" stroke="${shade(a.shirt, -0.35)}" stroke-width="3"/>`;
  if (a.collar === 'plaid') s += `<g clip-path="url(#${u}s)" opacity=".35" stroke="#1b1a1d" stroke-width="2">${[20, 32, 44, 56, 68, 80].map(x => `<path d="M${x} 70 V100"/>`).join('')}${[80, 90].map(y => `<path d="M0 ${y} H100"/>`).join('')}</g><clipPath id="${u}s"><path d="M10 100 C12 80 30 71 50 71 C70 71 88 80 90 100 Z"/></clipPath>`;
  if (a.collar === 'suspenders') s += `<path d="M38 73 L36 100 M62 73 L64 100" stroke="#3b2615" stroke-width="3.2"/>`;
  s += `<rect x="43" y="60" width="14" height="14" rx="5" fill="${skinD}"/><ellipse cx="50" cy="68" rx="9" ry="3.5" fill="#000" opacity=".22"/>`;   // cou et ombre du menton
  if (a.collar === 'scarf') s += `<path d="M37 71 L63 71 L50 86 Z" fill="${a.scarf}"/><path d="M37 71 L63 71" stroke="${shade(a.scarf, -0.3)}" stroke-width="2"/>`;
  if (a.collar === 'lace') s += `<path d="M36 72 Q40 79 44 73 Q47 80 50 74 Q53 80 56 73 Q60 79 64 72" fill="none" stroke="#f4efe3" stroke-width="2.6"/>`;
  if (a.collar === 'choker') s += `<path d="M43 69 Q50 72 57 69" fill="none" stroke="#1b1a1d" stroke-width="2.4"/><circle cx="50" cy="71.5" r="1.6" fill="#d2a64b"/>`;
  if (a.tie) s += `<path d="M44 73 L50 76 L44 79 Z M56 73 L50 76 L56 79 Z" fill="${a.tie}"/><circle cx="50" cy="76" r="1.4" fill="${shade(a.tie, -0.3)}"/>`;
  if (a.badge) s += `<path d="M66 82 l2.2 4.6 5 .6 -3.7 3.4 1 5 -4.5 -2.5 -4.5 2.5 1 -5 -3.7 -3.4 5 -.6 z" fill="#e2b94f" stroke="#8a6a1e" stroke-width=".6"/>`;

  // oreilles, tête
  s += `<ellipse cx="29.5" cy="50" rx="3.6" ry="5" fill="${skinD}"/><ellipse cx="70.5" cy="50" rx="3.6" ry="5" fill="${skinD}"/>`;
  s += `<ellipse cx="50" cy="48" rx="20.5" ry="23.5" fill="url(#${u}sk)"/>`;
  s += `<ellipse cx="43" cy="39" rx="8" ry="5" fill="#fff" opacity=".16"/><path d="M66 36 Q73 50 63 67" fill="none" stroke="#fff" stroke-width="1.4" opacity=".14" stroke-linecap="round"/>`;
  if (a.hat && a.hat[0] !== 'bandana') s += `<ellipse cx="50" cy="34" rx="20" ry="4.5" fill="#000" opacity=".2"/>`;   // ombre du bord du chapeau
  if (a.earrings === 'pearl') s += `<circle cx="29.5" cy="57" r="2" fill="#f7f3ea"/><circle cx="70.5" cy="57" r="2" fill="#f7f3ea"/>`;
  if (a.earrings === 'gold') s += `<circle cx="29.5" cy="57" r="1.8" fill="#e2b94f"/><circle cx="70.5" cy="57" r="1.8" fill="#e2b94f"/>`;
  if (a.earrings === 'hoop') s += `<circle cx="29" cy="59" r="3.2" fill="none" stroke="#e2b94f" stroke-width="1.2"/><circle cx="71" cy="59" r="3.2" fill="none" stroke="#e2b94f" stroke-width="1.2"/>`;
  if (a.stubble) s += `<path d="M31 54 C33 70 42 72 50 72 C58 72 67 70 69 54 C64 63 58 66 50 66 C42 66 36 63 31 54 Z" fill="${ink}" opacity=".16"/>`;
  if (a.beard && a.beard[0] === 'full') s += `<path d="M29 50 C30 76 41 86 50 86 C59 86 70 76 71 50 C67 61 60 66 50 66 C40 66 33 61 29 50 Z" fill="${a.beard[1]}"/>`;
  if (a.blush) s += `<ellipse cx="38" cy="58" rx="4" ry="2.4" fill="#e0756b" opacity=".28"/><ellipse cx="62" cy="58" rx="4" ry="2.4" fill="#e0756b" opacity=".28"/>`;
  if (a.freckles) s += [[37, 55], [40, 57], [36, 58], [63, 55], [60, 57], [64, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".8" fill="#a5643a" opacity=".7"/>`).join('');

  // yeux et sourcils selon l'humeur
  const brow = base === 'sad' ? 'M38 42.5 L45 45 M55 45 L62 42.5' : base === 'think' ? 'M38 42 L45 41 M55 43.5 L62 44' : base === 'happy' ? 'M38 42.5 Q41.5 40.5 45 42.5 M55 42.5 Q58.5 40.5 62 42.5' : 'M38 43.5 L45 43 M55 43 L62 43.5';
  s += `<path d="${brow}" stroke="${hs === 'bald' ? shade(a.skin, -0.45) : shade(hc, -0.2)}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  if (mood === 'cry') s += `<g fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"><path d="M38.5 48 Q41.5 51.5 44.5 48"/><path d="M55.5 48 Q58.5 51.5 61.5 48"/></g>`;
  else if (base === 'happy') s += `<g class="eyes-happy" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"><path d="M39 50 Q41.5 46.5 44 50"/><path d="M56 50 Q58.5 46.5 61 50"/></g>`;
  else {
    const dx = base === 'think' ? -1.2 : 0, dy = base === 'think' ? -1.2 : 0;
    s += `<g class="eyes"><ellipse cx="41.5" cy="49.5" rx="3.6" ry="3.4" fill="#fbf7ef"/><ellipse cx="58.5" cy="49.5" rx="3.6" ry="3.4" fill="#fbf7ef"/>
      <ellipse cx="${41.5 + dx}" cy="${49.5 + dy}" rx="2.3" ry="2.8" fill="${ink}"/><ellipse cx="${58.5 + dx}" cy="${49.5 + dy}" rx="2.3" ry="2.8" fill="${ink}"/>
      <circle cx="${42.3 + dx}" cy="${48.6 + dy}" r=".7" fill="#fff"/><circle cx="${59.3 + dx}" cy="${48.6 + dy}" r=".7" fill="#fff"/></g>`;
  }
  if (a.glasses) s += `<g fill="#fff" fill-opacity=".14" stroke="#3a3330" stroke-width="1.3"><circle cx="41.5" cy="50" r="5.4"/><circle cx="58.5" cy="50" r="5.4"/><path d="M46.9 50 Q50 48 53.1 50" fill="none"/></g>`;
  if (a.monocle) s += `<circle cx="58.5" cy="50" r="5.6" fill="#fff" fill-opacity=".15" stroke="#c9a54a" stroke-width="1.3"/><path d="M63.5 53 Q68 64 64 74" fill="none" stroke="#c9a54a" stroke-width=".8"/>`;

  // nez, bouche, moustache
  s += `<path d="M50.5 50 Q47 57 50 58.5 Q52 58.8 53 57.8" fill="none" stroke="${skinD}" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="51.5" cy="55" rx="1.3" ry=".9" fill="#fff" opacity=".35"/>`;
  const lip = a.lips || '#7a3328';
  if (mood === 'joy') s += `<path d="M41.5 60.5 Q50 75 58.5 60.5 Q50 63.5 41.5 60.5 Z" fill="#5a1d1a"/><path d="M44 61.5 Q50 63.4 56 61.5 L55 63.6 Q50 64.8 45 63.6 Z" fill="#fff"/><ellipse cx="50" cy="69" rx="4" ry="2.2" fill="#d9605a"/>`;
  else if (mood === 'cry') s += `<path d="M43.5 66.5 Q50 58.5 56.5 66.5 Q50 70 43.5 66.5 Z" fill="#5a1d1a"/><path d="M46.5 66 Q50 64 53.5 66" fill="none" stroke="#d9605a" stroke-width="1.4"/>`;
  else if (base === 'happy') s += `<path d="M42.5 61.5 Q50 71 57.5 61.5 Q50 64.5 42.5 61.5 Z" fill="${lip}"/><path d="M45 62.6 Q50 64.4 55 62.6 L54 64 Q50 65.2 46 64 Z" fill="#fff" opacity=".9"/>`;
  else if (base === 'sad') s += `<path d="M44 66 Q50 60.5 56 66" fill="none" stroke="${lip}" stroke-width="2.2" stroke-linecap="round"/>`;
  else if (base === 'think') s += `<ellipse cx="53" cy="64" rx="2.2" ry="1.7" fill="${lip}"/>`;
  else s += `<path d="M44.5 63 Q50 ${a.lips ? 66.5 : 65} 55.5 63" fill="${a.lips ? lip : 'none'}" stroke="${lip}" stroke-width="2" stroke-linecap="round"/>`;
  if (a.mustache) {
    const mc = a.mustache[1];
    if (a.mustache[0] === 'handlebar') s += `<path d="M36 55 C37 61 45 58.5 50 59.5 C55 58.5 63 61 64 55 C64.5 60 59 63.5 50 61.5 C41 63.5 35.5 60 36 55 Z" fill="${mc}"/>`;
    else if (a.mustache[0] === 'bushy') s += `<path d="M40 61.5 C41 56 47 56.5 50 58.5 C53 56.5 59 56 60 61.5 C56 60.5 53 61.5 50 61 C47 61.5 44 60.5 40 61.5 Z" fill="${mc}"/>`;
    else s += `<path d="M43 60.5 C45 58 48.5 58.5 50 59.5 C51.5 58.5 55 58 57 60.5 C54 60.2 52 60.8 50 60.5 C48 60.8 46 60.2 43 60.5 Z" fill="${mc}"/>`;
  }

  // cheveux devant, chapeaux
  if (hs === 'short') s += `<path d="M30 43 C27 26 40 22 50 23 C61 22 73 27 70 43 C66 35 58 31.5 50 31.5 C42 31.5 34 35 30 43 Z" fill="url(#${u}hr)"/>`;
  if (hs === 'bob' || hs === 'long') s += `<path d="M29.5 44 C29 28 41 23.5 51 24 C62 24 71 30 70.5 43 C66 36 60 32 54 31 C50 35 40 38 29.5 44 Z" fill="url(#${u}hr)"/>`;
  if (hs === 'bun') s += `<circle cx="50" cy="20" r="8" fill="${hc}"/><path d="M30 44 C28 27 40 22 50 23 C61 22 72 27 70 44 C67 34 59 30 50 30 C41 30 33 34 30 44 Z" fill="${hc}"/><path d="M38 28 Q50 24 62 28" stroke="${shade(hc, -0.2)}" fill="none"/>`;
  if (hs === 'braids') s += `<path d="M30 44 C28 27 40 22 50 23 C61 22 72 27 70 44 C66 35 56 32 50 33 L50 26 L50 33 C44 32 34 35 30 44 Z" fill="${hc}"/>`;
  if (hs === 'curly') s += [[34, 33], [40, 27], [48, 25], [56, 25], [63, 28], [67, 34], [31, 40], [69, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${hc}"/>`).join('');
  if (hs === 'bald') s += `<path d="M29 41 L29 52 L32 52 L32 40 Z M71 41 L71 52 L68 52 L68 40 Z" fill="${hc}"/>`;
  if (a.hat) {
    const [ht, c1, c2] = a.hat;
    if (ht === 'cowboy') s += `<path d="M30 31 C29 14 39 8 50 13 C61 8 71 14 70 31 Z" fill="url(#${u}ht)"/><path d="M42 14 Q50 19 58 14" stroke="${shade(c1, -0.3)}" stroke-width="1.5" fill="none"/>
      <rect x="30" y="25" width="40" height="5" fill="${c2}"/><path d="M8 30 C20 23 80 23 92 30 C84 38 16 38 8 30 Z" fill="${shade(c1, -0.08)}"/><path d="M8 30 C20 23 80 23 92 30" stroke="${shade(c1, 0.2)}" stroke-width="1" fill="none"/>`;
    if (ht === 'bowler') s += `<path d="M32 31 C31 11 69 11 68 31 Z" fill="url(#${u}ht)"/><rect x="32" y="26" width="36" height="4.5" fill="${c2}"/><path d="M23 31 C30 27 70 27 77 31 C70 35 30 35 23 31 Z" fill="${shade(c1, 0.08)}"/><ellipse cx="44" cy="18" rx="6" ry="3" fill="#fff" opacity=".12"/>`;
    if (ht === 'flat') s += `<path d="M34 29 L36 15 L64 15 L66 29 Z" fill="url(#${u}ht)"/><rect x="35" y="24" width="30" height="4.5" fill="${c2}"/><ellipse cx="50" cy="29.5" rx="32" ry="5" fill="${shade(c1, 0.1)}"/>`;
    if (ht === 'slouch') s += `<path d="M28 33 C27 14 41 10 52 12 C64 12 73 18 72 33 Z" fill="url(#${u}ht)"/><rect x="28" y="27" width="44" height="5" fill="${c2}"/><path d="M14 34 C28 26 72 26 86 34 C84 42 16 42 14 34 Z" fill="${shade(c1, -0.1)}"/>`;
    if (ht === 'bandana') s += `<path d="M28.5 42 C28 21 72 21 71.5 42 C64 35 36 35 28.5 42 Z" fill="url(#${u}ht)"/>${[[38, 30], [50, 28], [62, 30], [44, 36], [56, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="${c2}"/>`).join('')}<path d="M70 36 L80 32 L78 42 Z M70 37 L79 46 L71 45 Z" fill="${shade(c1, -0.12)}"/>`;
  }
  if (mood === 'cry') {
    s += `<path d="M40 52 Q38 60 39 70 M60 52 Q62 60 61 70" stroke="#9fd3f5" stroke-width="3.2" fill="none" opacity=".7" stroke-linecap="round"/>`;
    s += [[39.5, 0], [60.5, 0.35], [39.5, 0.7], [60.5, 1.05]].map(([x, d]) => `<path class="tear" style="animation-delay:${d}s" d="M${x} 50 q-4 6.5 0 9.4 q4 -2.9 0 -9.4 Z" fill="#8fd0fb" stroke="#3f8fcb" stroke-width=".7"/>`).join('');
  }
  s += '</g>' + (bust ? '' : `<circle cx="50" cy="50" r="48.5" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>`);
  if (mood === 'joy') {           // bras levés au-dessus de la tête, devant le buste
    const sl = shade(a.shirt, -0.08), sk = a.skin, skD = shade(a.skin, -0.22);
    const arm = (cls, x0, cx, x2, y2) => `<g class="arm ${cls}"><path d="M${x0} 92 Q${cx} 70 ${x2} ${y2 + 6}" fill="none" stroke="${shade(sl, -0.25)}" stroke-width="15" stroke-linecap="round"/><path d="M${x0} 92 Q${cx} 70 ${x2} ${y2 + 6}" fill="none" stroke="${sl}" stroke-width="12" stroke-linecap="round"/>
      <circle cx="${x2}" cy="${y2}" r="8.5" fill="${sk}" stroke="${skD}" stroke-width="1.2"/><path d="M${x2 - 5} ${y2 - 5} l2 -6 M${x2 - 1} ${y2 - 7} l1 -6 M${x2 + 3} ${y2 - 6} l1.5 -5.5" stroke="${skD}" stroke-width="3.5" stroke-linecap="round"/></g>`;
    s += arm('arm-l', 22, 6, -2, 22) + arm('arm-r', 78, 94, 102, 22);
  }
  if (mood === 'joy') s += [[8, 14, 0], [88, 10, .3], [95, 58, .6], [3, 62, .9], [50, -4, .45]].map(([x, y, d]) => `<g transform="translate(${x} ${y})"><path class="spark" style="animation-delay:${d}s" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#f3cf6a"/></g>`).join('');
  if (mood === 'cry') s += `<g class="puddle"><ellipse cx="50" cy="103" rx="20" ry="3" fill="#8fd0fb" opacity=".45"/></g>`;
  s += `</svg>`;
  return s;
}
