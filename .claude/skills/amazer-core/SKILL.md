---
name: amazer-core
description: Règles d'ingénierie fondamentales du projet AMAZER (plateforme de commerce et de découverte commerciale, Next.js 16 / React 19 / TypeScript / FastAPI). À charger dès qu'une tâche touche le code, l'architecture, les données, les API ou la sécurité d'AMAZER — avant d'écrire ou de modifier la moindre ligne. Couvre l'architecture réelle du dépôt, les conventions, la stack vérifiée, la gestion d'état, les erreurs, et la règle de non-régression. Déclencheurs - "amazer", "frontend/", "backend/", "ajoute une feature", "corrige", "refactor", "api", "endpoint", "composant", "route", "store", "seller", "boutique", "produit", "commande".
---

# AMAZER — Core Engineering

Tu travailles sur **AMAZER**, plateforme numérique de commerce et de découverte
commerciale (commerces, boutiques, restaurants, marques, entreprises, consommateurs).
Démarrage au Niger, trajectoire Afrique puis international.

AMAZER n'est pas « une marketplace de plus » : la cible est un **écosystème de découverte**
qui comprend le besoin et fait émerger le bon produit, la bonne offre, le bon commerce.
Chaque décision technique doit rester compatible avec cette trajectoire.

---

## 1. Stack réelle (vérifiée le 2026-10-04 — ne pas supposer, re-vérifier si doute)

| Couche | Technologie |
|---|---|
| Frontend | Next.js **16.1.6** (App Router, `--webpack`), React **19.2**, TypeScript strict |
| Styling | Tailwind **3.4**, shadcn/ui style `new-york`, CSS variables HSL, `tailwindcss-animate` |
| Composants | Radix Slot, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| Data | TanStack Query **5.90**, `axios` |
| État | Redux Toolkit **2.11** + `react-redux` **et** Zustand **5.0** *(voir §4 — dette)* |
| Animation | `framer-motion` **12.34** |
| Mobile | Capacitor **7.4** (Android), export statique via `scripts/build-mobile.mjs` |
| Backend | FastAPI **0.116**, SQLAlchemy **2.0**, Alembic, PostgreSQL (`psycopg` 3), Redis |
| Auth | `python-jose`, `passlib[bcrypt]` |
| Infra | boto3 (S3), firebase-admin (push), Vercel (front), `render.yaml` |
| Package manager | **npm uniquement** (pas de pnpm / yarn / bun sur cette machine) |

Arborescence frontend : `src/{app,components,hooks,lib,services,store,types}`.
Alias : `@/*` → `./src/*`.

## 2. Avant toute modification — obligatoire

1. **Lire le code existant** concerné (pas seulement le fichier cible : ses appelants).
2. **Comprendre les flux de données** : qui appelle, qui mute, qui met en cache.
3. **Identifier les risques de régression** — en particulier les parcours vendeur,
   commande, paiement et authentification.
4. Pour une modification non triviale, utiliser `feature-dev` (agents `code-explorer`
   puis `code-architect`) plutôt que d'écrire directement.

## 3. Règle de non-régression (non négociable)

- **Jamais** de refactor massif non demandé.
- **Jamais** casser une fonctionnalité pour en améliorer une autre sans justification écrite.
- Changements **ciblés** : le plus petit diff qui règle le problème proprement.
- Après toute modification significative :
  `cd frontend && node_modules/.bin/tsc --noEmit && npx eslint .`
  La baseline au 2026-10-04 est **0 erreur TypeScript** — toute erreur introduite est un échec.
- Le dépôt est sous Git : vérifier `git status` avant et après, ne jamais committer
  sans demande explicite.

## 4. Dettes architecturales connues (ne pas aggraver)

| Dette | État | Règle |
|---|---|---|
| **Redux installé mais mort** | `@reduxjs/toolkit`, `react-redux`, `immer` : **0 import** dans `src/` (vérifié 2026-10-04). Tout l'état global passe par **3 stores Zustand** (`auth-store`, `cartStore`, `notification-store`, 247 lignes au total) + TanStack Query sur 42 fichiers. | **Zustand est le choix retenu.** Ne pas introduire Redux. Nouvel état : serveur → TanStack Query ; UI local → `useState` ; partagé → Zustand. Les 3 paquets Redux peuvent être désinstallés (`npm rm @reduxjs/toolkit react-redux immer`) — non fait pour ne rien casser sans validation. |
| `src/components/ui` quasi vide (button, input, badge) | 3 primitives | Toute primitive manquante se crée **via le design system** — voir `amazer-design-system`. |
| `globals.css` : classes « luxury » à valeurs arbitraires | dette visuelle | Ne pas en ajouter. Migrer vers tokens — voir `amazer-design-system`. |
| Pas de tests (ni vitest, ni jest, ni playwright) | 0 test | Voir `amazer-qa` avant d'ajouter un runner. |
| Dark mode déclaré (`darkMode: ["class"]`) mais sans valeurs | incomplet | Ne pas promettre un dark mode qui n'existe pas. |

## 5. TypeScript

- `strict: true` est actif : **aucun `any` implicite ou explicite** sans commentaire justifiant.
- Pas de `as` pour taire le compilateur — corriger le type à la source.
- Types partagés dans `src/types/`, jamais dupliqués entre composants.
- Les réponses API ont un type déclaré ; ne jamais consommer un `axios.get` non typé.
- Préférer les unions discriminées aux booléens multiples (`status: 'idle' | 'loading' | 'error'`).

## 6. Composants

- **Server Components par défaut** (App Router) ; `"use client"` seulement si
  état, effet, événement ou API navigateur.
- Un composant = une responsabilité. Au-delà de ~150 lignes, découper.
- Props explicitement typées, pas de `Record<string, any>`.
- Composition (`children`, slots) plutôt qu'explosion de props booléennes.
- Nommage : `PascalCase.tsx` pour les composants, `camelCase.ts` pour le reste.
- Placement : primitive réutilisable → `components/ui/` ; métier → `components/<domaine>/`.

## 7. Données et API

- Lecture serveur → **TanStack Query** avec `queryKey` structurée et stable.
- Jamais de `fetch` nu dispersé dans les composants : passer par `src/services/`.
- Mutations : invalidation explicite des `queryKey` concernées, pas de rechargement global.
- États obligatoires pour toute vue de données : `loading`, `empty`, `error`, `success`.
- Côté FastAPI : schéma Pydantic en entrée **et** en sortie, jamais de modèle SQLAlchemy
  renvoyé directement.
- Toute migration de schéma passe par **Alembic**, jamais par un `create_all` implicite.

## 8. Gestion des erreurs

- Pas de `catch` silencieux. Un `catch` fait au moins une de ces trois choses :
  journaliser, remonter à l'utilisateur, relancer.
- Message utilisateur en **français**, actionnable, sans détail technique.
- Jamais de trace technique, de SQL ou de nom de table exposés côté client.
- Côté backend : `HTTPException` avec code HTTP juste (401 vs 403 vs 404 vs 422).

## 9. Sécurité (voir aussi le plugin `claude-security`)

- **Aucun secret dans le code ni dans le dépôt.** Variables d'environnement uniquement.
- Ne jamais lire, afficher ou transmettre : clés API, tokens, cookies, mots de passe,
  contenu de `.env`, `~/.claude/.credentials.json`.
- Autorisation vérifiée **côté serveur** pour chaque route : un contrôle côté client
  n'est pas un contrôle.
- Validation Pydantic sur toute entrée ; ne jamais faire confiance au client.
- Vendeur ≠ admin ≠ client : vérifier le rôle **et** la propriété de la ressource.
- Paiement : flux à ne jamais modifier sans lecture complète de
  `backend/app/services/payment_*` et validation explicite du besoin.

## 10. Performance

- Images : `next/image` avec `sizes` correct (le dépôt a déjà corrigé des 400
  `INVALID_IMAGE_OPTIMIZE_REQUEST` — ne pas régresser).
- Pas de dépendance ajoutée sans justification écrite du gain par rapport au coût de bundle.
- Pas de `"use client"` sur une page entière pour un seul bouton interactif.
- Listes longues : pagination ou virtualisation, jamais tout charger.
- Mesurer avant d'optimiser ; pas d'optimisation spéculative.

## 11. SEO (pages publiques : boutiques, produits, catégories, promotions)

- `generateMetadata` par route dynamique : titre, description, Open Graph, canonical.
- Données structurées JSON-LD `Product` / `LocalBusiness` sur les pages concernées.
- Une seule `<h1>` par page, hiérarchie de titres respectée.
- URLs lisibles et stables ; ne jamais casser une URL existante sans redirection.

## 12. Quand charger les autres Skills

| Tâche | Skill à charger |
|---|---|
| UI, composant, écran, style, responsive, accessibilité | `amazer-design-system` + plugin `frontend-design` |
| Animation d'interface, micro-interaction, transition web | `amazer-design-system` (§ motion) |
| Vidéo, film, publicité, explainer, storyboard | `amazer-motion-design` |
| Tests, QA, audit de finition, contrôle qualité | `amazer-qa` |
| Revue de code | `/code-review` ou agents `pr-review-toolkit` |
| Audit de vulnérabilités | `/claude-security` |
| Campagne, contenu marketing, acquisition | `amazer-motion-design` (§ brief publicitaire) |

Ne charge que ce qui sert la tâche en cours.
