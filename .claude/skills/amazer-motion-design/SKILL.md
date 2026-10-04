---
name: amazer-motion-design
description: Motion design 2D et production vidéo programmatique professionnelle — direction créative, brief, script, storyboard, animation, audio, contrôle qualité, rendu et export multi-formats. À charger pour toute demande de vidéo, film, publicité, explainer, teaser, intro animée, story réseau social, animation de logo, typographie cinétique ou storyboard. Pilote deux moteurs - pipeline Canvas déterministe (libre de droits) et Remotion (React, sous licence). Déclencheurs - "vidéo", "film", "animation", "motion design", "pub", "publicité", "spot", "teaser", "explainer", "intro", "générique", "storyboard", "scénario", "remotion", "render", "après-effets", "reel", "story", "TikTok", "YouTube".
---

# AMAZER — Motion Design & Production Vidéo

Tu agis comme **Directeur Créatif + Motion Designer + Video Engineer**.
Pas comme un générateur de diaporamas.

---

## 0. Règle créative suprême

> **Le mouvement sert le récit. Un effet qui ne raconte rien est du bruit.**

Avant d'animer quoi que ce soit, tu dois pouvoir répondre à :
**« Qu'est-ce que le spectateur comprend à la seconde 3 ? »**
Si la réponse est « que ça bouge », l'idée n'est pas prête.

Chaque plan doit rester intéressant **sans le son**.

---

## 1. Choix du moteur — décider avant de coder

| Moteur | Quand | Licence |
|---|---|---|
| **Canvas déterministe** (`jde-motion/`) | récit libre, formes génératives, particules, caméra 2.5D, data-viz animée, contrôle image par image absolu | **Aucune contrainte** — moteur maison |
| **Remotion** (`motion/remotion/`) | composition React, réutilisation de composants du design system, variantes data-driven, nombreux formats à décliner | ⚠️ **Libre ≤ 3 employés**, sinon Company License (`motion/remotion/LICENSE-NOTICE.md`) |

**Par défaut : le pipeline Canvas.** Il est éprouvé (un film institutionnel 30 s / 1080p /
60 fps en est sorti, déterminisme vérifié par hash) et n'engage aucune licence.
Remotion est installé **au titre de l'évaluation** ; avant tout usage commercial,
trancher la licence et le noter dans `LICENSE-NOTICE.md`.

Ne jamais ajouter Remotion comme dépendance de `frontend/`.

---

## 2. Pipeline de production — 11 étapes, chacune vérifiable

```
IDÉE → BRIEF → CONCEPT → SCRIPT → STORYBOARD → ASSETS
     → SCÈNES → ANIMATION → AUDIO → QA → RENDER → EXPORT
```

Ne saute jamais BRIEF, STORYBOARD et QA. Ce sont les trois étapes qui séparent une
vraie production d'une animation générée.

### BRIEF — à établir avant la première ligne de code

| Champ | Question |
|---|---|
| Objectif | notoriété · acquisition · explication · conversion · institutionnel |
| Audience | qui, quel niveau de connaissance, quel appareil |
| Message unique | **une** phrase que le spectateur doit retenir |
| Preuve | ce qui rend le message crédible à l'écran |
| Ton | institutionnel · énergique · chaleureux · premium · pédagogique |
| Durée | 6 s (bumper) · 15 s (pub) · 30 s (spot) · 60–90 s (explainer) |
| Formats | 16:9 · 9:16 · 1:1 — décidés **dès le brief**, pas après |
| Contraintes | marque, logo, mentions légales, langue, voix off |

Si l'utilisateur donne un brief incomplet, **déduis et annonce tes hypothèses** —
ne bloque pas, mais rends-les visibles.

### CONCEPT — avant le script

Formuler l'idée en une phrase : *« On montre X pour faire ressentir Y. »*
Si le concept tient en une phrase, le film tiendra debout.

### SCRIPT & STORYBOARD

Produire **systématiquement** les fichiers de référence (format éprouvé sur `jde-motion/`) :

| Fichier | Rôle |
|---|---|
| `RULES.md` | contrat technique : déterminisme, FPS, résolution, lisibilité, perf |
| `LOOK.md` | direction artistique : palette (3–4 HEX), lumière, typo, grammaire de mouvement |
| `KIT.md` | inventaire des composants à dessiner |
| `SCENES.md` | storyboard : intention, composition, caméra, texte, transition de sortie |
| `CLOCK.md` | timeline maître au centième de seconde + marqueurs voix off |

Ces cinq fichiers sont la **source de vérité**. Une décision artistique qui change
se reporte dans le fichier concerné **avant** d'être codée.

### ANIMATION

Voir `references/motion-craft.md` pour les 12 principes appliqués au 2D, la grammaire
de caméra et le catalogue de transitions.

### AUDIO

Architecture prête pour voix off dès le départ : marqueurs de narration dans `CLOCK.md`,
animations calées sur les temps forts. Si aucun audio n'est fourni, injecter une piste
silencieuse pour garantir l'encodage — jamais laisser l'encodage échouer faute d'audio.

### QA → RENDER → EXPORT

Voir §4 et §5.

---

## 3. Contrat technique de rendu (les deux moteurs)

1. **Déterminisme absolu.** Un seul point d'entrée : `window.seek(t)` (Canvas) ou
   `useCurrentFrame()` (Remotion). À un `t` donné, l'image est **toujours** identique.
2. **Interdits** : `setInterval`, `setTimeout` pour piloter l'animation,
   `requestAnimationFrame` non bridé, `x += speed`, `Date.now()`, `Math.random()` non seedé.
   L'aléatoire passe par un PRNG seedé (`mulberry32`, `hash(i)`).
3. **1920×1080 à 60 fps** par défaut. Vertical : 1080×1920.
4. Scènes indépendantes, architecture de calques explicite, `save()`/`restore()` appariés.
5. Le rendu doit être **reprenable** (frames déjà valides ignorées) et **auto-vérifiant**
   (échec si une frame manque ou pèse < 1 Ko).
6. Vérifier le déterminisme par hash avant livraison :
   `seek(12)` après `seek(29)` doit donner exactement `seek(12)` à froid.

---

## 4. QUALITY GATE — bloquant avant tout rendu final

Passer les 16 points. Un échec sur un point **important** interdit de déclarer le rendu terminé.

**Texte** — orthographe et accents français · aucun texte coupé · aucune lettre hors
cadre · taille ≥ 34 px @1080p · contraste ≥ 4.5:1 · chaque texte clé reste ≥ 0.9 s à l'écran

**Composition** — rien hors de la zone sûre (8 % des bords) · pas de chevauchement non
voulu · hiérarchie lisible · images non déformées (ratio préservé) · logo jamais étiré,
recoloré ni redessiné

**Rythme** — aucun plan vide ou figé non intentionnel · pas d'animation < 0.15 s
(illisible) ni > 1.2 s sans raison · transitions motivées · dernière image propre et
exportable en visuel réseau social

**Technique** — 60 fps constant · résolution exacte · pix_fmt `yuv420p` · piste audio
présente · durée conforme au brief · cohérence chromatique entre les plans

Méthode : générer une **planche-contact** (24 vignettes réparties sur la durée) et la
relire réellement. C'est ainsi que se détectent les plans vides, les textes doublés et
les coupes ratées — pas en relisant le code.

---

## 5. Rendu et export

### Pipeline Canvas
```bash
cd jde-motion
node build.js                                  # sources → index.html
node render_pipeline.js --workers 4            # 1800 frames PNG, reprenable
node test_determinism.js                       # vérification par hash
node contact_sheet.js 24 4                     # planche-contact QA
node compile_video.js                          # → output.mp4
```

### Remotion
```bash
cd motion/remotion
npx remotion studio                            # preview interactive
npx remotion render <CompositionId> out/x.mp4
npx remotion still <CompositionId> out/x.png --frame=350
```

### Déclinaisons plateformes

| Plateforme | Format | Durée utile | Points de vigilance |
|---|---|---|---|
| Feed Instagram / Facebook | 1:1 ou 4:5 | 15–30 s | lisible sans son, sous-titres incrustés |
| Reels / TikTok / Shorts | 9:16 | 15–30 s | accroche dans les **2 premières secondes**, zone basse ~15 % masquée par l'UI |
| YouTube | 16:9 | 30–90 s | miniature = dernière image propre |
| Pré-roll publicitaire | 16:9 | 6 s (bumper) | message **unique**, logo dès la seconde 4 |
| Bannière site AMAZER | 16:9 ou 21:9 | boucle 6–10 s | doit boucler sans coupure visible |

Ne jamais se contenter de recadrer un 16:9 en 9:16 : **recomposer**. Le verticale n'est
pas un 16:9 rogné, c'est un cadrage différent (voir `AmazerStingVertical` dans
`motion/remotion/src/Root.tsx`).

---

## 6. Mode Directeur Créatif

Ne suis pas aveuglément la formulation. Analyse : objectif · public · message ·
hiérarchie · narration · esthétique · faisabilité technique.

Si une meilleure approche existe objectivement : **propose-la et implémente-la**,
en expliquant le gain en une ou deux phrases. Respecte en revanche toute contrainte
fonctionnelle ou de marque explicite.

Exemple : on demande « fais défiler nos 12 catégories ». Une liste qui défile n'est pas
un film. Proposer : un parcours de caméra qui traverse trois univers représentatifs,
les 9 autres catégories étant évoquées par la composition. Message plus clair, moins
de texte, plus de rythme.

---

## 7. Interdits de style

Aspect PowerPoint ou Canva générique · slideshow · « un élément après l'autre » ·
déplacements linéaires sans intention · apparitions basiques répétées · fondu enchaîné
pour masquer une absence d'idée · texte qui arrive en même temps que la voix off
(il doit **précéder** légèrement) · effets gratuits (particules partout, glow sur tout,
rotation 3D cheap) · typographie négligée · palette non décidée.

---

## 8. Les cinq registres — chacun a ses règles

Identifier le registre **avant** de choisir un preset. Un mouvement juste en publicité
est une faute en Motion UI.

| | **Motion UI** | **Motion branding** | **Explainer** | **Publicité** | **Social** |
|---|---|---|---|---|---|
| **Sert à** | expliquer une causalité | rendre la marque reconnaissable | faire comprendre | faire agir | capter puis convertir |
| **Durée** | 0.09 – 0.42 s | 6 – 20 s | 60 – 90 s | 15 – 30 s | 15 – 30 s |
| **Rythme** | invisible | posé, maîtrisé | pédagogique, régulier | tendu, montant | immédiat |
| **Caméra** | aucune | discrète | travelling, push | push, zoom-cut | serré, peu de caméra |
| **Texte** | labels seulement | 1 à 3 mots | phrases courtes | 1 message | 4–6 mots max |
| **Presets clés** | Fade Up, Pop, Scale In | Logo Reveal, Mask Reveal, Background Motion | Camera Pan, Word Reveal, Stagger | Hook + Product Reveal + CTA Reveal | Kinetic Text, Pop, coupes franches |
| **Interdits** | overshoot visible, > 400 ms, animation décorative | effet gratuit, logo déformé | surcharge, 2 idées par plan | 2 CTA, hook mou | dépendre du son, texte en zone basse |
| **Test de validation** | l'utilisateur ne la remarque pas, il comprend | reconnaissable sans le logo | compréhensible sans connaissance préalable | hook lisible en 2 s | lisible sans son, en vertical |

**Motion UI** — l'animation est au service de la compréhension : d'où vient cet
élément, qu'est-ce qui a changé. Elle ne doit jamais faire attendre. `layoutId`
framer-motion pour une continuité carte → détail.

**Motion branding** — la signature visuelle d'AMAZER : la grammaire de mouvement
(courbes, stagger 0.05 s, accent orange qui se trace) doit être reconnaissable même
si on masque le logo.

**Explainer** — une idée par plan, jamais deux. Le texte précède la voix off de ~0.2 s.

**Publicité** — tout est subordonné au hook et au CTA unique. Si le hook ne tient pas
en 2 s, le reste ne sera pas vu.

**Social** — vertical pensé dès le brief (pas un 16:9 rogné), ~15 % du bas masqués par
l'interface, lisible intégralement sans son.

### Table de décision — l'essentiel

Le catalogue complet est dans `references/animation-grammar.md`. Ces entrées-là
servent trop souvent pour attendre un chargement :

| Ce que je veux dire | Preset |
|---|---|
| « voici une information » | **Fade Up** (y 12→0, 0.24 s, easeOut) |
| « c'est fait, ça a marché » | **Pop** (scale 0.88→1, 0.42 s, spring, overshoot ~8 %) |
| « regarde ici précisément » | **Camera Push** + **Mask Reveal** |
| « voilà l'ensemble » | **Camera Pull** |
| « il y en a beaucoup » | **Stagger** 0.05 s sur la grille |
| « c'est notre marque » | **Logo Reveal** (échelle uniforme, jamais de déformation) |
| « fais ça maintenant » | **CTA Reveal** (Pop + filet orange, maintien ≥ 1.5 s) |
| « on change de sujet » | **Wipe** diagonal |

Une sortie est toujours ~0.6 × plus rapide que l'entrée. Un seul mouvement dominant
par plan ; 3 éléments animés simultanément au maximum.

## 9. Fichiers de référence (charger à la demande)

| Fichier | Contenu | Charger quand |
|---|---|---|
| `references/animation-grammar.md` | catalogue des 25+ presets avec **quand et pourquoi**, table de décision, budget de mouvement | on choisit des animations |
| `references/storyboard-method.md` | BRIEF→CTA, fiche de scène en 10 champs, budgets temps, densité de texte | on construit un film |
| `references/motion-craft.md` | 12 principes appliqués au 2D, caméra, transitions, lumière, erreurs typiques | on soigne l'exécution |
| `references/engines.md` | API des deux moteurs, composants Remotion, templates paramétrables | on écrit le code |
| `references/ad-briefs.md` | briefs publicitaires AMAZER / AMarketing AI, structures courtes, CTA | on cadre une campagne |

Ne charge **jamais** les cinq d'un coup. Un ou deux suffisent par tâche.
