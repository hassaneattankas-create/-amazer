// Guides : clients, boutiques, restaurants, hôtels, transport.
import * as P from "./personas.mjs";
import { GUIDES, TXT, g } from "./guides-data.mjs";
import { wait } from "./lib.mjs";

const PRODUCT = "/product?id=710892d6-a515-4027-bdcc-7ddcd0a66d1c";
/** Prépare un panier (hors image) puis ouvre la page panier. */
const withCart = async (f) => {
  await f.goto(PRODUCT);
  await f.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Ajouter au panier")?.click());
  await wait(1200);
  await f.goto("/cart");
};

// ---------------------------------------------------------------- Client
GUIDES.client = {
  who: "Clients",
  title: "Acheter sur AMAZER",
  subtitle: "Trouver, commander, payer, recevoir",
  video: "AMAZER_guide-client.mp4",
  pdf: "AMAZER-Guide-client.pdf",
  lead: "Sur AMAZER, vous achetez auprès de **boutiques vérifiées**, vous payez par **Nita ou Amana**, et un **livreur AMAZER** vous apporte la commande.",
  points: [
    ["Trouver", "Cherchez un produit, une boutique ou un service."],
    ["Commander et payer", "Votre paiement est vérifié par AMAZER."],
    ["Recevoir", "Suivez la livraison et confirmez la réception."],
  ],
  intro: "Bienvenue sur AMAZER ! Voici comment trouver un produit, le commander, le payer, et le recevoir chez vous.",
  outro: "Trouvez, commandez, recevez. Faites vos achats en confiance sur amazer.store.",
  end: ["Bons achats !", "amazer.store"],
  chapters: [
    {
      title: "Trouver un produit",
      intro: "Ouvrez **amazer.store** dans le navigateur de votre téléphone, ou installez l'application.",
      persona: () => ({ ...P.client }),
      route: "/",
      scenes: [
        { say: "Sur la page d'accueil, écrivez ce que vous cherchez : un produit, une marque, ou une catégorie.",
          do: (f) => f.point("Rechercher un produit", { selector: "input" }), guide: g("Cherchez", "Écrivez dans la barre **Rechercher un produit, une marque ou une catégorie**.") },
        { say: "Vous pouvez aussi parcourir les catégories, les promotions, les restaurants, les pharmacies et les stations-essence.",
          do: (f) => f.point("Pharmacies", { selector: "a" }), guide: g("Parcourez", "Touchez une **catégorie** : Essence, Pharmacies, Restaurants, Premium, Bonnes affaires…") },
        { say: "Touchez un produit pour voir sa fiche : la photo, le prix, et la boutique qui le vend.",
          before: (f) => f.goto(PRODUCT), do: (f) => f.point("Vendu par", TXT), guide: g("Ouvrez la fiche produit", "La fiche montre la **photo**, le **prix**, le **stock** et la **boutique**. Vous pouvez **Appeler** ou écrire sur **WhatsApp** au vendeur.") },
        { say: "Touchez Ajouter au panier. Ou Acheter maintenant, pour aller plus vite.",
          do: (f) => f.click("Ajouter au panier"), guide: g("Ajoutez au panier", "Touchez **Ajouter au panier**, ou **Acheter maintenant** pour commander tout de suite.") },
      ],
    },
    {
      title: "Commander",
      intro: "Pour commander, connectez-vous à votre compte AMAZER (gratuit).",
      persona: () => ({ ...P.client }),
      route: "/cart",
      scenes: [
        { say: "Dans le panier, vérifiez vos articles et la quantité. Choisissez la livraison standard, ou express à Niamey.",
          before: withCart, do: (f) => f.point("Standard"), guide: g("Vérifiez le panier", "Vérifiez les **articles** et la **quantité**. Choisissez **Standard** ou **Express Niamey**.") },
        { say: "Écrivez l'adresse de livraison, avec un repère, et le téléphone pour le livreur.",
          do: async (f) => { await f.type("Quartier, rue, repère", "Plateau, près de la pharmacie"); await f.type("+227 90 00 00 00", "90000000"); }, guide: g("Donnez l'adresse", "Écrivez le **quartier**, la **rue** et un **repère**, puis le **téléphone pour le livreur**.") },
        { say: "Choisissez votre moyen de paiement. Le récapitulatif montre le total exact, livraison comprise. Puis touchez Commander.",
          do: async (f) => { await f.point("Nita Transfert"); await f.click("Commander", { selector: "button" }); }, guide: g("Commandez", "Choisissez **Nita Transfert** ou **Amana Transfert**, vérifiez le **Total**, puis touchez **Commander**.") },
      ],
    },
    {
      title: "Payer et recevoir",
      intro: "AMAZER vérifie chaque paiement **avant** que la boutique prépare votre commande.",
      persona: () => ({ ...P.client }),
      route: "/order/pay?id=c9",
      scenes: [
        { say: "Pour payer, suivez les trois étapes. Un : envoyez le montant au numéro affiché.",
          do: (f) => f.point("Envoyez l'argent", TXT), guide: g("1. Envoyez l'argent", "Envoyez **le montant exact** au **numéro affiché**. Touchez **Copier** pour ne pas vous tromper.") },
        { say: "Deux : écrivez ce motif dans votre transfert. Il permet de retrouver votre commande.",
          do: (f) => f.point("Motif du paiement", TXT), guide: g("2. Indiquez le motif", "Écrivez ce **motif** dans votre transfert : c'est lui qui relie le paiement à votre commande.") },
        { say: "Trois : touchez J'ai payé. AMAZER vérifie, puis confirme votre commande.",
          do: (f) => f.point("J'ai payé"), guide: g("3. Confirmez", "Touchez **J'ai payé**. AMAZER vérifie le paiement et confirme votre commande.") },
        { say: "Dans votre compte, suivez chaque commande : préparation, livraison, puis réception. Quand vous l'avez, touchez J'ai reçu ma commande.",
          before: (f) => f.goto("/dashboard"), do: (f) => f.point("J'ai reçu ma commande"), guide: g("Suivez et confirmez", "Dans **Mon compte**, suivez **Commande → Préparation → En livraison → Reçue**. À la réception, touchez **J'ai reçu ma commande**.", "Ne payez jamais le livreur : la commande est déjà payée.") },
      ],
    },
  ],
  tips: [
    "Payez **toujours sur AMAZER** et faites-vous livrer par un **livreur AMAZER** : vous êtes protégé.",
    "Écrivez une adresse **avec un repère** (mosquée, pharmacie, école…).",
    "Gardez votre téléphone allumé : le livreur peut vous appeler.",
    "Après la livraison, donnez votre **avis** : il aide les autres clients.",
  ],
  faq: [
    ["Comment créer un compte ?", "Touchez **Se connecter**, puis créez votre compte avec votre e-mail ou votre numéro. C'est gratuit."],
    ["Je n'ai pas reçu ma commande ?", "Ouvrez **Mon compte** pour voir où elle en est, ou écrivez à AMAZER depuis votre compte."],
    ["Puis-je acheter dans plusieurs boutiques ?", "Oui. Le panier regroupe tout ; la livraison est comptée par boutique."],
  ],
};

// ---------------------------------------------------------------- Boutique
GUIDES.boutique = {
  who: "Vendeurs · Boutiques",
  title: "Vendre avec votre boutique",
  subtitle: "Créer, publier, préparer, encaisser",
  video: "AMAZER_guide-boutique.mp4",
  pdf: "AMAZER-Guide-boutique.pdf",
  lead: "Ouvrez votre **boutique en ligne** depuis votre téléphone. Le client paie avant, **AMAZER vérifie** le paiement et **livre** vos commandes.",
  points: [
    ["Créer", "Votre boutique est en ligne tout de suite."],
    ["Publier", "Ajoutez vos produits avec photo, prix et stock."],
    ["Préparer", "Préparez les commandes payées : AMAZER livre."],
  ],
  intro: "Vous avez des produits à vendre ? Voici comment ouvrir votre boutique sur AMAZER, publier vos produits et gérer vos commandes.",
  outro: "Créez votre boutique, publiez vos produits, AMAZER livre. Lancez-vous sur amazer.store, page Devenir vendeur.",
  end: ["Votre boutique en ligne", "amazer.store · Devenir vendeur"],
  chapters: [
    {
      title: "Créer votre boutique",
      intro: "Dans le menu, touchez **Devenir vendeur**.",
      persona: () => ({ ...P.visiteur }),
      route: "/vendre",
      scenes: [
        { say: "Ouvrez la page Devenir vendeur. Vous créez votre boutique, elle est en ligne tout de suite.",
          do: (f) => f.point("Vendez sur AMAZER", { selector: "h1" }), guide: g("Ouvrez Devenir vendeur", "Dans le menu, touchez **Devenir vendeur**. La création ne prend que quelques minutes.") },
        { say: "Choisissez votre formule : Boutique pour les commerces, Restaurant, ou Premium pour les hôtels, le transport et les entreprises.",
          do: (f) => f.point("Choisir Boutique"), guide: g("Choisissez votre formule", "**Boutique**, **Restaurant** ou **Premium** : touchez **Choisir** sous la formule qui vous convient.") },
        { say: "Bon à savoir : vous recevez le prix entier de vos articles. Les frais AMAZER sont payés par le client.",
          do: (f) => f.point("Frais transparents", TXT), guide: g("Des frais clairs", "Vous recevez **le prix entier** de vos articles : la commission et les frais AMAZER sont **payés par le client**.") },
      ],
    },
    {
      title: "Publier vos produits",
      intro: "Tout se passe dans votre **Espace vendeur**.",
      persona: () => ({ ...P.boutique }),
      route: "/seller/dashboard#accueil",
      scenes: [
        { say: "Voici votre Espace vendeur. En haut : les commandes à préparer, vos ventes, vos produits en ligne, et le stock faible.",
          do: (f) => f.point("À préparer", TXT), guide: g("Votre Espace vendeur", "L'**Accueil** résume tout : **À préparer**, **Ventes sur 30 jours**, **Produits en ligne**, **Stock faible**.") },
        { say: "Pour ajouter un produit, touchez Ajouter un produit.",
          do: (f) => f.click("Ajouter un produit"), guide: g("Ajoutez un produit", "Touchez **Ajouter un produit** (ou la section **Ajouter un produit**).") },
        { say: "Écrivez le nom du produit, son prix et le stock disponible.",
          do: async (f) => { await f.type("Nom du produit", "Sac à main en cuir"); await f.type("Prix (XOF)", "12500"); await f.type("Stock", "10"); }, guide: g("Nom, prix, stock", "Remplissez **Nom du produit**, **Prix (XOF)** et **Stock**. La marque et la description sont facultatives.") },
        { say: "Ajoutez une belle photo, depuis la galerie ou l'appareil photo. Puis touchez Ajouter au catalogue.",
          do: async (f) => { await f.point("Prendre une photo", { selector: "label" }); await f.point("Ajouter au catalogue"); }, guide: g("Photo, puis publiez", "Choisissez une **photo** ou **Prendre une photo**, puis touchez **Ajouter au catalogue**.", "Une photo nette, à la lumière du jour, sur fond simple, fait vendre.") },
      ],
    },
    {
      title: "Gérer produits et commandes",
      persona: () => ({ ...P.boutique }),
      route: "/seller/dashboard#produits",
      scenes: [
        { say: "Dans Produits, retrouvez tout votre catalogue. Touchez un produit pour changer son prix, son stock, ou lancer une promotion.",
          do: (f) => f.click("Modifier Pagne wax 6 yards", { selector: "button" }), guide: g("Modifiez un produit", "Dans **Produits**, touchez un article pour changer **prix**, **stock**, le **masquer** ou créer une **promotion**.") },
        { say: "Dans Commandes, vous voyez les commandes déjà payées. Touchez Préparer la commande : un livreur AMAZER viendra la chercher.",
          before: (f) => f.goto("/seller/dashboard#commandes"), do: (f) => f.point("Préparer la commande"), guide: g("Préparez les commandes", "Dans **Commandes**, les commandes **payées** attendent. Touchez **Préparer la commande** : un **livreur AMAZER** vient la chercher.") },
        { say: "Pour voir votre boutique comme vos clients, touchez Voir ma boutique. Partagez son lien partout.",
          do: (f) => f.point("Voir ma boutique"), guide: g("Partagez votre boutique", "**Voir ma boutique** montre ce que voient vos clients. Partagez le lien sur WhatsApp et Facebook.") },
      ],
    },
  ],
  tips: [
    "Publiez **au moins 5 produits** avec de vraies photos.",
    "Gardez votre **stock à jour** : un produit épuisé déçoit le client.",
    "Préparez vite les commandes payées : la rapidité donne de bons avis.",
    "Lancez des **promotions** pour vous faire remarquer.",
    "Des revendeurs et des affiliés peuvent vendre vos produits pour vous.",
  ],
  faq: [
    ["Quand suis-je payé ?", "Le client paie AMAZER avant la préparation. Vous recevez le prix de vos articles selon les conditions affichées dans **Profil et abonnement**."],
    ["Dois-je livrer moi-même ?", "Non. Un livreur AMAZER vient chercher la commande chez vous."],
    ["Comment changer mes informations ?", "Touchez **Profil et abonnement** dans votre Espace vendeur."],
  ],
};

// ---------------------------------------------------------------- Restaurant
GUIDES.restaurant = {
  who: "Restaurants",
  title: "Votre restaurant sur AMAZER",
  subtitle: "Menu en ligne, commandes, livraison",
  video: "AMAZER_guide-restaurant.mp4",
  pdf: "AMAZER-Guide-restaurant.pdf",
  lead: "Mettez votre **menu en ligne**. Les clients commandent et paient sur AMAZER, vous cuisinez, **AMAZER livre**.",
  points: [
    ["Le menu", "Vos plats avec photo, prix et options."],
    ["Les commandes", "Acceptez, préparez, suivez."],
    ["L'ouverture", "Ouvrez, fermez ou mettez en pause en un geste."],
  ],
  intro: "Vous tenez un restaurant ? Voici comment les clients commandent chez vous sur AMAZER, et comment gérer vos commandes et votre menu.",
  outro: "Votre menu en ligne, vos commandes en direct, la livraison par AMAZER. Rendez-vous sur amazer.store.",
  end: ["Bon service !", "amazer.store · Restaurants"],
  chapters: [
    {
      title: "Ce que voit le client",
      persona: () => ({ ...P.restaurant }),
      route: "/shop?vendorId=v1",
      scenes: [
        { say: "Le client ouvre votre page. Il voit si vous êtes ouvert, votre plat du jour, et tout votre menu par catégorie.",
          do: (f) => f.point("Plat du jour", TXT), guide: g("Votre page restaurant", "Le client voit **Ouvert / Fermé**, le **Plat du jour** et le **menu** classé par catégorie.") },
        { say: "Il touche plus pour ajouter un plat, puis il donne son nom, son téléphone et son adresse, et il paie.",
          do: async (f) => { await f.click("Ajouter Thiéboudienne", { selector: "button" }); await f.point("Votre commande", TXT); }, guide: g("Le client commande", "Il touche **+** à côté d'un plat, remplit **Nom**, **Téléphone**, **Adresse**, puis paie par Nita ou Amana.") },
      ],
    },
    {
      title: "Recevoir et préparer les commandes",
      intro: "Dans votre **Espace vendeur**, section **Commandes**.",
      persona: () => ({ ...P.restaurant }),
      route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Les nouvelles commandes arrivent ici, avec les plats, les options, la note du client et l'adresse.",
          do: (f) => f.point("Nouvelles", { selector: "button" }), guide: g("Les nouvelles commandes", "L'onglet **Nouvelles** montre chaque commande : plats, options, **note du client**, adresse.") },
        { say: "Touchez Accepter et préparer. La commande passe en cuisine, puis en livraison.",
          do: (f) => f.point("Accepter et préparer"), guide: g("Acceptez", "Touchez **Accepter et préparer**. Suivez ensuite **En cuisine**, **En livraison**, **Terminées**.", "Vous pouvez **Refuser** ou **Appeler** le client si besoin.") },
      ],
    },
    {
      title: "Gérer le menu et l'ouverture",
      persona: () => ({ ...P.restaurant }),
      route: "/seller/dashboard#produits",
      scenes: [
        { say: "Dans Menu, ajoutez vos plats. Un plat fini ? Touchez Disponible pour le passer en épuisé.",
          do: (f) => f.point("Ajouter un plat"), guide: g("Votre menu", "Dans **Menu** : **Ajouter un plat**, modifier un plat, ou le marquer **Épuisé** d'un geste.") },
        { say: "Dans Réglages, vous ouvrez ou fermez. Trop de monde en cuisine ? Touchez Mettre en pause : les nouvelles commandes attendent.",
          before: (f) => f.goto("/seller/dashboard#reglages"), do: (f) => f.point("Mettre en pause"), guide: g("Ouvrir, fermer, pause", "Dans **Réglages** : **Mettre en pause** bloque les nouvelles commandes. Indiquez vos **horaires** pour fermer automatiquement.") },
      ],
    },
  ],
  tips: [
    "Mettez une **photo appétissante** pour chaque plat.",
    "Choisissez un **plat du jour** chaque jour.",
    "Acceptez vite : le client voit le temps d'attente.",
    "Répondez aux avis des clients, même aux critiques.",
  ],
  faq: [
    ["Qui livre ?", "Les livreurs AMAZER, à Niamey. Les frais de livraison sont payés par le client."],
    ["Je suis débordé ?", "Touchez **Mettre en pause** dans Réglages, puis réouvrez quand vous êtes prêt."],
  ],
};

// ---------------------------------------------------------------- Hôtel
GUIDES.hotel = {
  who: "Hôtels",
  title: "Votre hôtel sur AMAZER",
  subtitle: "Chambres en ligne, réservations, arrivées",
  video: "AMAZER_guide-hotel.mp4",
  pdf: "AMAZER-Guide-hotel.pdf",
  lead: "Avec la formule **Premium**, vos chambres se réservent en ligne. Le client paie directement l'établissement ; vous confirmez en un geste.",
  points: [
    ["Les chambres", "Prix par nuit, photos, équipements, disponibilité."],
    ["Les réservations", "Vous vérifiez le paiement et confirmez."],
    ["Les arrivées", "Vous suivez qui arrive, qui est en séjour."],
  ],
  intro: "Vous dirigez un hôtel ? Voici comment vos clients réservent une chambre sur AMAZER, et comment gérer vos réservations.",
  outro: "Des chambres réservées en ligne, des arrivées bien suivies. Votre hôtel sur amazer.store.",
  end: ["Bienvenue à vos clients", "amazer.store · Premium"],
  chapters: [
    {
      title: "Ce que voit le client",
      persona: () => ({ ...P.hotel }),
      route: "/shop?vendorId=h1",
      scenes: [
        { say: "Le client choisit sa date d'arrivée, sa date de départ et le nombre de personnes. Les chambres libres s'affichent avec le prix.",
          do: (f) => f.point("Arrivée", { selector: "label" }), guide: g("Le client choisit ses dates", "**Arrivée**, **Départ**, **Personnes** : les chambres disponibles s'affichent avec le **prix total**.") },
        { say: "Il touche Choisir sous la chambre qui lui plaît.",
          do: (f) => f.click("Choisir", { selector: "button" }), guide: g("Le client choisit sa chambre", "Sous chaque chambre : prix par nuit, équipements, places. Il touche **Choisir**.") },
        { say: "Il écrit son nom et son téléphone, paie l'hôtel par Nita ou Amana, puis touche Demander la réservation.",
          do: async (f) => { await f.point("Nom complet", { selector: "label" }); await f.point("Demander la réservation"); }, guide: g("Le client réserve", "Il remplit **Nom complet** et **Téléphone**, paie l'hôtel par **Nita** ou **Amana**, puis touche **Demander la réservation**.") },
      ],
    },
    {
      title: "Gérer les réservations",
      intro: "Dans votre **Espace vendeur**, section **Commandes**.",
      persona: () => ({ ...P.hotel }),
      route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Les réservations sont classées : arrivées du jour, à confirmer, en séjour, à venir.",
          do: (f) => f.point("À confirmer", { selector: "button" }), guide: g("Vos réservations", "Onglets **Arrivées**, **À confirmer**, **En séjour**, **À venir**, **Historique**.") },
        { say: "Vérifiez la référence du paiement, puis touchez Confirmer. Le client est prévenu.",
          do: (f) => f.point("Confirmer"), guide: g("Confirmez", "Vérifiez la **référence du paiement**, puis touchez **Confirmer** (ou **Refuser**). Vous pouvez **Appeler** le client.") },
        { say: "Le jour venu, suivez vos clients dans Arrivées, puis En séjour.",
          do: (f) => f.click("En séjour", { selector: "button" }), guide: g("Arrivées et séjours", "Les onglets **Arrivées** et **En séjour** montrent qui arrive aujourd'hui et qui est à l'hôtel.") },
      ],
    },
  ],
  tips: [
    "Ajoutez de **belles photos** de chaque type de chambre.",
    "Confirmez les réservations **rapidement**.",
    "Gardez le nombre de chambres à jour pour éviter les doublons.",
  ],
  faq: [
    ["Qui reçoit le paiement ?", "Le client paie **directement l'hôtel** (Nita ou Amana) ; vous vérifiez la référence avant de confirmer."],
    ["Comment avoir la réservation en ligne ?", "Elle est comprise dans la formule **Premium** (page Devenir vendeur)."],
  ],
};

// ---------------------------------------------------------------- Transport
GUIDES.transport = {
  who: "Compagnies de transport",
  title: "Vos billets sur AMAZER",
  subtitle: "Trajets, places, billets avec QR code",
  video: "AMAZER_guide-transport.mp4",
  pdf: "AMAZER-Guide-transport.pdf",
  lead: "Avec la formule **Premium**, vos voyageurs achètent leur place en ligne et reçoivent un **billet avec QR code**. Vous suivez chaque départ.",
  points: [
    ["Les trajets", "Prix par place, heures de départ, jours."],
    ["Les billets", "Le voyageur reçoit un billet avec QR code."],
    ["L'embarquement", "Vous scannez le billet au départ."],
  ],
  intro: "Vous avez une compagnie de transport ? Voici comment vos voyageurs réservent leur place sur AMAZER, et comment gérer vos départs.",
  outro: "Des places vendues en ligne, des départs bien suivis. Votre compagnie sur amazer.store.",
  end: ["Bon voyage !", "amazer.store · Premium"],
  chapters: [
    {
      title: "Ce que voit le voyageur",
      persona: () => ({ ...P.transport }),
      route: "/shop?vendorId=t1",
      scenes: [
        { say: "Le voyageur voit vos trajets, le prix par place et les heures de départ. Il choisit son trajet, sa date et son nombre de places, puis il paie.",
          do: (f) => f.click("Niamey → Maradi", { selector: "button" }), guide: g("Le voyageur choisit", "Il touche un **trajet**, choisit la **date**, l'**heure** et le **nombre de places**, puis paie par Nita ou Amana.") },
        { say: "Dans son compte, il retrouve sa réservation et touche Afficher mon billet. Le billet porte un QR code.",
          before: (f) => f.goto("/dashboard"), do: (f) => f.point("Afficher mon billet"), guide: g("Le billet", "Dans **Mon compte**, **Mes réservations** : **Afficher mon billet** montre le billet avec **QR code**.") },
      ],
    },
    {
      title: "Gérer les départs",
      intro: "Dans votre **Espace vendeur**, section **Commandes** : **Départs et passagers**.",
      persona: () => ({ ...P.transport }),
      route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Chaque départ montre ses passagers et les places restantes. Vérifiez le paiement d'une réservation, puis touchez Confirmer.",
          do: (f) => f.point("Confirmer"), guide: g("Confirmez les réservations", "Pour chaque départ : passagers, **places restantes**. Vérifiez la référence du paiement, puis **Confirmer**.") },
        { say: "Au moment du départ, touchez Scanner un billet et visez le QR code du voyageur. Il est marqué embarqué.",
          do: (f) => f.point("Scanner un billet"), guide: g("Scannez à l'embarquement", "Touchez **Scanner un billet** et visez le QR code. Le voyageur passe **Embarqué**.") },
      ],
    },
  ],
  tips: [
    "Indiquez **toutes vos heures de départ** et les jours de circulation.",
    "Confirmez vite les réservations payées.",
    "Scannez chaque billet : vous savez qui est monté.",
  ],
  faq: [
    ["Qui reçoit le paiement ?", "Le voyageur paie **directement la compagnie** (Nita ou Amana) ; vous vérifiez avant de confirmer."],
    ["Le voyageur n'a pas de téléphone au départ ?", "Retrouvez son nom dans la liste du départ et touchez **Embarqué**."],
  ],
};
