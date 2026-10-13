# Restaurer la base AMAZER depuis une sauvegarde

Les sauvegardes sont produites chaque nuit à 02:30 UTC par le workflow
`.github/workflows/db-backup.yml`. Chacune est conservée 14 jours.

## 1. Récupérer la sauvegarde

GitHub → dépôt → **Actions** → « Sauvegarde quotidienne de la base » → choisir
l'exécution du bon jour → section **Artifacts** → télécharger `amazer-db-AAAA-MM-JJ_HHMM`
(un `.zip` contenant le fichier `.dump`).

## 2. Restaurer

⚠️ **Ne jamais restaurer directement sur la base de production sans copie préalable.**
Procédure recommandée :

1. Dans Neon, créer une **nouvelle branche** (ou une nouvelle base) vide.
2. Restaurer dessus :
   ```bash
   pg_restore --no-owner --no-privileges --dbname "postgresql://…nouvelle-branche…" amazer_AAAA-MM-JJ_HHMM.dump
   ```
3. Vérifier les données (nombre de commandes, de boutiques, derniers comptes).
4. Seulement ensuite, faire pointer `DATABASE_URL` sur Render vers cette base, puis redéployer.

Client requis : PostgreSQL 17 (`pg_restore --version`).

## 3. Lancer une sauvegarde à la demande

GitHub → **Actions** → « Sauvegarde quotidienne de la base » → **Run workflow**.
Utile juste avant une migration risquée.
