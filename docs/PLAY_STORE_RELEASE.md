# AMAZER Play Store Release Guide

Date de reference: 2026-04-01

## Ce qui est deja pret dans le projet

- Application Android Capacitor presente dans `frontend/android`
- `compileSdkVersion = 35` et `targetSdkVersion = 35`
- `appId = ne.amazer.app`
- URL de confidentialite dans l'app: `/legal/privacy`
- URL de suppression de compte dans l'app: `/legal/account-deletion`
- Permission camera declaree uniquement pour le scan
- Synchronisation Android fonctionnelle avec:
  - `npm run mobile:prepare:android`

## Commandes utiles

- Synchroniser l'application Android sur la base du site public:

```bash
cd frontend
npm run mobile:prepare:android
```

- Tentative de build web embarque localement pour une future version mobile 100% bundlee:

```bash
cd frontend
npm run mobile:prepare:android:bundled
```

Note:
La variante `bundled` n'est pas encore finalisee car plusieurs routes dynamiques Next.js (`/product/[id]`, `/shop/[vendorId]`, `/order/...`) restent incompatibles avec un export statique complet sans refonte de navigation.

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

Apres installation du JDK et de l'Android SDK:

```bash
cd frontend/android
gradlew bundleRelease
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

## Blocages externes restants

Le repo est prepare, mais cette machine ne dispose pas encore des composants systeme suivants:

- JDK accessible en ligne de commande (`java`, `keytool`)
- Android SDK complet
- build release `AAB` effectivement genere

Sans ces composants, on ne peut pas produire ici un `app-release.aab` final pret a uploader.

Sans acces au compte Google Play Developer ou a un `service account` Google Play, on ne peut pas pousser l'application sur le Play Store depuis cette session.
