# AMAZER — Publication sur Google Play

Document unique pour préparer et envoyer l’app Android. Tout le reste sur ce sujet a été regroupé ici.

## 1. Ce que vous faites dans Play Console (obligatoire)

- Créer l’application, remplir la fiche (textes, captures, icône 512×512, bannière 1024×500).
- Renseigner les **URL légales** (voir §5).
- Compléter **Sécurité des données** (Data safety) en cohérence avec l’app.
- Créer une **release** (test interne / fermé / production) et **téléverser le fichier `.aab`** (pas seulement un `.apk` pour une nouvelle app).
- Fournir des **comptes de test** et les parcours reviewer dans **Accès à l’application** (sans mettre les mots de passe dans le dépôt Git).

L’upload se fait **uniquement** depuis votre compte sur [Play Console](https://play.google.com/console) — personne d’autre ne peut publier à votre place.

## 2. Prérequis sur la machine

- **JDK** (souvent 17 ou 21, selon votre Android Gradle Plugin).
- **Android SDK** avec API **35** (`compileSdk` / `targetSdk` du projet).
- Variables d’environnement usuelles : `ANDROID_HOME` (ou SDK correctement détecté par Android Studio).

## 3. Signature release (une fois)

1. Copier `frontend/android/keystore.properties.example` vers `frontend/android/keystore.properties` (fichier **non versionné**).
2. Générer un keystore d’upload (exemple, adaptez chemins et alias) :

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

3. Placer le fichier `.jks` là où l’indique `storeFile=` dans `keystore.properties`, et renseigner mots de passe + alias.
4. **Conserver une copie sécurisée** du `.jks` et des mots de passe (perte = impossibilité de mettre à jour l’app avec la même clé d’upload).

Les motifs `*.jks`, `*.keystore`, `keystore.properties` doivent rester **hors Git**.

## 4. Version et build du bundle (`.aab`)

Depuis le dossier **`frontend/`** :

```powershell
# Optionnel : forcer version avant build
$env:ANDROID_VERSION_CODE="5"
$env:ANDROID_VERSION_NAME="1.1.2"

npm run mobile:android:bundle:release
```

- **Sortie** : `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- **ID application** : `ne.amazer.app` (défini dans le projet Android).

Build alternatif (sans npm, après `npm run build:mobile:bundled && npx cap sync android`) :

```powershell
cd frontend/android
.\gradlew.bat bundleRelease
```

**APK release** (tests manuels hors Play, pas le format principal pour une nouvelle fiche) :

```powershell
cd frontend
npm run mobile:android:apk:release
```

## 5. URLs et contenu légal (fiche Play)

| Élément | URL |
|--------|-----|
| Politique de confidentialité | `https://amazerniger.vercel.app/legal/privacy` |
| Suppression de compte | `https://amazerniger.vercel.app/legal/account-deletion` |

**Support** (à indiquer sur la fiche) : `amazer.niger@gmail.com`

## 6. Textes boutique (à copier-coller dans Play Console)

**Nom** : AMAZER

**Description courte**  
Marketplace pour boutiques, restaurants et vendeurs premium.

**Description complète** (extrait — à adapter si besoin)  
AMAZER permet aux clients de découvrir des produits, commander et suivre leurs achats. Les vendeurs gèrent boutique ou restaurant, publications et commandes depuis un seul espace. Fonctions : recherche, catégories, commandes, reçu, espace vendeur, administration selon les droits ; la caméra peut servir au scan pour certaines vérifications.

## 7. Vérifications avant soumission

- L’app démarre, connexion client / vendeur / admin selon votre périmètre.
- **Data safety** : déclarer notamment compte, contact, adresses, commandes, contenus vendeur ; **caméra** si vous utilisez le scan (usage réel).
- Captures d’écran téléphone, icône, graphique fonctionnel selon les exigences Play.

## 8. CI / dépôt (optionnel)

Des workflows peuvent exister sous `.github/workflows/` pour construire ou publier avec des **secrets GitHub** (keystore encodé, compte de service Play, etc.). Consultez les fichiers du dossier et la doc Google si vous automatisez.

## 9. Rappels utiles

- Publier sur le Play Store **ne remplace pas** le site web : le mobile packagé s’appuie sur les mêmes URLs backend / site que la config du build (`frontend/scripts/build-mobile.mjs`, `.env.mobile` optionnel).
- Les **APK** installés en dehors du Play peuvent être plus signalés par Play Protect ; la distribution officielle passe par un **`.aab`** sur Play Console.

## 10. Même code : PC, APK et site en ligne

Voir **`docs/BUILD_ANDROID_ALIGNEMENT.md`** (empreinte de build, Vercel, Render, vendeur).
