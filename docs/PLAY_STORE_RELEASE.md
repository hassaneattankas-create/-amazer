# AMAZER Play Store Release Guide

Date de reference: 2026-04-04

## Ce qui est deja pret dans le projet

- Application Android Capacitor presente dans `frontend/android`
- `compileSdkVersion = 35` et `targetSdkVersion = 35`
- `appId = ne.amazer.app`
- version Android pilotable sans toucher au code via `ANDROID_VERSION_CODE` et `ANDROID_VERSION_NAME`
- URL de confidentialite dans l'app: `/legal/privacy`
- URL de suppression de compte dans l'app: `/legal/account-deletion`
- Permission camera declaree uniquement pour le scan
- navigation WebView restreinte aux domaines `amazerniger.vercel.app` et `amazer-api.onrender.com`
- Synchronisation Android fonctionnelle avec:
  - `npm run mobile:prepare:android`
- Build mobile embarque 100% bundle valide avec:
  - `npm run mobile:prepare:android:bundled`
- Build release Android valide avec Java 21
- Bundle Play Store genere localement dans:
  - `frontend/android/app/build/outputs/bundle/release/app-release.aab`

## Exigences Play Store actuelles couvertes par le repo

- Target API:
  - Google Play exige Android 15 / API 35 pour les nouvelles apps et mises a jour depuis le 31 aout 2025
  - etat repo: conforme (`targetSdkVersion = 35`)
- Publication:
  - Google Play demande un Android App Bundle (`.aab`) signe pour une nouvelle app
  - etat repo: workflow et build `bundleRelease` deja prepares
- Privacy policy:
  - Google Play demande un lien public vers une politique de confidentialite et un acces dans l'app
  - etat repo: conforme via `/legal/privacy` + lien dans l'application
- Account deletion:
  - si l'app permet de creer un compte, Google Play exige une suppression demandable dans l'app et hors de l'app
  - etat repo: conforme via Dashboard client, dashboard vendeur et page `/legal/account-deletion`
- Data safety:
  - la declaration Play Console doit correspondre au comportement reel de l'app et des SDK utilises
  - etat repo: texte et checklist prepares, validation finale a faire dans Play Console
- Verification developpeur Android:
  - le processus Android developer verification est ouvert a tous les developpeurs Play depuis mars 2026
  - action externe: verifier le compte Play Console si ce n'est pas deja fait

## Commandes utiles

- Synchroniser l'application Android sur la base du site public:

```bash
cd frontend
npm run mobile:prepare:android
```

- Build web embarque localement pour la version mobile 100% bundlee:

```bash
cd frontend
npm run mobile:prepare:android:bundled
```

Note:
La variante `bundled` est maintenant fonctionnelle. Les parcours mobiles dynamiques utilisent des routes statiques dediees a l'export Android afin de ne pas toucher au site web en ligne.

## Signature release

Le projet est maintenant configure pour signer un build `release` a partir d'un fichier local non versionne:

- fichier d'exemple: `frontend/android/keystore.properties.example`
- fichier reel attendu: `frontend/android/keystore.properties`

Exemple de contenu:

```properties
storeFile=../keystore/amazer-release.jks
storePassword=VOTRE_MOT_DE_PASSE
keyAlias=amazer
keyPassword=VOTRE_MOT_DE_PASSE
```

Le keystore lui-meme doit rester hors Git. Les extensions `*.jks`, `*.keystore` et `keystore.properties` sont ignorees.

## Generation du keystore

Apres installation d'un JDK:

```bash
keytool -genkeypair -v ^
  -keystore amazer-release.jks ^
  -alias amazer ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000
```

Place ensuite le fichier dans un dossier local du type:

```text
frontend/android/keystore/amazer-release.jks
```

## Build Play Store

Apres installation du JDK 21 et de l'Android SDK:

```bash
cd frontend/android
gradlew bundleRelease
```

Pour definir une version unique avant upload:

```powershell
$env:ANDROID_VERSION_CODE="12"
$env:ANDROID_VERSION_NAME="1.0.12"
./gradlew bundleRelease
```

Le resultat attendu sera dans:

```text
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

## GitHub Actions

Deux workflows sont prets dans le repo:

- build du bundle signe:
  - `.github/workflows/android-release.yml`
- build + envoi automatique sur Google Play:
  - `.github/workflows/play-store-release.yml`

Les deux workflows acceptent maintenant en lancement manuel:

- `version_code`
- `version_name`

Ils utilisent Java 21.

Secrets GitHub a renseigner dans le depot:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PLAY_SERVICE_ACCOUNT_JSON`

Le workflow Play publie sur la piste `internal`.

## Checklist Play Console

### Fiche Play

- nom de l'app: AMAZER
- description courte
- description complete
- icone 512x512
- banniere 1024x500
- captures telephone
- categorie: Shopping
- email support: `amazer.niger@gmail.com`

### Confidentialite et suppression

- Privacy policy URL:
  - `https://amazerniger.vercel.app/legal/privacy`
- Account deletion URL:
  - `https://amazerniger.vercel.app/legal/account-deletion`

### App access

Fournir des comptes de test valides pour:

- client
- vendeur boutique
- vendeur restaurant ou premium
- admin

Ajouter les instructions exactes pour atteindre:

- commande
- profil vendeur
- creation produit
- page admin

### Data safety

Declarer avec exactitude les donnees traitees par l'app:

- identifiants de compte
- informations de contact
- adresses de livraison
- historique de commande
- informations vendeur
- donnees de paiement selon le flux reel
- camera uniquement pour le scan

Verifier que la declaration Play est coherente avec:

- `frontend/src/app/legal/privacy/page.tsx`
- `frontend/src/app/legal/account-deletion/page.tsx`

## Etat actuel

- le bundle Android signe a ete genere localement
- la cle de signature locale existe sur cette machine dans `frontend/android/keystore`
- le fichier `frontend/android/keystore.properties` existe localement et reste hors Git
- les workflows GitHub sont alignes sur la configuration qui a fonctionne localement

## Blocage externe restant

Sans acces au compte Google Play Developer ou a un `service account` Google Play, on ne peut pas pousser l'application sur le Play Store depuis cette session.

## Sources officielles a verifier avant publication

- Target API requirements:
  - https://support.google.com/googleplay/android-developer/answer/15987130
- Developer Program Policy / privacy / account deletion / data safety:
  - https://support.google.com/googleplay/android-developer/answer/16528695
- Signature release / Play App Signing:
  - https://developer.android.com/studio/publish/app-signing
- Android developer verification:
  - https://developer.android.com/developer-verification
