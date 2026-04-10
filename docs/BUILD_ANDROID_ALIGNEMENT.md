# Alignement APK, code local et site en ligne

## Ce qui est vrai techniquement

| Élément | D’où ça vient |
|--------|----------------|
| **Interface dans l’APK** (écrans, textes, logique React) | Le dossier **`frontend/`** sur la machine où tu lances le build, au moment du build. Rien n’est « tiré de GitHub » automatiquement : si tu ne lances pas le build, l’APK ne change pas. |
| **API (règles vendeur, tarifs, abonnements, etc.)** | Toujours le **backend déployé** (ex. Render `amazer-api.onrender.com`), via le proxy du site (ex. Vercel `amazerniger.vercel.app`) selon la config mobile. |
| **Routes Next côté serveur** (ex. `/api/admin-proxy`, cookie admin finance) | Le déploiement **Vercel** du même projet frontend — pas le contenu du fichier `out/` dans l’APK. |

Donc : **même dépôt local** + **rebuild APK** + **déploiement Vercel/Render à jour** = comportement aligné. Si une de ces étapes manque, tu verras des écarts.

## Vérifier que l’APK correspond à ton build local

1. Depuis **`amazer savegarde/frontend`**, lancer :  
   `npm run mobile:android:apk:release` (ou `bundle:release` pour le Play Store).
2. Le script affiche dans le terminal :  
   `[mobile-build] Dossier frontend: ...` et **`[mobile-build] Empreinte build`** (date + hash Git court si disponible).
3. Dans l’APK, ouvrir **Tableau de bord** : en bas de page, une ligne **« Build: … »** reprend la même empreinte. Si elle correspond au terminal du build, **c’est bien cet APK** issu de ce dossier à cette date.

## Pour que le « en ligne » soit le même code que ton PC

- **Frontend (Vercel)** : pousser le code sur la branche connectée au déploiement et attendre la fin du déploiement.
- **Backend (Render)** : idem pour le dépôt backend ou pipeline configuré.

L’APK **ne met pas à jour** le site : il embarque seulement une copie figée du front au moment du `next build` mobile.

## Comportement vendeur / « restrictions »

Les règles métier (abonnement, limite d’articles, boutique visible ou non, etc.) sont appliquées par **l’API** sur Render, pas par magie dans le fichier APK. Le même compte sur le **site web** et sur l’**APK** doit donc se comporter pareil si les deux pointent vers la même API et la même base.

Si un nouveau vendeur n’a « aucune restriction », vérifier d’abord la logique **backend** et les **données** (ex. abonnement, validation admin), pas seulement la version de l’APK. Une évolution de règles impose un **déploiement backend** + éventuellement un **nouveau build APK** si le front affiche de nouveaux messages ou écrans.

## Déploiement du correctif cookie admin (tarifs / finance)

Le cookie `finance_pin_verified` doit être posé avec **SameSite=None** en production pour l’APK (voir `frontend/src/app/api/admin-finance/pin/verify/route.ts`). Ce fichier s’exécute sur **Vercel** : il faut **redéployer le frontend** sur Vercel pour que le correctif soit actif pour les utilisateurs de l’APK.
