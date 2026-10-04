---
name: amazer-qa
description: Contrôle qualité, tests et revue de code pour AMAZER — stratégie de tests, vérifications automatiques, détection de régressions, audit de finition et passe de relecture après tout développement significatif. À charger quand une tâche concerne les tests, la QA, la validation, le debugging, une revue de code, ou juste après avoir terminé une fonctionnalité. Déclencheurs - "test", "tests", "QA", "qualité", "vérifie", "valide", "relis", "review", "revue", "bug", "régression", "debug", "lint", "typecheck", "ça marche pas", "c'est cassé".
---

# AMAZER — Qualité, tests et revue

Charge `amazer-core` d'abord. Pour une passe de finition **visuelle**, utilise
`amazer-design-system` §10.

---

## 1. État réel de l'outillage (vérifié le 2026-10-04)

| Outil | État |
|---|---|
| TypeScript `tsc --noEmit` | ✅ disponible, **baseline 0 erreur** |
| ESLint 9 + `eslint-config-next` | ✅ configuré (`eslint.config.mjs`) |
| **Vitest 5.0.3** | ✅ installé le 2026-10-04 · `npm test` · config `vitest.config.mts` · **14 tests sur `cartStore`, tous verts** |
| Tests E2E | ❌ aucun (ni Playwright, ni Cypress) |
| Tests de composants | ❌ pas de jsdom ni Testing Library — environnement `node` uniquement |
| Tests backend | ⚠️ `backend/tests/unit/` existe — pytest non exécuté, état réel inconnu |

**La couverture est volontairement minimale.** Ne prétends jamais que « le projet est
testé » : seul le panier l'est. Dis précisément ce qui a été lancé.

## 2. Vérifications à lancer après toute modification significative

```bash
cd frontend
node_modules/.bin/tsc --noEmit     # doit rester à 0 erreur
npx eslint .                       # pas de nouvelle erreur
npm test                           # 14 tests, doivent rester verts
```

Proportionner au risque : un changement CSS n'exige pas `npm test` ; une modification
de `src/store/` ou `src/lib/` l'exige.

Backend :
```bash
cd backend
python -m pytest -q                # si pytest est disponible
```

Vidéo (pipeline Canvas) :
```bash
cd jde-motion
node test_determinism.js           # 16 instants, hash identique
node contact_sheet.js 24 4         # planche-contact à relire réellement
```

Toujours **lire la sortie** et la rapporter telle quelle. Un test qui échoue se dit.

## 3. Étendre la couverture — ordre de valeur

Vitest est en place. Les prochaines cibles, par rapport valeur/coût décroissant :

1. **Logique métier pure** — `src/lib/`, `src/services/`, `src/hooks/`, les deux autres
   stores Zustand (`auth-store`, `notification-store`). Aucune dépendance
   supplémentaire nécessaire : l'environnement `node` suffit.
2. **Composants** — demande `jsdom` + `@testing-library/react`. À proposer avant
   d'installer : +2 dépendances, et les tests de composants cassent plus souvent.
3. **Playwright** — 3 à 5 parcours critiques seulement : inscription vendeur, ajout
   produit, parcours d'achat, paiement, connexion. Décision d'architecture : proposer,
   ne pas imposer.
4. **Tests visuels** — en dernier. Fragiles, coûteux, faible retour ici.

Ne pas viser une couverture chiffrée. Viser les **chemins où une régression coûte
de l'argent**.

Modèle à suivre : `src/store/__tests__/cartStore.test.ts` — teste le comportement
observable et **documente les pièges** (ex. `setQuantity(0)` ne supprime pas l'article,
il le ramène à 1).

## 4. Stratégie par type de code

| Code | Ce qu'on teste |
|---|---|
| Logique pure (`lib/`, calculs) | valeurs limites, cas d'erreur, unités monétaires |
| Services API | forme de la réponse, gestion d'erreur, retry |
| Hooks | états `loading` / `error` / `success`, invalidation de cache |
| Composants | comportement observable (ce que l'utilisateur voit et fait), jamais l'implémentation |
| Routes FastAPI | autorisation **et** propriété de la ressource, validation Pydantic, codes HTTP |

Ne jamais tester un détail d'implémentation (nom de classe CSS interne, ordre
d'appel d'une fonction privée) : ces tests cassent au premier refactor légitime.

## 5. Passe de revue — après tout développement significatif

Déclencher `/code-review`, ou les agents de `pr-review-toolkit` quand le sujet est ciblé :

| Agent | Quand |
|---|---|
| `code-reviewer` | revue générale de correction |
| `silent-failure-hunter` | ⭐ `catch` vides, erreurs avalées — fréquent sur ce dépôt |
| `type-design-analyzer` | types trop larges, `any`, unions mal conçues |
| `code-simplifier` | duplication, abstractions inutiles |
| `pr-test-analyzer` | pertinence des tests ajoutés |

Chercher spécifiquement :
bugs · duplication · mauvaises abstractions · performance · sécurité · types faibles ·
responsive cassé · accessibilité · dépendances inutiles · code mort · `console.log` oubliés.

**Corriger directement ce qui est important.** Signaler le reste sans le corriger.

## 6. Sécurité

`/claude-security` pour un audit de vulnérabilités approfondi (il tourne entièrement
dans la session, chaque finding est challengé avant d'être rapporté).

Points de vigilance propres à AMAZER :
- autorisation vérifiée **côté serveur** sur chaque route (vendeur ≠ admin ≠ client) ;
- propriété de la ressource vérifiée, pas seulement le rôle ;
- aucun secret dans le code ni dans le dépôt ;
- flux de paiement (`backend/app/services/payment_*`) : lecture complète obligatoire
  avant toute modification ;
- uploads : type MIME et taille validés côté serveur ;
- pas de détail technique exposé dans les messages d'erreur client.

## 7. Debugging — méthode

1. **Reproduire** avant de corriger. Si tu ne reproduis pas, tu devines.
2. **Lire le message d'erreur en entier**, y compris la stack.
3. **Localiser** : `tsc --noEmit` et ESLint d'abord, ils pointent souvent la cause.
4. **Comprendre la cause**, pas le symptôme. Une correction qui fait disparaître
   l'erreur sans l'expliquer est une dette.
5. **Corriger au plus près de la cause**, pas en ajoutant une garde en aval.
6. **Vérifier la non-régression** : typecheck + lint + le parcours concerné.

Ne jamais « corriger » en élargissant un type, en ajoutant `as any`, en entourant
d'un `try/catch` vide, ou en désactivant une règle ESLint.

## 8. Auto-amélioration

Quand une même erreur revient :

1. identifier la cause réelle (pas l'occurrence) ;
2. corriger ;
3. documenter dans le Skill concerné — `amazer-core` §4 pour une dette d'architecture,
   `amazer-design-system` pour une dette visuelle ;
4. si c'est systématique, proposer un garde-fou automatique (règle ESLint, hook).

Ne jamais modifier silencieusement une règle fondamentale d'AMAZER : signaler
le changement proposé.
