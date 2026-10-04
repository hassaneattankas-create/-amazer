# Moteurs de production vidéo — API et structure

Référence chargée à la demande par `amazer-motion-design`.

---

## A. Pipeline Canvas déterministe — `jde-motion/`

Moteur maison, **aucune contrainte de licence**. Éprouvé : un film institutionnel de
30 s / 1920×1080 / 60 fps en est sorti, déterminisme vérifié par hash SHA-256 sur
16 instants.

### Structure

```
<projet>/
├── index.html              livrable généré (tout le code inline)
├── EASING_FUNCTIONS.js     courbes + outils de séquençage (réutilisable tel quel)
├── build.js                src/*.js → index.html
├── render_pipeline.js      Puppeteer : window.seek(t) → frames/frame_%05d.png
├── compile_video.js        FFmpeg : frames + audio → output.mp4
├── contact_sheet.js        planche-contact de relecture
├── test_determinism.js     vérification par hash
├── src/
│   ├── 01-core.js          caméra 2.5D, atmosphère, grain, vignettage
│   ├── 02-type.js          typographie animée (titleAt, kineticWord, bulletRow…)
│   ├── 03-figures.js       silhouettes, mobilier
│   ├── 04-objects.js       objets thématiques, data-viz, graphe réseau
│   ├── 05-transitions.js   transitions, compositing hors-écran, marque
│   ├── 06/07-scenes-*.js   les scènes
│   └── 08-seek.js          dispatcher window.seek(t) + preview clavier
└── RULES.md LOOK.md KIT.md SCENES.md CLOCK.md
```

### API de séquençage (`EASING_FUNCTIONS.js`)

```js
seg(t, t0, dur, ease)            // progression [0,1] d'un beat
segRaw(t, t0, dur)               // progression linéaire non eased
stagger(t, t0, i, dur, ease, 0.05)  // « Layered Time » : décalage i × 0.05 s
envelope(t, t0, tIn, hold, tOut) // enveloppe entrée / maintien / sortie
track(t, [[t0,v0],[t1,v1,'ease'],…])  // interpolation multi-clés (caméra)
lerp, mix, remap, clamp01
mulberry32(seed), hash1(i), hash2(i,j), hashS(i,j)   // aléatoire déterministe
```

Courbes disponibles : toute la famille `easeIn/Out/InOut × Quad/Cubic/Quart/Quint/
Sine/Expo/Circ`, plus `backIn/Out/InOut`, `elasticIn/Out/InOut`, `bounce*`,
`elasticSoft(x, amp)` (overshoot plafonné) et `spring(x, k, d)`.

### Caméra 2.5D

```js
const cam = newCam();
cam.zoom = track(t, [[0, 1.0], [2.5, 1.06], [3.15, 1.42, 'easeInOutQuint']]);
cam.x    = track(t, [[0, 0], [3.15, 14]]);

layer(() => { pushCam(cam, 0.22); /* arrière-plan */ });
layer(() => { pushCam(cam, 1.00); /* sujet, centré exactement */ });
layer(() => { pushCam(cam, 1.30); /* premier plan, parallax fort */ });
```

⚠️ Un élément qui doit être **exactement centré** à l'arrivée d'un travelling doit
être à `depth = 1.0`.

### Contrat `window.seek(t)`

```js
window.seek(t)        // t en secondes — seul point d'entrée de rendu
window.seekFrame(i)   // = seek(i / 60)
window.__READY__      // true quand polices + assets sont chargés
window.JDE            // { DURATION, FPS, W, H, TIMELINE, totalFrames }
```

### Commandes

```bash
node build.js
node render_pipeline.js --workers 4        # reprenable, auto-vérifiant
node render_pipeline.js --range 900-1200   # re-rendre une plage
node render_pipeline.js --frames 0,600,1799
node test_determinism.js
node contact_sheet.js 24 4
node compile_video.js --crf 16
```

### Pour démarrer un nouveau film

Copier `jde-motion/` comme gabarit, vider `src/06-…` et `src/07-…`, réécrire les
cinq fichiers de référence. Le noyau (`01`–`05`, `08`) et la chaîne de rendu sont
réutilisables tels quels.

---

## B. Remotion — `motion/remotion/`

⚠️ **Licence** : libre jusqu'à 3 employés, Company License au-delà
(`motion/remotion/LICENSE-NOTICE.md`). Installé au titre de l'évaluation.
Volontairement **isolé** de `frontend/` : ce n'est pas une dépendance de l'application.

Version installée : **remotion 4.0.532**, React 19.2.

### Structure

```
motion/remotion/
├── remotion.config.ts
├── LICENSE-NOTICE.md
└── src/
    ├── index.ts            registerRoot
    ├── Root.tsx            <Composition> — déclaration des formats
    ├── theme.ts            tokens vidéo AMAZER
    ├── lib/easing.ts       courbes (identiques au web et au moteur Canvas)
    └── components/
        ├── KineticText.tsx      typographie cinétique sous masque, stagger
        ├── CameraMove.tsx       caméra 2.5D + parallax par depth
        ├── SceneTransition.tsx  wipe · flash · irisIn · push
        └── LogoReveal.tsx       marque, échelle uniforme uniquement
```

### Composants

```tsx
<KineticText text="TROUVEZ" from={18} fontSize={150} exitAt={92} />
<KineticText text="BOUTIQUES · RESTAURANTS" from={54} fontSize={42} tracking={0.08} />

<CameraMove keyframes={[{at:0, zoom:1.18, y:30}, {at:145, zoom:1.0, y:-20}]} depth={0.8}>
  <Ambience />
</CameraMove>

<SceneTransition kind="wipe"   from={100} durationInFrames={22} />
<SceneTransition kind="flash"  from={240} />
<SceneTransition kind="irisIn" from={240} origin={{x:50, y:40}} />

<LogoReveal from={6} size={200} />        {/* src absent → lockup typographique */}
```

### Commandes

```bash
cd motion/remotion
npx remotion studio                              # preview interactive
npx remotion render AmazerSting out/x.mp4
npx remotion render AmazerStingVertical out/x-9x16.mp4
npx remotion still AmazerSting out/endcard.png --frame=350
```

### Déclinaison de format

Déclarer une `<Composition>` par format dans `Root.tsx`. Le même composant peut
servir les deux, mais la composition doit être **repensée** pour le vertical, pas
simplement rognée : utiliser `useVideoConfig()` pour adapter tailles et positions.

---

## C. Choisir entre les deux

| Besoin | Moteur |
|---|---|
| Film institutionnel, récit, formes génératives, data-viz animée | **Canvas** |
| Contrôle image par image absolu, particules seedées | **Canvas** |
| Aucune contrainte de licence | **Canvas** |
| Réutiliser des composants React du design system | **Remotion** |
| Beaucoup de variantes pilotées par des données (catalogue produits) | **Remotion** |
| Preview interactive avec timeline pendant l'écriture | **Remotion** |
| Nombreux formats à décliner rapidement | **Remotion** |

En cas de doute : **Canvas**, parce qu'il n'engage rien.
