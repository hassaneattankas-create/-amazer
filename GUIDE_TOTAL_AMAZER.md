# GUIDE COMPLET AMAZER

Ce document resume le fonctionnement global de l'application AMAZER (client, vendeur, admin), les parcours principaux et les limites techniques.

## 1) Acces local

- Application web: `http://localhost:3001`
- Espace admin: `http://localhost:3001/admin`
- Documentation API: `http://127.0.0.1:8000/docs`

## 2) Comptes et connexion

### Client
- Inscription: `/register`
- Connexion: `/login`
- Actions:
  - recherche produit
  - ajout panier
  - achat/checkout
  - suivi commande
  - commande restaurant
  - reservation table (si active)
  - booking premium (si active)
  - suppression de compte depuis le dashboard client

### Vendeur
- Inscription vendeur: `/register?next=/seller`
- Connexion: `/login`
- Actions:
  - creation/edition profil vendeur
  - publication produits avec descriptions
  - gestion stock/prix/promotions
  - publication menu restaurant
  - suivi reservations + bookings
  - scan QR livraison: `/seller/delivery-scan`
  - suppression de compte depuis le dashboard vendeur

### Admin
- Connexion: `/login`
- Email admin local: `Amazer.niger@gmail.com`
- Mot de passe admin local: `AmazerAdmin@2026`
- Deblocage finance/utilisateurs:
  - PIN admin: `7391`
  - cle secondaire: `07/11/03`

## 3) Logique metier par rubrique

### Boutique simple
- Le vendeur vend reellement (pas seulement exposition).
- Le client peut acheter via panier/checkout.

### Restaurant simple
- Le vendeur publie plats et recoit commandes.
- Le client peut commander et reserver une table.

### Premium entreprise
- Regroupe toutes les fonctions boutique + restaurant.
- Ajoute mini-site enrichi + services + booking.
- Objectif: offre premium plus complete et plus attractive.

## 4) Espace admin: pilotage complet

### Tableau principal
- Route: `/admin`
- Modules: Tarifs, Finance, Utilisateurs, Catalogues, Sections, Scan Recu.

### Tarifs et finance
- Routes: `/admin/tarifs`, `/admin/finance`
- Parametres modifiables:
  - commission AMAZER
  - frais de service
  - frais livraison (defaut/urbain/peripherie/quartier)
  - abonnement vendeur
  - prix boosts pub
- Suivi:
  - wallet Nita/Amana/COD
  - historique tresorerie
  - dispatch commandes
  - historique d'audit

### Utilisateurs
- Route: `/admin/users`
- Suivi:
  - nombre total d'utilisateurs
  - actifs/inactifs
  - nouveaux comptes (7j/30j)
  - volume vendeurs vs clients
- Actions:
  - retirer (desactiver) un utilisateur
  - restaurer un utilisateur
  - rechercher nom/email

### Gestion vendeurs
- verification vendeur
- desactivation/restauration vendeur
- impact automatique sur activation boutique/prix

### Contenu
- Categories dynamiques
- Sections homepage (produits/restaurants/mixte)
- Orchestration des blocs visuels

## 5) Livraison et recu QR

### Parcours normal
1. Admin met la commande en `livraison`.
2. Livreur/vendeur scanne le QR recu devant le client.
3. Commande passe en `recu`.

### Securite
- Blocage des doubles scans.
- Journalisation des tentatives sensibles.

### Fallback automatique (nouveau)
- Si la verification QR est oubliee, un mode de secours marque automatiquement la commande comme recue.
- Condition de securite:
  - commande en `livraison`
  - paiement `paid`
  - aucun scan QR valide deja enregistre
  - delai depasse (24h apres dispatch/repere livraison)
- But: eviter les blocages operationnels sans casser le flux normal QR.

## 6) UX admin (champ de verification)

- Le libelle visible n'affiche plus "date d'anniversaire".
- Le champ est presente comme `Cle secondaire` dans les pages admin.

## 7) Icone de l'application

- L'icone est un **A custom blanc sur fond orange sombre**.
- Fichier principal: `frontend/public/icon-amazer-titan.svg`
- Branchee dans:
  - `frontend/src/app/layout.tsx`
  - `frontend/public/manifest.json`

## 8) Est-ce que l'application supporte un nombre illimite d'utilisateurs ?

Non, aucune application n'est illimitee au sens strict.

### Etat actuel
- Backend FastAPI + base PostgreSQL.
- Capacite depend:
  - CPU/RAM/disque
  - nombre de workers API
  - taille de la base
  - index SQL
  - debit reseau

### Ce qu'il faut pour monter en tres grande charge
- PostgreSQL geree/replication + sauvegardes
- pool de connexions + tuning SQL/index
- cache Redis (sessions, lectures chaudes)
- stockage objet pour medias
- workers multiples derriere load balancer
- monitoring + alerting + autoscaling
- politique d'archivage donnees

AMAZER peut donc evoluer a tres grande echelle, mais pas "illimitee" sans architecture de scaling progressive.

## 9) Parcours de verification rapide

1. Login admin.
2. Debloquer finance/utilisateurs avec PIN + cle secondaire.
3. Verifier un vendeur.
4. Passer une commande client.
5. Dispatch en `livraison`.
6. Scan QR vendeur.
7. Verifier statut `recu` dans admin.
