# Guide Utilisateur AMAZER

Date de reference: 2026-04-01

## Vue d'ensemble

AMAZER regroupe plusieurs parcours:

- client
- vendeur boutique
- vendeur restaurant
- vendeur premium
- administrateur

Etat public actuel:

- site principal en ligne: `https://amazerniger.vercel.app`
- backend en ligne: `https://amazer-api.onrender.com`
- usage public recommande: partager `https://amazerniger.vercel.app`

Liens utiles:

- site: `https://amazerniger.vercel.app`
- boutiques: `https://amazerniger.vercel.app/boutiques`
- restaurant: `https://amazerniger.vercel.app/restaurant`
- espace vendeur: `https://amazerniger.vercel.app/seller`
- dashboard vendeur: `https://amazerniger.vercel.app/seller/dashboard`
- connexion: `https://amazerniger.vercel.app/login`
- inscription: `https://amazerniger.vercel.app/register`

## Guide client

### Creer un compte

1. Aller sur la page d'inscription
2. Saisir nom complet, e-mail ou WhatsApp, puis mot de passe
3. Valider le code de verification si demande
4. Se connecter

### Acheter un produit

1. Ouvrir `Boutiques`
2. Choisir une boutique
3. Ajouter les produits au panier
4. Ouvrir le panier
5. Choisir le paiement
6. Confirmer la commande

### Commander au restaurant

1. Ouvrir `Restaurant`
2. Choisir un restaurant
3. Ajouter les plats ou boissons
4. Renseigner adresse et paiement
5. Envoyer la commande

### Reserver

- reservation de table: depuis le restaurant si l'option est active
- reservation premium ou hotel: depuis la boutique premium si les chambres sont configurees

## Guide vendeur

### Creer un compte vendeur

1. Aller sur `Connexion`
2. Cliquer sur `devenir vendeur`
3. Choisir le type:
   - Boutique
   - Restaurant
   - Premium
4. Saisir le nom de boutique et les informations du compte
5. Valider l'inscription
6. Apres creation, redirection automatique vers le dashboard vendeur

### Ce que chaque type peut faire

#### Boutique

- ajouter un produit
- modifier prix et stock
- retirer ou republier un produit
- appliquer une promo
- lancer un boost 24h ou 7 jours

#### Restaurant

- ajouter un plat ou une boisson
- retirer ou remettre un plat au menu
- suivre les commandes
- changer le statut des commandes
- gerer les reservations de table si activees

#### Premium

- toutes les fonctions boutique
- toutes les fonctions restaurant
- suivi des reservations restaurant
- suivi des reservations hotel si les chambres sont configurees

### Configurer le profil vendeur

Le dashboard sert a l'exploitation quotidienne.  
Pour la configuration complete du profil, ouvrir `Espace vendeur`.

Depuis cette page on peut regler:

- nom commercial
- ville
- telephone
- adresse
- type d'activite
- logo
- couverture
- horaires
- WhatsApp contact
- e-mail contact

Pour le premium:

- galerie
- services
- chambres
- acompte
- reservations de table
- reservations hotel

### Utiliser le dashboard vendeur

Le dashboard permet maintenant:

- `Ajouter un produit`
- `Ajouter un plat ou une boisson`
- `Menu publie` pour retirer ou remettre un plat
- `Commandes restaurant`
- `Reservations restaurant`
- `Reservations hotel`
- `Catalogue produits` pour prix, stock, promo, publication et boost

## Guide administrateur

1. Se connecter avec le compte admin
2. L'application redirige vers `/admin`
3. Utiliser les pages admin pour le contenu, les tarifs, la finance et le suivi

### Verification admin finance

Pour les pages finance, tarifs et utilisateurs:

1. saisir le PIN admin
2. saisir la cle secondaire
3. valider

Informations actuelles:

- compte admin: `Amazer.niger@gmail.com`
- PIN finance: `7391`
- cle secondaire: `07/11/03`

Si plusieurs essais echouent d'affilee, attendre quelques minutes avant de recommencer, car la verification est limitee pour la securite.

## Questions frequentes

### Je suis vendeur et je n'accede pas au dashboard

- verifier la connexion
- verifier qu'un profil vendeur existe
- sinon ouvrir `/seller`

### Je suis boutique et rien n'apparait

- ajouter un premier produit
- verifier un stock strictement superieur a 0

### Je suis restaurant et je ne vois pas les reservations

- verifier que `reservation de table` est activee dans le profil vendeur

### Je suis premium et je ne vois pas les reservations hotel

- verifier que les chambres sont configurees
- verifier que `reservations hotel` est active

## Play Store

Publier l’app sur le Play Store ne remplace pas le site web ; web et mobile peuvent partager la même API. Tout le détail (build `.aab`, signature, fiche, URLs) est dans **`docs/AMAZER_PUBLICATION_PLAY_STORE.md`**.

## Exploitation quotidienne

### Lien a partager

Le lien officiel a partager aux clients, vendeurs et partenaires est:

- `https://amazerniger.vercel.app`

### Controle rapide chaque jour

1. ouvrir la home
2. verifier les boutiques
3. verifier les produits
4. verifier la connexion admin
5. verifier Render:
   - `https://amazer-api.onrender.com/health`
   - `https://amazer-api.onrender.com/api/v1/auth/health`
