# DOSSIER DE LANCEMENT AMAZER - 25/03/2026

Ce dossier recense ce qui est deja prepare dans le depot, ce qui a ete complete aujourd hui, et ce qui doit etre finalise manuellement pour Google Play et l App Store.

## 1. Etat actuel du projet

- Nom application: `AMAZER`
- Android package / app id: `ne.amazer.app`
- URL mobile configuree: `https://amazerniger.vercel.app`
- Politique de confidentialite web: `https://amazerniger.vercel.app/legal/privacy`
- Conditions d utilisation web: `https://amazerniger.vercel.app/legal/terms`
- Ressource web suppression de compte: `https://amazerniger.vercel.app/legal/account-deletion`

## 2. Ce qui a ete prepare dans le code

- Admin:
  - Les tarifs admin ne sont plus limites par des sliders avec plafond.
  - Les pages `admin/tarifs` et `admin/finance` acceptent maintenant des montants libres `>= 0`.
  - La commission admin accepte egalement des valeurs sans plafond cote validation admin.
  - Les frais par quartier sont editables directement depuis `admin/tarifs`.
- Compliance stores:
  - Une page web publique de suppression de compte a ete ajoutee.
  - La politique de confidentialite a ete renforcee avec la suppression de compte et la retention minimale de certaines donnees.
- Verification:
  - Test backend cible passe.
  - Lint frontend cible passe.
  - TypeScript frontend passe.
  - Build production Next.js passe.

## 3. Verification technique deja favorable

- Android:
  - `compileSdkVersion = 35`
  - `targetSdkVersion = 35`
  - Cela est compatible avec l exigence Google Play verifiee pour les nouvelles soumissions Android.
- Permissions detectees:
  - `INTERNET`
  - `CAMERA`
  - La camera est coherente avec les fonctions QR / scan.
- Suppression de compte:
  - Parcours in-app existant via le dashboard.
  - Ressource web externe maintenant disponible pour Google Play.

## 4. Ce qui manque encore dans le depot

- iOS natif:
  - Il n y a pas encore de dossier `frontend/ios`.
  - La tentative de generation a echoue car la dependance `@capacitor/ios` n est pas installee localement.
  - Cette etape demande un telechargement de dependance et, ensuite, un environnement macOS + Xcode pour aller jusqu a la soumission Apple.
- Signature / publication:
  - Aucune cle de signature Android release n est stockee dans le depot.
  - Aucun certificat Apple, provisioning profile ou configuration Xcode de signature n est stocke dans le depot.
- Assets stores:
  - Les captures d ecran stores, banniere feature graphic Play, et captures iPhone/iPad dediees App Store restent a produire/finaliser.

## 5. Actions obligatoires a faire toi-meme

### Google Play

- Creer ou verifier ton compte Play Console.
- Payer les frais d inscription uniques.
- Choisir le type de compte (`Personal` ou `Organization`).
- Si compte personnel recent: faire le closed test obligatoire avant la production.
- Creer la fiche app Play Console avec:
  - nom,
  - description courte,
  - description longue,
  - email support,
  - politique de confidentialite,
  - URL suppression de compte,
  - captures d ecran,
  - icone et feature graphic.
- Completer:
  - `App content`,
  - `Data safety`,
  - `Data deletion`,
  - declarations d acces / permissions si demandees.
- Generer ou fournir la cle de signature release.
- Uploader le `.aab` signe.
- Lancer une piste de test puis la production.

### Apple / App Store

- Souscrire au programme Apple Developer.
- Utiliser un Mac avec Xcode.
- Installer / generer la plateforme iOS Capacitor puis ouvrir le projet dans Xcode.
- Creer l App ID / Bundle ID Apple correspondant.
- Configurer la signature:
  - certificat,
  - provisioning profile,
  - team Apple.
- Creer la fiche App Store Connect.
- Renseigner:
  - nom,
  - sous-titre,
  - description,
  - mots-cles,
  - screenshots iPhone,
  - support URL,
  - privacy policy URL,
  - App Privacy,
  - App Review notes,
  - compte de demo si connexion necessaire.
- Archiver le build iOS et l envoyer a App Store Connect.
- Soumettre en review.

## 6. Valeurs recommandees a reutiliser

- Privacy Policy URL:
  - `https://amazerniger.vercel.app/legal/privacy`
- Terms URL:
  - `https://amazerniger.vercel.app/legal/terms`
- Account Deletion URL:
  - `https://amazerniger.vercel.app/legal/account-deletion`
- Support email:
  - `amazer.niger@gmail.com`
- Bundle / package cible:
  - `ne.amazer.app`

## 7. Points d attention avant soumission

- Verifier que le compte de demo review reste valide.
- Verifier que les captures montrent le vrai produit final.
- Verifier que les declarations privacy / data safety correspondent exactement au comportement reel de l app.
- Verifier que l URL Vercel finale utilisee publiquement est bien definitive.
- Incremente `versionCode` Android a chaque build Play et garde un `versionName` clair.
