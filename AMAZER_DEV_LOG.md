# AMAZER — Journal de développement

État réel du projet, mis à jour à la fin de chaque étape approuvée.
**Aucun secret ni aucune donnée personnelle dans ce fichier.**

---

## 1. Vision

AMAZER, « plateforme du commerce nigérien » (amazer.store) : vitrines vendeurs,
catalogue, recherche, commandes. Trois acteurs : client, vendeur, administration.
Démarrage au Niger avec des moyens limités, ouverture progressive vers l'Afrique et l'international.

## 2. Architecture constatée (audit du 2026-10-09)

| Couche | Technologie | Hébergement |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript strict, Tailwind, Zustand, TanStack Query | Vercel |
| Mobile | Capacitor 7 (Android) | Play Store |
| Backend | FastAPI 0.116, SQLAlchemy 2, Alembic (16 migrations), PostgreSQL | Render |
| Passerelle de paiement | Service séparé (`payment-gateway/`), IP fixe exigée par Amana | VPS Contabo |
| Images | S3 compatible (Backblaze) | — |

Rôles : client et vendeur (via `SellerProfile`). L'administrateur est identifié par une
adresse e-mail unique (`ADMIN_EMAIL`) : il n'existe pas de rôle en base.

## 3. État initial (audit)

- Tests backend : 66/66 OK. Frontend : 0 erreur TypeScript, 24/24 tests Vitest.
- Production : site 200 OK. API OK, avec un démarrage à froid d'environ 60 s observé.
- Fonctionne : comptes (e-mail ou WhatsApp), vitrines, catalogue, panier, commandes, reçus avec QR, restaurants et hôtels, admin et finance, notifications dans l'application.
- Partiel : paiements (voir §4), stock non décrémenté à la commande, un seul statut pour une commande multi-vendeurs, vérification de compte désactivée par défaut, aucun envoi d'e-mail.
- Absent : e-mails (vérification, mot de passe oublié), messagerie, centre d'aide, sous-commandes, frais de livraison par zone.

## 4. Étape 2 — Sécurisation des paiements (P0) — 2026-10-12

### Vulnérabilités identifiées

| # | Faille | Gravité |
|---|---|---|
| V1 | `POST /orders/{id}/payment/confirm` (et l'équivalent restaurant) : un client pouvait passer sa propre commande hors Amana à `paid`, sans aucune vérification. | P0 |
| V2 | `POST /orders/checkout` (et l'équivalent restaurant) : n'importe quel `transaction_code` jamais utilisé rendait la commande `paid` immédiatement. | P0 |

### Modifications effectuées

| Fichier | Changement |
|---|---|
| `backend/app/services/payment_security_service.py` | Ajout de `payment_code_in_use()`, qui contrôle l'unicité d'une référence en excluant la commande elle-même, et de `resolve_manual_payment_code()`, qui porte la règle de confirmation manuelle. `verify_payment_code()` garde le même comportement. |
| `backend/app/routes/orders.py` | Au checkout, un code saisi est conservé chiffré pour contrôle mais ne vaut plus paiement. À la confirmation hors Amana : le client obtient seulement le statut « en attente » ; l'administrateur doit fournir la référence de l'opérateur, et l'action est inscrite au journal d'audit. |
| `backend/app/routes/restaurant.py` | Mêmes corrections pour les commandes restaurant. |
| `frontend/src/app/order/pay/page.tsx`, `order/pay/[id]/page.tsx`, `restaurant/order/pay/page.tsx`, `restaurant/order/pay/[id]/page.tsx` | La page n'affiche « Paiement confirmé » et ne redirige que si le serveur répond `paid`. Sinon, elle affiche le message du serveur (paiement en attente de vérification). |
| `backend/tests/unit/test_payment_confirmation_security.py` | 28 tests ajoutés. |

### Règle de paiement désormais en vigueur

- **Amana** : la commande passe à « payé » uniquement si la passerelle répond `SUCCESS` à une requête faite par le serveur. Ce mécanisme existait déjà et n'a pas été modifié.
- **Autres modes (Nita…)** : la référence déclarée par le client est conservée chiffrée et la commande reste `payment_pending`. Seul l'administrateur peut confirmer le paiement, en saisissant la référence de transaction de l'opérateur sur `/order/pay/{id}` (ou la page restaurant). La référence doit être unique sur toutes les commandes, et l'action est tracée dans `audit_logs`.
- Les commandes déjà payées ne sont pas modifiées. Aucune donnée n'a été migrée ni supprimée.

### Tests exécutés

| Suite | Résultat |
|---|---|
| Nouveaux tests de sécurité des paiements | 28/28 OK |
| Les mêmes tests sur l'ancien code (contrôle) | 13 échecs, qui correspondent exactement aux failles V1 et V2. Les tests Amana et de non-régression passent dans les deux versions. |
| Suite backend complète | 94/94 OK (66 anciens + 28 nouveaux) |
| Frontend `tsc --noEmit` | 0 erreur |
| Frontend ESLint (4 pages de paiement) | 0 erreur |
| Frontend Vitest | 24/24 OK |

Tests non exécutés : aucun test sur une vraie base PostgreSQL (les tests unitaires
simulent la session). Aucun paiement réel (interdit à cette étape). Aucun test de bout
en bout dans un navigateur.

### Problèmes restant à résoudre

| Priorité | Problème |
|---|---|
| ~~P0~~ | ~~Acomptes de réservation enregistrés `paid` sur déclaration du client~~ : corrigé, voir §4 bis. |
| P1 | L'administrateur est reconnu par son seul e-mail, et l'inscription n'exige pas de vérification. Il faut confirmer que le compte admin existe bien en production. |
| P1 | Les paiements hors Amana dépendent désormais d'une validation manuelle par l'admin : prévoir le temps de traitement. Les restaurants ne peuvent pas traiter une commande non payée. |
| P1 | Un vendeur peut changer le statut d'une commande boutique non payée : aucun contrôle de `payment_status` à ce niveau. |
| P1 | Un client peut déclarer la référence réelle d'une autre personne et la « bloquer ». L'admin verra alors un conflit qu'il faudra traiter manuellement. |
| P2 | La réponse Amana n'est pas comparée au montant attendu : seul le statut est lu. Le montant est fixé par le serveur à la création, ce qui limite le risque. |
| P2 | Les liens `pay.amazer.ne` affichés au client pointent vers un domaine non vérifié. |

### Secrets exposés (catégories, sans valeurs)

À renouveler (non fait, en attente d'autorisation) : identifiants Amana production et
sandbox (VPS), secret partagé backend ↔ passerelle (Render et VPS en même temps),
jetons GitHub, Render et Vercel (y compris le secret `VERCEL_TOKEN` du dépôt GitHub),
mot de passe du compte GitHub de l'organisation, mot de passe Contabo.
Vérifié : aucun `.env` réel n'est suivi par Git. Les fichiers `.env.example` ne
contiennent que des valeurs de démonstration.

## 4 bis. Étape 2 (suite) — Acomptes de réservation (P0) — 2026-10-12

**Faille V3 :** les réservations de table et d'hôtel enregistraient l'acompte comme `paid`
sur simple déclaration du client.

**Constat :** le client verse l'acompte directement sur le numéro du vendeur
(`payout_phone`). Seul le vendeur peut donc constater sa réception ; AMAZER ne voit pas ce compte.

| Fichier | Changement |
|---|---|
| `backend/app/routes/seller.py` | Avec un acompte dû, la réservation est créée `pending` ; sans acompte, elle reste `paid`. Le passage à `paid` se fait uniquement quand le **vendeur propriétaire** confirme la réservation (`confirmed`). Un refus ou une annulation ne la rend jamais payée. |
| `frontend/src/types/seller.ts` | Ajout de `payment_status` au type `HotelBooking`, que le backend renvoyait déjà. |
| `frontend/src/app/seller/dashboard/page.tsx` | Le libellé affiche « payé » ou « à vérifier » selon le statut réel, au lieu de « payé » en permanence. |
| `backend/tests/unit/test_reservation_deposit_security.py` | 9 tests ajoutés. |

Résultats : 9/9 nouveaux tests OK, suite backend complète 103/103 OK.
Les réservations existantes ne sont pas modifiées : celles déjà marquées `paid` le restent.

Limite connue : un vendeur qui confirme sans avoir vérifié son compte marque l'acompte
comme payé. C'est sa propre responsabilité, puisque l'argent arrive chez lui.

### Déploiement de l'étape 2 — 2026-10-12

Commit `e966f2f9` poussé sur `main`, ce qui déclenche les déploiements automatiques
Render (backend) et Vercel (frontend). Vérifié en ligne : le JavaScript servi par
amazer.store contient la nouvelle logique de paiement. Côté backend, le statut du
déploiement Render n'est pas visible d'ici (dépôt privé, pas de CLI GitHub).

## 4 ter. Étape P1 — Durcissement — 2026-10-12

| # | Problème | Correction | Fichier |
|---|---|---|---|
| 1 | Derrière le proxy Render, `request.client.host` donne l'IP du proxy : la limite de tentatives devenait commune à tous les clients (risque de blocage général de la connexion). | `client_ip()` lit `CF-Connecting-IP`, qui est écrasé par Cloudflare et donc non falsifiable ; à défaut, la **dernière** entrée de `X-Forwarded-For`. Ces en-têtes ne sont lus que derrière le proxy privé. Test en production : une première version lisait la première entrée de `X-Forwarded-For`, et une fausse IP contournait la limite ; elle a été corrigée. | `backend/app/core/rate_limit.py` |
| 2 | Une adresse e-mail admin non encore créée pouvait être réservée par n'importe qui via l'inscription publique. | L'inscription refuse `ADMIN_EMAIL`. Le compte admin reste créé au démarrage par `ADMIN_PASSWORD`. | `backend/app/services/auth_service.py` |
| 3 | Le stock n'était jamais décrémenté. | Le stock est décrémenté à la **confirmation du paiement** (Amana ou admin), pas au checkout : une commande jamais payée ne bloque pas de stock. Le stock ne descend jamais sous 0 ; un manque éventuel est journalisé. | `backend/app/routes/orders.py` |
| 4 | Un vendeur pouvait traiter une commande boutique non payée. | Refus côté serveur (409). Le bouton est masqué dans le tableau de bord. | `backend/app/routes/seller.py`, `frontend/src/app/seller/dashboard/page.tsx` |
| 5 | Bug d'affichage : une commande restaurant non payée apparaissait comme « Livrée ». | Libellé « Paiement en attente ». | `frontend/src/app/seller/dashboard/page.tsx` |

Tests : 9 tests ajoutés (`backend/tests/unit/test_p1_hardening.py`), suite backend 113/113 OK.

Vérifications en production (2026-10-12, après le déploiement `e5bba0ec`) :
- 8 connexions échouées avec un faux `X-Forwarded-For` différent à chaque fois : blocage (429) à la 7ᵉ. La falsification ne contourne plus la limite.
- Un faux `CF-Connecting-IP` est rejeté directement par Cloudflare (403).
- `/health` 200, amazer.store 200.

Non traité, car impossible d'ici sans accès au tableau de bord Render : le plan de la
base PostgreSQL et ses sauvegardes. C'est une vérification manuelle (voir §5).

## 5. Décisions et vérifications en attente

- **Secrets exposés : non renouvelés, par décision du propriétaire (2026-10-12).** Ils restent utilisés. Ce risque est accepté et documenté.
- Vérifier sur Render (Dashboard → base PostgreSQL) : le plan (une base gratuite expire), les sauvegardes et la restauration.
- Vérifier sur Render que `ADMIN_PASSWORD` est défini (création du compte admin au démarrage).
- Prochaines étapes de la feuille de route : rôle admin en base, e-mails, sous-commandes par vendeur, liens `pay.amazer.ne`.

## 6. Prochaine étape approuvée

Aucune. En attente de validation.
