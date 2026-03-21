# PLAN DE PUBLICATION PLAY STORE + APP STORE

Objectif: passer AMAZER en mode publication avec un niveau de preparation maximal (release-ready).

## Phase 1 - Preconditions produit

- Bloquer une version candidate (freeze fonctionnel).
- Verifier les flux critiques:
  - inscription / connexion
  - achat boutique + restaurant
  - livraison + recu QR
  - fallback auto recu (24h) si QR oublie
  - suppression de compte utilisateur dans l'app
- Verifier la securite:
  - suppression des secrets dev en production
  - HTTPS partout
  - sauvegardes DB + journalisation

## Phase 2 - Android (Play Store)

### Technique
- S'assurer que le projet Capacitor Android compile en release.
- Generer et signer l'AAB (`.aab`).
- Verifier permissions (camera pour QR, internet).
- Tester sur plusieurs tailles d'ecran Android.

### Console Play
- Creer/valider le compte Play Developer.
- Creer l'application `ne.amazer.app`.
- Remplir:
  - Store listing
  - Politique de confidentialite
  - Data safety
  - App content declarations
- Uploader le build AAB.
- Passer par piste de test (interne/fermee) puis production.

## Phase 3 - iOS (App Store)

### Technique
- Ajouter plateforme iOS Capacitor (`npx cap add ios`) sur macOS.
- Ouvrir Xcode, configurer:
  - bundle id
  - signing/certificats/profils
  - icones iOS, splash, permissions
- Archiver et uploader via Xcode vers App Store Connect.

### App Store Connect
- Creer la fiche app.
- Remplir metadata:
  - description
  - screenshots iPhone
  - app privacy
  - URL privacy policy
- Soumettre en review Apple.

## Phase 4 - Check "100% release-ready"

- Build Android signe + upload reussi.
- Build iOS archive + upload reussi.
- Checklists legal/policy completes:
  - privacy policy publique
  - suppression de compte in-app
  - declarations data safety/privacy exactes
- QA finale:
  - zero erreur bloquante
  - crash-free tests critiques
  - monitoring en place

## Phase 5 - Lancement et suivi

- Publication progressive (rollout).
- Monitoring 24/7 la premiere semaine:
  - crash
  - latence API
  - erreurs paiement
  - feedback utilisateurs
- Hotfix rapide si besoin.

