# KIT.md — Kit de composants

Inventaire des primitives dessinées dans `index.html`. Chaque composant est une **fonction
pure** `(ctx, params) → void` : aucun état interne, aucune dépendance au temps réel.
Tout paramètre d'animation arrive déjà calculé par la scène appelante.

## 1. Noyau

| Composant | Signature | Rôle |
|---|---|---|
| `layer(ctx, fn)` | — | `save()` / `fn()` / `restore()` appariés, obligatoire |
| `cameraTransform(ctx, cam, depth)` | `{x,y,zoom,rot}`, `depth∈[0,1]` | applique parallax + échelle 2.5D |
| `rand(seed)` / `hash2(i,j)` | → `[0,1)` | PRNG `mulberry32` déterministe |
| `clamp01`, `lerp`, `mix`, `remap` | — | utilitaires numériques |
| `seg(t, t0, dur, ease)` | → `[0,1]` | progression d'un beat, cœur du séquençage |
| `stagger(t, t0, i, step, dur, ease)` | → `[0,1]` | Layered Time : décalage `i × step` (défaut 0.05 s) |

## 2. Fonds & atmosphère

| Composant | Description |
|---|---|
| `bgDeep(ctx, p)` | fond `INK` + gradient vertical subtil |
| `bgPaper(ctx, p)` | fond `PAPER` + horizon bas et ombre d'horizon |
| `glow(ctx, x, y, r, color, alpha)` | gradient radial — lueur d'ambiance / halo |
| `vignette(ctx, strength)` | vignettage radial (bords assombris) |
| `grain(ctx, t)` | bruit déterministe pré-calculé en tuile 256², alpha 0.025 |
| `lightShaft(ctx, p)` | faisceau de vidéoprojecteur (trapèze dégradé) |
| `dustMotes(ctx, t, n)` | poussières fines en suspension, positions dérivées de `hash2` |

## 3. Typographie

| Composant | Description |
|---|---|
| `titleMask(ctx, text, x, y, size, prog, opts)` | titre dont **les lettres montent sous un masque** horizontal, stagger 0.05 s |
| `kineticWord(ctx, text, x, y, size, prog, out)` | mot-clé : entrée clip-up, sortie `backIn` vers le haut |
| `labelTrack(ctx, text, x, y, size, tracking, alpha)` | micro-label capitales à tracking large |
| `bodyLine(ctx, text, x, y, size, prog, align)` | ligne de corps de texte avec fade+rise |
| `accentRule(ctx, x, y, w, h, prog, origin)` | filet orange animé en `scaleX` (`left`/`center`) |
| `bulletRow(ctx, items, x, y, size, prog)` | suite de mots séparés par des puces `•` orange |

Mesure de chasse : `ctx.measureText` avec `tracking` appliqué lettre par lettre
(`drawTracked`) pour garantir un centrage exact malgré l'espacement.

## 4. Personnages (silhouettes stylisées)

Aucun visage, aucun trait caricatural : formes pleines, épaules construites, proportions
adultes réalistes (tête ≈ 1/7.5 de la hauteur).

| Composant | Description |
|---|---|
| `figureSeated(ctx, p)` | entrepreneur assis de trois quarts, avant-bras sur la table |
| `figureStanding(ctx, p)` | intervenant debout, bras en geste de présentation (angle animable) |
| `figureAudience(ctx, p)` | participant de dos/trois quarts, `lean` pour la prise de notes |
| `figureRaisedHand(ctx, p)` | participant levant le bras (question) |
| `figurePair(ctx, p)` | duo en échange, poignée de main optionnelle |
| `crowdRow(ctx, p)` | rangée procédurale de participants, déphasage par `hash2` |
| `figureIcon(ctx, p)` | silhouette compacte pour la scène communauté (14 variantes de gabarit) |

## 5. Mobilier & objets de scène

`deskSetup` (table en perspective, lampe, écran, carnet, dossiers) · `chairBack` ·
`podium` · `stageScreen` (écran de scène + contenu paramétrable) · `notebook` (lignes
d'écriture tracées progressivement) · `speechBubble` · `businessCard`.

## 6. Objets thématiques (scène 4)

| Station | Composant |
|---|---|
| FISCALITÉ | `objForms` — liasse de formulaires + `objStamp` (tampon qui frappe) |
| FINANCEMENT | `objCoins` — piles de pièces + `objCurve` (courbe ascendante tracée) |
| GESTION | `objDashboard` — cadrans et jauges à aiguilles |
| MARKETING | `objTarget` — cible + `objWaves` (ondes concentriques) |
| COMMERCE | `objShop` — devanture + store rayé + `objBasket` |
| DIGITAL | `objScreenNet` — écran + graphe de nœuds reliés |
| DÉVELOPPEMENT | `objStairs` — escalier + flèche montante |

Chaque objet reçoit `prog∈[0,1]` et s'assemble sous-élément par sous-élément
(stagger interne 0.05 s, `elasticOut`).

## 7. Données & réseau

`barChart(ctx, p)` · `lineChart(ctx, p)` (tracé progressif par longueur de chemin) ·
`gauge(ctx, p)` · `networkGraph(ctx, p)` (nœuds + arêtes à tracé progressif) ·
`ringOrbit(ctx, p)` (anneau central de la scène 5).

## 8. Transitions

| Composant | Description |
|---|---|
| `wipeDiagonal(ctx, prog, color, angle)` | lame orange diagonale, bord adouci |
| `flash(ctx, prog, color)` | flash court (≤ 6 frames) |
| `zoomPunch(ctx, prog)` | zoom-cut avec léger décalage chromatique |
| `maskCircle(ctx, prog, cx, cy, fn)` | révélation par disque (clip) |
| `screenPortal(ctx, prog, rect, fn)` | l'écran de scène devient le cadre du plan suivant |
| `whipPan(ctx, prog, dir)` | balayage motion-blurré (3 strates d'alpha décalées) |
| `collapseToPoint(ctx, prog, cx, cy)` | aspiration de l'image vers un point lumineux |

## 9. Marque

| Composant | Description |
|---|---|
| `logoMEN(ctx, p)` | dessine l'asset officiel `assets/logo-men.(svg\|png)` — **translation, échelle uniforme et opacité uniquement** |
| `LOGO_FALLBACK(ctx, p)` | lockup typographique institutionnel de substitution : monogramme `MEN` dans un écusson bleu + `MAISON DE L'ENTREPRISE DU NIGER` sur deux lignes. Utilisé **uniquement** si l'asset est absent ; un avertissement est journalisé |
| `endCardFrame(ctx, prog)` | filet d'encadrement fin qui se trace sur les quatre bords |

## 10. Dépôt de l'asset logo

```
jde-motion/assets/logo-men.svg   (préféré)
jde-motion/assets/logo-men.png   (accepté)
```

Détection automatique au chargement, aucune modification de code nécessaire.
Le ratio est préservé ; le logo est inscrit dans une boîte de 520 × 190 px (scène 6)
en `object-fit: contain`.
