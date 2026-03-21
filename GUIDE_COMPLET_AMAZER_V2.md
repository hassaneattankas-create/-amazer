# GUIDE COMPLET AMAZER (Version 2026-03-20)

## 1) Etat actuel de l'application

Verification faite localement:
- Frontend: `http://localhost:3000` -> OK (HTTP 200)
- Backend API: `http://127.0.0.1:8000/docs` -> OK (HTTP 200)
- Pages protegees:
  - `/seller` -> redirection (HTTP 307, normal sans connexion)
  - `/admin` -> redirection (HTTP 307, normal sans connexion)

Conclusion: l'application demarre correctement et les protections d'acces fonctionnent.

## 2) Liens principaux

- App web: `http://localhost:3000`
- Login: `http://localhost:3000/login`
- Inscription: `http://localhost:3000/register`
- Espace vendeur: `http://localhost:3000/seller`
- Espace admin: `http://localhost:3000/admin`
- Documentation API: `http://127.0.0.1:8000/docs`

## 3) Comptes et roles

### Client
- Creer un compte, se connecter.
- Parcourir boutiques/restaurants/premium.
- Ajouter au panier, acheter, suivre commande.
- Voir le recu et QR de commande.

### Vendeur
- Creer/mettre a jour son profil vendeur.
- Publier produits avec description, prix, stock.
- Gerer restaurants: plats, disponibilite, commandes.
- Scanner QR de reception livraison.

### Admin
- Gerer utilisateurs (activer/desactiver/rechercher).
- Suivre chiffres (utilisateurs, vendeurs, activite).
- Modifier commissions/frais AMAZER.
- Superviser commandes, finance, contenus et vendeurs.

## 4) Regles metier par rubrique

### Boutique simple
- Vente reelle active.
- Les produits ne sont pas juste exposes: achat/panier disponibles.

### Restaurant simple
- Vente de plats active.
- Commande client directe possible.

### Premium
- Reunit les fonctions Boutique + Restaurant.
- Inclut mini-site plus complet.
- Ajoute des options avancees pour justifier l'offre premium.

## 5) QR de verification livraison

- Le QR peut etre scanne pour confirmer la remise au client.
- Un fallback automatique existe pour eviter le blocage si le scan est oublie, avec controles de securite.

## 6) Identite de l'app

- Nom officiel: **AMAZER**
- Le manifeste PWA est mis a jour avec `"name": "AMAZER"`.

## 7) Procedure de lancement (local)

### Backend
```powershell
cd "C:\Users\User\Desktop\amazer savegarde\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd "C:\Users\User\Desktop\amazer savegarde\frontend"
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Ensuite ouvrir: `http://localhost:3000`

## 8) Checklist rapide avant publication

- Auth client/vendeur/admin verifiee.
- Paiement/panier/commande verifies.
- Parcours restaurant verifies.
- Parcours premium verifies.
- Admin: utilisateurs + commissions + finance verifies.
- Politique confidentialite/CGU pretes.
- Build Android/iOS teste en release.
