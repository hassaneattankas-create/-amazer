# AMAZER - Checklist Release Play Store

Ce guide sert a publier l'application Android sans toucher a la version web en ligne.

## 1) Prerequis machine

- Java 17 installe (`java -version`)
- Android SDK installe (API 35)
- Variables Android configurees (`ANDROID_HOME` / SDK path)
- Compte Google Play Console actif

## 2) Cle de signature (une seule fois)

1. Creer le dossier des cles:
   - `frontend/keys/`
2. Generer une cle upload:
   - `keytool -genkeypair -v -keystore frontend/keys/amazer-upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
3. Creer `frontend/android/keystore.properties` a partir de `frontend/android/keystore.properties.example`.
4. Renseigner les vrais mots de passe.

Important:
- Ne jamais committer la cle `.jks`.
- Sauvegarder la cle dans un coffre externe.

## 3) Versioning release

Avant chaque publication, augmenter:
- `ANDROID_VERSION_CODE` (entier strictement croissant)
- `ANDROID_VERSION_NAME` (ex: `1.0.1`)

Exemple PowerShell:

```powershell
$env:ANDROID_VERSION_CODE="2"
$env:ANDROID_VERSION_NAME="1.0.1"
```

## 4) Build Android release (AAB)

Depuis `frontend/`:

```powershell
npm run mobile:android:bundle:release
```

Sortie attendue:
- `frontend/android/app/build/outputs/bundle/release/app-release.aab`

Option APK release (tests internes):

```powershell
npm run mobile:android:apk:release
```

## 5) Verifications avant soumission

- L'app se lance et charge l'accueil
- Login client / vendeur / admin fonctionne
- Flux vendeur apres inscription redirige bien vers `/seller?welcome=1`
- Paiement vendeur : soumission puis validation admin (Finance admin) avant deblocage complet
- Notifications visibles + badge
- Aucune erreur critique sur `npx tsc --noEmit` et `npx eslint`
- `targetSdkVersion` et `compileSdkVersion` a 35
- **Data Safety (Play Console)** : declarer l'utilisation de la **camera** (scan code-barres) comme fonctionnalite optionnelle
- **Politique de confidentialite** : URL publique obligatoire (meme domaine ou page dediee)

## 6) Exigences Play Console (a preparer)

- Politique de confidentialite publique (URL)
- Fiche Data Safety correcte
- Compte test pour verification Google si fonctionnalites protegees
- Captures d'ecran smartphone
- Icône Play Store 512x512
- Feature graphic 1024x500
- Classification du contenu

## 7) Publication

1. Ouvrir Play Console > votre app.
2. Creer une release (interne puis production).
3. Televerser `app-release.aab`.
4. Remplir notes de version.
5. Soumettre pour revue.

## 8) Ce qui est deja bon dans ce projet

- `applicationId`: `ne.amazer.app`
- `minSdk`: 23
- `targetSdk`: 35
- `compileSdk`: 35
- Signature release supportee via `keystore.properties`
- Capacitor Android deja configure
