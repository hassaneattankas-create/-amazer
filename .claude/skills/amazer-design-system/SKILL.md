---
name: amazer-design-system
description: Design system et UI/UX d'AMAZER — tokens, composants, hiérarchie visuelle, responsive, accessibilité, micro-interactions framer-motion, et passe de finition « impeccable ». À charger AVANT d'écrire la moindre classe CSS pour toute tâche touchant une interface - créer ou modifier un écran, un composant, un style, une animation d'interface, un formulaire, une modale, une navigation, ou auditer la finition visuelle d'une page. Les tokens vivent dans frontend/src/app/globals.css et frontend/src/lib/design-tokens.ts ; les classes héritées .premium-card, .luxury-title, .primary-glow-btn sont DÉPRÉCIÉES et interdites pour du code neuf ; aucune valeur arbitraire (#hex, rounded-[Npx], shadow-[...]) n'est admise. Déclencheurs - "UI", "UX", "design", "composant", "écran", "page", "style", "responsive", "mobile", "accessibilité", "a11y", "animation", "transition", "hover", "bouton", "formulaire", "modale", "carte", "finition", "polish".
---

# AMAZER — Design System & UI/UX

Charge d'abord `amazer-core` si ce n'est pas déjà fait.
Utilise le plugin **`frontend-design`** en complément pour l'exécution visuelle.

---

## 1. Où vit la vérité

| Quoi | Fichier |
|---|---|
| Valeurs des tokens (CSS variables) | `frontend/src/app/globals.css` — bloc « AMAZER DESIGN TOKENS » |
| Exposition Tailwind | `frontend/tailwind.config.ts` |
| Miroir TypeScript + presets framer-motion | `frontend/src/lib/design-tokens.ts` |
| Primitives | `frontend/src/components/ui/` |

**Règle absolue : une valeur littérale dans un composant est un bug.**
Pas de `#FF4D00`, pas de `shadow-[0_20px_50px_rgba(...)]`, pas de `rounded-[24px]`,
pas de `duration-[240ms]`. Si le token manque, on l'ajoute au design system — on ne
contourne pas.

## 2. Tokens disponibles

**Couleur** — `brand-50…900` (500 = #FF4D00, l'orange AMAZER) · `ink-50…900` ·
`surface-0…3` · `success` `warning` `danger` `info` · plus les tokens sémantiques
shadcn existants (`primary`, `muted`, `border`, `ring`…).

**Rayons (par rôle)** — `rounded-chip` `rounded-field` `rounded-card` `rounded-sheet`
`rounded-pill`. Les `rounded-sm/md/lg` existants sont inchangés.

**Ombres (par rôle)** — `shadow-hairline` `shadow-resting` `shadow-raised`
`shadow-floating` `shadow-overlay` · `shadow-brand-sm/md/lg` · `shadow-focus`.

**Typographie** — `text-display-sm/md/lg` (fluides, `clamp()`), `text-2xs`,
`tracking-display`, `tracking-label`, `leading-token-*`. Les `text-sm/base/lg…`
natifs Tailwind sont **inchangés** (387 usages).

**Espace** — `p-gutter` `p-gutter-md` `p-gutter-lg` `py-section` `py-section-lg`,
`max-w-container`.

**Mouvement** — `duration-instant/fast/base/slow/slower`,
`ease-out-quint` `ease-in-out-cubic` `ease-spring` `ease-exit`.

**Empilement** — `z-sticky` `z-dropdown` `z-overlay` `z-modal` `z-toast`.
Jamais de `z-[9999]`.

> Pourquoi des noms de rôle et pas de tailles ? Parce que `rounded-xl`, `text-sm`,
> `shadow-sm` sont déjà utilisés des centaines de fois dans `src/`. Les écraser
> aurait changé le rendu partout. Les rôles évitent la collision **et** disent
> l'intention.

## 3. Classes héritées — ne pas supprimer

`globals.css` contient 5 classes « luxury » antérieures, à valeurs arbitraires :

| Classe | Usages | Remplacement cible |
|---|---|---|
| `.premium-card` | 174 | `rounded-card bg-surface-1 border border-border shadow-floating` |
| `.luxury-title` | 94 | `text-display-md tracking-display text-ink-900` (le dégradé orange→jaune est à retirer : il casse le contraste et fait « template ») |
| `.primary-glow-btn` | 51 | `<Button variant="primary">` |
| `.hover-lift-glow` | 6 | `transition-transform duration-base ease-out-quint hover:-translate-y-1 hover:shadow-brand-md` |
| `.shine-btn` | 3 | à supprimer — animation infinie sans fonction |

**Ne les supprime pas en masse.** Migration opportuniste : quand tu touches un écran
pour une autre raison, migre les occurrences de cet écran, vérifie visuellement,
puis passe. Jamais de PR « migration globale » non demandée.

## 4. Hiérarchie visuelle — à vérifier sur chaque écran

1. **Un seul point d'entrée visuel** par écran. Si tout est mis en avant, rien ne l'est.
2. **Trois niveaux typographiques maximum** par vue.
3. L'orange de marque est un **accent**, pas un fond : ≤ ~10 % de la surface.
   Un écran majoritairement orange n'est pas premium, il est criard.
4. **L'espace blanc est une décision**, pas un reste. Rythme vertical par `py-section`.
5. Alignement sur une grille. Pas d'espacement « à l'œil » en valeurs arbitraires.
6. Densité adaptée au contexte : dashboard vendeur = dense ; vitrine client = aérée.

## 5. États obligatoires

Toute vue qui affiche des données déclare les **cinq** :

| État | Exigence |
|---|---|
| `loading` | squelette aux dimensions réelles du contenu — jamais un spinner centré sur une page entière |
| `empty` | explique *pourquoi* c'est vide **et** propose l'action suivante |
| `error` | message FR actionnable + moyen de réessayer, aucun détail technique |
| `success` | le cas nominal |
| `partial` | pagination / « charger plus », si la liste peut être longue |

Un composant interactif déclare : `default`, `hover`, `focus-visible`, `active`,
`disabled`, et `loading` s'il déclenche une action asynchrone.

## 6. Accessibilité — non négociable

- Contraste **4.5:1** minimum (texte normal), **3:1** (texte ≥ 24 px, icônes porteuses de sens).
  ⚠️ Le blanc sur `brand-500` passe tout juste : à vérifier, préférer `brand-600` pour
  du petit texte sur fond orange.
- Tout contrôle est atteignable au clavier, dans un ordre logique.
- `focus-visible` est déjà posé globalement dans `globals.css` — ne pas le neutraliser.
- Cible tactile ≥ **44 × 44 px** (l'app tourne aussi via Capacitor sur Android).
- Chaque `<input>` a un `<label>` associé — un `placeholder` n'est pas un label.
- Icône seule ⇒ `aria-label`. Image décorative ⇒ `alt=""`.
- Une seule `<h1>` par page, pas de saut de niveau de titre.
- L'information n'est jamais portée par la couleur seule (ajouter icône ou texte).
- `prefers-reduced-motion` est déjà respecté globalement — ne pas forcer d'animation
  en `!important`.

## 7. Responsive

- **Mobile d'abord.** Le trafic AMAZER est majoritairement mobile.
- Breakpoints Tailwind standards ; `BREAKPOINT_MD = 768` est exporté dans `design-tokens.ts`.
- Gouttière latérale minimale : `px-gutter` (16 px) à toute largeur.
- Pas de `min-width` supérieure à l'écran. Tableaux et graphiques : conteneur
  `overflow-x-auto` dédié, jamais le body qui défile horizontalement.
- Vérifier à **360 px** (entrée de gamme Android), 768 px, 1280 px.
- Attention aux encoches : `env(safe-area-inset-*)` sur les barres fixes.

## 8. Micro-interactions (framer-motion 12)

Utiliser les presets de `design-tokens.ts` — ne pas réécrire des transitions à la main :

```tsx
import { motion } from "framer-motion";
import { motionPresets, staggerContainer, STAGGER } from "@/lib/design-tokens";

<motion.div {...motionPresets.card}>…</motion.div>

<motion.ul {...staggerContainer(STAGGER)}>
  {items.map(i => <motion.li key={i.id} {...motionPresets.rise} />)}
</motion.ul>
```

Règles :
- Une animation doit **servir une fonction** : orienter l'attention, expliquer une
  origine, confirmer une action. Une animation décorative est du bruit.
- Durées : **160–240 ms** pour l'UI. Au-delà de 400 ms, l'interface paraît lente.
- Animer `transform` et `opacity`. Jamais `width`/`height`/`top`/`left` (reflow).
- Entrée en `ease-out-quint`, sortie en `ease-exit`, déplacement continu en `ease-in-out-cubic`.
- Stagger de **0.05 s** entre éléments d'une même liste — pas plus, sinon ça traîne.
- `layoutId` pour une transition partagée entre deux vues (carte → détail) : c'est
  là que framer-motion vaut vraiment son poids.
- `AnimatePresence` obligatoire pour toute sortie d'élément démonté.
- Jamais d'animation en boucle infinie hors indicateur de chargement.

## 9. Formulaires

- Validation **au blur**, pas à chaque frappe (sauf force de mot de passe).
- Message d'erreur sous le champ, lié par `aria-describedby`, en français, disant
  **comment corriger**.
- Le bouton de soumission passe en `loading` et se désactive — jamais de double envoi.
- Les erreurs serveur se rattachent au champ concerné quand c'est possible.
- Ne jamais vider les champs saisis après une erreur.

## 10. Passe de finition (« impeccable »)

À déclencher quand un écran est fonctionnellement terminé. Parcourir dans l'ordre et
**corriger directement** ce qui est important :

1. **Valeurs arbitraires** — `grep -rn "\[.*px\]\|#[0-9a-fA-F]\{6\}" src/components/<zone>`
2. **Alignements** — bords qui ne tombent pas sur la grille, espacements inégaux
3. **Typographie** — plus de 3 niveaux, veuves, titres sans hiérarchie, texte < 12 px
4. **Contraste** — gris clair sur blanc, blanc sur orange en petit corps
5. **États manquants** — loading / empty / error absents
6. **Responsive** — débordement horizontal à 360 px, texte tronqué, cible < 44 px
7. **Focus** — anneau supprimé, ordre de tabulation incohérent
8. **Mouvement** — animation > 400 ms, sans fonction, ou en boucle
9. **Cohérence** — deux boutons identiques au style différent, deux rayons voisins
10. **Nettoyage** — code mort, `console.log`, props inutilisées, imports orphelins

Terminer par :
```bash
cd frontend && node_modules/.bin/tsc --noEmit && npx eslint .
```

## 11. À éviter — marqueurs de design généré

- dashboard SaaS générique (sidebar sombre + cartes à ombre + graphique mauve)
- cartes partout, y compris pour un contenu qui n'en a pas besoin
- dégradés gratuits (le dégradé orange→ambre→jaune hérité en est un)
- `backdrop-blur` systématique
- animations d'apparition sur chaque élément de chaque page
- emojis en guise d'icônes (`lucide-react` est installé)
- texte gris clair « parce que c'est secondaire » — c'est juste illisible
- ombres colorées sur tout
- coins arrondis incohérents dans un même écran
