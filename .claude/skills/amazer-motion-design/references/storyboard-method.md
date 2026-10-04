# Méthode de storyboard — de l'idée marketing au plan de tournage

Référence chargée à la demande.

```
BRIEF → OBJECTIF → AUDIENCE → MESSAGE → HOOK → SCRIPT
      → STORYBOARD → SCÈNES → ASSETS → ANIMATION → AUDIO → CTA
```

Chaque étape produit un **livrable vérifiable**. On ne passe pas à la suivante tant
que la précédente ne tient pas en une phrase.

---

## 1. Les 6 étapes amont (avant toute ligne de code)

| Étape | Livrable | Test de passage |
|---|---|---|
| **OBJECTIF** | un verbe + une métrique | « faire installer l'app » ✅ · « communiquer » ❌ |
| **AUDIENCE** | qui, ce qu'elle sait déjà, sur quel écran | si on ne sait pas ce qu'elle sait déjà, le script sera redondant |
| **MESSAGE** | **une** phrase | deux messages = zéro message retenu |
| **HOOK** | les 2 premières secondes, décrites visuellement | lisible sans son et sans contexte |
| **SCRIPT** | texte à l'écran + voix off, minuté | lu à voix haute : ≈ 2,5 mots/s |
| **CTA** | un verbe à l'impératif | un seul |

**Règle du HOOK** : jamais de logo ni de fondu depuis le noir en ouverture. On entre
**dans** le sujet. Sur formats courts, la seconde 1 décide de tout.

## 2. Fiche de scène — schéma obligatoire

Chaque scène du `SCENES.md` renseigne ces 10 champs. Un champ vide est un trou dans
le film, pas un détail.

```
SCÈNE n — <titre>            t = <début> → <fin>   (<durée> s)
────────────────────────────────────────────────────────────
OBJECTIF    ce que le spectateur doit comprendre ICI
NARRATION   voix off, verbatim — ou « (silence) »
TEXTE       ce qui est écrit à l'écran, verbatim
VISUEL      composition : ce qu'on voit, où, à quelle échelle
MOUVEMENT   quels éléments bougent, avec quel preset
CAMÉRA      push / pull / pan / fixe — amplitude et durée
TRANSITION  comment on sort vers la scène suivante
AUDIO       temps fort musical, bruitage, respiration
CTA         présent ? lequel ?
RISQUE      ce qui peut rater ici (lisibilité, timing, surcharge)
```

## 3. Budget temps par durée de film

| Durée | Structure |
|---|---|
| **6 s** (bumper) | 1 image forte (3 s) + logo/CTA (3 s). Un seul mot. |
| **15 s** | hook 2 s · problème 4 s · solution 6 s · CTA 3 s |
| **30 s** | hook 3 s · problème 6 s · solution 12 s · preuve 5 s · CTA 4 s |
| **60–90 s** | hook 4 s · contexte 10 s · 3 bénéfices 12 s chacun · preuve 10 s · CTA 6 s |

Un plan dure **au minimum 1,2 s**. En dessous, le spectateur n'a pas le temps de lire
ni de comprendre.

## 4. Densité de texte

| Format | Mots max à l'écran simultanément |
|---|---|
| 16:9 | 8–10 |
| 1:1 | 6–8 |
| 9:16 | **4–6** |

Un texte reste affiché ≥ 0.9 s, idéalement 1.2–2 s. Compter 0.3 s par mot pour la
lecture, plus 0.4 s d'amorce.

## 5. Les cinq registres — règles propres

Voir le SKILL pour le tableau de synthèse. En storyboard, ce qui change :

| Registre | Ce que le storyboard doit prouver |
|---|---|
| **Motion UI** | que l'animation explique une causalité (d'où vient l'élément, ce qui a changé) |
| **Motion branding** | que la marque est reconnaissable même sans le logo |
| **Explainer** | qu'on peut suivre sans connaissance préalable, une idée par plan |
| **Publicité** | que le hook tient en 2 s et que le CTA est unique |
| **Social** | que tout se lit sans son, en vertical, zone basse dégagée |

## 6. De la fiche de scène au code

```
SCENES.md (fiches)      →  structure des scènes
CLOCK.md (timeline)     →  constantes de temps dans le code
LOOK.md (palette, typo) →  tokens
animation-grammar.md    →  choix des presets
```

Le code ne doit **jamais** contenir une décision artistique absente des fichiers de
référence. Si on improvise en codant, on reporte d'abord dans le fichier concerné.

## 7. Relecture avant production

1. Lire le script à voix haute, chronomètre en main — ça dépasse presque toujours.
2. Vérifier que chaque scène a un **objectif distinct** (deux scènes avec le même
   objectif = une scène de trop).
3. Vérifier que le message unique est dit **une fois, clairement**, pas trois fois
   mollement.
4. Vérifier que le film tient **sans le son**.
5. Vérifier que la dernière image est exploitable en visuel fixe.

## 8. Réutilisation

Un storyboard validé devient un **template paramétrable**
(voir `motion/remotion/src/templates/`) : mêmes scènes, contenu injecté par `props`.
On ne recopie pas un storyboard, on le paramètre.
