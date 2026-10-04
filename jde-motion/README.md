# JDE — Jeudi de l'Entrepreneur · Maison de l'Entreprise du Niger

Film institutionnel animé de **30 s · 1920×1080 · 60 fps**, rendu déterministe
(Canvas 2D) → Puppeteer → FFmpeg.

```
output.mp4            ← le livrable
```

## Les 5 fichiers de référence (source de vérité)

| Fichier | Contenu |
|---|---|
| `RULES.md` | contrat technique : déterminisme, modèle de temps, easing, lisibilité, perf |
| `LOOK.md` | direction artistique : palette, lumière, typographie, grammaire de mouvement |
| `KIT.md` | inventaire des composants dessinés |
| `SCENES.md` | storyboard des 6 scènes |
| `CLOCK.md` | timeline maître au centième de seconde + marqueurs voix off |

Toute décision artistique qui change doit être reportée dans le fichier correspondant
**avant** d'être codée.

## Arborescence

```
jde-motion/
├── index.html              ← livrable d'animation (généré, tout le code inline)
├── EASING_FUNCTIONS.js     ← courbes d'inertie + outils de séquençage (réutilisable)
├── build.js                ← assemble src/*.js dans index.html
├── render_pipeline.js      ← Puppeteer : window.seek(t) → frames/frame_%05d.png
├── compile_video.js        ← FFmpeg : frames + audio → output.mp4
├── contact_sheet.js        ← planche-contact de relecture
├── src/                    ← sources d'édition (découpées par couche)
│   ├── 01-core.js          noyau, caméra 2.5D, atmosphère
│   ├── 02-type.js          typographie animée
│   ├── 03-figures.js       silhouettes et mobilier
│   ├── 04-objects.js       objets thématiques, data-viz, réseau
│   ├── 05-transitions.js   transitions, compositing, marque
│   ├── 06-scenes-123.js    scènes 1 à 3
│   ├── 07-scenes-456.js    scènes 4 à 6
│   └── 08-seek.js          dispatcher window.seek(t) + preview
├── assets/
│   ├── fonts.css           Montserrat + Inter (embarquées, aucun appel réseau)
│   └── logo-men.svg        ← À DÉPOSER : logo officiel (voir plus bas)
└── frames/                 1800 PNG
```

## Chaîne de production

```bash
node build.js              # src/*.js  →  index.html
node render_pipeline.js    # 1800 frames PNG (reprenable, auto-vérifiant)
node compile_video.js      # frames + audio  →  output.mp4
```

Options utiles :

```bash
node render_pipeline.js --workers 4            # onglets parallèles
node render_pipeline.js --range 900-1200       # re-rendre une plage
node render_pipeline.js --frames 0,600,1799    # frames de contrôle
node render_pipeline.js --force                # ignorer les frames existantes
node contact_sheet.js 24 4                     # planche-contact 24 vignettes
node compile_video.js --crf 18 --out teaser.mp4
```

## Prévisualisation

Ouvrir `index.html` dans un navigateur :
**espace** lecture/pause · **←/→** ± 1 frame · **Home/End** début/fin.
`?render=1` désactive la boucle de preview (mode capture).

La preview est le **seul** endroit qui lit une horloge, et elle se contente d'en déduire
`t` pour appeler `window.seek(t)`. Elle n'accumule aucun état visuel.

## Logo officiel

Le logo de la Maison de l'Entreprise du Niger **n'était pas fourni** dans l'espace de
travail. Le film utilise donc un **lockup typographique institutionnel de substitution**
(écusson `MEN` + raison sociale) sur l'end card.

Pour le remplacer, déposer le fichier officiel :

```
jde-motion/assets/logo-men.svg      (ou .png / .jpg / .webp)
```

puis relancer :

```bash
node render_pipeline.js --range 1540-1799   # seule l'end card change
node compile_video.js
```

Aucune modification de code n'est nécessaire : l'asset est détecté au chargement, inscrit
dans une boîte de 520 × 190 px en `contain`, **ratio préservé**, et jamais redessiné,
recoloré ni déformé (`RULES.md` §7).

## Audio

Le pipeline cherche à la racine du projet, dans cet ordre :

| Fichier | Rôle |
|---|---|
| `voice.wav` / `.mp3` … | voix off |
| `music.wav` / `.mp3` … | musique |
| `audio.wav` / `.mp3` … | piste unique déjà mixée |

Si voix **et** musique sont présentes, elles sont mixées avec la musique à −16 dB.
Si rien n'est trouvé, une **piste silencieuse** est injectée pour garantir l'encodage.

Les marqueurs de narration (texte de la VO et time-codes) sont dans `CLOCK.md` §3 ;
les beats d'animation sont déjà calés dessus.

## Contrat de déterminisme

- Point d'entrée unique : `window.seek(t)`, `t` en secondes.
- Pour un même `t`, l'image est strictement identique quel que soit l'ordre des appels :
  `seek(12)` après `seek(29)` donne exactement `seek(12)` à froid.
- Aucun `setInterval` / `setTimeout` / `x += speed` / `Date.now()` dans la logique de dessin.
- Tout l'aléatoire passe par `mulberry32` / `hash1` / `hash2` (seedés).
