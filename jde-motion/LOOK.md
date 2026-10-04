# LOOK.md — Direction artistique

## 1. Intention

**« L'institution qui met l'entrepreneur au centre. »**

Registre : **institutionnel contemporain africain**. Rigueur graphique d'un rapport annuel,
énergie d'un lancement produit. Les personnages sont des **silhouettes stylisées élégantes**
(pas de visages caricaturaux), traitées comme des formes pleines dans un espace 2.5D éclairé.

Trois mots directeurs : **NET — PROFOND — CHALEUREUX**.

## 2. Palette

| Rôle | Nom | HEX | Usage |
|---|---|---|---|
| Fond profond | `INK` | `#061629` | nuit institutionnelle, base des plans sombres |
| Bleu institutionnel | `BLUE` | `#0E3A6B` | couleur d'autorité, aplats, cartes, structures |
| Bleu lumière | `BLUE_LT` | `#1D6FB8` | arêtes, lueurs, données, profondeur atmosphérique |
| Accent | `ORANGE` | `#F6871F` | énergie entrepreneuriale : accents, soulignements, CTA |
| Accent chaud | `ORANGE_LT` | `#FFA94D` | dégradés d'accent, particules, halos |
| Blanc | `WHITE` | `#FFFFFF` | typographie principale, respiration |
| Papier | `PAPER` | `#F2F6FB` | plans clairs (scène thématiques), documents |
| Sable (nuance unique) | `SAND` | `#E7C9A3` | rappel chromatique sahélien, ≤ 5 % de l'image |

Règle : **max 3 couleurs dominantes par plan**. L'orange ne dépasse jamais ~12 % de la surface
(sauf flash de transition ≤ 6 frames). Le sable n'est jamais utilisé pour du texte.

## 3. Lumière et profondeur

- **Vignettage radial** systématique (centre +8 % de luminance, bords −35 %).
- **Lueur d'ambiance** : gradient radial bleu-lumière derrière le sujet + halo orange rasant
  côté opposé → modelé en deux sources, jamais de flat design plat.
- **Ombres portées douces** : `shadowBlur` 24–60 px, décalage vertical 8–18 px, alpha ≤ 0.35.
- **Grain** : bruit déterministe très fin (alpha 0.025) sur toute l'image → texture film.
- **Profondeur de champ simulée** : les calques `depth < 0.6` sont dessinés en strates d'alpha
  décalées (3 passes, offset 1.5 px) → flou perceptible sans filtre coûteux.
- **Parallax** : `offset = cam.pan × (1 − depth)`, `scale = 1 + (cam.zoom − 1) × depth`.

## 4. Typographie

- **Titres** : sans condensée très grasse, chasse serrée, capitales. 132 px (titre majeur),
  86 px (titre de scène).
- **Mots-clés cinétiques** : 72–96 px, capitales, tracking +6 %.
- **Corps / sous-titres** : 40–48 px, sentence case, graisse medium, interligne 1.25.
- **Micro-labels** : 30–34 px, capitales, tracking +14 %, en `ORANGE` ou `BLUE_LT`.
- Hiérarchie de 3 niveaux maximum par plan.
- Soulignement d'accent : barre orange de 6 px, animée en `scaleX` depuis la gauche.

## 5. Grammaire de mouvement

- **Caméra qui raconte** : on déplace un point de vue dans un décor continu (push-in,
  pull-back, travelling latéral, whip-pan) plutôt que d'animer des éléments sur fond fixe.
- **Transitions** : morphing de forme (cercle → carte), masque de balayage orange,
  whip-pan motion-blurré, zoom-cut sur le centre d'intérêt. **Zéro fondu enchaîné paresseux.**
- **Typographie cinétique** : lettres montant sous un masque horizontal (clip), stagger 0.05 s ;
  sortie en `backIn` vers le haut.
- **Particules** : rares, fines, orientées (pas de confettis). Elles matérialisent le flux
  d'opportunités.

## 6. Interdits

Esthétique enfantine · personnages caricaturaux · templates génériques · transitions
PowerPoint · surcharge · couleurs criardes · texte < 34 px · compositions plates ·
dégradés arc-en-ciel · emojis · stock-icônes incohérentes.

## 7. Dernière image (end card)

Composition centrée, respirante, exportable en visuel réseau social :
logo officiel · titre `JEUDI DE L'ENTREPRENEUR` · `Chaque dernier jeudi du mois` ·
`Rejoignez-nous.` · filet orange. Fond `INK` + halo bleu. **Zéro élément en mouvement sur
les 18 dernières frames** (image parfaitement nette pour la capture).
