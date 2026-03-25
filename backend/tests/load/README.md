# AMAZER Load Test

Ce dossier contient un test de charge pratique pour mesurer la capacite reelle actuelle d AMAZER.

## Script principal

- `amazer_load_test.py`

## Ce que le script mesure

- `web_home`
- `api_home_content`
- `api_products_search`
- `api_storefronts`
- `api_auth_me`

## Execution

Depuis `backend`:

```powershell
python tests/load/amazer_load_test.py
```

Exemple avec plus de charge:

```powershell
python tests/load/amazer_load_test.py --concurrency 1,10,25,50 --requests-per-level 80
```

## Sorties

Par defaut, les rapports sont ecrits dans:

`C:\Users\User\Documents\amazer donnee\load-tests`

Le script genere:

- un rapport JSON brut
- un rapport Markdown lisible

## Attention

- Le chiffre obtenu depend beaucoup de:
  - la machine qui execute le test,
  - le mode de lancement local ou production,
  - le nombre de workers backend,
  - la presence ou non de Redis,
  - la base de donnees,
  - la latence reseau.
- Un test local donne une mesure utile, mais ne remplace pas un test sur l infrastructure de production.
