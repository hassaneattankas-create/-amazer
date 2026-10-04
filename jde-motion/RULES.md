# RULES.md — Contrat technique du projet JDE

Source de vérité n°1. Toute dérogation doit être écrite ici avant d'être codée.

## 1. Déterminisme absolu

- Un seul point d'entrée de rendu : `window.seek(t)` où `t` est en **secondes** (float).
- `seek(t)` est une **fonction pure vis-à-vis du visuel** : pour un même `t`, l'image produite
  est strictement identique, quel que soit l'ordre d'appel (seek(12) après seek(29) = seek(12) direct).
- **Interdits formels** :
  - `setInterval`, `setTimeout` pour piloter l'animation
  - `requestAnimationFrame` non bridé (la boucle de preview l'utilise mais ne fait QUE calculer
    `t` à partir d'une horloge et appeler `seek(t)` ; elle n'accumule aucun état visuel)
  - accumulateurs du type `x += speed`
  - `Date.now()` / `performance.now()` dans la logique de dessin
  - `Math.random()` non seedé — on utilise `hash(i)` / `rand(seed)` déterministes
- Les particules, grains, bruits et positions aléatoires sont dérivés d'un **PRNG seedé**
  (`mulberry32` / hash entier) : même index → même valeur, pour toujours.

## 2. Modèle de temps

- Durée totale : **30.000 s**. FPS : **60**. Frames : **1800** (frame `i` → `t = i / 60`).
- Résolution logique de composition : **1920 × 1080** (16:9).
- Le canvas est dimensionné en `DPR = 1` lors du rendu offline (pas de sur-échantillonnage) ;
  l'anti-aliasing est obtenu par tracé vectoriel 2D natif + ombres douces.
- `CLOCK.md` est l'unique référence des bornes de scènes. Le code lit la table `TIMELINE`
  qui doit rester synchronisée avec `CLOCK.md`.

## 3. Architecture de scènes

- Chaque scène est un objet `{ id, t0, t1, draw(ctx, local, dt01, g) }`.
- `local` = temps écoulé depuis `t0` ; `dt01` = progression normalisée `[0,1]`.
- Une scène ne dessine **jamais** en dehors de sa fenêtre temporelle, sauf pendant une
  **transition de recouvrement** explicitement déclarée dans `CLOCK.md`.
- Aucune scène ne mute l'état global. Tout est recalculé à chaque frame.
- `ctx.save()` / `ctx.restore()` strictement appariés (helper `layer()` obligatoire).

## 4. Mouvement

- Toutes les interpolations passent par `EASING_FUNCTIONS.js`.
- Transitions de plan : `easeInOutCubic` / `easeInOutQuint`.
- Entrées d'éléments UI, badges, boutons : `elasticOut` (amorti, overshoot ≤ 12 %).
- Propulsions / sorties d'écran : `backIn`.
- Apparitions de masse (lettres, cartes, icônes) : **stagger de 0.05 s** par sous-élément
  (principe « Layered Time »), jamais d'apparition simultanée en bloc.
- Caméra virtuelle : un seul objet `cam = {x, y, zoom, rot}` appliqué en transform racine,
  animé par easing. Le parallax dérive de `cam` × `depth` de chaque calque (2.5D).

## 5. Lisibilité (non négociable)

- Taille de texte minimale à l'écran : **34 px** @1080p.
- Contraste minimum texte/fond : **4.5:1** (textes clés sur aplat ou derrière un voile).
- Aucun texte clé ne reste à l'écran moins de **0.9 s**.
- Aucun texte pendant une transition de caméra rapide (> 0.35 zoom/s).
- Marges de sécurité : 8 % des bords (safe area 1612 × 907 centrée).

## 6. Performance de rendu

- Pas de `filter: blur()` CSS sur de grandes surfaces en boucle : les flous sont simulés par
  gradients radiaux, strates d'alpha, ou `shadowBlur` ciblé.
- Les géométries coûteuses (grilles, foules, nuages de particules) sont **pré-calculées une fois**
  dans des tables immuables, puis seulement transformées par `t`.
- Budget indicatif : < 16 ms / frame en preview, < 120 ms / frame en capture.

## 7. Assets

- Logo officiel Maison de l'Entreprise du Niger attendu en `assets/logo-men.(svg|png)`.
- **Le logo ne doit jamais être redessiné, recoloré, déformé ou étiré** : ratio préservé,
  seules translation / échelle uniforme / opacité sont autorisées.
- Si l'asset est absent, le moteur affiche un **lockup typographique institutionnel de
  substitution** (`LOGO_FALLBACK`) et journalise `⚠ logo officiel manquant`.
  Déposer le fichier dans `assets/` suffit : aucune modification de code.

## 8. Audio

- Architecture prête pour voix off : `voice.wav` (ou `.mp3`) et `music.wav` à la racine du projet.
- Les marqueurs de narration sont dans `CLOCK.md` (colonne VO) et doivent rester alignés sur
  les beats d'animation. Si aucun audio n'est fourni, le pipeline injecte une piste silencieuse
  pour garantir l'encodage.

## 9. Pipeline

- `render_pipeline.js` : Puppeteer → `window.seek(i/60)` → `frames/frame_%05d.png`.
- Le script est **reprenable** (skip des frames déjà écrites) et **auto-vérifiant**
  (échec si une frame est manquante ou < 1 Ko).
- Compilation : FFmpeg `libx264`, `yuv420p`, CRF 16, `-r 60`, `+faststart`.
