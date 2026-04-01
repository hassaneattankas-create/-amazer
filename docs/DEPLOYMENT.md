# Deploiement AMAZER

Date de reference: 2026-04-01

## URLs en production

- site public principal: `https://amazerniger.vercel.app`
- site public secondaire: `https://amazerniger-hub-amazer.vercel.app`
- API backend: `https://amazer-api.onrender.com`

Aujourd'hui, le lien public a partager en priorite est:

- `https://amazerniger.vercel.app`

## Architecture en ligne

- frontend: Next.js deploye sur Vercel
- backend: FastAPI deploye sur Render
- base de donnees: PostgreSQL Neon branchee a Render
- domaine public actuel: sous-domaine Vercel `amazerniger.vercel.app`

Le frontend public passe par le proxy Vercel `/backend-api`, ce qui evite les blocages CORS navigateur sur les appels publics.

## Ce qui doit etre configure

### Vercel

Variables attendues:

- `NEXT_PUBLIC_API_URL=https://amazer-api.onrender.com`
- `NEXT_PUBLIC_SITE_URL=https://amazerniger.vercel.app`
- `NEXT_PUBLIC_BACKEND_ORIGIN=https://amazer-api.onrender.com`

Comportement attendu:

- l'accueil charge correctement
- `/backend-api/api/v1/storefronts` renvoie les boutiques
- `/backend-api/api/v1/products/search` renvoie les produits

### Render

Variables minimales a garder:

- `APP_ENV=production`
- `DATABASE_URL=...`
- `JWT_SECRET_KEY=...`
- `ADMIN_EMAIL=Amazer.niger@gmail.com`
- `ADMIN_FINANCE_PIN=7391`
- `ADMIN_BIRTH_DATE=07/11/03`
- `PAYMENT_ENCRYPTION_KEY=...`
- `CORS_ALLOWED_ORIGINS=https://amazerniger.vercel.app,https://amazerniger-hub-amazer.vercel.app,https://amazerapp.com,https://www.amazerapp.com,...`
- `ALLOWED_HOSTS=amazer-api.onrender.com`

Important:

- `JWT_SECRET_KEY` doit etre long et fort
- `ALLOWED_HOSTS` ne doit pas rester a `*` en production
- si tu ajoutes un domaine custom, il faudra aussi l'ajouter dans `CORS_ALLOWED_ORIGINS`

## Procedure de verification apres deploiement

### Verification frontend

1. Ouvrir `https://amazerniger.vercel.app`
2. Verifier que la home charge
3. Verifier les boutiques
4. Verifier les produits
5. Verifier l'inscription vendeur

### Verification backend

1. Tester `https://amazer-api.onrender.com/health`
2. Tester `https://amazer-api.onrender.com/api/v1/auth/health`
3. Tester les listes publiques:
   - `/api/v1/storefronts`
   - `/api/v1/products/search`

### Verification admin

Compte admin actuel:

- email: `Amazer.niger@gmail.com`

Verification finance:

- PIN admin: `7391`
- cle secondaire: `07/11/03`

Parcours:

1. se connecter
2. ouvrir `/admin`
3. ouvrir `Admin Finance`
4. saisir `7391`
5. saisir `07/11/03`

Si tu inverses les deux champs, l'interface actuelle essaie maintenant de corriger automatiquement.

## Problemes deja rencontres et solution retenue

### Boutiques et produits absents en public

Cause:

- appels frontend bloques ou mal resolves vers l'API

Solution retenue:

- proxy Vercel `/backend-api`

### Ancienne version visible sur telephone

Cause:

- cache PWA / service worker

Solution retenue:

- desactivation du service worker stale
- ouvrir en navigation privee si besoin

### Verification admin qui bloque

Causes deja corrigees:

- backend Render pas redeploye sur la bonne revision
- variables Render de prod incorrectes
- colonnes manquantes dans la base

## Domaine custom plus tard

Si tu achetes `amazerapp.com`, la procedure sera:

1. ajouter le domaine dans Vercel
2. pointer le DNS vers Vercel
3. garder `amazer-api.onrender.com` ou creer `api.amazerapp.com`
4. ajouter le nouveau domaine dans:
   - `NEXT_PUBLIC_SITE_URL`
   - `CORS_ALLOWED_ORIGINS`
   - `ALLOWED_HOSTS` si l'API passe aussi sur un domaine custom

## Checklist finale

- [x] frontend public disponible
- [x] backend public disponible
- [x] boutiques publiques chargees
- [x] produits publics charges
- [x] login admin fonctionnel
- [x] verification PIN admin fonctionnelle
- [x] guide utilisateur disponible
- [ ] domaine custom branche
- [ ] video publicitaire finale produite
