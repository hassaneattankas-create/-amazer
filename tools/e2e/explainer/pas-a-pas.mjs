// Guides « pas à pas » : une vidéo par type d'utilisateur, du tout début (arrivée sur amazer.store, création du
// compte) jusqu'au bout du parcours, en montrant chaque clic. Usage : GUIDES_SET=pas node explainer/guides.mjs [nom…]
// Personnages et données fictifs (personas.mjs, stations-data.mjs) : rien n'est écrit sur le vrai site.
import * as P from "./personas.mjs";
import { FORM, TXT, g } from "./guides-data.mjs";
import { scenarios } from "./stations-data.mjs";
import { wait } from "./lib.mjs";

export const GUIDES = {};

// Vrai produit en vente (vérifié le 10/11/2026) : Samsung A17, 95 000 F.
const PRODUCT = "/product?id=f93d7622-d798-4ca2-ae81-f3f5fa0482c1";

// La commande simulée reprend ce produit (montant affiché à l'écran de paiement).
const ORDER_TOTAL = 96500;
for (const [pattern, body] of P.client.mocks) {
  if (pattern.source.includes("c9") && body && typeof body === "object") {
    if ("total_amount" in body) Object.assign(body, { total_amount: ORDER_TOTAL, items: [{ id: "n1", product_id: "s17", product_name: "Samsung A17", quantity: 1, unit_price: 95000 }] });
    if ("amount" in body) body.amount = ORDER_TOTAL;
  }
}

/** Attend qu'un élément portant ce texte soit à l'écran (données du vrai site parfois lentes). */
async function ready(f, text, selector = "button,a", timeout = 45000) {
  await f.page.waitForFunction((text, selector) => [...document.querySelectorAll(selector)].some((e) => e.offsetParent !== null && (e.innerText || "").includes(text)), { timeout, polling: 500 }, text, selector).catch(() => console.log(`  pas chargé : ${text}`));
}
const MENU = { selector: "button" };
const LINK = { selector: "a" };

/** Remplace le contenu d'un champ (souris, clic, puis frappe lettre par lettre). */
async function fill(f, field, value, opts = {}) {
  f.typing = true;
  const ok = await f.click(field, { selector: "input,textarea", ...opts });
  f.typing = false;
  if (!ok) return;
  await f.page.keyboard.down("Control");
  await f.page.keyboard.press("KeyA");
  await f.page.keyboard.up("Control");
  await f.keys(value);
  await wait(300);
}

/** Bouton fixé en bas de l'écran (masqué par défaut pendant le tournage) : on le rend visible avant de le toucher. */
async function save(f, text = "Enregistrer le profil") {
  await f.page.evaluate((text) => document.querySelectorAll(".xp-hide").forEach((e) => { if ((e.innerText || "").includes(text)) e.classList.remove("xp-hide"); }), text);
  await f.click(text);
}

/** Visiteur qui s'inscrit : l'inscription est simulée, le code de vérification « envoyé » par WhatsApp. */
const inscription = () => ({
  proxy: true,
  mocks: [],
  onWrite(url) {
    if (/\/auth\/register$/.test(url)) return { verification_channel: "whatsapp", verification_destination_masked: "+227 90 •• •• 01", verification_code_preview: null };
    return {};
  },
});

/** Chapitre « Créer votre compte » (client, revendeur, affilié, livreur, gérant…). */
function compteClient({ name, email, phone, password = "Amazer#2026", intro } = {}) {
  return {
    title: "Créer votre compte",
    intro: intro || "Ouvrez **amazer.store** dans le navigateur de votre téléphone. Le compte est **gratuit**.",
    persona: inscription,
    route: "/",
    scenes: [
      { say: "Ouvrez amazer.store sur votre téléphone. En haut de l'écran, touchez le bouton Menu.",
        do: (f) => f.click("Menu", MENU), guide: g("Ouvrez le menu", "Sur **amazer.store**, touchez le bouton **Menu** en haut de l'écran.") },
      { say: "Dans le menu, touchez Créer un compte.",
        do: (f) => f.click("Créer un compte", LINK), guide: g("Touchez Créer un compte", "Dans le menu, touchez **Créer un compte**.") },
      { say: "Écrivez votre nom complet.",
        do: (f) => fill(f, "Nom complet", name), guide: g("Votre nom", "Dans **Nom complet**, écrivez votre prénom et votre nom.") },
      { say: "Vérifiez votre pays, puis écrivez votre ville.",
        do: async (f) => { await f.point("Pays", { selector: "select" }); await fill(f, "Ex. Niamey", "Niamey"); }, guide: g("Pays et ville", "Vérifiez le **Pays** (Niger, +227), puis écrivez votre **ville**.") },
      { say: "Écrivez votre e-mail, et votre numéro WhatsApp. L'un des deux suffit, mais les deux, c'est mieux.",
        do: async (f) => { await fill(f, "nom@exemple.com", email); await fill(f, "90 00 00 00", phone); }, guide: g("E-mail et WhatsApp", "Écrivez votre **e-mail** et/ou votre **numéro WhatsApp** : l'un des deux suffit pour vous connecter.") },
      { say: "Choisissez un mot de passe : au moins huit caractères, avec une majuscule, une minuscule, un chiffre et un signe. Chaque règle passe au vert.",
        do: (f) => fill(f, "Mot de passe", password), guide: g("Mot de passe", "Au moins **8 caractères**, une **majuscule**, une **minuscule**, un **chiffre** et un **signe** (! ? @ #). Les règles passent au **vert**.", "Notez votre mot de passe dans un endroit sûr.") },
      { say: "Cochez la case pour accepter les conditions d'utilisation. Puis touchez Créer mon compte.",
        do: async (f) => { await f.click("J'accepte la", { selector: "label" }); await f.click("Créer mon compte", FORM); }, guide: g("Créez le compte", "Cochez **J'accepte la politique de confidentialité et les conditions**, puis touchez **Créer mon compte**.") },
      { say: "Vous recevez un code à six chiffres, par WhatsApp ou par e-mail. Écrivez-le ici, puis touchez Activer mon compte. Votre compte est prêt, vous êtes connecté.",
        do: async (f) => { await fill(f, "000000", "482913"); await f.point("Activer mon compte"); }, guide: g("Activez avec le code", "Écrivez le **code à 6 chiffres** reçu par WhatsApp ou e-mail, puis touchez **Activer mon compte**. Vous êtes connecté.") },
    ],
  };
}

/** Chapitre « Ouvrir votre espace vendeur » : Menu → Devenir vendeur → formule → formulaire → code. */
const STATIONS_PUBLIC = (() => {
  const base = { vendor_id: "v1", vendor_slug: "sahel", service_kind: "fuel_station", whatsapp_contact: null, logo_url: null, is_verified: true, delivery_phone: null, services: [], brand_outlets: 3, brand_name: "Sahel Énergie" };
  const at = new Date().toISOString();
  const st = (id, name, lat, lng, fuel, extra = {}) => ({ ...base, outlet_id: id, business_name: `Sahel Énergie · ${name}`, city: "Niamey", address: name, phone: "+227 90 00 00 11", latitude: lat, longitude: lng, maps_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, fuel, fuel_fresh: true, fuel_updated_at: at, on_duty: false, duty_label: null, opening_hours: "6 h - 23 h", ...extra });
  return {
    items: [
      st("o1", "Plateau", 13.5205, 2.1046, { super: "available", gasoil: "available", gaz: "low" }, { on_duty: true, duty_label: "De garde", opening_hours: "24 h/24" }),
      st("o2", "Koira Kano", 13.5452, 2.1175, { super: "low", gasoil: "out" }),
      st("o3", "Grand Marché", 13.511, 2.118, { super: "out", gasoil: "out" }),
    ],
    cities: [{ city: "Niamey", count: 3 }], delivery_cities: ["Niamey"], fresh_hours: 4,
  };
})();

/** Position du client pour « Voir la carte » (Niamey, Plateau). */
async function here(f) {
  await f.page.browserContext().overridePermissions(new URL(f.page.url() || "http://localhost:3100").origin, ["geolocation"]);
  await f.page.setGeolocation({ latitude: 13.5137, longitude: 2.1098 });
}

/** Chapitre « Votre formule » : ce que le vendeur a, et ce qui l'attend (section Ma formule de l'espace vendeur). */
function formule(persona, say, text, pointAt = "Sans paiement") {
  return {
    title: "Votre formule",
    intro: "Dans votre **Espace vendeur**, la section **Ma formule** vous dit ce qui vous attend.",
    persona,
    route: "/seller/dashboard#accueil",
    scenes: [
      {
        say,
        do: async (f) => {
          await ready(f, "Ma formule", "button");
          await f.click("Ma formule", { selector: "button" });
          await f.point(pointAt, { selector: "li" });
        },
        guide: g("Ma formule", text),
      },
    ],
  };
}

function compteVendeur({ plan, planSay, shop, name, email, phone }) {
  return {
    title: "Créer votre compte vendeur",
    intro: "Ouvrez **amazer.store** dans le navigateur de votre téléphone. Tout se fait en quelques minutes.",
    persona: inscription,
    route: "/",
    scenes: [
      { say: "Ouvrez amazer.store sur votre téléphone. En haut de l'écran, touchez le bouton Menu.",
        do: (f) => f.click("Menu", MENU), guide: g("Ouvrez le menu", "Sur **amazer.store**, touchez le bouton **Menu** en haut de l'écran.") },
      { say: "Dans le menu, touchez Devenir vendeur.",
        do: (f) => f.click("Devenir vendeur", LINK), guide: g("Touchez Devenir vendeur", "Dans le menu, touchez **Devenir vendeur**.") },
      { say: `Les formules sont expliquées avec leur prix. ${planSay} Touchez Choisir ${plan}.`,
        do: (f) => f.click(`Choisir ${plan}`, LINK), guide: g(`Choisissez ${plan}`, `Lisez les formules, puis touchez **Choisir ${plan}**.`) },
      { say: "Écrivez le nom de votre établissement, puis votre nom complet.",
        do: async (f) => { await fill(f, "Nom de la boutique", shop); await fill(f, "Nom complet", name); }, guide: g("Nom et responsable", "Écrivez le **nom de votre établissement**, puis **votre nom complet**.") },
      { say: "Vérifiez le pays, et écrivez votre ville.",
        do: async (f) => { await f.point("Pays", { selector: "select" }); await fill(f, "Ex. Niamey", "Niamey"); }, guide: g("Pays et ville", "Vérifiez le **Pays**, puis écrivez votre **ville**.") },
      { say: "Écrivez votre e-mail et votre numéro WhatsApp. Les clients et AMAZER pourront vous joindre.",
        do: async (f) => { await fill(f, "nom@exemple.com", email); await fill(f, "90 00 00 00", phone); }, guide: g("E-mail et WhatsApp", "Écrivez votre **e-mail** et votre **numéro WhatsApp**.") },
      { say: "Choisissez un mot de passe solide : huit caractères, une majuscule, un chiffre et un signe.",
        do: (f) => fill(f, "Mot de passe", "Amazer#2026"), guide: g("Mot de passe", "Au moins **8 caractères**, une **majuscule**, une **minuscule**, un **chiffre** et un **signe**.") },
      { say: "Cochez la case des conditions, puis touchez Créer ma boutique. Votre espace est en ligne tout de suite, avec 14 jours d'essai gratuit.",
        do: async (f) => { await f.click("J'accepte la", { selector: "label" }); await f.click("Créer ma boutique", FORM); }, guide: g("Créez votre espace", "Cochez les **conditions**, puis touchez **Créer ma boutique**. Votre espace est en ligne **tout de suite**.") },
      { say: "Écrivez le code à six chiffres reçu par WhatsApp ou par e-mail, puis touchez Activer mon compte.",
        do: async (f) => { await fill(f, "000000", "482913"); await f.point("Activer mon compte"); }, guide: g("Activez avec le code", "Écrivez le **code à 6 chiffres** reçu, puis touchez **Activer mon compte**.") },
    ],
  };
}

const intro = (who) => `Cette vidéo vous montre tout, étape par étape, et chaque clic : de l'arrivée sur amazer.store jusqu'au bout. ${who}`;

// ================================================================ Client
GUIDES.client = {
  who: "Clients", title: "Acheter, pas à pas", subtitle: "Du compte à la livraison, chaque clic",
  video: "AMAZER_pas-a-pas-client.mp4", pdf: "AMAZER-Pas-a-pas-client.pdf",
  lead: "Toutes les étapes, dans l'ordre : **créer votre compte**, **trouver** un produit, **commander**, **payer** par Nita ou Amana, **recevoir**.",
  points: [["Le compte", "Gratuit, en 2 minutes."], ["La commande", "Panier, adresse, paiement."], ["La livraison", "Suivi, puis confirmation."]],
  intro: intro("Aujourd'hui : acheter sur AMAZER."),
  outro: "Voilà ! Vous savez créer votre compte, commander, payer et recevoir. Bons achats sur amazer.store.",
  end: ["Bons achats !", "amazer.store"],
  chapters: [
    compteClient({ name: "Aïcha Mahamadou", email: "aicha@exemple.com", phone: "90000001" }),
    {
      title: "Trouver un produit", persona: () => ({ ...P.client }), route: "/",
      scenes: [
        { say: "Vous êtes connectée. Touchez la barre de recherche, et écrivez ce que vous cherchez. Par exemple : Samsung.",
          before: async (f) => { await f.goto(PRODUCT); await ready(f, "Ajouter au panier"); await f.goto("/search?q=samsung"); await ready(f, "Samsung", "a"); await f.goto("/"); },
          do: async (f) => { await fill(f, "Rechercher", "samsung"); await f.page.keyboard.press("Enter"); await wait(2500); }, guide: g("Cherchez", "Touchez la **barre de recherche**, écrivez le produit, puis validez.") },
        { say: "Les résultats s'affichent, avec le prix et la boutique. Touchez le produit qui vous plaît.",
          do: async (f) => { await ready(f, "Samsung A17", "a"); await f.click("Samsung A17", LINK); }, guide: g("Touchez un produit", "Les **résultats** montrent la photo, le **prix** et la **boutique**. Touchez le produit.") },
        { say: "La fiche montre la photo, le prix, le stock et le vendeur. Touchez Ajouter au panier.",
          do: async (f) => { if (!f.page.url().includes("f93d7622")) await f.goto(PRODUCT); await ready(f, "Ajouter au panier"); await f.click("Ajouter au panier"); }, guide: g("Ajoutez au panier", "Vérifiez **prix**, **stock** et **vendeur**, puis touchez **Ajouter au panier**.") },
        { say: "En haut, touchez le bouton du panier.",
          do: (f) => f.click("", { selector: "a[href='/cart']" }), guide: g("Ouvrez le panier", "Touchez le bouton **Panier** (orange) en haut de l'écran.") },
      ],
    },
    {
      title: "Commander", persona: () => ({ ...P.client }), route: "/cart",
      scenes: [
        { say: "Dans le panier, vérifiez l'article et la quantité. Avec plus et moins, vous changez la quantité.",
          before: async (f) => { await f.goto(PRODUCT); await ready(f, "Ajouter au panier"); await f.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Ajouter au panier")?.click()); await wait(1500); await f.goto("/cart"); await ready(f, "Standard"); },
          do: (f) => f.point("Retirer"), guide: g("Vérifiez le panier", "Vérifiez l'**article** et la **quantité** (boutons **+** et **−**).") },
        { say: "Choisissez la livraison : Standard, ou Express à Niamey.",
          do: (f) => f.click("Standard"), guide: g("Choisissez la livraison", "Touchez **Standard** ou **Express Niamey**.") },
        { say: "Écrivez l'adresse, avec un repère que le livreur trouvera facilement.",
          do: (f) => fill(f, "Quartier, rue, repère", "Plateau, près de la pharmacie, porte bleue"), guide: g("L'adresse", "Écrivez le **quartier**, la **rue** et un **repère** (mosquée, pharmacie, école…).") },
        { say: "Écrivez le téléphone pour le livreur.",
          do: (f) => fill(f, "+227 90 00 00 00", "90000001"), guide: g("Le téléphone", "Écrivez le **téléphone pour le livreur** : il vous appelle en arrivant.") },
        { say: "Choisissez le paiement : Nita Transfert ou Amana Transfert. Vérifiez le total, livraison comprise, puis touchez Commander.",
          do: async (f) => { await f.click("Nita Transfert"); await f.click("Commander", { selector: "button" }); }, guide: g("Paiement, puis Commander", "Touchez **Nita Transfert** ou **Amana Transfert**, vérifiez le **Total**, puis touchez **Commander**.") },
      ],
    },
    {
      title: "Payer", persona: () => ({ ...P.client }), route: "/order/pay?id=c9",
      scenes: [
        { say: "Étape un : envoyez le montant exact au numéro affiché. Touchez Copier pour ne pas vous tromper.",
          do: (f) => f.click("Copier", { selector: "button" }), guide: g("1. Envoyez l'argent", "Envoyez **le montant exact** au **numéro affiché** (touchez **Copier**).") },
        { say: "Étape deux : écrivez ce motif dans votre transfert. Il relie votre paiement à votre commande.",
          do: (f) => f.point("Motif du paiement", TXT), guide: g("2. Le motif", "Écrivez ce **motif** dans le transfert Nita ou Amana.") },
        { say: "Étape trois : touchez J'ai payé. AMAZER vérifie le paiement, puis la boutique prépare votre commande.",
          do: (f) => f.click("J'ai payé"), guide: g("3. J'ai payé", "Touchez **J'ai payé**. AMAZER vérifie, puis la boutique prépare.") },
      ],
    },
    {
      title: "Suivre et recevoir", persona: () => ({ ...P.client }), route: "/",
      scenes: [
        { say: "Pour suivre votre commande, touchez Menu, puis Tableau de bord.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Tableau de bord", LINK); }, guide: g("Ouvrez votre tableau de bord", "Touchez **Menu**, puis **Tableau de bord**.") },
        { say: "Chaque commande montre son étape : commande, préparation, livraison, reçue.",
          do: (f) => f.point("AMZ-4821", TXT), guide: g("Suivez chaque étape", "**Commande → Préparation → En livraison → Reçue**.") },
        { say: "Quand le livreur vous remet le colis, touchez J'ai reçu ma commande. Ne payez jamais le livreur : tout est déjà payé.",
          do: (f) => f.click("J'ai reçu ma commande"), guide: g("Confirmez la réception", "À la réception, touchez **J'ai reçu ma commande**.", "Ne payez jamais le livreur : la commande est déjà payée.") },
      ],
    },
  ],
  tips: ["Payez **toujours sur AMAZER** : vous êtes protégé.", "Une adresse **avec un repère** fait gagner du temps.", "Gardez votre téléphone allumé pendant la livraison."],
  faq: [["J'ai oublié mon mot de passe ?", "Sur la page **Connexion**, touchez **Mot de passe oublié**."], ["Je n'ai pas reçu le code ?", "Vérifiez le numéro WhatsApp ou l'e-mail, puis recommencez avec **Retour à l'inscription**."]],
};

// ================================================================ Boutique
GUIDES.boutique = {
  who: "Vendeurs · Boutiques", title: "Ouvrir sa boutique, pas à pas", subtitle: "Du compte à la première vente, chaque clic",
  video: "AMAZER_pas-a-pas-boutique.mp4", pdf: "AMAZER-Pas-a-pas-boutique.pdf",
  lead: "Toutes les étapes, dans l'ordre : **créer votre boutique**, la **présenter**, **publier** vos produits, **préparer** les commandes payées.",
  points: [["Créer", "Boutique en ligne tout de suite."], ["Publier", "Photo, prix, stock."], ["Vendre", "AMAZER vérifie le paiement et livre."]],
  intro: intro("Aujourd'hui : ouvrir votre boutique et vendre."),
  outro: "Votre boutique est prête : publiez vos produits, préparez les commandes, AMAZER livre. Rendez-vous sur amazer.store.",
  end: ["Bonnes ventes !", "amazer.store · Devenir vendeur"],
  chapters: [
    compteVendeur({ plan: "Boutique", planSay: "Pour vendre des produits, c'est la formule Boutique.", shop: "Bella Mode", name: "Bella Abdou", email: "bella@exemple.com", phone: "90000002" }),
    formule(() => ({ ...P.boutique }),
      "Ouvrez Ma formule. Pendant les 14 jours d'essai, tout est illimité. Ensuite, deux choix : continuer gratuitement, avec 5 produits visibles, AMAZER gardant 5 % de chaque vente ; ou prendre l'abonnement Boutique à 2 000 francs par mois, sans limite et sans commission.",
      "Essai : tout illimité. Ensuite : **formule gratuite** (5 produits visibles, 5 % par vente) ou **abonnement Boutique** (2 000 F/mois, illimité, 0 %). La boutique reste en ligne dans les deux cas.",
      "Ensuite"),
    {
      title: "Présenter votre boutique", intro: "Votre fiche boutique : logo, photo, contact, horaires.", persona: () => ({ ...P.boutique }), route: "/seller",
      scenes: [
        { say: "Vous arrivez dans Profil et abonnement. Ajoutez votre logo et une belle photo de votre commerce.",
          do: (f) => f.point("Logo", TXT), guide: g("Logo et photo", "Dans **Profil et abonnement**, ajoutez votre **Logo** et une **Photo de couverture**.") },
        { say: "Écrivez votre numéro WhatsApp, vos horaires, et l'adresse de la boutique.",
          do: async (f) => { await fill(f, "Ex. Lun-Sam 8h-20h", "Lun-Sam 8h-20h"); await fill(f, "Adresse / quartier", "Grand marché, allée 4"); }, guide: g("Contact et horaires", "Remplissez **WhatsApp**, **Téléphone**, **Horaires** et **Adresse / quartier**.") },
        { say: "Touchez Enregistrer le profil.",
          do: (f) => save(f), guide: g("Enregistrez", "Touchez **Enregistrer le profil** (bouton en bas de l'écran).") },
      ],
    },
    {
      title: "Publier vos produits", persona: () => ({ ...P.boutique }), route: "/seller/dashboard#accueil",
      scenes: [
        { say: "Ouvrez votre Espace vendeur. Touchez Ajouter un produit.",
          do: (f) => f.click("Ajouter un produit"), guide: g("Ajouter un produit", "Dans l'**Espace vendeur**, touchez **Ajouter un produit**.") },
        { say: "Écrivez le nom du produit.",
          do: (f) => fill(f, "Nom du produit", "Sac à main en cuir"), guide: g("Le nom", "Écrivez le **Nom du produit**, clair et précis.") },
        { say: "Écrivez le prix en francs CFA, puis le stock disponible.",
          do: async (f) => { await fill(f, "Prix (XOF)", "12500"); await fill(f, "Stock", "10"); }, guide: g("Prix et stock", "Écrivez le **Prix (XOF)** et le **Stock**.") },
        { say: "Ajoutez la photo : depuis la galerie, ou avec l'appareil photo.",
          do: (f) => f.point("Prendre une photo", { selector: "label" }), guide: g("La photo", "Touchez **Prendre une photo** ou choisissez dans la galerie.", "Lumière du jour, fond simple : la photo fait vendre.") },
        { say: "Touchez Ajouter au catalogue. Votre produit est en ligne.",
          do: (f) => f.click("Ajouter au catalogue"), guide: g("Publiez", "Touchez **Ajouter au catalogue** : le produit est en ligne.") },
      ],
    },
    {
      title: "Préparer les commandes", persona: () => ({ ...P.boutique }), route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Quand un client a payé, la commande arrive dans Commandes. AMAZER a déjà vérifié le paiement.",
          do: (f) => f.point("AMZ-5102", TXT), guide: g("Les commandes payées", "Dans **Commandes**, chaque commande est **déjà payée** et vérifiée par AMAZER.") },
        { say: "Touchez Préparer la commande. Un livreur AMAZER vient la chercher chez vous.",
          do: (f) => f.click("Préparer la commande"), guide: g("Préparez", "Touchez **Préparer la commande**. Un **livreur AMAZER** vient la chercher.") },
        { say: "Pour voir votre boutique comme vos clients, touchez Voir ma boutique, et partagez son lien sur WhatsApp.",
          do: (f) => f.point("Voir ma boutique"), guide: g("Partagez votre boutique", "**Voir ma boutique**, puis partagez le lien sur WhatsApp et Facebook.") },
      ],
    },
  ],
  tips: ["Publiez **au moins 5 produits** avec de vraies photos.", "Gardez le **stock à jour**.", "Préparez vite : les bons avis suivent."],
  faq: [["Comment payer l'abonnement ?", "Dans **Profil et abonnement**, choisissez la **durée** et **Nita** ou **Amana**, puis envoyez la référence."], ["Dois-je livrer ?", "Non : un livreur AMAZER vient chercher la commande."]],
};

// ================================================================ Restaurant
GUIDES.restaurant = {
  who: "Restaurants", title: "Mon restaurant, pas à pas", subtitle: "Du compte au premier plat livré, chaque clic",
  video: "AMAZER_pas-a-pas-restaurant.mp4", pdf: "AMAZER-Pas-a-pas-restaurant.pdf",
  lead: "Toutes les étapes : **créer votre restaurant**, **publier le menu**, **accepter** les commandes, gérer l'**ouverture**.",
  points: [["Créer", "Formule Restaurant."], ["Le menu", "Plats, prix, options, photo."], ["Les commandes", "Accepter, cuisiner, AMAZER livre."]],
  intro: intro("Aujourd'hui : mettre votre restaurant en ligne."),
  outro: "Votre menu est en ligne, vos commandes arrivent, AMAZER livre. Bon service avec amazer.store.",
  end: ["Bon service !", "amazer.store · Restaurants"],
  chapters: [
    compteVendeur({ plan: "Restaurant", planSay: "Pour un restaurant ou un maquis, c'est la formule Restaurant.", shop: "Chez Awa", name: "Awa Moussa", email: "awa@exemple.com", phone: "90000003" }),
    formule(() => ({ ...P.restaurant }),
      "Ouvrez Ma formule. Pendant l'essai, tout est inclus. Ensuite, l'abonnement Restaurant coûte 5 000 francs par mois. Sans paiement, votre restaurant n'est plus visible des clients jusqu'au paiement ; votre menu est gardé.",
      "Essai : tout inclus. Ensuite : **abonnement Restaurant**, 5 000 F/mois. Sans paiement, le restaurant n'est plus visible jusqu'au paiement (menu gardé)."),
    {
      title: "Publier votre menu", persona: () => ({ ...P.restaurant }), route: "/seller/dashboard#produits",
      scenes: [
        { say: "Dans votre Espace vendeur, ouvrez la section Mon menu, puis touchez Ajouter un plat.",
          do: async (f) => { await f.point("Mon menu", { selector: "button" }); await f.click("Ajouter un plat", { selector: "button" }); }, guide: g("Ajouter un plat", "Section **Mon menu** → **Ajouter un plat**.") },
        { say: "Écrivez le nom du plat, sa catégorie et son prix.",
          do: async (f) => { await fill(f, "Ex. Riz sauce arachide", "Riz sauce arachide"); await fill(f, "Prix", "1500"); }, guide: g("Nom, catégorie, prix", "Écrivez le **nom du plat**, la **catégorie** (Plats, Grillades…) et le **prix**.") },
        { say: "Décrivez le plat, et ajoutez une photo appétissante.",
          do: async (f) => { await fill(f, "Ingrédients, portion, accompagnement…", "Riz, sauce arachide maison, viande de bœuf"); await f.point("Photo du plat", TXT); }, guide: g("Description et photo", "Écrivez les **ingrédients** et ajoutez la **Photo du plat**.") },
        { say: "Ajoutez des options si vous voulez : supplément viande, sans piment. Puis touchez Publier au menu.",
          do: async (f) => { await f.point("Options et suppléments", TXT); await f.click("Publier au menu"); }, guide: g("Options, puis publiez", "Ajoutez les **Options et suppléments**, puis touchez **Publier au menu**.") },
      ],
    },
    {
      title: "Recevoir les commandes", persona: () => ({ ...P.restaurant }), route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Les nouvelles commandes arrivent dans Commandes, avec les plats, les options et l'adresse.",
          do: (f) => f.click("Nouvelles", { selector: "button" }), guide: g("Nouvelles commandes", "Onglet **Nouvelles** : plats, options, note du client, adresse.") },
        { say: "Touchez Accepter et préparer. La commande passe en cuisine, puis un livreur AMAZER l'emporte.",
          do: (f) => f.click("Accepter et préparer"), guide: g("Acceptez", "Touchez **Accepter et préparer**. Suivez **En cuisine**, **En livraison**, **Terminées**.") },
      ],
    },
    {
      title: "Ouvrir, fermer, pause", persona: () => ({ ...P.restaurant }), route: "/seller/dashboard#reglages",
      scenes: [
        { say: "Dans Réglages, trop de monde en cuisine ? Touchez Mettre en pause. Les nouvelles commandes attendent.",
          do: (f) => f.point("Mettre en pause"), guide: g("Pause", "Dans **Réglages**, **Mettre en pause** bloque les nouvelles commandes.") },
      ],
    },
  ],
  tips: ["Une **photo appétissante** par plat.", "Choisissez un **plat du jour**.", "Acceptez vite les commandes."],
  faq: [["Qui livre ?", "Les livreurs AMAZER, à Niamey. Le client paie la livraison."]],
};

// ================================================================ Hôtel
GUIDES.hotel = {
  who: "Hôtels", title: "Mon hôtel, pas à pas", subtitle: "Du compte à la première réservation, chaque clic",
  video: "AMAZER_pas-a-pas-hotel.mp4", pdf: "AMAZER-Pas-a-pas-hotel.pdf",
  lead: "Toutes les étapes : **créer votre compte Premium**, faire **activer l'hôtel**, publier vos **chambres**, **confirmer** les réservations.",
  points: [["Premium", "La formule des hôtels."], ["Les chambres", "Prix par nuit, photos, équipements."], ["Les réservations", "Vous confirmez en un geste."]],
  intro: intro("Aujourd'hui : mettre votre hôtel en ligne."),
  outro: "Vos chambres sont en ligne, vos réservations bien suivies. Votre hôtel sur amazer.store.",
  end: ["Bienvenue à vos clients", "amazer.store · Premium"],
  chapters: [
    compteVendeur({ plan: "Premium", planSay: "Pour un hôtel, c'est la formule Premium.", shop: "Hôtel du Fleuve", name: "Moussa Hamani", email: "hotel@exemple.com", phone: "90000004" }),
    formule(() => ({ ...P.hotel }),
      "Ouvrez Ma formule. Pendant l'essai, tout est inclus. Ensuite, l'abonnement Premium coûte 10 000 francs par mois. Sans paiement, votre hôtel n'est plus visible et ne reçoit plus de réservations jusqu'au paiement ; vos chambres sont gardées.",
      "Essai : tout inclus. Ensuite : **abonnement Premium**, 10 000 F/mois. Sans paiement, plus de réservations jusqu'au paiement (données gardées)."),
    {
      title: "Publier vos chambres", intro: "AMAZER active la fonction **hôtel** après vérification : écrivez-nous sur WhatsApp depuis la page d'aide.", persona: () => ({ ...P.hotel }), route: "/seller",
      scenes: [
        { say: "Dans Profil et abonnement, la formule Premium est choisie. Écrivez à AMAZER sur WhatsApp : l'équipe vérifie votre hôtel et active la réservation.",
          do: (f) => f.point("Type d'activité", { selector: "label" }), guide: g("Faites activer l'hôtel", "Formule **Premium**. Écrivez à AMAZER sur **WhatsApp** : l'équipe vérifie et **active la fonction hôtel**.") },
        { say: "Cochez Réservations en ligne, et écrivez le numéro qui reçoit les paiements des clients.",
          do: async (f) => { await f.point("Réservations en ligne", { selector: "label" }); await fill(f, "Ex. 90 00 00 00", "90000004"); }, guide: g("Réservations et paiement", "Cochez **Réservations en ligne (chambres)** et écrivez le **numéro qui reçoit les paiements**.") },
        { say: "Dans Vos chambres, chaque type de chambre a un nom, un prix par nuit, des photos et des équipements. Touchez Ajouter pour en créer une autre.",
          do: (f) => f.point("Vos chambres", TXT), guide: g("Vos chambres", "Pour chaque chambre : **nom**, **prix par nuit**, **places**, **équipements**, **photos**. **+ Ajouter une chambre**.") },
        { say: "Touchez Enregistrer le profil. Vos chambres sont réservables.",
          do: (f) => save(f), guide: g("Enregistrez", "Touchez **Enregistrer le profil**.") },
      ],
    },
    {
      title: "Confirmer les réservations", persona: () => ({ ...P.hotel }), route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Les réservations arrivent dans Commandes. Ouvrez À confirmer.",
          do: (f) => f.click("À confirmer", { selector: "button" }), guide: g("À confirmer", "Dans **Commandes**, ouvrez **À confirmer**.") },
        { say: "Vérifiez la référence du paiement, puis touchez Confirmer. Le client est prévenu.",
          do: (f) => f.click("Confirmer"), guide: g("Confirmez", "Vérifiez la **référence du paiement**, puis **Confirmer**.") },
        { say: "Le jour venu, suivez Arrivées, puis En séjour.",
          do: (f) => f.click("En séjour", { selector: "button" }), guide: g("Arrivées et séjours", "**Arrivées** et **En séjour** : qui arrive, qui est à l'hôtel.") },
      ],
    },
  ],
  tips: ["De **belles photos** pour chaque chambre.", "Confirmez **vite**.", "Gardez le nombre de chambres à jour."],
  faq: [["Qui reçoit le paiement ?", "Le client paie **directement l'hôtel** (Nita ou Amana)."]],
};

// ================================================================ Transport
GUIDES.transport = {
  who: "Compagnies de transport", title: "Ma compagnie, pas à pas", subtitle: "Du compte au premier billet, chaque clic",
  video: "AMAZER_pas-a-pas-transport.mp4", pdf: "AMAZER-Pas-a-pas-transport.pdf",
  lead: "Toutes les étapes : **compte Premium**, **activation transport**, publier vos **trajets**, **confirmer** et **scanner** les billets.",
  points: [["Premium", "La formule des compagnies."], ["Les trajets", "Prix, jours, heures de départ."], ["L'embarquement", "Billet avec QR code scanné."]],
  intro: intro("Aujourd'hui : vendre vos billets en ligne."),
  outro: "Vos places se vendent en ligne, vos départs sont suivis. Votre compagnie sur amazer.store.",
  end: ["Bon voyage !", "amazer.store · Premium"],
  chapters: [
    compteVendeur({ plan: "Premium", planSay: "Pour une compagnie de transport, c'est la formule Premium.", shop: "Sahel Voyages", name: "Saidou Amadou", email: "voyages@exemple.com", phone: "90000005" }),
    formule(() => ({ ...P.transport }),
      "Ouvrez Ma formule. Pendant l'essai, tout est inclus. Ensuite, l'abonnement Premium coûte 10 000 francs par mois. Sans paiement, vos trajets ne sont plus proposés aux voyageurs jusqu'au paiement ; vos données sont gardées.",
      "Essai : tout inclus. Ensuite : **abonnement Premium**, 10 000 F/mois. Sans paiement, plus de billets vendus jusqu'au paiement (données gardées)."),
    {
      title: "Publier vos trajets", intro: "AMAZER active la fonction **transport** après vérification (WhatsApp).", persona: () => ({ ...P.transport }), route: "/seller",
      scenes: [
        { say: "Écrivez à AMAZER sur WhatsApp : l'équipe vérifie votre compagnie et active le transport.",
          do: (f) => f.point("Type d'activité", { selector: "label" }), guide: g("Faites activer le transport", "Formule **Premium** : écrivez à AMAZER sur **WhatsApp** pour activer le **transport**.") },
        { say: "Dans Vos trajets, chaque trajet a un nom, un prix par place, des jours et des heures de départ.",
          do: (f) => f.point("Vos trajets", TXT), guide: g("Vos trajets", "Pour chaque trajet : **nom** (ex. Niamey - Maradi), **prix par place**, **jours**, **heures de départ**.") },
        { say: "Touchez Ajouter une heure pour un nouveau départ, puis Enregistrer le profil.",
          do: async (f) => { await f.point("+ Ajouter une heure"); await save(f); }, guide: g("Heures, puis enregistrez", "**+ Ajouter une heure**, **+ Ajouter un jour**, puis **Enregistrer le profil**.") },
      ],
    },
    {
      title: "Confirmer et embarquer", persona: () => ({ ...P.transport }), route: "/seller/dashboard#commandes",
      scenes: [
        { say: "Chaque départ montre ses passagers et les places restantes. Vérifiez le paiement, puis touchez Confirmer.",
          do: (f) => f.click("Confirmer"), guide: g("Confirmez", "Vérifiez la **référence du paiement**, puis **Confirmer**.") },
        { say: "Au départ, touchez Scanner un billet, et visez le QR code du voyageur. Il passe embarqué.",
          do: (f) => f.point("Scanner un billet"), guide: g("Scannez", "**Scanner un billet** : visez le QR code. Le voyageur passe **Embarqué**.") },
      ],
    },
  ],
  tips: ["Indiquez **toutes vos heures** de départ.", "Scannez **chaque billet**."],
  faq: [["Qui reçoit le paiement ?", "Le voyageur paie **directement la compagnie**."]],
};

// ================================================================ Pharmacie
GUIDES.pharmacie = {
  who: "Pharmacies", title: "Ma pharmacie, pas à pas", subtitle: "Du compte à la première garde, chaque clic",
  video: "AMAZER_pas-a-pas-pharmacie.mp4", pdf: "AMAZER-Pas-a-pas-pharmacie.pdf",
  lead: "Toutes les étapes : **compte Premium**, **activation pharmacie**, **programmer les gardes**, enregistrer la **position**.",
  points: [["Premium", "Compte de la pharmacie."], ["Les gardes", "Programmées, automatiques."], ["La position", "Itinéraire Google Maps."]],
  intro: intro("Aujourd'hui : inscrire votre pharmacie."),
  outro: "Vos gardes sont annoncées, votre position est juste : les clients vous trouvent. Rendez-vous sur amazer.store.",
  end: ["Votre pharmacie, trouvée", "amazer.store · Pharmacies"],
  chapters: [
    compteVendeur({ plan: "Premium", planSay: "Pour une pharmacie, c'est la formule Premium.", shop: "Pharmacie du Fleuve", name: "Dr Mariama Issa", email: "pharmacie@exemple.com", phone: "90000006" }),
    formule(() => ({ ...P.pharmacie }),
      "Ouvrez Ma formule : elle rappelle votre abonnement Premium et sa date de fin. Sans paiement, votre pharmacie et vos gardes ne sont plus visibles des clients jusqu'au paiement.",
      "**Abonnement Premium** et sa date de fin. Sans paiement, la pharmacie et ses gardes ne sont plus visibles jusqu'au paiement."),
    {
      title: "Programmer vos gardes", intro: "AMAZER active la fonction **pharmacie** après vérification (WhatsApp).", persona: () => ({ ...P.pharmacie }), route: "/seller/dashboard#accueil",
      scenes: [
        { say: "Une fois la pharmacie activée par AMAZER, la carte Ma garde apparaît dans votre Espace vendeur.",
          do: (f) => f.point("Ma garde", TXT), guide: g("Ma garde", "Après l'**activation** par AMAZER, la carte **Ma garde** apparaît.") },
        { say: "Choisissez la date de début, la date de fin, puis touchez Programmer. La garde démarre et s'arrête toute seule.",
          do: async (f) => {
            // un clic ouvrirait le calendrier du navigateur : on montre le champ, puis on y inscrit la date
            for (const [field, date] of [["Du", "2026-11-15"], ["Au", "2026-11-22"]]) {
              await f.point(field, { selector: "input" });
              await f.page.evaluate((v) => {
                const e = document.querySelector("[data-xp-last]");
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, v);
                e.dispatchEvent(new Event("input", { bubbles: true }));
              }, date);
              await wait(700);
            }
            await f.click("Programmer", { selector: "button" });
          }, guide: g("Programmez", "Choisissez **Du** et **Au**, puis **Programmer**.") },
        { say: "Dans la pharmacie, touchez Enregistrer ma position. Les clients auront le bon itinéraire.",
          do: (f) => f.point("ma position", { selector: "button" }), guide: g("Votre position", "Dans la pharmacie, **Enregistrer ma position** (ensuite : **Mettre à jour ma position**).") },
      ],
    },
    {
      title: "Ce que voient les clients", persona: () => ({ ...P.pharmaClient }), route: "/",
      scenes: [
        { say: "Les clients touchent Menu, puis Premium, puis Pharmacies.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Premium", MENU); await f.click("Pharmacies", LINK); }, guide: g("La page Pharmacies", "**Menu** → **Pharmacies**.") },
        { say: "Les pharmacies de garde sont en tête. Le client appelle, ou ouvre l'itinéraire jusqu'à vous.",
          do: (f) => f.point("Itinéraire"), guide: g("Appeler, venir", "**Appeler** et **Itinéraire** (Google Maps).") },
        { say: "Le client peut aussi toucher Voir la carte : autour de lui, les pharmacies de garde sont en vert. Il touche la vôtre pour l'itinéraire.",
          before: async (f) => { await here(f); },
          do: async (f) => { await f.click("Voir la carte", { selector: "button" }); await ready(f, "De garde", "li"); await wait(2500); await f.point("De garde", { selector: "li" }); },
          guide: g("La carte", "**Voir la carte** : les pharmacies **de garde** en vert, autour du client.") },
      ],
    },
  ],
  tips: ["Programmez **toutes vos gardes du mois**.", "Enregistrez la position **dans la pharmacie**."],
  faq: [["Ma garde est finie ?", "Elle s'arrête toute seule à la date de fin."]],
};

// ================================================================ Station-essence (gérant)
function gerant() {
  const mocks = scenarios.gerant.mocks;
  const entry = mocks.find(([pattern]) => pattern.source.includes("station-manager"));
  const outlets = typeof entry[1] === "function" ? entry[1]("") : entry[1];
  entry[1] = outlets;
  return {
    user: true,
    proxy: true,
    mocks,
    onWrite(url, body, method) {
      const outlet = outlets.find((o) => url.includes(o.id));
      if (method === "PUT" && outlet) {
        if (body.fuel) Object.assign(outlet.fuel, body.fuel);
        outlet.fuel_updated_at = new Date().toISOString();
        outlet.fuel_fresh = true;
        return outlet;
      }
      if (url.endsWith("/deliveries")) return { id: "d-new", outlet_id: outlet?.id, outlet_name: outlet?.name, fuel: body.fuel, liters: body.liters, reference: body.reference ?? null, delivered_at: new Date().toISOString(), recorded_by: "Vous" };
      return {};
    },
  };
}
GUIDES.station = {
  who: "Stations-essence", title: "Ma station, pas à pas", subtitle: "Du compte aux disponibilités, chaque clic",
  video: "AMAZER_pas-a-pas-station.mp4", pdf: "AMAZER-Pas-a-pas-station.pdf",
  lead: "Le gérant crée son **compte gratuit**, il est **nommé** par sa marque, puis il tient sa station à jour : **carburants**, **horaires**, **position**, **livraisons**.",
  points: [["Le compte", "Gratuit, avec votre e-mail."], ["La nomination", "Par le responsable de ville."], ["La mise à jour", "Un geste par carburant."]],
  intro: intro("Aujourd'hui : gérer une station-essence."),
  outro: "Disponible, stock faible, rupture : un geste suffit, et vos clients savent où aller. Rendez-vous sur amazer.store.",
  end: ["Votre station, à jour", "amazer.store · Stations"],
  chapters: [
    compteClient({ name: "Aïchatou Issa", email: "aichatou@exemple.com", phone: "90000007", intro: "Le gérant crée d'abord son **compte AMAZER gratuit**, avec son e-mail." }),
    {
      title: "Ouvrir votre Espace station", intro: "Donnez votre **e-mail** au responsable de ville : il vous nomme gérant de la station.", persona: gerant, route: "/",
      scenes: [
        { say: "Donnez votre e-mail à votre responsable de ville : il vous nomme gérant. Ensuite, touchez Menu, puis Espace station.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Espace station", LINK); }, guide: g("Espace station", "Une fois nommé : **Menu** → **Espace station**.") },
        { say: "Votre station s'affiche. Pour chaque carburant, un seul geste : disponible, stock faible, ou rupture. Ici, plus de gasoil : touchez Rupture.",
          do: (f) => f.click("Rupture", { nth: 1 }), guide: g("Les disponibilités", "Pour chaque carburant : **Disponible**, **Stock faible** ou **Rupture**. Les clients le voient aussitôt.") },
        { say: "Dans Informations et horaires, indiquez l'adresse, le téléphone, les horaires et les services.",
          do: (f) => f.click("Informations et horaires"), guide: g("Informations", "**Informations et horaires** : adresse, téléphone, horaires, services.") },
        { say: "Dans Garde, indiquez si votre station est de garde : jusqu'à nouvel ordre, ou jusqu'à une date. Sur la carte, les clients la voient avec un cercle.",
          do: async (f) => { await f.click("Garde", { selector: "button" }); await f.point("Mettre de garde", { selector: "button" }); },
          guide: g("La garde", "Section **Garde** : **Mettre de garde**, jusqu'à nouvel ordre ou jusqu'à une date.") },
        { say: "Dans Position Google Maps, placez-vous à la station, et touchez Je suis à la station.",
          do: async (f) => { await f.click("Position Google Maps"); await f.point("Je suis à la station"); }, guide: g("La position", "**Position Google Maps** → **Je suis à la station**.") },
        { say: "Quand un camion arrive, ouvrez Livraisons, et notez le carburant, la quantité et le numéro du bon.",
          do: async (f) => { await f.click("Livraisons"); await fill(f, "Ex. 15000", "15000"); }, guide: g("Les livraisons", "**Livraisons** : carburant, **litres**, numéro du bon, puis **Enregistrer la livraison**.") },
      ],
    },
    {
      title: "Ce que voient les clients", intro: "Page **Où trouver de l'essence** : liste et **carte**.", persona: () => ({ proxy: true, mocks: [[/\/services\/stations$/, STATIONS_PUBLIC]] }), route: "/stations",
      scenes: [
        { say: "Les clients touchent Voir la carte. Autour d'eux : en vert les stations qui ont du carburant, en orange le stock faible, en rouge la rupture. Le cercle, c'est la station de garde.",
          before: async (f) => { await f.goto("/stations"); await here(f); },
          do: async (f) => { await f.click("Voir la carte", { selector: "button" }); await ready(f, "Disponible", "li"); await wait(2500); await f.point("Cerclé : de garde", { selector: "li" }); },
          guide: g("La carte", "**Voir la carte** : vert = disponible, orange = stock faible, rouge = rupture, **cercle = de garde**.") },
      ],
    },
  ],
  tips: ["Mettez à jour **dès qu'un carburant change**.", "Notez **chaque livraison** de camion."],
  faq: [["Je ne vois pas Espace station ?", "Votre responsable de ville doit vous ajouter avec **le même e-mail** que votre compte."]],
};

// ================================================================ Revendeur
GUIDES.revendeur = {
  who: "Revendeurs", title: "Revendre, pas à pas", subtitle: "Du compte à la première marge, chaque clic",
  video: "AMAZER_pas-a-pas-revendeur.mp4", pdf: "AMAZER-Pas-a-pas-revendeur.pdf",
  lead: "Toutes les étapes : **créer votre compte**, **activer** la revente, **choisir** des produits, fixer **votre prix**, **partager**, **encaisser**.",
  points: [["Activer", "Abonnement Nita ou Amana."], ["Choisir", "Votre prix, votre marge."], ["Partager", "Votre lien sur WhatsApp."]],
  intro: intro("Aujourd'hui : revendre sans stock."),
  outro: "Choisissez, partagez, encaissez. Commencez aujourd'hui sur amazer.store.",
  end: ["À vous de vendre !", "amazer.store · Revendre"],
  chapters: [
    compteClient({ name: "Ali Garba", email: "ali@exemple.com", phone: "90000008" }),
    {
      title: "Activer la revente", persona: () => ({ ...P.revendeur }), route: "/",
      scenes: [
        { say: "Touchez Menu, puis Gagner avec AMAZER, puis Revendre sans stock.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Gagner avec AMAZER", MENU); await f.click("Revendre sans stock", LINK); }, guide: g("Revendre sans stock", "**Menu** → **Gagner avec AMAZER** → **Revendre sans stock**.") },
        { say: "Pour activer la revente, choisissez Nita ou Amana, envoyez le montant affiché, et écrivez la référence du paiement. AMAZER vérifie et active.",
          do: (f) => f.point("Nita Transfert"), guide: g("Activez", "Choisissez **Nita** ou **Amana**, envoyez le montant, écrivez la **référence**.") },
      ],
    },
    {
      title: "Choisir et fixer son prix", persona: () => ({ ...P.revendeur }), route: "/revendre",
      scenes: [
        { say: "Dans Choisir des produits à revendre, cherchez un produit.",
          do: async (f) => { await fill(f, "Riz, téléphone, savon", "samsung"); await ready(f, "Samsung", "*"); }, guide: g("Cherchez", "Écrivez le nom d'un produit.") },
        { say: "Vous voyez le prix de la boutique et ce que vous gagnez. Écrivez votre prix, puis touchez Revendre.",
          do: (f) => f.click("Revendre", { selector: "button" }), guide: g("Votre prix", "Écrivez **Mon prix de revente**, puis **Revendre**.", "Gain = votre prix − prix boutique.") },
        { say: "Copiez le lien de votre boutique, ou partagez-le directement sur WhatsApp.",
          do: async (f) => { await f.click("Copier le lien"); await f.point("Partager sur WhatsApp"); }, guide: g("Partagez", "**Copier le lien** ou **Partager sur WhatsApp**.") },
        { say: "Ici, suivez vos gains. AMAZER vous verse votre marge par Nita ou Amana après la livraison.",
          do: (f) => f.point("Gagné net", TXT), guide: g("Vos gains", "**Gagné net**, **Déjà reçu**, **à recevoir**.") },
      ],
    },
  ],
  tips: ["Des produits que **vos proches achètent déjà**.", "Une **petite marge** vend plus vite."],
  faq: [["Dois-je acheter les produits ?", "Non : la boutique prépare, AMAZER livre."]],
};

// ================================================================ Affilié
GUIDES.affilie = {
  who: "Affiliés", title: "L'affiliation, pas à pas", subtitle: "Du compte au premier retrait, chaque clic",
  video: "AMAZER_pas-a-pas-affilie.mp4", pdf: "AMAZER-Pas-a-pas-affilie.pdf",
  lead: "Toutes les étapes : **créer votre compte**, ouvrir **Affiliation**, **partager** votre lien, **retirer** vos gains. C'est **gratuit**.",
  points: [["Le compte", "Gratuit."], ["Le lien", "Personnel, à partager."], ["Les gains", "Retrait Nita, Amana, Airtel, Moov."]],
  intro: intro("Aujourd'hui : gagner avec l'affiliation."),
  outro: "Partagez votre lien, aidez les commerçants, et gagnez avec AMAZER.",
  end: ["Partagez et gagnez", "amazer.store · Affiliation"],
  chapters: [
    compteClient({ name: "Fatima Issa", email: "fatima@exemple.com", phone: "90000009" }),
    {
      title: "Partager votre lien", persona: () => ({ ...P.affilie, proxy: true }), route: "/",
      scenes: [
        { say: "Touchez Menu, puis Gagner avec AMAZER, puis Affiliation.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Gagner avec AMAZER", MENU); await f.click("Affiliation", LINK); }, guide: g("Affiliation", "**Menu** → **Affiliation**.") },
        { say: "Votre code et votre lien sont prêts. Touchez Copier mon lien.",
          do: (f) => f.click("Copier mon lien"), guide: g("Copiez votre lien", "Touchez **Copier mon lien**.") },
        { say: "Pour un commerçant, copiez le lien pour les vendeurs : il arrive droit sur la création de boutique.",
          do: (f) => f.click("Lien pour les vendeurs"), guide: g("Lien vendeurs", "**Lien pour les vendeurs**.") },
      ],
    },
    {
      title: "Retirer vos gains", persona: () => ({ ...P.affilie, proxy: true }), route: "/affiliation",
      scenes: [
        { say: "Vos gains : disponible, en attente, déjà payé.",
          do: (f) => f.point("Disponible", TXT), guide: g("Vos gains", "**Disponible**, **En attente**, **Déjà payé**.") },
        { say: "Choisissez le moyen de paiement, écrivez le numéro qui reçoit l'argent, puis touchez Demander le paiement.",
          do: (f) => f.click("Demander le paiement"), guide: g("Retirez", "Moyen de paiement, **numéro**, puis **Demander le paiement**.") },
      ],
    },
  ],
  tips: ["Aidez les commerçants à publier leurs **5 premiers produits**.", "Partagez sur votre **statut WhatsApp**."],
  faq: [["Faut-il payer ?", "Non, c'est gratuit."]],
};

// ================================================================ Livreur
GUIDES.livreur = {
  who: "Livreurs", title: "Livrer, pas à pas", subtitle: "Du compte à la première livraison, chaque clic",
  video: "AMAZER_pas-a-pas-livreur.mp4", pdf: "AMAZER-Pas-a-pas-livreur.pdf",
  lead: "Toutes les étapes : **créer votre compte**, demander l'**activation livreur**, **prendre** une course, **retirer**, **livrer**.",
  points: [["Le compte", "Gratuit, activé par AMAZER."], ["La course", "Frais affichés."], ["La livraison", "Colis remis, rien à encaisser."]],
  intro: intro("Aujourd'hui : devenir livreur AMAZER."),
  outro: "Choisir, retirer, livrer : c'est simple. Bonne route avec AMAZER !",
  end: ["Bonne route !", "amazer.store · Espace livreur"],
  chapters: [
    compteClient({ name: "Issa Souley", email: "issa@exemple.com", phone: "90000010" }),
    {
      title: "Devenir livreur", persona: inscription, route: "/livreur",
      scenes: [
        { say: "Ouvrez la page Espace livreurs, et touchez Devenir livreur. Vous écrivez à AMAZER sur WhatsApp, et l'équipe active votre compte.",
          do: (f) => f.point("Devenir livreur"), guide: g("Devenir livreur", "Page **Espace livreurs** → **Devenir livreur** (WhatsApp). AMAZER **active** votre compte.") },
      ],
    },
    {
      title: "Prendre et livrer une course", persona: () => ({ ...P.livreur, proxy: true }), route: "/",
      scenes: [
        { say: "Une fois activé : touchez Menu, puis Espace livreur.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Espace livreur", LINK); }, guide: g("Espace livreur", "**Menu** → **Espace livreur**.") },
        { say: "Chaque course montre la boutique de retrait, les articles et vos frais. La commande est déjà payée.",
          do: (f) => f.point("Frais de livraison", TXT), guide: g("La course", "Boutique, articles, **frais de livraison**. **Déjà payé**.") },
        { say: "Touchez Prendre cette course.",
          do: (f) => f.click("Prendre"), guide: g("Prenez la course", "Touchez **Prendre cette course**.") },
        { say: "Allez à la boutique avec l'itinéraire, puis chez le client. Remettez le colis, et touchez Livrée.",
          do: async (f) => { await f.click("Mes livraisons", { selector: "button" }); await f.point("Livr"); }, guide: g("Livrez", "**Itinéraire**, retrait, remise du colis, puis **Livrée** (ou scannez le reçu).") },
      ],
    },
  ],
  tips: ["Ne demandez **jamais d'argent** au client.", "Appelez le client en arrivant."],
  faq: [["Comment être activé ?", "Touchez **Devenir livreur** : l'équipe AMAZER vous contacte."]],
};
