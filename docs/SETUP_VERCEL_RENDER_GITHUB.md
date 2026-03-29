# Connecter GitHub, Vercel et Render (deploiement continu)

Objectif : **chaque `git push` sur la branche `main`** met a jour l’API (Render) et le site (Vercel), sans action manuelle.

## Prerequis

- Le code est sur **GitHub** (ex. `amazerniger-hub/amazer`).
- Comptes **Vercel** et **Render** (meme e-mail ou GitHub OAuth).

---

## 1. Render (API — dossier `backend/`)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connecter le depot GitHub et choisir le repo **amazer**.
3. Render detecte `render.yaml` a la racine : service **amazer-api** (`rootDir: backend`).
4. **A la premiere creation**, renseigner les variables **manquantes** (souvent marquees a synchroniser) :
   - `DATABASE_URL` (creer une base **PostgreSQL** sur Render puis lier, ou coller une URL externe),
   - `JWT_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `PAYMENT_ENCRYPTION_KEY`, `ADMIN_FINANCE_PIN`, `ADMIN_BIRTH_DATE`, etc. (voir `docs/DEPLOYMENT.md`).
5. **Deploy**. Noter l’URL publique HTTPS, ex. `https://amazer-api.onrender.com`.

Comportement ensuite :

- **Branche** : `main` (definie dans `render.yaml`).
- **Auto-deploy** : `autoDeployTrigger: commit` → un nouveau commit sur `main` **rebuild et redeploie** l’API.

---

## 2. Vercel (frontend — dossier `frontend/`)

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → importer le **meme** repo GitHub.
2. **Root Directory** : `frontend` (deja indique par `vercel.json` a la racine du repo).
3. **Environment Variables** (Production) :
   - `NEXT_PUBLIC_API_URL` = URL HTTPS de l’API Render (ex. `https://amazer-api.onrender.com`), **sans slash final**.
   - `NEXT_PUBLIC_SITE_URL` = URL du site Vercel (ex. `https://amazer.vercel.app`) ou de ton domaine custom.
4. **Deploy**.

Comportement ensuite :

- Dans **Project → Settings → Git** : branche de production = **`main`** (par defaut si le repo utilise `main`).
- Chaque **push sur `main`** declenche un **nouveau build** et un deploiement Production.

Si tu changes l’URL de l’API plus tard : mets a jour `NEXT_PUBLIC_API_URL` dans Vercel puis **Redeploy** le dernier deploiement (les variables `NEXT_PUBLIC_*` sont injectees au **build**).

---

## 3. Ordre recommande pour la premiere fois

1. Deploy **Render** (API) et verifier `GET https://ton-api.onrender.com/health` → `{"status":"ok"}`.
2. Configurer **Vercel** avec la bonne `NEXT_PUBLIC_API_URL`, puis deploy du **frontend**.
3. Dans **CORS** cote API : inclure l’URL exacte du site Vercel (ex. `https://amazer-xxx.vercel.app`).

---

## 4. Workflow developpeur

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

- **Render** et **Vercel** recoivent le webhook GitHub et lancent chacun leur pipeline.
- Suivre l’avancement dans les onglets **Deployments** (Vercel / Render).

---

## 5. Depannage rapide

| Probleme | Piste |
|----------|--------|
| Vercel build OK mais app ne parle pas a l’API | `NEXT_PUBLIC_API_URL` incorrecte ou CORS / `ALLOWED_HOSTS` cote API. |
| Render ne redeploie pas | Verifier que le push est bien sur `main` et que **Auto-Deploy** n’est pas desactive dans le service Render. |
| Erreur `npm ci` sur Vercel | `package-lock.json` doit etre committe dans `frontend/`. |

---

## Fichiers du repo utiles pour ce flux

| Fichier | Role |
|---------|------|
| `render.yaml` | Service API, branche `main`, auto-deploy sur commit |
| `vercel.json` | Racine Next.js = `frontend`, `npm ci` + `npm run build` |
