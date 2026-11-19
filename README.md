# Table de Tarot

Jeu de tarot français (règles FFT) de 3 à 5 joueurs, avec 1 ou 2 joueurs physiques sur le même écran ; les autres places sont tenues par l'ordinateur.

## Démarrer

**Pour jouer : ouvrez `jouer.html` dans Safari, Chrome ou Firefox** (fichier unique, tout inclus). L'aperçu de fichiers d'un téléphone ou du Finder n'exécute pas le jeu et n'affiche que du texte.

Pour développer : aucune dépendance. Ouvrez `index.html` dans un navigateur, ou lancez un serveur local :

```bash
npm run dev       # serveur sur http://localhost:5173
npm test          # 2 700 donnes simulées entre IA pour vérifier les règles
npm run build     # fichier unique dans dist/tarot.html
npm run preview   # sert dist/
```

## Structure

```
index.html          écran d'accueil et squelette des trois zones
css/styles.css      thème, tapis en perspective, animations 3D, mises en page iPad et mobile
js/cards.js         les 78 cartes, valeurs, noms
js/rules.js         cartes permises, gagnant du pli, écart, décompte
js/ai.js            IA en trois niveaux (faible, intermédiaire, expert)
js/audio.js         lecteur de la musique (boucle sans coupure, fondus)
js/avatars.js       portraits SVG des joueurs : humeurs, saut de joie bras levés, larmes
assets/music-*.mp3  les quatre musiques mixées
assets/music.js     les mêmes en base64, chargées par le jeu (fonctionne aussi sans serveur)
tools/compose_music.py   partition et mixage du thème western
tools/compose_pieces.py  Bach, Pachelbel, pop, et assemblage de music.js
js/anim.js          animations 3D de la main en éventail, parallaxe du tapis
js/save.js          sauvegarde de la partie et statistiques (localStorage, sur l'appareil)
js/online.js        parties en ligne : table par code, hôte qui fait tourner la partie, invités
js/pwa.js           installation comme application (bouton Installer, aide iPhone)
pwa/                manifeste et service worker (hors ligne)
server/server.mjs   serveur Node.js sans dépendance : application + relais WebSocket des parties en ligne
render.yaml, Dockerfile   déploiement
js/game.js          déroulement d'une donne
js/ui.js            rendu des panneaux, du tapis et de la feuille de marque
build.mjs           assemble tout en un seul HTML
test/simulate.mjs   vérification automatique des règles
```

Les scripts sont des scripts classiques chargés dans l'ordre (pas de modules ES) : le jeu fonctionne aussi en ouvrant le fichier directement, sans serveur.

## Écran

- **Ordinateur et iPad paysage** : trois colonnes, joueur 1 | tapis | joueur 2 (ou journal si un seul joueur).
- **iPad portrait** : tapis en haut, les deux joueurs côte à côte dessous.
- **Téléphone** : une colonne, tapis puis mains.

À deux joueurs physiques, chaque main reste face cachée jusqu'à ce que son joueur la retourne, et se recache après chaque action.

## Règles appliquées

- Distribution : 24 cartes et chien de 6 à 3 joueurs, 18 et 6 à 4, 15 et 3 à 5. Petit sec : on redistribue.
- Enchères : Petite ×1, Garde ×2, Garde sans le chien ×4, Garde contre le chien ×6. Tout le monde passe : on redistribue.
- À 5 : le preneur appelle un roi (une dame s'il a les quatre rois). Le partenaire est secret jusqu'à ce que la carte tombe.
- Écart : ni roi ni bout ; l'atout seulement s'il n'y a pas assez d'autres cartes, et il est montré.
- Fournir, couper, monter à l'atout. L'Excuse reste à son camp contre une demi-carte, sauf au dernier pli.
- Contrat selon les bouts : 56, 51, 41, 36 points. Score : (25 + écart) × multiplicateur, Petit au bout 10 × multiplicateur.
- Poignées : simple, double, triple (3 joueurs : 13, 15, 18 atouts ; 4 : 10, 13, 15 ; 5 : 8, 10, 13), annoncées en jouant sa première carte ; l'Excuse peut remplacer un atout ; prime de 20, 30 ou 40 points au camp qui gagne le contrat.
- Chelem : annoncé par le preneur après l'écart (il entame alors) ; +400 s'il réussit, −200 sinon ; réussi sans annonce +200 ; chelem de la défense −200 pour l'attaque. Dans un chelem, l'Excuse menée au dernier pli le remporte.

## Sauvegarde et statistiques

- La partie est sauvegardée sur l'appareil au début de chaque pli et entre les donnes. À l'accueil, « Reprendre la partie » repart du pli en cours ; une donne interrompue pendant les enchères ou l'écart est redistribuée.
- Le bouton « Statistiques » affiche, pour la partie en cours, les prises, réussites, contrats par type, poignées, chelems, points et moyennes de chaque joueur ; et, pour les joueurs physiques, le cumul de toutes leurs parties sur cet appareil (par prénom).

## Niveaux de l'IA

| Niveau | Comportement |
|---|---|
| Faible | Annonces très approximatives, joue au hasard 6 fois sur 10 |
| Intermédiaire | Charge son partenaire, gagne au plus juste, protège le Petit, garde l'Excuse pour la fin |
| Expert | Compte les cartes jouées, mémorise les coupes de chaque joueur, joue ses cartes maîtresses, fait couper le preneur en défense, ne charge que si le pli est imprenable |

## Musique

Quatre ambiances au choix, à l'accueil ou pendant la partie (liste ♪ en haut du tapis). Le choix est retenu sur l'appareil.

| Ambiance | Morceau | Instruments |
|---|---|---|
| Western | composition originale | sifflet, guitare twang (trémolo, écho), guitare folk, contrebasse, trompettes, chœur, cordes, harmonica, timbales |
| Classique | J.-S. Bach, Prélude en do majeur BWV 846 (domaine public) | piano |
| Classique | J. Pachelbel, Canon en ré (domaine public) | violon, alto, violoncelle, clavecin |
| Pop | composition originale | batterie, basse, piano électrique, guitare, vibraphone, cordes |

Les chansons pop et les musiques de film existantes sont protégées par le droit d'auteur : elles ne sont pas incluses.
Échantillons d'instruments : FluidR3_GM (dépôt gleitz/midi-js-soundfonts, licence Creative Commons Attribution 3.0).

Pour modifier ou ajouter un morceau : partition dans `tools/compose_music.py` (western) ou `tools/compose_pieces.py` (les autres), puis

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/gleitz/midi-js-soundfonts.git sf
cd sf && git sparse-checkout set --no-cone /FluidR3_GM/ && cd ..
python3 tools/compose_music.py sf/FluidR3_GM assets/music-western.mp3   # numpy, scipy, ffmpeg
python3 tools/compose_pieces.py sf/FluidR3_GM assets                    # écrit aussi assets/music.js
npm run build
```

## Lumière et 3D

La table est éclairée par deux chandeliers en laiton posés dans les coins, à trois bougies chacun : flammes qui vacillent, halo chaud, flaques de lumière orangée sur le tapis qui frémissent avec les flammes (les deux chandeliers ne vacillent pas en même temps). Les ombres des cartes et des bustes sont projetées à l'opposé du chandelier le plus proche, et les bustes reçoivent un reflet chaud du côté des bougies.

Autres effets : bustes 3D des joueurs de l'ordinateur tournés vers le centre ; projecteur sur le joueur dont c'est le tour ; éclat doré sous la carte qui remporte le pli ; plis gagnés empilés en 3D ; bouts et Excuse holographiques ; reflet et inclinaison de la main qui suivent la souris ; rayons dorés quand le contrat est réussi, pénombre quand il chute.

## Installer comme application et jouer en ligne

Ces deux fonctions demandent que le jeu soit servi par son serveur, à une adresse web (https). Elles ne marchent ni en ouvrant `jouer.html` depuis l'ordinateur, ni dans l'aperçu hébergé sur Claude : l'encart « Jouer en ligne » y est grisé et l'explique.

```bash
npm run serve          # construit dist/pwa puis lance le serveur sur http://localhost:8080
```

**Application (PWA)**
- Chrome, Edge, Android : bouton « Installer l'application » à l'accueil (ou icône d'installation de la barre d'adresse).
- iPhone, iPad : Safari → Partager → « Sur l'écran d'accueil ».
- Une fois ouverte, l'application fonctionne sans réseau (sauf le jeu en ligne). Une nouvelle version s'affiche au lancement suivant.

**Jeu en ligne**
- L'hôte choisit le nombre de joueurs et le niveau de l'ordinateur, puis « Créer une table » : un code de 4 lettres s'affiche.
- Chaque invité ouvre le jeu à la même adresse, choisit son prénom et son avatar, tape le code et « Rejoindre ».
- L'hôte lance la partie : il prend la première place, les invités les suivantes, l'ordinateur les places libres. Chacun voit la table depuis sa place, sa main en bas.
- L'appareil de l'hôte fait tourner la partie ; le serveur ne fait que relayer. Chaque invité ne reçoit que ce que sa place a le droit de voir (sa main, le nombre de cartes des autres, la table).
- Un invité qui perd la connexion est remplacé par l'ordinateur ; il retrouve sa place en rejoignant avec le même appareil. Si l'hôte quitte, la table se ferme.
- Jusqu'à 5 joueurs, un par appareil.

**Déployer**
- Render : pousser le dépôt sur GitHub, puis sur render.com « New + » → « Blueprint » et choisir le dépôt (`render.yaml`). L'offre gratuite met le serveur en veille après 15 minutes sans visite : la première connexion prend alors une minute environ.
- Tout hébergeur Docker : `docker build -t tarot . && docker run -p 8080:8080 tarot`.
- Un serveur Node.js 18 ou plus : `node build.mjs && PORT=8080 node server/server.mjs`, derrière un proxy https qui laisse passer les WebSocket sur `/ws`.

## Jouer au toucher (iPad, téléphone)

- Toucher une carte de l'éventail la lève, toucher à nouveau la joue. On peut aussi glisser le doigt sur l'éventail pour lever les cartes une à une.
- Téléphone en hauteur : tapis en haut, votre main juste dessous. En largeur : tapis à gauche, main à droite.
- iPad en largeur : trois colonnes. En hauteur : tapis en haut, mains côte à côte.
- Pour un affichage plein écran sur iPhone ou iPad : Safari → Partager → Sur l'écran d'accueil.
