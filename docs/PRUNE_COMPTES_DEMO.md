# Retirer les comptes de démo (@amazer.demo)

Conservés par défaut dans le script :

- `demo.amazer.market@amazer.demo` (vitrine Amazer Market)
- `demo.fragrance@amazer.demo` (Fragrance)
- `demo.sahelrooftop@amazer.demo` (Le Sahel Rooftop)

L’email **admin** configuré sur Render (`ADMIN_EMAIL` / `admin_email`) est aussi toujours conservé.

Les utilisateurs avec un email **réel** (Gmail, etc.) ne sont **pas** modifiés.

## Commande (Render : Shell, ou local avec accès DB)

```bash
cd backend
export DATABASE_URL="postgresql://..."  # identique à Render
python -m scripts.prune_demo_accounts
```

Simulation :

```bash
python -m scripts.prune_demo_accounts --dry-run
```

Après exécution, dans l’app admin **Utilisateurs**, les comptes retirés sont masqués par défaut (case « Afficher les comptes retirés »).
