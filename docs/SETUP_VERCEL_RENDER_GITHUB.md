# Setup Complet Vercel + Render + GitHub

Date de reference: 2026-04-01

Objectif:

- chaque `git push` sur `main` met a jour le backend Render
- chaque `git push` sur `main` met a jour le frontend Vercel
- le site public principal reste `https://amazerniger.vercel.app`

## 1. Depot GitHub

Le projet attendu est:

- repo: `amazerniger-hub/amazer`
- branche de production: `main`

Workflow standard:

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

## 2. Render

Service attendu:

- nom: `amazer-api`
- root directory: `backend`
- runtime: `python`
- start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Fichier source:

- `render.yaml`

### Variables Render a garder

- `APP_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `ADMIN_EMAIL`
- `ADMIN_FINANCE_PIN`
- `ADMIN_BIRTH_DATE`
- `PAYMENT_ENCRYPTION_KEY`
- `CORS_ALLOWED_ORIGINS`
- `ALLOWED_HOSTS`

### Verification Render

Apres deploy:

1. ouvrir `https://amazer-api.onrender.com/health`
2. verifier la reponse `{"status":"ok"}`
3. verifier `https://amazer-api.onrender.com/api/v1/auth/health`

Si un deploy Render echoue:

1. verifier `JWT_SECRET_KEY`
2. verifier `ALLOWED_HOSTS`
3. verifier `CORS_ALLOWED_ORIGINS`
4. verifier les colonnes de base attendues par le code actuel

## 3. Vercel

Projet public principal:

- `amazerniger`

URL publique principale:

- `https://amazerniger.vercel.app`

Projet secondaire encore accessible:

- `https://amazerniger-hub-amazer.vercel.app`

### Variables Vercel a garder

- `NEXT_PUBLIC_API_URL=https://amazer-api.onrender.com`
- `NEXT_PUBLIC_SITE_URL=https://amazerniger.vercel.app`
- `NEXT_PUBLIC_BACKEND_ORIGIN=https://amazer-api.onrender.com`

### Verification Vercel

1. ouvrir `https://amazerniger.vercel.app`
2. tester:
   - `/backend-api/api/v1/storefronts?limit=5&activity_type=shop`
   - `/backend-api/api/v1/products/search?sort=newest&limit=5`

Les deux doivent repondre en `200`.

## 4. Liaison frontend-backend

En production:

- le frontend appelle l'API via `/backend-api`
- Vercel rewrite ensuite vers `https://amazer-api.onrender.com`

Avantage:

- le public charge correctement les donnees meme si Render est strict cote navigateur

## 5. Admin

Connexion admin:

- email: `Amazer.niger@gmail.com`

Verification finance:

- PIN: `7391`
- date secondaire: `07/11/03`

Etapes:

1. se connecter sur `https://amazerniger.vercel.app/login`
2. ouvrir `/admin`
3. ouvrir finance, tarifs ou utilisateurs
4. entrer les deux cles

## 6. Quand tout est bon

Tu peux considerer l'app en ligne si:

- la home publique repond
- les produits apparaissent
- les boutiques apparaissent
- le login fonctionne
- l'espace vendeur fonctionne
- l'admin fonctionne
- les endpoints de sante Render sont en `200`

## 7. Domaine custom plus tard

Si tu achetes `amazerapp.com`:

1. l'ajouter dans Vercel
2. configurer le DNS
3. mettre `NEXT_PUBLIC_SITE_URL=https://amazerapp.com`
4. ajouter `https://amazerapp.com` et `https://www.amazerapp.com` dans `CORS_ALLOWED_ORIGINS`

## 8. Recommandation pratique

Tant que le domaine custom n'est pas branche, le lien officiel a communiquer est:

- `https://amazerniger.vercel.app`
