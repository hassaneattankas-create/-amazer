/**
 * Contenu des formations AMAZER. Chaque module : un objectif, l'essentiel, un exercice concret.
 * Regle : ne decrire que ce que la plateforme fait vraiment (a mettre a jour si une fonction change).
 */

export type Module = { title: string; goal: string; points: string[]; exercise: string };
export type Course = { key: string; title: string; audience: string; modules: Module[] };

export const COURSES: Course[] = [
  {
    key: "vendre",
    title: "Vendre sur AMAZER",
    audience: "Commerçants, artisans, restaurants",
    modules: [
      {
        title: "1. Ouvrir sa boutique en 10 minutes",
        goal: "Avoir une boutique en ligne, visible et crédible.",
        points: [
          "Choisissez votre formule sur la page « Vendre », puis créez votre compte : la boutique est en ligne tout de suite, avec la période d'essai gratuite.",
          "Dans « Profil et abonnement », ajoutez un logo, une photo de couverture et une description qui dit clairement ce que vous vendez et où.",
          "Renseignez votre WhatsApp : les clients peuvent vous appeler ou vous écrire depuis chaque produit.",
          "Avant la fin de l'essai, payez l'abonnement par Nita ou Amana et saisissez la référence : AMAZER valide et vous prévient.",
        ],
        exercise: "Complétez les 4 éléments (logo, couverture, description, WhatsApp) puis ouvrez « Voir ma boutique » pour la voir comme un client.",
      },
      {
        title: "2. Des fiches produits qui font vendre",
        goal: "Donner envie et éviter les questions inutiles.",
        points: [
          "Photo : à la lumière du jour, produit net et centré, fond simple. Une photo floue fait fuir les clients.",
          "Titre : marque + produit + format. Exemple : « Riz Basmati Royal Salami 4,5 kg ».",
          "Prix exact et stock réel : un produit vendu mais absent fait perdre la confiance.",
          "Choisissez la bonne catégorie : le client vous trouve aussi en parcourant les rayons.",
        ],
        exercise: "Reprenez vos 5 produits les plus vendus et corrigez photo, titre et stock depuis l'onglet « Produits ».",
      },
      {
        title: "3. Traiter une commande pas à pas",
        goal: "Livrer vite et sans erreur.",
        points: [
          "Le client paie sur AMAZER ; AMAZER vérifie le paiement avant toute préparation. Ne préparez jamais une commande « paiement en vérification ».",
          "Onglet « Commandes » : « Préparer la commande », puis « Remise au livreur », puis la livraison est confirmée (livreur, scan du reçu ou vous).",
          "Le livreur AMAZER voit votre adresse de retrait : préparez le colis avec le numéro de commande dessus.",
          "Chaque étape prévient automatiquement le client sur le site et par e-mail.",
        ],
        exercise: "Ouvrez l'onglet « Commandes » chaque matin et traitez d'abord le filtre « À traiter ».",
      },
      {
        title: "4. Service client et avis",
        goal: "Transformer un acheteur en client fidèle.",
        points: [
          "Répondez aux messages en moins d'une heure : la rapidité rassure plus que le prix.",
          "En cas de retard, prévenez le client avant qu'il ne demande.",
          "Un produit en rupture ? Masquez-le au lieu de laisser une commande impossible.",
        ],
        exercise: "Préparez 3 réponses types (disponibilité, délai, retard) à copier-coller.",
      },
      {
        title: "5. Promotions et visibilité",
        goal: "Attirer de nouveaux clients sans brader.",
        points: [
          "Espace vendeur > Produits > Modifier : indiquez un prix promo et une durée (1 à 30 jours). Le produit s'affiche dans « Promotions » avec le prix normal barré, puis revient seul à son prix normal. Choisissez 1 ou 2 produits d'appel.",
          "Partagez le lien de votre boutique dans votre statut WhatsApp chaque semaine.",
          "Gardez une marge : une remise qui vous fait perdre de l'argent n'est pas une bonne affaire.",
        ],
        exercise: "Lancez une promotion sur un produit pendant 7 jours et comparez vos ventes avant / après.",
      },
    ],
  },
  {
    key: "revendre",
    title: "Revendre sans stock",
    audience: "Toute personne qui veut un revenu sans boutique",
    modules: [
      {
        title: "1. Le principe",
        goal: "Comprendre qui fait quoi.",
        points: [
          "Vous choisissez des produits AMAZER et fixez votre prix (au moins le prix de la boutique, au plus 3 fois).",
          "Le client paie votre prix sur AMAZER ; la boutique prépare et un livreur AMAZER livre.",
          "Vous gagnez la différence, moins la commission AMAZER, une fois la commande livrée. Un petit abonnement garde votre boutique en ligne.",
        ],
        exercise: "Ouvrez la page « Revendre » et repérez 5 produits que vos proches achètent souvent.",
      },
      {
        title: "2. Calculer un prix juste",
        goal: "Gagner de l'argent tout en restant compétitif.",
        points: [
          "Exemple : prix boutique 10 000 XOF, votre prix 11 500 XOF → marge 1 500 XOF. La page « Revendre » affiche directement ce que vous gagnez après commission.",
          "Comparez avec le marché : si votre prix est plus cher qu'au quartier, le client n'achètera pas.",
          "Mieux vaut 10 ventes avec une petite marge qu'aucune vente avec une grosse.",
        ],
        exercise: "Fixez vos prix pour 5 produits avec une marge entre 10 et 20 %.",
      },
      {
        title: "3. Trouver ses premiers clients",
        goal: "Faire ses 5 premières ventes.",
        points: [
          "Commencez par votre entourage : famille, collègues, groupes WhatsApp où les annonces sont permises.",
          "Publiez 2 ou 3 produits par jour dans votre statut, avec le prix et le lien de votre boutique.",
          "Rassurez : paiement contrôlé par AMAZER et livraison suivie.",
        ],
        exercise: "Partagez le lien de votre boutique à 20 contacts avec un message personnel.",
      },
    ],
  },
  {
    key: "affiliation",
    title: "Affiliation",
    audience: "Ambassadeurs, influenceurs, associations",
    modules: [
      {
        title: "1. Deux façons de gagner",
        goal: "Savoir ce que rapporte chaque partage.",
        points: [
          "Vous amenez un vendeur : vous touchez une part de chacun de ses abonnements pendant plusieurs mois.",
          "Vous amenez un client : vous touchez un bonus fixe pour sa première commande livrée.",
          "Les montants exacts sont affichés sur la page « Affiliation ». Vos propres achats ne comptent pas.",
        ],
        exercise: "Ouvrez la page « Affiliation » et notez votre code.",
      },
      {
        title: "2. Démarcher les commerçants",
        goal: "Amener des vendeurs qui restent.",
        points: [
          "Visez les commerces qui vendent déjà sur WhatsApp : AMAZER leur apporte paiement contrôlé, livraison et visibilité.",
          "Envoyez le « Lien pour les vendeurs » : il mène à la page des formules avec votre code.",
          "Aidez-les à mettre leurs 5 premiers produits en ligne : un vendeur actif vous rapporte chaque mois.",
        ],
        exercise: "Faites la liste de 10 commerçants de votre quartier et présentez AMAZER à 3 d'entre eux cette semaine.",
      },
    ],
  },
  {
    key: "marketing",
    title: "Vendre sur WhatsApp et les réseaux",
    audience: "Vendeurs, revendeurs, affiliés",
    modules: [
      {
        title: "1. WhatsApp Business",
        goal: "Utiliser WhatsApp comme un vrai outil de vente.",
        points: [
          "Installez l'application gratuite WhatsApp Business (différente de WhatsApp classique) et remplissez le profil : horaires, adresse, description.",
          "Créez un catalogue avec vos meilleurs produits et un message d'accueil automatique.",
          "Utilisez les réponses rapides pour les questions fréquentes.",
        ],
        exercise: "Configurez le message d'accueil et 3 réponses rapides (voir les guides officiels WhatsApp Business plus bas).",
      },
      {
        title: "2. Photos et vidéos au téléphone",
        goal: "Montrer le produit comme en vrai.",
        points: [
          "Lumière du jour près d'une fenêtre, jamais de flash direct.",
          "Une vidéo de 10 à 15 secondes qui tourne autour du produit vaut mieux qu'un long texte.",
          "Montrez la taille réelle (dans la main, à côté d'un objet connu).",
        ],
        exercise: "Filmez une vidéo de 15 secondes de votre meilleur produit et publiez-la en statut avec le lien.",
      },
      {
        title: "3. Facebook et TikTok",
        goal: "Toucher des clients hors de votre entourage.",
        points: [
          "Publiez régulièrement plutôt que beaucoup d'un coup : 3 à 4 publications par semaine.",
          "Répondez à chaque commentaire : c'est ce qui fait remonter la publication.",
          "Mettez toujours le lien AMAZER : le client paie de façon sécurisée.",
        ],
        exercise: "Planifiez vos publications de la semaine (1 produit par jour, du lundi au jeudi).",
      },
    ],
  },
  {
    key: "securite",
    title: "Confiance et sécurité",
    audience: "Tout le monde",
    modules: [
      {
        title: "1. Éviter les arnaques",
        goal: "Ne jamais perdre d'argent.",
        points: [
          "Payez et faites payer uniquement sur AMAZER : un paiement direct ou une livraison hors AMAZER n'est pas protégé (voir les Conditions d'utilisation).",
          "AMAZER ne demande jamais votre code secret Nita ou Amana, ni par SMS ni par appel.",
          "À la livraison, le livreur AMAZER scanne le QR code du reçu : c'est la preuve que la commande est bien remise.",
        ],
        exercise: "Une fois le paiement confirmé, ouvrez votre reçu : le QR code y apparaît. Gardez-le jusqu'à la livraison.",
      },
      {
        title: "2. Protéger son compte",
        goal: "Garder le contrôle de sa boutique et de ses gains.",
        points: [
          "Un mot de passe unique, avec majuscule, chiffre et caractère spécial.",
          "Ajoutez votre e-mail dans votre « Tableau de bord » : vous recevez les notifications et pouvez récupérer l'accès.",
          "Ne partagez jamais vos identifiants, même avec un employé : créez-lui son propre compte.",
        ],
        exercise: "Vérifiez dans votre « Tableau de bord » que votre e-mail et votre WhatsApp sont bien renseignés.",
      },
    ],
  },
];

/** Ressources externes gratuites, en francais, verifiees le 2026-10-15 (titre et lien controles). */
export const RESOURCES: { title: string; provider: string; text: string; href: string }[] = [
  {
    title: "Les principes fondamentaux du marketing digital",
    provider: "Google (Skillshop)",
    text: "Le cours de référence de Google pour débuter : présence en ligne, réseaux sociaux, publicité, e-commerce.",
    href: "https://skillshop.exceedlms.com/student/collection/1830723?locale=fr",
  },
  {
    title: "Cours business gratuits",
    provider: "Google Ateliers Numériques",
    text: "Catalogue de formations courtes pour développer son activité avec le numérique.",
    href: "https://grow.google/intl/fr_fr/courses-and-tools/?category=business&type=online-courses",
  },
  {
    title: "Accélérer mon business avec l'IA (vidéos)",
    provider: "Google Ateliers Numériques",
    text: "Série de vidéos pour utiliser l'IA dans son commerce : textes, visuels, idées.",
    href: "https://www.youtube.com/playlist?list=PLvHZurC3Swd9Z-40akxlJ53jnsjwQFmam",
  },
  {
    title: "Initiez-vous au marketing digital",
    provider: "OpenClassrooms",
    text: "Cours pour débutants (environ 10 h) : définir sa cible, son plan d'action et mesurer ses résultats.",
    href: "https://openclassrooms.com/fr/courses/3013816-initiez-vous-au-marketing-digital",
  },
  {
    title: "Bien démarrer avec l'application WhatsApp Business",
    provider: "WhatsApp (guide officiel)",
    text: "Profil, message d'accueil, organisation : les bases pour vendre sur WhatsApp.",
    href: "https://whatsappbusiness.com/fr/resources/resource-library/onboarding-success-whatsapp-business-app/",
  },
  {
    title: "Notes et catalogue WhatsApp Business",
    provider: "WhatsApp (guide officiel)",
    text: "Présenter ses produits dans un catalogue et personnaliser le suivi de chaque client.",
    href: "https://whatsappbusiness.com/fr/resources/resource-library/personalized-customer-interactions-notes-catalog-whatsapp/",
  },
  {
    title: "HubSpot Academy",
    provider: "HubSpot",
    text: "Cours gratuits en français sur le marketing, la vente et le service client, avec certifications.",
    href: "https://academy.hubspot.fr/",
  },
  {
    title: "MOOC entrepreneuriat",
    provider: "FUN MOOC (universités françaises)",
    text: "Cours en ligne gratuits pour créer et gérer une entreprise.",
    href: "https://www.fun-mooc.fr/fr/cours/?q=entrepreneuriat",
  },
  {
    title: "Programme d'entrepreneuriat TEF",
    provider: "Fondation Tony Elumelu (TEFConnect)",
    text: "Pour les entrepreneurs africains : formation en gestion d'entreprise, mentorat et appels à candidatures pour un financement.",
    href: "https://tefconnect.com/",
  },
  {
    title: "Meta Blueprint",
    provider: "Meta (Facebook, Instagram)",
    text: "Cours gratuits pour vendre et faire de la publicité sur Facebook et Instagram (une partie en anglais).",
    href: "https://www.facebookblueprint.com/student/catalog",
  },
];
