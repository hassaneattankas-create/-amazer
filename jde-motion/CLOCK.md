# CLOCK.md — Timeline maître

**Durée : 30.000 s · 60 FPS · 1800 frames · 1920×1080**
Frame `i` ⇄ `t = i / 60`. Cette table est la référence unique ; la constante `TIMELINE`
de `index.html` doit lui être identique.

## 1. Découpage macro

| # | Scène | t0 | t1 | Durée | Frames | Caméra | Sortie |
|---|---|---|---|---|---|---|---|
| 1 | ACCROCHE | 0.00 | 4.80 | 4.80 | 0–287 | push-in | wipe orange |
| 2 | RÉVÉLATION | 4.80 | 9.60 | 4.80 | 288–575 | pull-back | zoom-into-screen |
| 3 | LE JDE | 9.60 | 15.60 | 6.00 | 576–935 | travelling latéral | zoom-cut clair |
| 4 | THÉMATIQUES | 15.60 | 21.60 | 6.00 | 936–1295 | travelling continu + pull-back | convergence |
| 5 | COMMUNAUTÉ | 21.60 | 26.00 | 4.40 | 1296–1559 | resserrement | morph point lumineux |
| 6 | END CARD | 26.00 | 30.00 | 4.00 | 1560–1799 | fixe | hold |

### Fenêtres de transition réellement implémentées (`TR` dans `index.html`)

| Transition | Fenêtre | Coupe | Procédé |
|---|---|---|---|
| S1 → S2 | 4.45 – 4.95 | 4.80 | lame orange diagonale (clip + blade lumineuse) |
| S2 → S3 | 9.30 – 9.60 | 9.60 | sortie d'écran : S2 plonge dans l'écran (zoom 1 → 2.90) pendant que S3 monte en fondu depuis son amorce |
| S3 → S4 | 15.44 – 15.78 | 15.60 | zoom-cut + flash blanc (≈ 20 frames, pic à 0.92) |
| S4 → S5 | 21.42 – 21.60 | 21.60 | bascule douce (les deux plans sont déjà en `INK`) |
| S5 → S6 | — | 26.00 | raccord lumineux : le point d'aspiration de S5 devient le halo d'ouverture de S6 |

Recouvrement maximal déclaré : **0.50 s** (S1→S2). La scène sortante reste dessinée sous
le masque de la transition entrante ; la scène entrante est composée via le tampon
hors-écran (`withOffscreen`) puis déposée avec son alpha.

## 2. Beats détaillés

### Scène 1 — ACCROCHE (0.00 → 4.80)

| t | Beat | Easing |
|---|---|---|
| 0.00 | Noir. Lueur bleue naissante au centre. | `easeOutQuad` |
| 0.25 | Le poste de travail de l'entrepreneur se construit (plan, lampe, écran, silhouette). | `easeOutCubic` |
| 0.90 | Micro-label `ENTREPRENDRE AU NIGER` (fade + rise). | `easeOutCubic` |
| 1.20 | 5 cartes-problématiques entrent en orbite, **stagger 0.05 s** : GESTION · FISCALITÉ · FINANCEMENT · MARKETING · DÉVELOPPEMENT. | `elasticOut` |
| 2.35 | Pulsation orange : les cartes se densifient (pression). | `easeInOutSine` |
| 2.60 | **Push-in caméra** vers la silhouette (zoom 1.06 → 1.42, cadrage resserré sans écraser la composition). | `easeInOutQuint` |
| 2.85 | Les cartes sont propulsées hors cadre. | `backIn` |
| 3.20 | Titre `VOUS ÊTES ENTREPRENEUR ?` lettres en clip-up, stagger 0.05 s. | `easeOutQuint` |
| 3.75 | Filet orange sous le titre (scaleX). | `easeOutCubic` |
| 4.45 | Wipe orange diagonal → scène 2. | `easeInOutCubic` |

### Scène 2 — RÉVÉLATION (4.80 → 9.60)

| t | Beat | Easing |
|---|---|---|
| 4.80 | **Pull-back** : la salle se révèle (zoom 1.50 → 0.95). | `easeInOutQuint` |
| 5.10 | Rangées de participants + intervenant + écran de scène, parallax 4 plans. | — |
| 5.55 | Têtes qui prennent des notes (micro-mouvement sinusoïdal déphasé). | `easeInOutSine` |
| 5.90 | Titre `JEUDI DE L'ENTREPRENEUR` — lettres sous masque, stagger 0.05 s. | `easeOutQuint` |
| 7.05 | Sous-titre `Le rendez-vous des entrepreneurs` + filet orange. | `easeOutCubic` |
| 8.20 | Halo du vidéoprojecteur s'intensifie. | `easeInOutSine` |
| 8.55 | **Zoom-into-screen** : la caméra plonge dans l'écran (zoom 1.00 → 2.90, `cam` recentrée sur l'écran). | `easeInOutQuint` |
| 9.30 | Amorce de la scène 3 en fondu montant depuis l'intérieur de l'écran. | `easeInOutCubic` |

### Scène 3 — LE JDE (9.60 → 15.60)

| t | Beat | Easing |
|---|---|---|
| 9.30 | **Amorce** (recouvrement avec S2) : le plan s'ouvre depuis l'intérieur de l'écran. | `easeOutCubic` |
| 9.34 | Moment A — l'expert présente (panneau de données animé, barres dès 9.52, courbe dès 9.72). | `easeOutQuart` |
| 9.60 | Sortie d'écran achevée : début du travelling latéral sur 4 tableaux. | `easeInOutCubic` |
| 10.15 | Mot `APPRENEZ` (clip-up, stagger). | `easeOutQuint` |
| 10.90 | Moment B — un entrepreneur lève la main et pose une question. | `elasticOut` |
| 11.35 | Mot `ÉCHANGEZ`. | `easeOutQuint` |
| 11.95 | Moment C — prise de notes, carnets, échange à deux. | `easeOutCubic` |
| 12.55 | Mot `AGISSEZ`. | `easeOutQuint` |
| 13.05 | Networking : poignée de main + bulles de dialogue. | `elasticOut` |
| 13.55 | Phrase `Des connaissances pratiques. Des échanges. Des opportunités.` (3 segments, stagger 0.22 s). | `easeOutCubic` |
| 15.00 | **Zoom-cut** + flash blanc court → bascule vers plan clair. | `backIn` |

### Scène 4 — THÉMATIQUES (15.60 → 21.60)

Travelling horizontal continu sur fond `PAPER`, caméra `x` de −170 → 5080 px
(7 stations espacées de **820 px**, segments intermédiaires en `linear` pour une vitesse
constante — aucun arrêt net). Chaque station : objet graphique + mot ancré dans la scène.

| t | Station | Objet | Easing d'entrée |
|---|---|---|---|
| 15.88 | `FISCALITÉ` | liasse de formulaires + tampon (amorcée dès 14.92 pour éviter un plan vide à l'arrivée) | `elasticOut` |
| 16.65 | `FINANCEMENT` | pile de pièces + courbe ascendante | `elasticOut` |
| 17.35 | `GESTION` | tableau de bord / jauges | `elasticOut` |
| 18.05 | `MARKETING` | cible + ondes de diffusion | `elasticOut` |
| 18.75 | `COMMERCE` | devanture + panier | `elasticOut` |
| 19.45 | `DIGITAL` | écran + nœuds réseau | `elasticOut` |
| 20.15 | `DÉVELOPPEMENT` | escalier + flèche montante | `elasticOut` |
| 20.85 | **Pull-back** : les 7 mots quittent leur ancrage monde et convergent vers une grille 3 × 3 vue de haut. Le mot ancré cesse d'être dessiné dès que le morph démarre (c'est le même mot qui continue). | `easeInOutQuint` |
| 21.12 | La grille s'assombrit vers `INK` (retour nuit institutionnelle). | `easeInOutCubic` |
| 21.26 | Micro-label `LES THÉMATIQUES DU JDE`. | `easeOutCubic` |

### Scène 5 — COMMUNAUTÉ (21.60 → 26.00)

| t | Beat | Easing |
|---|---|---|
| 21.62 | 14 silhouettes entrent depuis les bords, **stagger 0.045 s**, rayon 1.78 → 1.00. | `easeOutQuint` |
| 22.15 | Texte `ENTREPRENEURS • PORTEURS DE PROJETS • PROFESSIONNELS`. | `easeOutCubic` |
| 22.80 | Lignes de connexion orange entre les silhouettes (tracé progressif). | `easeInOutCubic` |
| 23.30 | Convergence vers un anneau central. | `easeInOutQuint` |
| 23.85 | Texte `APPRENEZ • ÉCHANGEZ • AGISSEZ` (3 blocs, stagger 0.18 s). | `elasticOut` |
| 25.05 | L'anneau se referme ; tout s'aspire vers un point lumineux. | `easeInOutQuint` |
| 25.70 | Le point explose en halo doux → end card. | `easeOutQuart` |

### Scène 6 — END CARD (26.00 → 30.00)

| t | Beat | Easing |
|---|---|---|
| 26.00 | Fond `INK` + halo bleu, filet d'encadrement qui se trace. | `easeOutCubic` |
| 26.20 | **Logo officiel MEN** (scale 0.82 → 1, overshoot amorti ≤ 6 %). | `elasticOut` |
| 26.90 | Titre `JEUDI DE L'ENTREPRENEUR`. | `easeOutQuint` |
| 27.65 | Filet orange + `Chaque dernier jeudi du mois`. | `easeOutCubic` |
| 28.45 | `Rejoignez-nous.` | `easeOutQuint` |
| 29.05 | Particules d'accent se posent et s'immobilisent. | `easeOutQuart` |
| **29.70** | **Image gelée** — plus aucun mouvement jusqu'à 30.00 (capture réseau social). | — |

## 3. Marqueurs voix off

| t | Narration |
|---|---|
| 0.60 | « Vous êtes entrepreneur, porteur de projet ou acteur de l'écosystème entrepreneurial ? » |
| 4.90 | « Découvrez le Jeudi de l'Entrepreneur de la Maison de l'Entreprise du Niger. » |
| 9.80 | « Un rendez-vous pour apprendre, échanger et agir autour des enjeux concrets de l'entreprise. » |
| 15.80 | « Fiscalité, financement, gestion, marketing, digital et bien plus encore. » |
| 22.00 | *(respiration — lit visuellement la communauté)* |
| 26.30 | « Rendez-vous chaque dernier jeudi du mois. » |

Fichiers audio attendus à la racine du projet : `voice.wav` (VO) et/ou `music.wav`.
Absents → piste silencieuse injectée automatiquement par le pipeline.

## 4. Points de contrôle de rendu

Frames de validation visuelle : **0, 72, 180, 300, 420, 600, 780, 960, 1140, 1320, 1470, 1620, 1799**.
