# Environnement Claude Code — AMAZER

Document de passation. Un agent qui arrive sur ce dépôt doit pouvoir comprendre
l'installation en lisant ce seul fichier.

**Dernière mise à jour : 2026-10-04**

---

## 1. Environnement constaté (audit réel)

| Élément | Valeur |
|---|---|
| Claude Code | **2.1.287** (extension VS Code `anthropic.claude-code`) |
| CLI | `~/.vscode/extensions/anthropic.claude-code-2.1.287-win32-x64/resources/native-binary/claude.exe` — **pas dans le PATH** |
| OS | Windows 11 Pro 26200 |
| Node / npm | v24.13.1 / 11.8.0 |
| pnpm · yarn · bun | **absents** — npm uniquement |
| Git | 2.54.0 |
| Python | 3.11.9 |
| TypeScript | 7.0.2 (global, installé le 2026-10-04) + local au frontend |
| `typescript-language-server` | 6.0.1 (global, installé le 2026-10-04) |
| Marketplace | `anthropic-plugin-directory` (Anthropic Directory) — 2419 plugins référencés |
| Plugins avant intervention | **0** |
| Skills projet avant intervention | **0** · aucun `.claude/` ni `CLAUDE.md` |

---

## 2. Plugins installés

Tous proviennent de `github.com/anthropics/claude-plugins-official`, sur un commit
revu par Anthropic (`checks.review.state = done`, `by.type = anthropic`), en source
`directory` — **aucun téléchargement de binaire, aucune commande marketplace**.

| Plugin | Composants | Coût always-on | Raison |
|---|---|---|---|
| `frontend-design` | 1 skill | ~80 tok | Exécution UI/UX — explicitement demandé |
| `code-review` | 1 skill (`/code-review`) | ~22 tok | Passe de revue après développement |
| `pr-review-toolkit` | 1 skill + **6 agents** | ~1 567 tok | `silent-failure-hunter`, `type-design-analyzer`, `code-simplifier`, `code-reviewer`, `pr-test-analyzer`, `comment-analyzer` |
| `feature-dev` | 1 skill + 3 agents | ~240 tok | `code-explorer` → `code-architect` → `code-reviewer` |
| `claude-security` | 1 skill + 8 agents + 3 hooks | ~696 tok | Audit de vulnérabilités, chaque finding challengé |

**Total always-on ≈ 2 605 tokens.** Les corps de skills et les agents se chargent
à l'invocation uniquement.

### Audit de sécurité effectué avant installation

Dépôt officiel cloné et inspecté localement : inventaire des fichiers, lecture des
`hooks.json`, recherche de `rm -rf`, `curl`, `wget`, `eval`, `base64`, accès à
`.env` / `.ssh` / `ANTHROPIC_API_KEY` / `AWS_*`.

Les hooks de `claude-security` se limitent à : bannière de menu, comptage d'usage,
fermeture d'une question restée sans réponse, suggestion de scan après un `git push`.
Aucun accès à des secrets, aucune opération destructive, aucune exfiltration.

### Rejetés — et pourquoi

| Plugin | Raison du rejet |
|---|---|
| `security-guidance` | Hook `SessionStart` qui **crée un venv et lance `pip install`** (timeout 180 s), plus une revue LLM sur **chaque** `PostToolUse` et chaque `Stop`. Mutation de l'environnement + coût de tokens permanent. `claude-security`, à la demande, couvre le besoin. |
| `typescript-lsp` | **Installé puis désinstallé** : le paquet publié ne contient que `LICENSE` et `README.md`, aucun `plugin.json`, 0 composant (`claude plugin details` le confirme). Plugin inerte. La valeur réelle venait de `npm i -g typescript-language-server typescript`, qui a été conservée. |
| `code-simplifier` (seul) | Doublon : l'agent est déjà fourni par `pr-review-toolkit`. |
| `skill-creator` (plugin) | Déjà disponible comme skill Anthropic synchronisé. |
| `context7` (Upstash, partner) | Serveur MCP tiers pour la doc à jour. `WebFetch` vers la documentation officielle rend le même service sans intermédiaire ni connexion persistante. |
| `Design` (knowledge-work) | Recouvrement important avec `frontend-design` + `amazer-design-system`, orienté workflow designer plutôt que code. |
| `playwright` (Microsoft) | Pertinent, mais ajouter un runner E2E est une décision d'architecture : à proposer avant d'installer (voir `amazer-qa` §3). |
| Plugins Remotion du catalogue | 2 résultats, **aucun revu**. Écarter au profit d'une intégration maîtrisée. |
| `clipwave-*`, `marketing-skills`, … | Non revus, et ce sont des connecteurs vers des SaaS de génération vidéo, pas de l'ingénierie motion design. |
| « Impeccable » | **N'existe pas** dans le catalogue (0 résultat sur 2419). La fonction demandée est couverte par `amazer-design-system` §10 (passe de finition). |

---

## 3. Skills personnalisés créés

Emplacement : `.claude/skills/<nom>/SKILL.md` (portée projet, versionnable avec le dépôt).

| Skill | Rôle | Corps | Chargé quand |
|---|---|---|---|
| `amazer-core` | Socle : stack réelle, conventions, TypeScript, API, erreurs, sécurité, perf, SEO, dettes | 8 Ko | toute tâche de code AMAZER |
| `amazer-design-system` | Tokens, hiérarchie visuelle, états, a11y, responsive, framer-motion, passe de finition | 9 Ko | toute tâche d'interface |
| `amazer-motion-design` | Pipeline BRIEF→EXPORT, choix de moteur, quality gate 16 points, mode directeur créatif | 9 Ko + 3 références (18 Ko) | toute tâche vidéo |
| `amazer-qa` | Outillage réel, vérifications, stratégie de tests, revue, debugging, auto-amélioration | 5 Ko | tests, QA, debug, revue |

Les trois références de `amazer-motion-design` (`motion-craft.md`, `engines.md`,
`ad-briefs.md`) ne se chargent qu'à la demande — divulgation progressive.

**Coût always-on des 4 skills ≈ 620 tokens** (descriptions uniquement).

### Architecture de chargement

```
CLAUDE.md (toujours)  →  route vers le bon skill
   amazer-core        →  socle, dès qu'on touche au code produit
   + amazer-design-system   →  si interface
   + amazer-motion-design   →  si vidéo
   + amazer-qa              →  si tests / revue
```

Jamais les quatre ensemble.

---

## 4. Modifications apportées au dépôt

| Fichier | Nature | Risque de régression |
|---|---|---|
| `CLAUDE.md` | **créé** — carte du dépôt, routage, règles permanentes | nul |
| `.claude/skills/**` | **créés** — 4 skills + 3 références | nul |
| `frontend/src/app/globals.css` | **ajout** d'une couche de tokens (+173 lignes) · sauvegarde `globals.css.bak` | nul — rien de l'existant n'est modifié |
| `frontend/tailwind.config.ts` | **étendu** — tokens exposés sous des noms de **rôle** | nul — voir ci-dessous |
| `frontend/src/lib/design-tokens.ts` | **créé** — miroir TS + presets framer-motion | nul |
| `motion/remotion/**` | **créé** — workspace d'évaluation isolé | nul — hors `frontend/` |
| `docs/CLAUDE-ENVIRONMENT.md` | **créé** — ce document | nul |

### Pourquoi des noms de rôle dans Tailwind

Comptage réel avant modification :
`text-sm` 387 usages · `rounded-2xl` 48 · `rounded-xl` 40 · `shadow-sm` 8 ·
`shadow-xl` 5 · `tracking-tight` 3.

Écraser ces clés aurait changé le rendu de centaines de composants. Les tokens AMAZER
sont donc exposés sous des noms libres et sémantiques :
`rounded-card` `rounded-field` `rounded-sheet` `rounded-chip` `rounded-pill` ·
`shadow-resting` `shadow-raised` `shadow-floating` `shadow-overlay` `shadow-brand-*` ·
`text-display-sm/md/lg` · `tracking-display` `tracking-label`.

**Vérification : `tsc --noEmit` à 0 erreur avant et après.**

### Ajouts fonctionnels au passage

- **Mode sombre** : `darkMode: ["class"]` était déclaré sans aucune valeur. Les tokens
  `.dark` existent maintenant. ⚠️ Les écrans n'ont pas été vérifiés en sombre — ne pas
  annoncer le dark mode comme supporté.
- **`prefers-reduced-motion`** respecté globalement.
- **`:focus-visible`** homogène sur tous les contrôles (il était absent).

---

## 5. Production vidéo — deux moteurs

| Moteur | Emplacement | Licence | État |
|---|---|---|---|
| Canvas déterministe | `jde-motion/` | aucune | éprouvé : film 30 s / 1080p / 60 fps livré, déterminisme vérifié par hash sur 16 instants |
| Remotion 4.0.532 | `motion/remotion/` | ⚠️ libre ≤ 3 employés, sinon Company License | **rendu vérifié** : `out/amazer-sting.mp4`, 6,00 s / 1920×1080 / 60 fps / H.264 |

Licence vérifiée à la source le 2026-10-04 :
`https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md` →
« a for-profit organization with up to 3 employees ».

Remotion est installé **au titre de la phase d'évaluation**, explicitement couverte
par la licence libre. Il est **isolé de `frontend/`** : ce n'est pas une dépendance
de l'application. Voir `motion/remotion/LICENSE-NOTICE.md`.

**Moteur par défaut : Canvas**, parce qu'il n'engage rien.

---

## 6. Tests réellement effectués

| Test | Commande | Résultat |
|---|---|---|
| Typecheck frontend, avant modifications | `tsc --noEmit` | ✅ 0 erreur |
| Typecheck frontend, après tokens | `tsc --noEmit` | ✅ 0 erreur |
| Typecheck workspace Remotion | `tsc --noEmit` | ✅ 0 erreur |
| Installation des 5 plugins | `claude plugin install … --json` | ✅ `outcome: ok` × 5 |
| Coût en contexte des plugins | `claude plugin details <nom>` | ✅ mesuré, ≈ 2 605 tok always-on |
| Validation des 4 SKILL.md | script de parsing frontmatter | ✅ nom = dossier, description < 1 536 c |
| **Détection des skills** | `claude -p "liste les skills amazer"` | ✅ les 4 remontent |
| **Déclenchement + contenu** | `claude -p` sur une tâche UI réelle | ✅ `rounded-card`, `motionPresets.pop`, 174 usages de `.premium-card`, cible 44 px — exacts |
| Rendu Remotion | `npx remotion render AmazerSting` | ✅ 6,00 s / 1920×1080 / 60 fps, 3 frames relues visuellement |
| Chemin et format des skills | doc officielle `code.claude.com/docs/en/skills` | ✅ `.claude/skills/<nom>/SKILL.md`, description ≤ 1 536 c |

### Enseignement d'un test qui a échoué

Premier essai de test fonctionnel, outils interdits : le modèle a répondu
`.premium-card` (classe dépréciée) et n'a pas trouvé le preset framer-motion.
Cause : sans outil, le **corps** du skill n'est pas chargé, seule la description l'est.

Correction appliquée : la description de `amazer-design-system` porte désormais
elle-même les faits critiques (tokens dépréciés, interdiction des valeurs arbitraires),
puisqu'elle est toujours en contexte. Le second test, outils autorisés, est passé
sur les quatre points.

---

## 7. Commandes d'administration

Le CLI n'est pas dans le PATH :

```bash
CLI="$HOME/.vscode/extensions/anthropic.claude-code-2.1.287-win32-x64/resources/native-binary/claude.exe"

"$CLI" plugin list
"$CLI" plugin details <nom>              # inventaire + coût en tokens
"$CLI" plugin install <nom>@anthropic-plugin-directory --json
"$CLI" plugin uninstall <nom> --json
"$CLI" plugin marketplace list
```

Interroger le catalogue local (2419 entrées, aucun appel réseau) :

```bash
node -e "
const d=require('C:/Users/User/.claude/plugins/plugin-directory-cache-v2.json');
d.listings
 .filter(x=>/MOT-CLE/i.test(x.name+' '+(x.summary||'')))
 .filter(x=>x.checks?.review?.state==='done')
 .forEach(x=>console.log(x.name,'|',x.summary));
"
```

---

## 8. Phase 2 — 2026-10-04 (après-midi)

### État global : Redux était mort

Vérification par grep : `@reduxjs/toolkit`, `react-redux`, `immer` → **0 import** dans
`src/`. Tout l'état global passe par **3 stores Zustand** (247 lignes) + TanStack Query
(42 fichiers). Le diagnostic « double store » de la phase 1 était tiré du `package.json`,
pas de l'usage réel — **corrigé** dans `amazer-core`.

→ Décision : **Zustand est le choix retenu**, rien à installer.
Les 3 paquets Redux sont désinstallables (`npm rm @reduxjs/toolkit react-redux immer`) ;
non fait pour ne rien casser sans validation.

Faux positifs écartés : `html2canvas` et `jspdf` sont bien utilisés (imports dynamiques
dans `ReceiptView.tsx`), `victory-vendor` est une dépendance de `recharts`.

### Test runner : Vitest

| Candidat | Verdict |
|---|---|
| **Vitest 5** | ✅ retenu — ESM natif (le projet est ESM), zéro config bundler, alias `@/` en 3 lignes, démarrage ~2 s, une seule dépendance |
| Jest + `next/jest` | ❌ friction CJS/ESM, plus lent, plus de dépendances |
| `node:test` | ❌ zéro dépendance mais ergonomie faible et pas d'écosystème React pour la suite |

Installé : `vitest@5.0.3` (devDep) · `vitest.config.mts` · scripts `test` / `test:watch`.
Première suite : **`src/store/__tests__/cartStore.test.ts` — 14 tests, tous verts**,
sur la logique la plus coûteuse en cas de régression (panier).
Environnement `node` : pas de jsdom, donc **pas encore de tests de composants**.

### Motion design — montée en gamme

- `amazer-motion-design` : ajout des **cinq registres** (Motion UI · branding ·
  explainer · publicité · social) avec règles, presets et test de validation propres.
- `references/animation-grammar.md` — **nouveau** : 25+ presets avec *quand et pourquoi*,
  table de décision « ce que je veux dire → preset », budget de mouvement par plan.
- `references/storyboard-method.md` — **nouveau** : BRIEF→CTA, fiche de scène en
  10 champs obligatoires, budgets temps par durée, densité de texte par format.

### Templates vidéo paramétrables

`motion/remotion/src/templates/ProductAd.tsx` — **un** composant, piloté par props,
qui sert produit / vendeur / restaurant / promotion. `useLayout()` **recompose** selon
le format (16:9, 1:1, 9:16) : le vertical n'est pas un 16:9 rogné, et la zone basse
(~15 % masqués par l'UI des plateformes) est réservée.

8 compositions enregistrées dans `Root.tsx`. Ajouter une vidéo = ajouter un jeu de
props, pas du code. Aucune dépendance ajoutée (zod écarté : présent seulement en
transitif, remplacé par des types TS).

### Quality gate automatisé

`motion/remotion/scripts/qa-video.mjs` — vérifie résolution, fps, durée, `pix_fmt`,
codec, présence de piste audio, **plans noirs en cours de film** (`blackdetect`) et
**images figées > 1.5 s** (`freezedetect`). Sortie 0/1, utilisable en CI.

```bash
node scripts/qa-video.mjs out/x.mp4 --w 1080 --h 1920 --fps 60 --dur 15
```

Il a immédiatement attrapé un vrai défaut : **les rendus Remotion n'ont pas de piste
audio** par défaut, ce que certaines plateformes rejettent.
→ Remède : `npx remotion render … --enforce-audio-track`.

Ce que le script **ne** vérifie **pas** et qui reste humain : orthographe, contraste,
hiérarchie visuelle, chevauchements, pertinence narrative.

### Licence Remotion — réponse précise

Sources : [LICENSE.md](https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md) ·
[Company Licensing](https://www.remotion.pro/license) ·
[License FAQ](https://www.remotion.dev/docs/license/faq) ·
[Terms v5.0](https://www.remotion.dev/docs/terms)

| Cas | Situation |
|---|---|
| Usage personnel | Libre |
| **Usage commercial, organisation ≤ 3 personnes** | **Libre**, y compris commercial |
| Organisation ≥ 4 personnes opérant Remotion | **Company License obligatoire** |
| **Vidéos pour des clients (agence)** | Si le studio opère Remotion **en interne** et ne livre qu'un MP4, l'effectif du client **ne s'additionne pas**. Le studio seul compte. |
| Client qui **opère** le projet Remotion avec vous | Les effectifs **s'additionnent** |
| **SaaS / prompt-to-video servant des vidéos aux utilisateurs finaux** | Relève de **Remotion for Automators** — 0,01 $/rendu, minimum 100 $/mois. L'offre « Creators » (25 $/siège/mois) est explicitement réservée au **faible volume interne**, pas au service d'utilisateurs finaux. |
| Redistribuer un dérivé de Remotion | **Interdit** |

**Conséquence pour AMarketing AI** : une plateforme qui génère des vidéos pour ses
utilisateurs est, par nature, une automatisation au sens de Remotion → tier
**Automators**. À budgéter (100 $/mois minimum) **avant** toute mise en production.

⚠️ Ceci est une lecture de la documentation publique au 2026-10-04, **pas un avis
juridique**. Faire confirmer par Remotion (ou un conseil) avant exploitation commerciale.

### AMarketing AI — ce qui se partage, ce qui reste séparé

| Brique | Statut | Pourquoi |
|---|---|---|
| `amazer-motion-design` + ses 5 références | **Commun** | grammaire de mouvement, storyboard, quality gate : métier, pas produit |
| Moteur Canvas `jde-motion/` | **Commun** | libre de droits, réutilisable tel quel |
| Composants Remotion (`KineticText`, `CameraMove`, `SceneTransition`, `LogoReveal`) | **Commun** | génériques, sans marque codée en dur |
| `scripts/qa-video.mjs` | **Commun** | aucune dépendance au produit |
| `amazer-qa` (méthode de test, debugging, revue) | **Commun** | méthode, pas stack |
| Courbes d'easing et échelle de durées | **Commun** | cohérence de marque entre produits |
| **`theme.ts` / tokens AMAZER** | **Spécifique** | identité AMAZER — AMarketing AI aura la sienne |
| **`PRESETS` de `Root.tsx`** (textes, CTA) | **Spécifique** | contenus produit |
| **`amazer-core`** (stack, routes, dettes, règles métier) | **Spécifique** | ne décrit que ce dépôt |
| **`amazer-design-system`** | **Spécifique** | tokens et classes héritées propres à AMAZER |

**Ligne de séparation** : est commun ce qui relève du **métier** (motion design, QA,
méthode) ; est spécifique ce qui relève de l'**identité** ou de la **stack** d'un produit.

Le jour où AMarketing AI existe comme dépôt : copier `motion/remotion/src/components/`,
`lib/easing.ts` et `scripts/qa-video.mjs`, créer son propre `theme.ts`, et créer un
`amarketing-core` sur le modèle d'`amazer-core`. **Ne pas** partager un dépôt ni un
design system entre les deux produits.

## 9. Phase 3 — 2026-10-04 (soir) · passage en production-ready

### Dépendances mortes supprimées

`npm rm @reduxjs/toolkit react-redux immer` après double vérification (aucun import,
aucune forme `require`). `immer` n'était requis par zustand qu'en peer optionnel — les
stores n'utilisent que le middleware `persist`.
Vérifié après suppression : **`npm test` 24/24 · `tsc --noEmit` 0 erreur · `npm run build` OK**.

Faux positifs confirmés comme **à conserver** : `html2canvas` et `jspdf` (imports
dynamiques dans `ReceiptView.tsx`), `victory-vendor` (dépendance de `recharts`).

### Tests étendus

`src/lib/__tests__/pricing.test.ts` — 10 tests sur `formatMoney` / `formatXOF` et
`computeRestaurantOrderSummary` (commission, frais de service nuls si panier vide,
entrées négatives ramenées à 0, invariant « total = somme des composants »).
**Total : 24 tests, 2 fichiers.** Toujours pas de jsdom → pas de tests de composants.

### Trois défauts réels trouvés par la vérification visuelle

Le quality gate automatique passait au vert sur les trois : ils n'étaient visibles
qu'à l'œil. C'est la raison d'être de la relecture humaine.

1. **Titres écrasés et illisibles en colonne étroite** (format carré). Cause : `KineticText`
   posait les lettres en flex sans `flexShrink: 0`. Corrigé.
2. **Mots coupés au retour à la ligne** (« au-d / elà »). Cause : le `flexWrap` cassait
   entre deux lettres. Corrigé : regroupement par **mot**, le stagger restant continu
   sur toute la ligne via un index global.
3. **CTA figé et logo jamais affiché.** Cause : à l'intérieur d'une `<Sequence>`,
   `useCurrentFrame()` renvoie une frame **locale**, et le template la comparait à des
   repères **absolus** (`ctaStart`, `bodyStart`). Les `interpolate()` restaient donc
   bloqués à leur valeur initiale. 8 occurrences corrigées, piège documenté en commentaire
   dans `ProductAd.tsx`.

### Quality gate durci

Verdict désormais explicite **PASS / FAIL** (sortie 0/1). Critères bloquants :
résolution, fps, durée, `pix_fmt`, codec, piste audio, plans noirs en cours de film.
Avertissement non bloquant : images figées > 1.5 s (une pause de lecture est légitime).
Aucun critère n'a été assoupli pour faire passer un rendu.

`scripts/render-batch.mjs` enchaîne rendu + gate sur une liste de compositions et écrit
`out/batch-report.txt`. Sur Windows, l'appel passe par `shell: true` — sans cela
`npx.cmd` échoue silencieusement (constaté : 9 FAIL en 0 s).

### Chaîne réutilisable pour AMarketing AI — démontrée

```
brief → storyboard (SCENES/CLOCK) → scènes (composants) → données (PRESETS/props)
      → rendu (render-batch) → QA (qa-video) → export (3 formats)
```

Chaque maillon existe et a tourné. Ajouter une vidéo = ajouter un jeu de props dans
`PRESETS` + une `<Composition>`. **Aucune architecture supplémentaire n'a été construite
pour AMarketing AI** : la séparation commun/spécifique du §8 suffit tant que le projet
n'existe pas.

### Assets

Les visuels proviennent de `frontend/public/images/placeholders/*.svg` (assets réels du
dépôt), copiés dans `motion/remotion/public/img/`. Ce sont des **icônes de catégorie sur
fond blanc**, pas des photos : elles s'affichent en petit dans le cadre produit. Avec de
vraies photos (`imageSrc`), la composition se remplit correctement.

## 10. Ce qui reste ouvert

1. **Licence Remotion** — trancher avant tout usage commercial, noter la décision
   dans `motion/remotion/LICENSE-NOTICE.md`.
2. **Runner de tests** — aucun n'existe côté frontend. Vitest d'abord (logique métier),
   Playwright ensuite (3 à 5 parcours critiques). À proposer, pas à imposer.
3. **Double store** Redux Toolkit + Zustand — à trancher un jour ; en attendant,
   ne pas aggraver.
4. **Migration des classes héritées** — 328 usages, à faire opportunément écran par
   écran, jamais en masse.
5. **Dark mode** — tokens posés, écrans non vérifiés.
6. **`backend/tests/`** — existe, mais `pytest` n'a pas été exécuté ; état réel inconnu.
