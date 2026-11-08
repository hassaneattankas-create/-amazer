// Contenu des guides : ce qui est dit (voix), ce qui est montré (actions) et ce qui est écrit (PDF).
// Règle d'écriture : phrases courtes, mots simples, un geste par étape.
import * as P from "./personas.mjs";

export const FORM = { selector: "button[type=submit]" };
export const TXT = { selector: "p,span,h2,h3,dt,dd,li,strong,div" };
export const g = (title, text, tip) => ({ title, text, ...(tip ? { tip } : {}) });

export const GUIDES = {};

// ---------------------------------------------------------------- Livreur
GUIDES.livreur = {
  who: "Livreurs",
  title: "Livrer avec AMAZER",
  subtitle: "Prendre une course, retirer, livrer",
  video: "AMAZER_guide-livreur.mp4",
  pdf: "AMAZER-Guide-livreur.pdf",
  lead: "Vous livrez les commandes des boutiques et des restaurants. Tout se fait depuis votre téléphone, dans l'**Espace livreur**.",
  points: [
    ["Choisir", "Vous voyez les courses disponibles et vos frais de livraison."],
    ["Retirer", "Vous allez à la boutique avec l'itinéraire et le numéro."],
    ["Livrer", "Vous remettez le colis et scannez le reçu du client."],
  ],
  intro: "Vous êtes livreur AMAZER ? Voici comment prendre une course, retirer le colis et le livrer au client.",
  outro: "Choisir, retirer, livrer : c'est simple. Bonne route avec AMAZER !",
  end: ["Bonne route !", "amazer.store · Espace livreur"],
  chapters: [
    {
      title: "Trouver une course",
      intro: "Votre compte doit être activé comme livreur par l'équipe AMAZER.",
      persona: () => ({ ...P.livreur }),
      route: "/livreur",
      scenes: [
        { say: "Connectez-vous, puis ouvrez l'Espace livreur. En haut, vous voyez les courses à prendre, celles en cours, et celles livrées aujourd'hui.",
          do: (f) => f.point("À prendre", TXT), guide: g("Ouvrez l'Espace livreur", "Connectez-vous avec votre compte livreur. Les compteurs montrent les courses **à prendre**, **en cours** et **livrées aujourd'hui**.") },
        { say: "Chaque course montre la boutique où retirer le colis, les articles, et vos frais de livraison.",
          do: (f) => f.point("Frais de livraison", TXT), guide: g("Lisez la course", "Vous voyez la **boutique de retrait**, les **articles** et vos **frais de livraison**.") },
        { say: "La commande est déjà payée. Vous n'encaissez rien auprès du client.",
          do: (f) => f.point("Déjà payé", TXT), guide: g("Rien à encaisser", "La commande est **déjà payée** au moment où vous la prenez. Ne demandez jamais d'argent au client.") },
        { say: "Pour aller à la boutique, touchez Itinéraire boutique. Vous pouvez aussi l'appeler.",
          do: (f) => f.point("Itinéraire boutique"), guide: g("Allez à la boutique", "**Itinéraire boutique** ouvre Google Maps. **Appeler** vous met en contact avec la boutique.") },
        { say: "Quand vous êtes prêt, touchez Prendre en charge. La course est à vous.",
          do: (f) => f.click("Prendre en charge"), guide: g("Prenez la course", "Touchez **Prendre en charge**. La course est réservée pour vous.") },
      ],
    },
    {
      title: "Livrer le client",
      intro: "Après la prise en charge, l'adresse exacte et le numéro du client apparaissent.",
      persona: () => ({ ...P.livreur }),
      route: "/livreur",
      scenes: [
        { say: "Vos courses sont dans Mes livraisons. L'adresse exacte et le numéro du client sont maintenant visibles.",
          do: (f) => f.click("Mes livraisons"), guide: g("Ouvrez Mes livraisons", "Vous y retrouvez vos courses, avec l'**adresse exacte** du client.") },
        { say: "Appelez le client, écrivez-lui sur WhatsApp, ou suivez l'itinéraire jusqu'à lui.",
          do: (f) => f.point("Itinéraire client"), guide: g("Rejoignez le client", "**Appeler le client**, **WhatsApp** ou **Itinéraire client** : choisissez ce qui vous aide.") },
        { say: "À la remise du colis, scannez le code QR du reçu du client. C'est la preuve que la commande est bien livrée.",
          do: (f) => f.point("Scanner le reçu du client"), guide: g("Scannez le reçu", "Le client vous montre son reçu. Touchez **Scanner le reçu du client** et visez le code QR.", "Sans scan possible, utilisez **Marquer livrée sans scan**.") },
        { say: "Si vous ne pouvez pas livrer, touchez Je ne peux pas la livrer. Un autre livreur la prendra.",
          do: (f) => f.point("Je ne peux pas la livrer"), guide: g("Un empêchement ?", "Touchez **Je ne peux pas la livrer** : la course retourne dans la liste pour un autre livreur.") },
      ],
    },
  ],
  tips: [
    "Prenez une course seulement si vous pouvez la livrer **avant l'heure indiquée**.",
    "Vérifiez les articles à la boutique **avant de partir**.",
    "Prévenez le client de votre arrivée par un appel ou un message WhatsApp.",
    "Ne demandez **jamais d'argent** : la commande est déjà payée.",
    "Scannez toujours le reçu : c'est votre preuve de livraison.",
  ],
  faq: [
    ["Comment devenir livreur ?", "Créez un compte AMAZER gratuit, puis contactez l'équipe AMAZER pour qu'elle active votre compte livreur."],
    ["Le client n'est pas là ?", "Appelez-le ou écrivez-lui sur WhatsApp. Si vous ne pouvez pas livrer, rendez la course avec **Je ne peux pas la livrer**."],
    ["Le scan ne marche pas ?", "Touchez **Marquer livrée sans scan** une fois le colis remis."],
  ],
};
