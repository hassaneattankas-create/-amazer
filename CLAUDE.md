# AMAZER — Instructions de travail

Ce dépôt héberge **AMAZER**, plateforme numérique de commerce et de découverte
commerciale (Niger → Afrique → international), plus les outils de production
créative associés.

---

## Carte du dépôt

| Chemin | Contenu |
|---|---|
| `frontend/` | Application **Next.js 16.1.6** (App Router) · React 19.2 · TypeScript strict · Tailwind 3.4 + shadcn/ui · Capacitor 7 (Android) |
| `backend/` | API **FastAPI 0.116** · SQLAlchemy 2 · Alembic · PostgreSQL · Redis · S3 · Firebase |
| `payment-gateway/` | Passerelle de paiement (service séparé) |
| `jde-motion/` | Pipeline vidéo **Canvas déterministe** — libre de droits, éprouvé (film 30 s / 1080p / 60 fps livré) |
| `motion/remotion/` | Workspace **Remotion** d'évaluation — ⚠️ voir `LICENSE-NOTICE.md`, isolé de `frontend/` |
| `.claude/skills/` | Skills AMAZER (voir ci-dessous) |
| `docs/` | Documentation projet |
| `amazer-main-3bfa/` | Ancienne copie du dépôt — **ne pas modifier**, référence uniquement |

Gestionnaire de paquets : **npm** (ni pnpm, ni yarn, ni bun sur cette machine).

---

## Routage des Skills — charge uniquement ce qui sert

| La tâche concerne… | Charge |
|---|---|
| Code, architecture, API, données, sécurité AMAZER | `amazer-core` |
| Interface, composant, style, responsive, accessibilité, animation web | `amazer-core` + `amazer-design-system` |
| Vidéo, film, pub, explainer, storyboard, motion design | `amazer-motion-design` |
| Tests, QA, debugging, revue, non-régression | `amazer-qa` |

`amazer-core` est le socle : charge-le dès qu'il s'agit de toucher au code du produit.
Les autres se chargent **par-dessus**, à la demande. Ne charge jamais les quatre
d'un coup.

Plugins disponibles en complément :
`frontend-design` (exécution UI) · `/code-review` · `pr-review-toolkit` (agents
spécialisés) · `/feature-dev` (exploration + architecture) · `/claude-security` (audit).

---

## Politique de consommation — toujours active

**Minimum de consommation → maximum de valeur.**
Hiérarchie : exactitude > sécurité > fonctionnement > qualité > économie de tokens.
On n'économise jamais sur une recherche ou un test réellement nécessaires.

Choisir le niveau d'effort **avant** de commencer :
**N1** simple → action directe · **N2** intermédiaire → lecture ciblée, modification,
test ciblé · **N3** complexe → architecture, recherche et tests approfondis.
Ne jamais traiter du N1 comme du N3.

- Ne pas relire ce qui est déjà en contexte. Lire des sections, pas des fichiers entiers.
- Charger uniquement les Skills utiles (pas de skill vidéo sur une tâche API).
- Grouper les appels d'outils indépendants ; filtrer les sorties volumineuses.
- Debug : erreur → fichier → dépendances directes → cause → correctif → test.
  Élargir seulement si non résolu.
- Tests proportionnés au risque du changement.
- Pas de dépendance ni d'installation « pour essayer ».

Format de réponse par défaut :
```
Fait.
Modification : …
Test : …
Résultat : …
```
Explications détaillées réservées aux problèmes qui en demandent vraiment.

## Règles qui s'appliquent toujours

1. **Lire avant d'écrire.** Le fichier cible *et* ses appelants.
2. **Ne pas casser l'existant.** Le plus petit diff qui règle proprement le problème.
   Pas de refactor massif non demandé.
3. **Vérifier.** Après toute modification significative :
   ```bash
   cd frontend && node_modules/.bin/tsc --noEmit && npx eslint .
   ```
   Baseline au 2026-10-04 : **0 erreur TypeScript**. Toute erreur introduite est un échec.
4. **Pas de valeur arbitraire** dans l'UI. Les tokens sont dans
   `frontend/src/app/globals.css` et `frontend/src/lib/design-tokens.ts`.
5. **Aucun secret** lu, affiché ou transmis. Variables d'environnement uniquement.
6. **Dire la vérité** sur ce qui a été fait. Ne jamais prétendre avoir lancé un test,
   installé un paquet ou rendu une vidéo sans l'avoir fait.
7. **Français** pour l'interface, les messages d'erreur utilisateur et les commits.

---

## Dettes connues

État global = **Zustand** (Redux est installé mais mort, 0 import) · `components/ui`
à 3 primitives · classes héritées `.premium-card`/`.luxury-title`/`.primary-glow-btn`
dépréciées · couverture de tests minimale (panier seulement) · dark mode tokenisé mais
écrans non vérifiés.

Détail, chiffres et règles : `amazer-core` §4 et `amazer-qa` §1. Ne pas aggraver.

---

## Commandes utiles

```bash
# Frontend
cd frontend && npm run dev                 # dev server (webpack)
cd frontend && node_modules/.bin/tsc --noEmit
cd frontend && npx eslint .
cd frontend && npm test                    # vitest — 14 tests (panier)
cd frontend && npm run build

# Backend
cd backend && uvicorn app.main:app --reload

# Vidéo — pipeline Canvas (libre de droits)
cd jde-motion && node build.js && node render_pipeline.js --workers 4 && node compile_video.js
cd jde-motion && node test_determinism.js && node contact_sheet.js 24 4

# Vidéo — Remotion (⚠️ licence)
cd motion/remotion && npx remotion studio
cd motion/remotion && npx remotion render AmazerSting out/x.mp4
```
