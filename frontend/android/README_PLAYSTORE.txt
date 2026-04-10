AMAZER — Android / Play Store (résumé professionnel)
=====================================================

1) Pourquoi Google affiche parfois « application dangereuse » ou « menace »
   - Installation d’un APK en dehors du Play Store (fichier .apk reçu par WhatsApp, etc.) :
     Play Protect analyse les applis « inconnues » plus sévèrement. C’est normal.
   - APK signé avec la clé de debug ou non publié sur Play Console : moins de confiance.
   - Solution fiable : publier sur le Play Store (piste interne / fermée / production) avec un
     bundle .aab signé avec votre clé d’upload. Les utilisateurs installent depuis Google Play :
     le message de menace disparaît en général.

2) Ce dont l’APK a besoin pour fonctionner (même sans Vercel)
   - Une API HTTPS publique (FastAPI) + une base PostgreSQL. Sans serveur accessible depuis
     Internet, l’app ne peut pas synchroniser boutiques / comptes / commandes.
   - À la compilation mobile, définir MOBILE_BACKEND_ORIGIN (voir ../.env.mobile.example).

3) Build release signée (obligatoire pour Play Store)
   - Créer upload-keystore.jks avec keytool (une seule fois ; conservez une copie sécurisée).
   - Copier keystore.properties.example vers keystore.properties et renseigner les mots de passe.
   - Lancer : npm run mobile:android:bundle:release
   - Fichier AAB : android/app/build/outputs/bundle/release/app-release.aab

4) Fichier APK release (tests ou distribution hors Play)
   - npm run mobile:android:apk:release
   - Sans keystore.properties, la release peut être signée avec une clé par défaut non adaptée
     au Play Store : configurez keystore.properties pour une signature cohérente.

5) Play Console — à prévoir
   - Politique de confidentialité (URL).
   - Formulaire « Sécurité des données » (données collectées, chiffrement, etc.).
   - Icônes, captures d’écran, fiche descriptive.
