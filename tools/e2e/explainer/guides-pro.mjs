// Guides : revendeurs, affiliés, pharmacies.
import * as P from "./personas.mjs";
import { GUIDES, TXT, g } from "./guides-data.mjs";

// ---------------------------------------------------------------- Revendeur
GUIDES.revendeur = {
  who: "Revendeurs",
  title: "Revendre sans stock",
  subtitle: "Choisir, fixer son prix, partager, encaisser",
  video: "AMAZER_guide-revendeur.mp4",
  pdf: "AMAZER-Guide-revendeur.pdf",
  lead: "Vous vendez les produits des boutiques AMAZER **sans acheter de stock**. La boutique prépare, AMAZER livre, et vous gardez **votre marge**.",
  points: [
    ["Choisir", "Vous prenez des produits AMAZER que vous aimez."],
    ["Partager", "Vous fixez votre prix et partagez votre lien."],
    ["Encaisser", "AMAZER vous verse votre marge après la livraison."],
  ],
  intro: "Vous voulez gagner de l'argent sans acheter de stock ? Avec AMAZER, vous revendez les produits des boutiques et vous gardez la marge. Voici comment.",
  outro: "Choisissez, partagez, encaissez. Commencez aujourd'hui sur amazer.store, page Revendre.",
  end: ["À vous de vendre !", "amazer.store · Revendre sans stock"],
  chapters: [
    {
      title: "Bien démarrer",
      intro: "Créez d'abord votre compte AMAZER gratuit, puis ouvrez **Revendre sans stock** dans le menu.",
      persona: () => ({ ...P.revendeur }),
      route: "/revendre",
      scenes: [
        { say: "Ouvrez la page Revendre sans stock. Tout tient en quatre étapes : choisir des produits, fixer votre prix, partager votre lien, et encaisser votre marge.",
          do: (f) => f.point("Revendez sans stock", { selector: "h1" }), guide: g("Ouvrez la page Revendre", "Dans le menu, touchez **Revendre sans stock**. La page résume les **4 étapes**.") },
        { say: "Pour revendre, votre abonnement doit être actif. Choisissez Nita ou Amana, envoyez le montant indiqué, puis écrivez la référence du paiement.",
          do: (f) => f.point("Nita Transfert"), guide: g("Activez votre abonnement", "Choisissez **Nita Transfert** ou **Amana Transfert**, envoyez le montant affiché, puis écrivez la **référence du paiement**. AMAZER vérifie et active votre compte.") },
      ],
    },
    {
      title: "Choisir des produits et fixer son prix",
      persona: () => ({ ...P.revendeur }),
      route: "/revendre",
      scenes: [
        { say: "Descendez jusqu'à Choisir des produits à revendre. Cherchez un produit par son nom.",
          do: (f) => f.type("Riz, téléphone, savon", "parfum"), guide: g("Cherchez un produit", "Dans **Choisir des produits à revendre**, écrivez le nom d'un produit.") },
        { say: "Chaque produit montre le prix de la boutique et ce que vous gagnez. Écrivez votre prix de revente, puis touchez Revendre.",
          do: (f) => f.point("Revendre", { selector: "button" }), guide: g("Fixez votre prix", "Sous chaque produit : le **prix boutique** et **ce que vous gagnez**. Écrivez **Mon prix de revente**, puis touchez **Revendre**.", "Votre gain = votre prix moins le prix de la boutique.") },
        { say: "Vos produits apparaissent dans Mes produits. Vous pouvez changer le prix, masquer un produit, ou le retirer.",
          do: (f) => f.point("Mes produits", TXT), guide: g("Gérez vos produits", "Dans **Mes produits** : changez le prix, **Masquer** ou **Retirer** un produit à tout moment.") },
      ],
    },
    {
      title: "Partager et encaisser",
      persona: () => ({ ...P.revendeur }),
      route: "/revendre",
      scenes: [
        { say: "Votre boutique a son propre lien. Copiez-le, ou partagez-le directement sur WhatsApp.",
          do: async (f) => { await f.point("Copier le lien"); await f.point("Partager sur WhatsApp"); }, guide: g("Partagez votre boutique", "Touchez **Copier le lien** ou **Partager sur WhatsApp**. Vos clients voient vos produits à vos prix.") },
        { say: "Quand un client commande, la boutique prépare et AMAZER livre. Vous n'avez rien à transporter.",
          do: (f) => f.point("Voir ma boutique"), guide: g("Laissez faire AMAZER", "Le client paie AMAZER, la boutique prépare, **AMAZER livre**. Vérifiez votre boutique avec **Voir ma boutique**.") },
        { say: "Ici, vous suivez vos gains : ce qui est gagné, déjà reçu, et en attente de livraison. AMAZER vous verse votre marge par Nita ou Amana.",
          do: (f) => f.point("Gagné net", TXT), guide: g("Suivez vos gains", "**Gagné net**, **Déjà reçu**, **à recevoir** et **En attente de livraison** : tout est affiché. AMAZER vous paie par Nita ou Amana après livraison.") },
      ],
    },
  ],
  tips: [
    "Choisissez des produits que **vos proches achètent déjà**.",
    "Gardez une **petite marge** : un prix juste se vend plus vite.",
    "Publiez chaque jour une vraie photo, le prix et votre lien sur votre **statut WhatsApp**.",
    "Répondez vite : le client qui attend achète ailleurs.",
    "Suivez les **Formations gratuites** sur amazer.store.",
  ],
  faq: [
    ["Dois-je acheter les produits ?", "Non. Vous ne payez rien à la boutique : le client paie AMAZER, et vous recevez votre marge après la livraison."],
    ["Quand suis-je payé ?", "Après la livraison de la commande, par Nita ou Amana. Vous êtes prévenu à chaque versement."],
    ["Puis-je changer mon prix ?", "Oui, à tout moment, dans **Mes produits**."],
  ],
};

// ---------------------------------------------------------------- Affilié
GUIDES.affilie = {
  who: "Affiliés",
  title: "Gagner avec l'affiliation",
  subtitle: "Partager un lien, gagner sur chaque inscription",
  video: "AMAZER_guide-affilie.mp4",
  pdf: "AMAZER-Guide-affilie.pdf",
  lead: "Faites connaître AMAZER et gagnez de l'argent. C'est **gratuit**, sans stock et sans abonnement.",
  points: [
    ["Partager", "Vous partagez votre lien personnel."],
    ["Amener", "Des vendeurs et des clients s'inscrivent avec votre lien."],
    ["Gagner", "Vous touchez une part des abonnements et un bonus par client."],
  ],
  intro: "Avec l'affiliation AMAZER, vous gagnez de l'argent en faisant connaître la plateforme. C'est gratuit. Voici comment ça marche.",
  outro: "Partagez votre lien, aidez les commerçants, et gagnez avec AMAZER.",
  end: ["Partagez et gagnez", "amazer.store · Affiliation"],
  chapters: [
    {
      title: "Comprendre ce que vous gagnez",
      intro: "Ouvrez **Affiliation** dans le menu. L'inscription se fait avec votre compte AMAZER.",
      persona: () => ({ ...P.affilie }),
      route: "/affiliation",
      scenes: [
        { say: "Ouvrez la page Affiliation. Vous gagnez de deux façons.",
          do: (f) => f.point("Programme d'affiliation", { selector: "h1" }), guide: g("Ouvrez la page Affiliation", "Dans le menu, touchez **Affiliation**. Tout est expliqué en haut de la page.") },
        { say: "Quand vous amenez un vendeur, vous touchez une part de chacun de ses abonnements, pendant des mois. Quand vous amenez un client, vous touchez un bonus sur sa première commande livrée.",
          do: (f) => f.point("Vous amenez un vendeur", TXT), guide: g("Deux façons de gagner", "**Vous amenez un vendeur** : une part de ses abonnements. **Vous amenez un client** : un bonus sur sa 1re commande livrée. Les montants exacts sont affichés sur la page.") },
      ],
    },
    {
      title: "Partager votre lien",
      persona: () => ({ ...P.affilie }),
      route: "/affiliation",
      scenes: [
        { say: "Votre code et votre lien sont ici. Touchez Copier mon lien, ou partagez-le sur WhatsApp.",
          do: (f) => f.click("Copier mon lien"), guide: g("Copiez votre lien", "Votre **code** et votre **lien** sont personnels. Touchez **Copier mon lien** ou **Partager sur WhatsApp**.") },
        { say: "Pour un commerçant, utilisez le lien pour les vendeurs. Il arrive directement sur l'inscription des boutiques.",
          do: (f) => f.point("Lien pour les vendeurs"), guide: g("Un lien pour les vendeurs", "**Lien pour les vendeurs** mène le commerçant droit à la création de sa boutique.") },
        { say: "La page vous donne aussi des arguments vrais et des messages prêts à envoyer, avec votre lien déjà dedans.",
          do: (f) => f.point("Messages prêts à envoyer", TXT), guide: g("Utilisez les messages prêts", "**Quoi dire aux vendeurs** : les arguments et des **messages prêts à envoyer**. Touchez **Copier** ou **Envoyer sur WhatsApp**.") },
      ],
    },
    {
      title: "Recevoir votre argent",
      persona: () => ({ ...P.affilie }),
      route: "/affiliation",
      scenes: [
        { say: "Vos gains sont classés : disponible, en attente, et déjà payé. Un gain devient disponible après la livraison et une période de sécurité.",
          do: (f) => f.point("Disponible", TXT), guide: g("Suivez vos gains", "**Disponible** : vous pouvez le retirer. **En attente** : livraison en cours puis période de sécurité. **Déjà payé** : ce que vous avez reçu.") },
        { say: "Pour être payé, choisissez Nita, Amana, Airtel Money ou Moov Money, écrivez le numéro qui reçoit l'argent, puis touchez Demander le paiement.",
          do: (f) => f.point("Demander le paiement"), guide: g("Demandez le paiement", "Choisissez le **moyen de paiement**, écrivez **le numéro qui reçoit l'argent**, puis touchez **Demander le paiement**. Un minimum de retrait est indiqué.") },
      ],
    },
  ],
  tips: [
    "Allez voir les commerçants : aidez-les à publier leurs **5 premiers produits** avec de belles photos.",
    "Partagez votre lien sur votre **statut WhatsApp** et dans vos groupes.",
    "Sur chaque produit, le bouton **Partager et gagner** crée un lien avec votre code.",
    "Dites la vérité sur AMAZER : la confiance fait vendre.",
  ],
  faq: [
    ["Combien de temps mon lien compte-t-il ?", "La personne doit s'inscrire ou commander via votre lien dans les **30 jours**."],
    ["Pourquoi un gain est en attente ?", "Il attend la livraison de la commande, puis une période de sécurité, avant de devenir disponible."],
    ["Faut-il payer pour être affilié ?", "Non, c'est gratuit."],
  ],
};

// ---------------------------------------------------------------- Pharmacie
GUIDES.pharmacie = {
  who: "Pharmacies",
  title: "Votre pharmacie sur AMAZER",
  subtitle: "Gardes, position, livraison",
  video: "AMAZER_guide-pharmacie.mp4",
  pdf: "AMAZER-Guide-pharmacie.pdf",
  lead: "Les habitants cherchent une **pharmacie de garde** la nuit et le week-end. Avec AMAZER, ils vous trouvent, vous appellent et viennent jusqu'à vous.",
  points: [
    ["Être trouvé", "Votre pharmacie apparaît dans la liste de votre ville."],
    ["Annoncer la garde", "Vous programmez vos gardes en un geste."],
    ["Guider", "Votre position Google Maps amène les clients à votre porte."],
  ],
  intro: "Vous êtes pharmacien ? Voici comment les clients trouvent les pharmacies de garde sur AMAZER, et comment tenir votre pharmacie à jour.",
  outro: "Programmez vos gardes, gardez votre position à jour : les clients vous trouvent. Rendez-vous sur amazer.store.",
  end: ["Votre pharmacie, trouvée", "amazer.store · Pharmacies"],
  chapters: [
    {
      title: "Ce que voient les clients",
      intro: "La page **Pharmacies** est publique : tout le monde peut l'ouvrir, même sans compte.",
      persona: () => ({ ...P.pharmaClient }),
      route: "/pharmacies",
      scenes: [
        { say: "Le client ouvre la page Pharmacies. Il choisit sa ville, ou touche Près de moi.",
          do: (f) => f.point("Près de moi"), guide: g("La page Pharmacies", "Le client choisit sa **ville** ou touche **Près de moi**.") },
        { say: "Les pharmacies de garde apparaissent en tête. Le client peut appeler, ouvrir l'itinéraire, ou se faire livrer par AMAZER.",
          do: (f) => f.point("Itinéraire"), guide: g("Appeler, venir, se faire livrer", "Pour chaque pharmacie : **Appeler**, **Itinéraire** (Google Maps), et **Se faire livrer par AMAZER** dans les villes desservies.") },
      ],
    },
    {
      title: "Tenir votre pharmacie à jour",
      intro: "Votre compte doit être activé comme **pharmacie** par l'équipe AMAZER. Ensuite, tout se passe dans **Espace vendeur**.",
      persona: () => ({ ...P.pharmacie }),
      route: "/seller/dashboard#accueil",
      scenes: [
        { say: "Dans votre Espace vendeur, la carte Ma garde montre votre état. De garde, vous apparaissez en tête de la page Pharmacies.",
          do: (f) => f.point("Ma garde", TXT), guide: g("Votre garde", "Dans **Espace vendeur**, la carte **Ma garde** montre si vous êtes **de garde**. De garde, vous êtes en tête de liste.") },
        { say: "Pour programmer une garde, choisissez la date de début et la date de fin, puis touchez Programmer. Elle démarre et s'arrête toute seule.",
          do: (f) => f.point("Programmer", { selector: "button" }), guide: g("Programmez une garde", "Choisissez **Du** et **Au**, puis touchez **Programmer**. La garde s'active et s'arrête **toute seule** (31 jours au plus).") },
        { say: "Placez-vous dans la pharmacie et touchez Mettre à jour ma position. Le bouton Itinéraire mènera les clients jusqu'à vous.",
          do: (f) => f.point("Mettre à jour ma position"), guide: g("Enregistrez votre position", "Dans la pharmacie, touchez **Mettre à jour ma position**. Vérifiez avec **Voir sur Google Maps**.") },
      ],
    },
  ],
  tips: [
    "Programmez **toutes vos gardes du mois** d'un coup.",
    "Enregistrez votre position **depuis l'intérieur** de la pharmacie.",
    "Gardez votre numéro de téléphone à jour dans **Profil et abonnement**.",
    "AMAZER ne vend pas de médicaments : le client vous appelle ou vient chez vous.",
  ],
  faq: [
    ["Comment inscrire ma pharmacie ?", "Créez un compte AMAZER gratuit, puis contactez l'équipe AMAZER pour activer votre compte pharmacie."],
    ["Ma garde est finie, que faire ?", "Rien : elle s'arrête toute seule à la date de fin."],
  ],
};
