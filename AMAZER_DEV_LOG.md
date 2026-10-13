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

## 4 quater. Rôle admin en base — 2026-10-13

- Colonne `users.role` (`user` | `admin`), ajoutée sans effet destructif au démarrage (`ADD COLUMN IF NOT EXISTS`, valeur par défaut `user`).
- Une seule fonction `is_admin()` (`backend/app/core/permissions.py`) remplace 7 contrôles basés sur l'e-mail. Le compte principal `ADMIN_EMAIL` reste reconnu et reçoit `role=admin` au démarrage.
- `PATCH /admin/finance/users/{id}/role` permet de nommer ou retirer un admin. La route exige le PIN finance et chaque changement est tracé dans le journal d'audit. Le rôle du compte principal ne peut pas être modifié, ni celui de l'admin qui fait la demande.
- Page admin des utilisateurs : boutons « Nommer admin » et « Retirer admin ».
- 8 tests. Déployé (commit `dc8700db`).

## 4 quinquies. Mot de passe oublié et e-mails — 2026-10-13

- Envoi SMTP avec la bibliothèque standard de Python (`email_delivery_service.py`), donc **aucune dépendance ajoutée**. Il est inactif tant que `SMTP_HOST` et `SMTP_FROM` ne sont pas définis, et n'indique jamais un envoi qui n'a pas eu lieu.
- `POST /auth/password/forgot` donne la même réponse que le compte existe ou non. Limite : 3 demandes par 15 min. Le code est envoyé par WhatsApp si le compte a un numéro, sinon par e-mail.
- `POST /auth/password/reset` : code à 6 chiffres, à usage unique, expirant ; nombre d'essais limité ; mot de passe fort exigé. Toutes les sessions ouvertes sont fermées après le changement.
- Les codes de réinitialisation ont un canal dédié (`reset`) : ils ne peuvent jamais servir à vérifier un compte, et inversement.
- La vérification de compte passe désormais aussi par e-mail quand le SMTP est configuré.
- Frontend : page `/forgot-password` en deux étapes ; lien depuis la page de connexion ; le contact du support reste affiché en secours.
- 13 tests (envoi SMTP simulé, aucun e-mail réel). Suite backend : 134/134.

**Pour activer les e-mails (action du propriétaire) :** créer un compte chez un fournisseur
SMTP. Brevo propose une offre gratuite (environ 300 e-mails/jour, à confirmer sur leur site).
Il faut ensuite authentifier le domaine `amazer.store` (enregistrements DNS donnés par le
fournisseur), puis renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
et `SMTP_FROM` dans les variables Render. Tant que ce n'est pas fait, le code n'est envoyé
que par WhatsApp (si cette messagerie est configurée), sinon nulle part : le lien vers le
support reste le recours.

## 4 sexies. Sous-commandes par vendeur — 2026-10-13

- Nouvelle table `order_fulfillments` (une ligne par commande et par vendeur), créée au démarrage par `create_all` : uniquement si elle n'existe pas, sans toucher aux tables existantes.
- Chaque vendeur fait avancer sa propre préparation (`commande` → `preparation` → `livraison` → `recu`). Le statut global de la commande correspond au vendeur **le moins avancé**.
- Les événements globaux (livraison lancée par l'admin, réception confirmée par le client, finalisation automatique, scan du reçu) s'appliquent à toutes les parts.
- Une commande à un seul vendeur se comporte exactement comme avant. Pour les commandes antérieures, les parts sont créées au statut global lors de la première action d'un vendeur.
- Le vendeur voit le statut de **sa** part. Le client voit le suivi boutique par boutique dans le suivi de commande (`OrderStepper`), uniquement pour une commande multi-vendeurs.
- Les paiements et les frais ne changent pas : paiement unique par commande, frais de livraison par vendeur (comportement déjà existant). Une annulation partielle ou un remboursement par vendeur n'est pas géré (il n'existe pas d'annulation aujourd'hui).
- 8 tests. Suite backend : 142/142.

## 4 septies. Infrastructure vérifiée via l'API Render — 2026-10-13

- Service `amazer-api` : **plan gratuit**, branche `main`, déploiement automatique. Les 6 déploiements des 12-13 octobre sont tous passés ; `7b8cc8d4` est en ligne.
- **La base PostgreSQL n'est pas chez Render mais chez Neon** (us-east-1). Offre gratuite Neon (source tierce, 2026) : 0,5 Go de stockage, 100 heures de calcul par mois, restauration possible sur 6 h seulement.
- `MEDIA_STORAGE_PROVIDER=database` : **les images sont stockées dans la base**. Avec 0,5 Go, c'est le principal risque de saturation. Passer sur Backblaze (déjà prévu dans `render.yaml`) libérerait la base.
- Variables absentes : `SMTP_*` et `WHATSAPP_*`. Les codes de réinitialisation ne sont donc envoyés **par aucun canal** en production. Absente aussi : `REDIS_URL`, ce qui est sans effet avec un seul processus.
- Non vérifié : la taille réelle de la base et les tables créées au démarrage. La lecture directe de la base de production a été refusée par le système de permissions et doit être autorisée par le propriétaire.

## 4 octies. E-mails activés avec Brevo — 2026-10-13

- Compte Brevo, offre gratuite (300 e-mails/jour). Domaine `amazer.store` authentifié : DKIM (`brevo1/brevo2._domainkey`) et DMARC (`p=none`) en place. Les MX Private Email et le SPF existant sont inchangés.
- Expéditeur vérifié : `AMAZER <no-reply@amazer.store>`. Ne jamais utiliser l'expéditeur Gmail du compte (refusé par Google, Yahoo et Microsoft).
- Variables Render `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` et `SMTP_FROM` configurées par l'API, puis redéploiement.
- Test local d'envoi via le service AMAZER : accepté par Brevo.
- **Port 2525 obligatoire** : sur le port 587, l'envoi depuis Render échouait (`TimeoutError` dans les logs), car l'offre gratuite de Render bloque les ports SMTP sortants (25, 465, 587). `SMTP_PORT=2525`, accepté par Brevo, fonctionne.
- Test en production (2026-10-13 à 10:12 UTC) : « mot de passe oublié » sur le compte admin, sans aucune erreur SMTP dans les logs Render. Réception à confirmer dans la boîte de l'admin.
- ⚠️ **La clé SMTP expire le 13/10/2027**, ou plus tôt après 90 jours sans aucun envoi. Il faudra alors en générer une nouvelle dans Brevo (SMTP et API) et mettre à jour `SMTP_PASSWORD` sur Render.
- Le blocage des IP non autorisées dans Brevo ne doit pas être activé : Render n'envoie pas depuis des adresses fixes.

## 4 nonies. Changement du compte admin — 2026-10-13

- L'ancienne boîte admin est bloquée. `ADMIN_EMAIL` vaut désormais `amazer.niger2@gmail.com` (variable Render). Le compte est créé au démarrage s'il n'existe pas.
- Adresse de support publique mise à jour partout : pied de page, pages légales, page « mot de passe oublié », valeur par défaut côté frontend et backend.
- ⚠️ L'ancien compte AMAZER (`amazer.niger@…`) garde `role=admin` en base. Il faut le lui retirer depuis le nouveau compte : Admin → Utilisateurs → « Retirer admin ».

## 4 decies. Corrections de paiement (P2) — 2026-10-13

- **Liens `pay.amazer.ne` supprimés** : ce domaine n'appartient pas à AMAZER. Les champs `payment_url` et `qr_payload` des réponses de l'API pointent désormais vers la vraie page de paiement (`https://amazer.store/order/pay/{id}` ou sa version restaurant). Nouveau réglage `PUBLIC_SITE_URL`, par défaut `https://amazer.store`. Ces liens n'étaient affichés nulle part dans le frontend.
- **Montant Amana : analysé, pas de modification.** La passerelle ne renvoie que le statut. Le risque n'est pas exploitable : le paiement est créé par le serveur avec le montant calculé côté serveur, la référence Amana n'est enregistrée que par le serveur, et le montant de la commande ne change pas ensuite. Un contrôle supplémentaire demanderait de modifier la passerelle sur le VPS et de connaître le format de réponse d'Amana, qui n'est pas documenté ici.

## 4 undecies. Sauvegarde quotidienne de la base — 2026-10-13

- Workflow `.github/workflows/db-backup.yml` : chaque nuit à 02:30 UTC, `pg_dump` (client 17, format compressé), contrôle que l'archive est lisible, puis conservation 14 jours comme artefact GitHub. Peut aussi être lancé à la main (« Run workflow »).
- Procédure de restauration : `docs/RESTAURATION_BASE.md` (toujours sur une nouvelle branche Neon, jamais directement sur la production).
- **Activation : il faut ajouter le secret GitHub `NEON_DATABASE_URL`.** Le jeton GitHub disponible est révoqué (401), je ne peux pas le faire moi-même. Tant que le secret manque, le workflow échoue avec un message explicite.

**GitHub Actions** (vérifié avec le jeton le 2026-10-13) : le dépôt est **public**, donc les minutes sont illimitées et il n'y a aucun problème de quota. En revanche, GitHub avait **désactivé automatiquement** les tâches planifiées après 60 jours sans activité (`disabled_inactivity` depuis le 16/08). Le ping Render ne tournait plus, d'où les démarrages à froid de 60 s. **« Keep Backend Alive » a été réactivé.** « Maintenance quotidienne » reste désactivée : elle dépend d'un secret `CRON_SECRET` qui n'est configuré nulle part et elle échouait déjà en août. « Auto-commit » reste désactivé : il était inutile.
⚠️ GitHub coupera de nouveau ces tâches après 60 jours sans commit. Il faudra les réactiver (Actions → workflow → « Enable workflow »).

## 4 duodecies. Images sur Backblaze B2 — 2026-10-13

- Bucket `amazer-media` (région `eu-central-003`) et clé applicative limitée à ce bucket. Le test d'envoi depuis le module `S3MediaStorage` d'AMAZER fonctionne.
- Frontend : l'hôte `f003.backblazeb2.com/file/amazer-media` est ajouté aux images optimisées directement par Next.js.
- Bucket passé en **Public** par le propriétaire (Backblaze exige un paiement unique de 1 $, crédité sur le compte). Un fichier de test est accessible publiquement (200).
- Variables Render configurées par l'API : `MEDIA_STORAGE_PROVIDER=s3`, `S3_BUCKET_NAME`, `S3_ENDPOINT_URL`, `S3_REGION=eu-central-003`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` et `MEDIA_PUBLIC_BASE_URL`.
- Premier déploiement en échec : Render n'a pas détecté le port ouvert (« Port scan timeout »), alors que l'application avait démarré normalement. Les journaux montrent un incident côté Render. Le second déploiement est en ligne, et la version précédente était restée en service entre-temps.
- Vérifié en production : les 6 images actuelles des boutiques sont toujours servies (200). Non vérifié en production : l'envoi d'une nouvelle image, qui nécessite un compte vendeur ou admin. Testé uniquement en local.
- Les images déjà stockées dans la base restent servies depuis la base. Seuls les nouveaux envois iront sur B2, ce qui arrête la croissance de la base. Leur migration se fera plus tard.

## 4 terdecies. Centre d'aide et paiement Nita — 2026-10-13

- Nouvelle page **`/comment-ca-marche`** (Server Component, sans JavaScript ajouté, métadonnées SEO) : acheter, rechercher, commander, payer, suivre, réserver, ouvrir sa boutique, publier, gérer ses commandes, mot de passe oublié, signaler un problème. Chaque libellé cité a été vérifié dans l'interface réelle. La page indique que la messagerie n'existe pas encore. Lien ajouté dans le pied de page.
- **Défaut corrigé** : la page de paiement Nita n'affichait **aucun numéro** de destination, le client ne savait pas où envoyer l'argent. La route `payment-intent` renvoie désormais `platform_wallet_phone` (paramètre admin « numéro du portefeuille plateforme »). La carte de paiement l'affiche avec la référence à indiquer, ou invite à contacter le support si le numéro n'est pas configuré. Le bouton devient « J'ai payé - envoyer la référence », puisqu'il ne confirme plus rien lui-même.
- 1 test ajouté. Suite backend : 143/143.

## 4 quaterdecies. Messagerie client ↔ boutique — 2026-10-13

- Tables `conversations` (une par paire client/boutique, avec un aperçu du dernier message) et `conversation_messages` (2 000 caractères maximum, date de lecture). Créées au démarrage par `create_all`, sans effet destructif.
- API `/api/v1/conversations` : ouvrir une conversation, lister, lire (les messages de l'autre partie sont alors marqués comme lus), répondre, signaler.
- **Contrôle d'accès côté serveur** : seuls le client et le vendeur de la boutique y ont accès. Tout autre utilisateur reçoit une 404, qui ne révèle pas l'existence de la conversation. Un vendeur ne peut pas écrire à sa propre boutique, et une boutique inactive ne peut pas être contactée.
- Anti-abus : 10 nouvelles conversations par 10 min, 30 messages par 5 min, 5 signalements par heure. Un signalement est inscrit au journal d'audit et notifié aux administrateurs. L'admin **n'a pas accès** au contenu des conversations : c'est un choix de confidentialité, il dispose du motif et de l'identifiant de la conversation.
- Notifications dans l'application à chaque message. Rafraîchissement automatique toutes les 15 s (conversation ouverte) et 30 s (liste) ; pas de temps réel (WebSocket), pour rester simple et gratuit.
- Frontend : page `/messages` protégée (liste et fil, adaptée au mobile), bouton « Écrire à la boutique » sur les pages boutique, lien « Messages » dans la navigation, aide mise à jour.
- 12 tests. Suite backend : 155/155.

## 4 quindecies. Annulation des commandes et nettoyage — 2026-10-13

- **Client** : il peut annuler lui-même une commande **non payée**, tant qu'elle est en attente de paiement ou nouvelle (`POST /orders/{id}/cancel`, bouton « Annuler la commande » dans le tableau de bord). Une commande payée ne s'annule pas en ligne : le message invite à contacter le support.
- **Admin** : il peut annuler toute commande non livrée (`POST /admin/finance/orders/{id}/cancel`, avec PIN finance, bouton « Annuler »). Si elle était payée, le stock est remis en vente et le journal d'audit indique `refund_to_handle_manually` : **aucun remboursement automatique n'existe**.
- Une commande annulée est figée : plus de paiement possible (démarrage ou confirmation), plus de préparation par le vendeur, plus de livraison par l'admin. Les vendeurs sont notifiés, ainsi que le client quand c'est l'admin qui annule.
- Statut `annulee` affiché côté client, vendeur et admin. Aide mise à jour.
- Nettoyage : workflow « auto-commit » supprimé (il ne pouvait rien commiter), fichier de test supprimé de Backblaze. Les dépendances Redux étaient déjà retirées.
- 10 tests. Suite backend : 165/165.

## 4 sexdecies bis. Abonnements vendeurs — 2026-10-13

État constaté : tarifs par formule (boutique, restaurant, premium) réglables dans Admin → Tarifs ; droits vérifiés côté serveur (`get_seller_user` bloque la publication sans abonnement actif) ; paiements d'abonnement validés manuellement par l'admin ; tarif négociable par boutique.
Écarts avec le cahier des charges, corrigés :
- **Essai gratuit** (« premier mois gratuit ») : il dépendait d'une variable serveur, à 0 en production. Il devient un réglage admin (`seller_trial_days`), **0 par défaut**. Il est accordé une seule fois par boutique.
- **Réduction de lancement** (−50 % envisagé) : elle n'existait pas. Nouveau réglage admin `seller_launch_discount_percent`, **0 par défaut**. Elle s'applique aux tarifs standard, jamais aux tarifs négociés.
- La page « Devenir vendeur » affiche ces offres uniquement quand elles sont actives.
- **Les montants (500 / 1 000 / 5 000 FCFA) ne sont pas modifiés** : ce sont des décisions commerciales à prendre dans Admin → Tarifs.
- 8 tests. Suite backend : 172/172.

## 4 septdecies. Administration : modération — 2026-10-13

Existant : gestion des boutiques (retrait, restauration, vérification, tarifs), des utilisateurs (retrait, restauration, rôle), des catégories, des commandes.
Ajouts (`/api/v1/admin/moderation`, page **Admin → Modération**) :
- **Signalements** : liste des conversations signalées (motif, auteur, boutique, date). Le contenu des conversations reste privé.
- **Annonces produit** : recherche, puis « Masquer » avec un motif transmis au vendeur, ou « Réafficher ». Nouveau marqueur `prices.hidden_by_admin` (ajouté au démarrage, sans effet destructif) : **le vendeur ne peut plus réafficher lui-même** une annonce masquée (409). Les listes publiques filtrent déjà les annonces inactives. Chaque action est inscrite au journal d'audit.
- 5 tests. Suite backend : 177/177.

## 4 octodecies. Performances — 2026-10-13

Mesures en production, depuis le poste du propriétaire (Afrique, via Cloudflare) :
- Frontend : environ 310 Ko de JS et CSS compressés sur l'accueil. Les pages sont servies depuis le cache Vercel (`X-Vercel-Cache: HIT`). Pas de problème de poids.
- API : environ 0,6 s pour une requête sans base (`/health`, réseau + TLS), et **0,9 à 1,3 s** avec la base. **La base ajoute 0,3 à 0,7 s par requête**, car l'API est à Francfort (Render) et la base aux États-Unis (Neon us-east-1) : chaque requête SQL traverse l'Atlantique.
- **Aucun cache actif** : le cache de l'API ne fonctionnait qu'avec Redis, qui n'est pas configuré.

Corrigé : **cache mémoire de secours** quand Redis est absent (`core/cache.py`). Il reste fiable avec un seul processus, l'invalidation existante continue de fonctionner (`catalog:`, `content:` après une modification vendeur), la mémoire est limitée à 512 entrées, et les durées existantes (60 à 120 s) s'appliquent. 4 tests.

Recommandé, non fait : **déplacer la base Neon en Europe (Francfort)**, à côté de l'API. C'est le principal gain restant, mais cela demande une migration des données (export puis import). À faire seulement une fois la sauvegarde quotidienne active.

## 4 novodecies. Tests de bout en bout — 2026-10-13

- `tools/e2e/smoke.mjs` (Puppeteer, écran mobile) : **parcours en lecture seule sur le vrai site**, sans compte ni commande créés. Il vérifie l'API (santé, boutiques, 401 sur les données privées), l'accueil, la liste des boutiques, la page boutique avec son bouton « Écrire à la boutique », le centre d'aide, « mot de passe oublié », la redirection de `/messages` vers la connexion, et l'absence d'erreur JavaScript.
- Premier passage en production : **10/10 OK**.
- Workflow `.github/workflows/e2e-smoke.yml` : chaque jour à 07:15 UTC et à la demande. Un échec déclenche l'e-mail habituel de GitHub, ce qui fait office de surveillance gratuite du site.
- Non couvert : les parcours qui écrivent des données (commande, paiement, message). Il faudrait un environnement de test séparé ou des comptes de test dédiés.

## 4 vicies. Livraison par quartier et études — 2026-10-13

- **Défaut corrigé** : l'admin pouvait régler des frais de livraison par quartier (`finance_district_fees`), mais la commande ne les appliquait jamais. Désormais, le client choisit son quartier dans le panier (livraison standard). Le serveur facture le tarif de ce quartier pour chaque boutique, avec la même règle dans le panier et sur la commande. Un quartier inconnu reprend le tarif standard, et le tarif express reste inchangé. Nouvelle route publique `GET /admin/finance/public-district-fees`. 4 tests (185/185).
- **Mesure du cache en production** : la requête « boutiques » prend environ 1,9 s de traitement serveur hors cache, contre environ 0,4 s quand elle est en cache.
- **Études** (`docs/ETUDES_STRATEGIQUES.md`) : livraison et partenaires (aucune API de suivi identifiée), fournisseurs internationaux (scénarios A à D, évolution minimale « sur commande » proposée), WhatsApp (procédure d'activation Meta, tarif à vérifier), paiements futurs (pistes non vérifiées, Nita conservé), coûts et dépendances (**Vercel Hobby non commercial** : décision à prendre avant le lancement ; base à déplacer en Europe).

## 4 sexdecies. Volontairement non faits — décision du 2026-10-13

- **Paiement** : Nita est laissé tel quel ; un autre moyen de paiement sera ajouté plus tard (décision du propriétaire).
- **Migration des anciennes images vers Backblaze** : elle réécrirait des données de production (les URL des boutiques et produits), alors que la croissance de la base est déjà arrêtée. Gain faible, risque réel : reportée.
- **Montants `Float` → `Numeric`** : il faudrait convertir les colonnes de production (`ALTER COLUMN TYPE`), alors que les montants en XOF sont entiers et que le volume est faible. Reportée à une étape dédiée, avec sauvegarde préalable : la sauvegarde quotidienne doit d'abord être active.

## 5. Décisions et vérifications en attente

- **Secrets exposés : non renouvelés, par décision du propriétaire (2026-10-12).** Ils restent utilisés. Ce risque est accepté et documenté.
- Vérifier sur Render (Dashboard → base PostgreSQL) : le plan (une base gratuite expire), les sauvegardes et la restauration.
- Vérifier sur Render que `ADMIN_PASSWORD` est défini (création du compte admin au démarrage).
- Restant (P2) : annulation et remboursement par vendeur ; montants en `Float`.

## 6. Prochaine étape approuvée

Aucune. En attente de validation.
