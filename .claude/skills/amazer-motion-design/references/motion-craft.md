# Motion craft — les règles de métier

Référence chargée à la demande par `amazer-motion-design`.

---

## 1. Les 12 principes appliqués au motion design 2D

Les principes Disney transposés. Ceux qui comptent vraiment pour du 2D graphique :

| Principe | Application concrète | Erreur typique |
|---|---|---|
| **Anticipation** | Un élément recule de 4–8 px avant de partir ; un bouton se comprime avant de rebondir | Démarrage sec, sans préparation |
| **Slow in / slow out** | Toujours une courbe d'easing, jamais `linear` (sauf défilement continu) | `linear` partout → effet mécanique |
| **Follow-through** | Les sous-éléments s'arrêtent après le conteneur (décalage 2–4 frames) | Tout s'arrête sur la même frame → effet « bloc » |
| **Overlapping action** | Les mouvements se chevauchent, ils ne se suivent pas | Séquence « un élément après l'autre » = diaporama |
| **Staging** | Un seul centre d'intérêt par plan, le reste le soutient | Trois choses bougent, l'œil ne sait pas où aller |
| **Arcs** | Un déplacement traverse en courbe, pas en ligne droite | Translation X pure, robotique |
| **Squash & stretch** | Très subtil en 2D corporate : 2–5 % max sur un rebond | Déformation visible → cartoon involontaire |
| **Timing** | Le poids perçu vient de la durée : léger = rapide, lourd = lent | Tout à la même durée → pas de hiérarchie |
| **Exaggeration** | Pousser l'overshoot de 6–12 %, pas 40 % | Elastic brut (≈ 20 % d'overshoot) sur de la typo institutionnelle |
| **Appeal** | Composition, lumière, contraste — l'image doit être belle à l'arrêt | On anime un plan moche en espérant que ça sauve |

**Test** : mettre en pause à n'importe quelle frame. L'image doit tenir comme une
affiche. Si elle ne tient pas, le problème n'est pas l'animation.

---

## 2. Timing — ordres de grandeur

| Mouvement | Durée |
|---|---|
| Micro-interaction UI (hover, toggle) | 0.09 – 0.16 s |
| Apparition d'un élément | 0.24 – 0.42 s |
| Transition de plan | 0.4 – 0.8 s |
| Mouvement de caméra lisible | 0.8 – 1.6 s |
| Maintien d'un texte clé à l'écran | ≥ 0.9 s, idéalement 1.2 – 2 s |
| Flash de coupe | ≤ 0.1 s (6 frames @60) |
| Stagger entre sous-éléments | **0.05 s** (3 frames @60) |

Un mot de 8 lettres en stagger 0.05 s met 0.40 s à se poser. Avec 0.08 s, il met
0.64 s et le film traîne. Le stagger se sent, il ne se regarde pas.

### Courbes

| Courbe | Usage |
|---|---|
| `easeOutQuint` | entrées d'éléments — arrive vite, se pose doucement |
| `easeInOutCubic` | transitions de plan, mouvements de caméra continus |
| `easeInOutQuint` | push-in / pull-back nerveux |
| `spring` amorti (overshoot 6–12 %) | boutons, badges, confirmations |
| `backIn` / `exit` | sorties d'écran, propulsions |
| `easeInOutSine` | respirations, pulsations, boucles |
| `linear` | **uniquement** défilement continu et travelling à vitesse constante |

---

## 3. Grammaire de caméra

On ne déplace pas des éléments devant un fond fixe : on **déplace un point de vue
dans un décor continu**. C'est ce qui sépare le motion design du diaporama.

| Mouvement | Sens narratif |
|---|---|
| **Push-in** (zoom avant) | on se concentre, ça devient important |
| **Pull-back** (zoom arrière) | révélation du contexte, « voilà où on est » |
| **Travelling latéral** | énumération, parcours, progression dans le temps |
| **Whip-pan** | rupture énergique, changement de sujet |
| **Zoom-cut** | coupe sur un temps fort, transition dynamique |
| **Parallax** | profondeur ; `offset = pan × (1 − depth)` |

### Parallax 2.5D

Chaque calque porte une `depth` (0 = lointain, 1 = premier plan) :

```
zoom_calque  = 1 + (cam.zoom − 1) × depth
offset_calque = −cam.pan × depth
```

Trois à cinq plans de profondeur suffisent. Au-delà, c'est de la complexité gratuite.

⚠️ **Piège** : un élément qui doit être exactement centré à l'arrivée d'un travelling
doit être à `depth = 1.0`. À une autre profondeur, le parallax le décale — c'est une
erreur fréquente qui produit des cadrages décentrés.

### Profondeur de champ simulée

Pas de `filter: blur()` sur de grandes surfaces (coûteux en rendu). Simuler avec :
3 passes d'alpha décalées de ~1.5 px, ou un gradient radial, ou `shadowBlur` ciblé.

---

## 4. Catalogue de transitions

| Transition | Procédé | Quand |
|---|---|---|
| **Wipe** | lame colorée diagonale (~18°) qui balaie | changement franc de sujet, énergie |
| **Flash cut** | blanc ≤ 6 frames sur la coupe | temps fort musical, accélération |
| **Zoom-into-screen** | la caméra plonge dans un écran du décor, son cadre devient le plan suivant | continuité spatiale, « on entre dedans » |
| **Iris** | révélation par disque | focaliser sur un point précis |
| **Morphing** | une forme devient une autre (cercle → carte) | continuité d'idée |
| **Collapse to point** | tout s'aspire vers un point lumineux | fin de séquence, vers l'end card |
| **Match cut** | une forme du plan A se retrouve au même endroit dans le plan B | la plus élégante, à chercher systématiquement |
| **Raccord lumineux** | le point lumineux de sortie devient la source du plan suivant | fin de film |

**Interdit** : fondu enchaîné utilisé pour masquer l'absence d'idée de transition.
Un fondu doit être un choix (ellipse temporelle), pas un pansement.

### Recouvrement

Déclarer explicitement la fenêtre de recouvrement (typiquement 0.3 – 0.5 s) où les
deux scènes sont dessinées. La scène entrante est composée hors-écran puis déposée
avec son alpha, pendant que la sortante reste visible sous le masque.

---

## 5. Typographie cinétique

**Le masque fait tout.** Une lettre qui monte **sous un masque horizontal** semble
émerger d'une ligne de base. La même lettre en simple fade-in apparaît dans le vide :
c'est la différence entre du motion design et une transition PowerPoint.

```
pour chaque lettre i :
    p = easeOutQuint( (t − t0 − i × 0.05) / durée )
    y = (1 − p) × taille × 1.2
    clip = bande horizontale de hauteur ≈ 1.2 × taille
```

Règles :
- Capitales pour les titres courts, tracking légèrement négatif (−1 à −2 %) en très gros.
- Mots-clés : tracking **positif** (+6 à +14 %) pour l'autorité institutionnelle.
- Sortie en `backIn` vers le haut, stagger réduit (0.6 × celui de l'entrée).
- Trois niveaux typographiques maximum par plan.
- **Jamais** plus d'une ligne qui s'anime en même temps que la voix off le prononce :
  le texte doit **précéder** la voix de ~0.2 s, sinon le spectateur lit en retard.

---

## 6. Lumière et composition

- **Deux sources contradictoires** (une froide, une chaude) modèlent le sujet.
  Un aplat uniforme = flat design plat, sans profondeur.
- **Vignettage systématique** : centre +8 % de luminance, bords −35 %.
- **Grain** fin et déterministe (alpha ~0.03) : casse le rendu numérique trop propre.
- **Silhouettes** : pour qu'un personnage se lise comme une silhouette, le fond doit
  être **plus clair** que lui. Erreur fréquente : figures claires sur fond sombre → elles
  flottent au lieu de se découper.
- **Perspective atmosphérique** : les plans lointains sont plus clairs et moins
  contrastés que les plans proches.
- **Zone sûre** : 8 % des bords. Rien d'important en dehors.

### Couleur

3 à 4 HEX décidés au brief, pas davantage. Maximum **3 couleurs dominantes par plan**.
La couleur d'accent ne dépasse jamais ~12 % de la surface (sauf flash ≤ 6 frames).

---

## 7. Particules et effets

- **Rares, fines, orientées.** Des particules doivent matérialiser une idée (un flux,
  une diffusion), pas décorer.
- Positions dérivées d'un PRNG seedé — jamais `Math.random()`, sinon le rendu
  n'est plus reproductible frame par frame.
- Pas de confettis. Pas de glow sur tout. Pas de lens flare.

---

## 8. Erreurs qui trahissent une animation générée

1. Tous les éléments entrent avec la même animation et la même durée
2. Déplacements strictement linéaires
3. Tout s'arrête exactement sur la même frame
4. Fondu enchaîné entre chaque plan
5. Texte centré, même taille, sur fond uni, plan après plan
6. Aucun mouvement de caméra — seulement des éléments qui bougent
7. Animation d'apparition sur chaque élément de chaque plan
8. Plan vide pendant 0.5 s parce que la scène suivante n'a pas commencé à se construire
9. Dernière image avec un élément encore en mouvement → inexploitable en miniature
10. Le même texte dessiné deux fois pendant une transition (bug de morph classique)
