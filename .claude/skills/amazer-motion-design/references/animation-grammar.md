# Grammaire d'animation AMAZER

Référence chargée à la demande. Complète `motion-craft.md` (principes, caméra,
transitions) : ici, le **catalogue opérationnel** — quel mouvement, quand, pourquoi.

> Un preset n'est pas un effet à appliquer. C'est une **phrase**. On choisit la phrase
> selon ce qu'on veut dire.

Durées en secondes. Courbes = `ease.out` / `ease.inOut` / `ease.spring` / `ease.exit`
de `frontend/src/lib/design-tokens.ts` (identiques côté vidéo dans `lib/easing.ts`).

---

## 1. Entrées d'éléments

| Preset | Paramètres | Sens narratif | Quand | À éviter |
|---|---|---|---|---|
| **Fade Up** | `y: 12→0`, `op 0→1`, 0.24 s, `out` | « voici une information » — neutre, discret | corps de texte, lignes de liste, blocs secondaires | sur un élément majeur : trop faible |
| **Fade Down** | `y: −12→0`, 0.24 s, `out` | arrive « d'en haut » — notification, alerte, menu | toasts, barres de notification, dropdowns | pour du contenu de page : lecture à contresens |
| **Scale In** | `scale 0.94→1`, `op 0→1`, 0.24 s, `out` | « ceci apparaît ici » — ancré, pas venu d'ailleurs | modales, popovers, tooltips, images | en liste : donne un effet « bulles » |
| **Slide In** | `x: ±24→0`, 0.32 s, `out` | vient d'un ailleurs identifiable | panneaux latéraux, étapes d'un tunnel | si l'origine n'existe pas à l'écran : gratuit |
| **Pop** | `scale 0.88→1`, 0.42 s, `spring` (overshoot ~8 %) | **succès, confirmation, gain** | ajout au panier, badge, compteur, validation | sur du texte long : illisible |
| **Overshoot** | cible ×1.06 puis retour, 0.42 s, `spring` | masse et énergie | boutons, pastilles, pictos | sur plus de 2 éléments simultanés : ça « gigote » |
| **Blur Reveal** | `blur 8px→0` + `op`, 0.42 s, `out` | mise au point — « ça devient net » | hero, photo produit, révélation | en web : coûteux, réserver à la vidéo ou à 1 élément |
| **Mask Reveal** | clip-path `inset(0 100% 0 0)` → `inset(0)`, 0.42 s, `inOut` | le contenu **émerge** d'une ligne de base | titres, images, barres de données | sans direction claire : masque illisible |

**Règle de choix** : si l'élément a une **origine visible** à l'écran → Slide/Mask.
Sinon → Fade/Scale. Si l'événement est une **réussite** → Pop.

## 2. Sorties

| Preset | Paramètres | Quand |
|---|---|---|
| **Fade Out** | `op 1→0`, 0.16 s, `inOut` | disparition neutre, par défaut |
| **Scale Out** | `scale 1→0.94` + `op`, 0.16 s, `exit` | fermeture de modale/popover |
| **Slide Out** | `x/y → hors cadre`, 0.24 s, `exit` | retour vers l'origine (drawer) |
| **Propulsion** | `y → −130 %`, 0.38 s, `exit` (backIn) | **vidéo uniquement** — sortie de mot-clé |

Une sortie est **toujours plus rapide** que l'entrée (≈ 0.6 ×). L'utilisateur a déjà
compris ; le faire attendre à la sortie est une faute.

## 3. Séquençage

| Preset | Paramètres | Quand |
|---|---|---|
| **Stagger** | 0.05 s entre enfants | liste, grille, lettres d'un titre |
| **Stagger inverse** | du dernier au premier | fermeture d'un menu |
| **Follow-through** | sous-éléments finissent 2–4 frames après le conteneur | carte + son contenu |

Au-delà de ~8 éléments, réduire le stagger à 0.03 s ou grouper : sinon le dernier
arrive une seconde après le premier.

## 4. Caméra (vidéo)

| Preset | Paramètres | Sens narratif |
|---|---|---|
| **Camera Push** | `zoom 1→1.3`, 0.8–1.4 s, `inOut` | « concentre-toi » — on resserre sur l'enjeu |
| **Camera Pull** | `zoom 1.6→1`, 0.8–1.4 s, `inOut` | **révélation du contexte** — « voilà où on est » |
| **Camera Pan** | `x` continu, vitesse constante (`linear`) | énumération, parcours |
| **Parallax** | `offset = pan × depth` | profondeur ; 3 à 5 plans suffisent |
| **Whip Pan** | déplacement rapide + 3 strates d'alpha décalées | rupture énergique |

⚠️ Un élément qui doit être **exactement centré** à l'arrivée doit être à `depth = 1.0`.

## 5. Typographie cinétique

| Preset | Paramètres | Quand |
|---|---|---|
| **Kinetic Text** | lettres sous masque, `y: +1.2em→0`, stagger 0.05 s, `out` | titre majeur, mot-clé |
| **Word Reveal** | même principe **par mot** (stagger 0.12 s) | phrase de 4–8 mots |
| **Line Mask** | ligne entière sous masque, pas de stagger | sous-titre, accroche courte |
| **Counter** | valeur interpolée + `Pop` à l'arrivée | chiffres, prix, économies |

Lettre par lettre au-delà de ~14 caractères : passer au mot. Une phrase complète
animée lettre par lettre est illisible.
Le texte doit **précéder la voix off de ~0.2 s**, jamais la suivre.

## 6. Narratif / branding (vidéo)

| Preset | Construction | Quand |
|---|---|---|
| **Character Entrance** | silhouette : arrivée en arc + léger overshoot + settle | introduire un acteur du récit |
| **Character Exit** | sortie en arc hors cadre, `exit` | libérer la scène |
| **Product Reveal** | Mask Reveal + Camera Push léger + accent orange qui se trace | mise en avant produit |
| **Logo Reveal** | échelle **uniforme** 0.84→1, `spring` amorti ≤ 8 %, halo qui monte | end card |
| **CTA Reveal** | `Pop` + filet orange en `scaleX` + maintien ≥ 1.5 s | appel à l'action final |
| **Background Motion** | dérive très lente (< 2 px/s) de halos et poussières | empêcher l'image de « mourir » |

**Le logo ne se déforme jamais** : translation, échelle uniforme, opacité. Pas de
`scaleX`/`scaleY` indépendants, pas de skew, pas de recolorisation, pas de rotation.

## 7. Transitions de plan

Catalogue complet dans `motion-craft.md` §4. Résumé des choix :

| Intention | Transition |
|---|---|
| changement franc de sujet | Wipe diagonal |
| temps fort, accélération | Flash cut (≤ 6 frames) |
| continuité spatiale | Zoom-into-screen, Push |
| focaliser sur un point | Iris |
| continuité d'idée | Morphing, Match cut |
| fin de séquence | Collapse to point, raccord lumineux |

**Interdit** : fondu enchaîné employé faute d'idée.

## 8. Table de décision rapide

| Ce que je veux dire | Preset |
|---|---|
| « voici une information » | Fade Up |
| « c'est fait, ça a marché » | Pop |
| « regarde ici précisément » | Camera Push + Mask Reveal |
| « voilà l'ensemble » | Camera Pull |
| « il y en a beaucoup » | Stagger sur grille |
| « ça vient de là-bas » | Slide In depuis l'origine réelle |
| « c'est net maintenant » | Blur Reveal |
| « c'est notre marque » | Logo Reveal |
| « fais ça maintenant » | CTA Reveal |
| « on change de sujet » | Wipe |
| « on entre dans le sujet » | Zoom-into-screen |

## 9. Budget de mouvement par plan

- **Un seul mouvement dominant** par plan. Les autres le soutiennent à ≤ 30 % d'amplitude.
- Maximum **3 éléments** animés simultanément avec une amplitude comparable.
- Si tout bouge, l'œil ne sait pas où aller : c'est le défaut n°1 des animations générées.
