# Déploiement web AMAZER (site public avant les stores)

**Deploiement continu (GitHub + Vercel + Render)** : voir [`SETUP_VERCEL_RENDER_GITHUB.md`](./SETUP_VERCEL_RENDER_GITHUB.md) pour lier le depot et obtenir un deploiement automatique a chaque push sur `main`.

Ce guide décrit comment mettre le **frontend Next.js** et l’**API FastAPI** en ligne derrière un **nom de domaine .com**, avec des réglages de sécurité et de performance cohérents avec le code du dépôt.

## Pourquoi l’IA ne peut pas « se connecter » à ton compte

Même si tu utilises **le même e-mail** (`amazer.niger@gmail.com`) sur Vercel et Render, **personne d’autre** (y compris un assistant) ne peut ouvrir ta session : il manque ton mot de passe, le 2FA et les jetons de déploiement. Sur ta machine, la commande `vercel whoami` doit afficher ton compte après `vercel login`.

**Ce que tu fais en 10 minutes** (une fois le code poussé sur GitHub) :

### Vercel (frontend)

1. [vercel.com](https://vercel.com) → **Log in** avec `amazer.niger@gmail.com`.
2. **Add New… → Project** → importer le dépôt `amazerniger-hub/amazer` (ou le tien).
3. **Root Directory** : `frontend` (le fichier `vercel.json` à la racine du repo le fixe aussi).
4. **Environment Variables** : `NEXT_PUBLIC_API_URL` = URL HTTPS de ton API Render (voir ci‑dessous), puis `NEXT_PUBLIC_SITE_URL` = URL du site Vercel ou de ton domaine.
5. **Deploy**.

### Render (API)

1. [dashboard.render.com](https://dashboard.render.com) → même compte Google si tu l’utilises.
2. **New → Blueprint** (ou **Web Service**) → même dépôt Git.
3. Si tu utilises le fichier **`render.yaml`** à la racine : Render propose le service `amazer-api` (dossier `backend/`).
4. Crée une **PostgreSQL** sur Render (ou colle une `DATABASE_URL` externe), puis dans l’API ajoute les variables **secrètes** : `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ALLOWED_ORIGINS` (origines Vercel + domaine), `ALLOWED_HOSTS` (nom d’hôte de l’API Render, ex. `amazer-api.onrender.com`), `PAYMENT_ENCRYPTION_KEY`, `ADMIN_FINANCE_PIN`, `ADMIN_BIRTH_DATE`, etc. (voir tableau plus bas).
5. **Deploy** ; l’URL publique de l’API (ex. `https://amazer-api.onrender.com`) sert pour **Vercel** `NEXT_PUBLIC_API_URL`.

Ensuite : **redéploie Vercel** après avoir fixé l’URL de l’API.

### Option ligne de commande (sur ton PC)

```bash
npm i -g vercel
vercel login
cd frontend
vercel --prod
```

Il te demandera de lier le projet au compte `amazer.niger@gmail.com`.

## Architecture recommandée

| Composant | Rôle | Exemple d’hébergeur |
|-----------|------|---------------------|
| Site vitrine + app web | Next.js | [Vercel](https://vercel.com) (recommandé pour Next.js) |
| API REST | FastAPI (Uvicorn) | [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io) |
| Base PostgreSQL | Données | Render / Railway / Neon / Supabase |
| Redis (optionnel) | Cache / rate limit | Upstash / Redis Cloud |
| Nom de domaine `.com` | DNS + HTTPS | Cloudflare, Namecheap, Google Domains, etc. |

Tu ne peux pas « obtenir » un `.com » dans le code : tu **achètes** le domaine chez un registrar, puis tu pointes les enregistrements DNS vers Vercel et ton hébergeur API.

## 1. Domaine .com

1. Acheter `tondomaine.com` (et souvent `www.tondomaine.com`).
2. **Zone DNS** (souvent chez le même registrar ou Cloudflare) :
   - **Site (Vercel)** : suivre l’assistant Vercel « Domains » (souvent un **CNAME** `www` → `cname.vercel-dns.com`, et une redirection apex `tondomaine.com` → `www`).
   - **API** : un sous-domaine du type `api.tondomaine.com` en **CNAME** vers l’URL fournie par Render/Railway (ex. `xxx.onrender.com`), ou un **A** si l’hébergeur impose une IP fixe.

3. Attendre la propagation DNS (quelques minutes à 48 h).

## 2. Variables d’environnement (production)

### Frontend (Vercel / build Next.js)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_API_URL` | Oui | URL publique de l’API, ex. `https://api.tondomaine.com` (sans slash final). |
| `NEXT_PUBLIC_SITE_URL` | Fortement conseillé | URL canonique du site, ex. `https://www.tondomaine.com` — utilisée pour la CSP (`connect-src`). |
| `NEXT_PUBLIC_CSP_CONNECT_EXTRA` | Optionnel | Origines supplémentaires séparées par des virgules si besoin (analytics, etc.). |

Le build lit ces variables : sans `NEXT_PUBLIC_API_URL`, le build peut échouer ou la CSP bloquera les appels API.

### Backend (API)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `APP_ENV` | Oui | `production` |
| `DATABASE_URL` | Oui | URL PostgreSQL |
| `JWT_SECRET_KEY` | Oui | Secret long (≥ 32 caractères en prod) |
| `CORS_ALLOWED_ORIGINS` | Oui | Liste séparée par des virgules : **exactement** les origines du site, ex. `https://www.tondomaine.com,https://tondomaine.com` |
| `ALLOWED_HOSTS` | Oui | Hostnames acceptés par l’API (header `Host`), ex. `api.tondomaine.com,xxx.onrender.com` si tu testes encore l’URL fournie par l’hébergeur |
| `ADMIN_FINANCE_PIN`, `ADMIN_BIRTH_DATE`, `PAYMENT_ENCRYPTION_KEY` | Oui en prod | Voir validation dans `app/config.py` |
| `REDIS_URL` | Optionnel | Améliore cache / rate limiting si configuré |

Après changement de domaine, **aligne** `CORS_ALLOWED_ORIGINS` et `ALLOWED_HOSTS` avec les URLs réelles (www / non-www / API).

## 3. Sécurité déjà présente dans le code

- **Frontend** : en production, en-têtes **CSP**, **HSTS**, **X-Frame-Options**, **COOP**, etc. (`next.config.mjs`).
- **API** : **CORS** restreint aux origines listées, **CSRF** sur les requêtes mutantes, **Trusted Host** en production, **GZip**, en-têtes de sécurité sur les réponses, journalisation des accès sensibles.

Renforcer encore : WAF / pare-feu (ex. Cloudflare en proxy devant le site et l’API), secrets forts, mises à jour régulières des dépendances (`npm audit`, `pip-audit`).

## 4. Performance

- Next : compression activée, `optimizePackageImports` pour `lucide-react` / `recharts`, suppression des `console` non critiques en prod.
- API : compression GZip pour les réponses volumineuses.
- Côté infra : activer le **CDN** (Vercel le fait pour le frontend), mettre Redis pour le cache catalogue si le trafic augmente.

## 5. Déploiement typique (Vercel + Render)

1. Créer un **Web Service** Render pour le backend : commande du type `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. Lier la base et les variables d’environnement.
3. Connecter le dépôt GitHub au **projet Vercel** pour le dossier `frontend`, avec les variables `NEXT_PUBLIC_*`.
4. Ajouter le domaine `.com` dans Vercel et configurer le DNS.
5. Tester login, checkout, upload média et admin sur l’URL HTTPS finale.

## 6. Checklist avant ouverture au public

- [ ] HTTPS partout (site + API)
- [ ] `CORS_ALLOWED_ORIGINS` et `NEXT_PUBLIC_API_URL` cohérents
- [ ] `ALLOWED_HOSTS` inclut l’hôte réel de l’API
- [ ] Secrets de production non commités (fichiers `.env` ignorés par Git)
- [ ] Monitoring basique (logs Render/Vercel, alertes erreurs 5xx)

Pour une **app mobile plus tard** (stores), tu réutilises la même API ; ajoute alors les origines ou clés API mobiles selon ton architecture.
