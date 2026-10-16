import Link from "next/link";

export const metadata = {
  title: "Conditions d'utilisation — AMAZER",
  description: "Règles d'utilisation d'AMAZER : achats, restaurants, hôtels, trajets, paiements, remboursements, avis, affiliation.",
};

type Section = { id: string; title: string; paragraphs: string[] };

/** Conditions d'utilisation : un texte simple, par sujet. Les montants sont affiches sur les pages concernees. */
const SECTIONS: Section[] = [
  {
    id: "general",
    title: "1. Le rôle d'AMAZER",
    paragraphs: [
      "AMAZER met en relation des clients avec des boutiques, restaurants, hôtels, transporteurs, revendeurs et livreurs. En créant un compte ou en utilisant le site ou l'application, vous acceptez ces conditions.",
      "Chaque établissement est responsable de ce qu'il publie : produits, plats, chambres, trajets, prix, photos, disponibilités, et du respect des lois en vigueur. Pour une question sur un produit ou un service, contactez directement l'établissement depuis sa page.",
      "Vous devez donner des informations exactes (nom, téléphone, adresse) et garder votre mot de passe secret. Un compte est personnel.",
    ],
  },
  {
    id: "achats",
    title: "2. Commandes en boutique et au restaurant",
    paragraphs: [
      "Les commandes en boutique et au restaurant sont payées à AMAZER par Nita ou Amana. La commande n'est traitée qu'une fois le paiement vérifié. Le prix affiché au moment de la commande (y compris une promotion en cours) est celui que vous payez.",
      "Un restaurant peut refuser une commande (plat épuisé, cuisine fermée, trop de commandes). Il peut aussi suspendre les commandes ou n'en accepter que pendant ses horaires.",
      "La commande est confirmée livrée lorsque le livreur, l'établissement ou vous-même le confirmez, ou lorsque le QR code de votre reçu est scanné. Vérifiez votre commande à la réception.",
    ],
  },
  {
    id: "remboursements",
    title: "3. Annulations et remboursements (paiements faits à AMAZER)",
    paragraphs: [
      "Vous pouvez annuler vous-même une commande non payée tant qu'elle n'est pas en livraison.",
      "Si une commande déjà payée à AMAZER est annulée par AMAZER ou refusée par le restaurant, AMAZER vous rembourse sur le numéro Nita ou Amana utilisé, dans les meilleurs délais. Vous recevez une notification avec la référence du remboursement.",
      "Pour toute réclamation (produit non conforme, commande incomplète), contactez AMAZER dans les 48 heures après la livraison, avec votre numéro de commande.",
    ],
  },
  {
    id: "reservations",
    title: "4. Réservations d'hôtels et de trajets",
    paragraphs: [
      "Une réservation d'hôtel ou de trajet est une demande envoyée à l'établissement. Elle n'est valable qu'après sa confirmation, que vous recevez par notification.",
      "Pour les hôtels et les transporteurs, vous payez directement l'établissement (Nita ou Amana, sur le numéro indiqué). AMAZER n'encaisse pas ce paiement : les annulations, modifications et remboursements se règlent avec l'établissement, selon ses propres conditions. AMAZER peut vous aider à le joindre, mais n'est pas responsable du remboursement.",
      "Un billet de trajet est personnel. Son QR code n'est valable qu'une seule fois, pour le départ indiqué, et seulement auprès de la compagnie concernée. Présentez-vous à l'avance : un voyageur absent au départ peut perdre sa place.",
      "Un hôtel peut indiquer que vous ne vous êtes pas présenté. La chambre est alors libérée.",
    ],
  },
  {
    id: "hors-amazer",
    title: "5. Paiement et livraison en dehors d'AMAZER",
    paragraphs: [
      "AMAZER protège uniquement les achats payés sur la plateforme et livrés par un livreur AMAZER. Si vous payez une boutique directement, ou si vous vous faites livrer par une personne qui n'est pas un livreur AMAZER, vous le faites à vos risques : AMAZER n'est pas responsable en cas d'arnaque, de perte, de produit non conforme ou de litige.",
      "En cas de doute sur un livreur, demandez-lui le numéro de commande affiché dans votre compte ou contactez AMAZER avant de payer.",
    ],
  },
  {
    id: "avis",
    title: "6. Avis clients",
    paragraphs: [
      "Seul un client ayant eu une commande livrée, un séjour ou un voyage avec un établissement peut donner son avis sur cet établissement, une seule fois (il peut le modifier). Votre avis est publié avec votre prénom et l'initiale de votre nom.",
      "Un avis doit être honnête et respectueux. Sont interdits : insultes, menaces, propos discriminatoires, informations personnelles, publicité, faux avis ou avis rémunérés. AMAZER peut masquer un avis qui ne respecte pas ces règles.",
      "L'établissement peut répondre publiquement aux avis. Il ne peut ni les modifier ni les supprimer.",
    ],
  },
  {
    id: "vendeurs",
    title: "7. Vendeurs, restaurants, hôtels et transporteurs",
    paragraphs: [
      "L'ouverture d'un espace vendeur est soumise à un abonnement, avec une période d'essai gratuite. Les tarifs en vigueur sont affichés lors de l'inscription et dans « Profil et abonnement ». Sans paiement à la fin de la période, l'espace peut être suspendu.",
      "L'établissement s'engage à publier des informations exactes (prix, stock, chambres disponibles, horaires de départ, places), à traiter rapidement les commandes et réservations, et à respecter les clients. Les hôtels et transporteurs remboursent eux-mêmes leurs clients en cas d'annulation de leur fait.",
      "AMAZER peut suspendre un espace en cas de fraude, de plaintes répétées, d'informations trompeuses ou de non-paiement.",
    ],
  },
  {
    id: "revendeurs",
    title: "8. Revendeurs (revente sans stock)",
    paragraphs: [
      "Le revendeur fixe son prix entre le prix de la boutique d'origine et le plafond indiqué sur la page « Revendre ». La boutique d'origine prépare et livre la commande ; AMAZER prélève une commission sur la marge du revendeur, selon le taux affiché.",
      "Le revendeur doit présenter fidèlement les produits et ne pas promettre ce que la boutique ne propose pas.",
    ],
  },
  {
    id: "affiliation",
    title: "9. Affiliation et ambassadeurs",
    paragraphs: [
      "L'affiliation est gratuite. L'affilié gagne une part des abonnements payés par les vendeurs qu'il a amenés, pendant une durée limitée, et un bonus fixe sur la première commande livrée d'un nouveau client. Les taux et montants en vigueur sont affichés sur la page « Affiliation ». Un simple clic ne rapporte rien.",
      "Les ambassadeurs sont nommés par AMAZER. Ils bénéficient de taux améliorés affichés dans leur espace. AMAZER peut retirer ce statut à tout moment.",
      "Chaque gain respecte un délai de sécurité avant d'être payable, puis il est versé sur demande, à partir du minimum affiché. Vos propres inscriptions et achats ne comptent pas.",
      "Toute fraude (faux comptes, auto-parrainage, inscriptions en série, achats fictifs, publicité trompeuse) entraîne l'annulation des gains non payés, la récupération des gains obtenus par fraude et la suspension du compte.",
      "AMAZER peut modifier les taux et montants pour l'avenir ; les gains déjà acquis ne sont pas modifiés. L'affilié agit de façon indépendante : il n'est ni salarié ni représentant d'AMAZER, et il déclare lui-même ses revenus si la loi l'exige.",
    ],
  },
  {
    id: "livreurs",
    title: "10. Livreurs",
    paragraphs: [
      "Le livreur utilise les informations du client (nom, téléphone, adresse) uniquement pour la livraison. Il confirme la livraison sur place, de préférence en scannant le QR code du reçu.",
    ],
  },
  {
    id: "suspension",
    title: "11. Suspension, responsabilité et contact",
    paragraphs: [
      "AMAZER peut suspendre ou supprimer un compte en cas de fraude, d'abus, de tentative de contournement de la sécurité ou de non-respect des présentes conditions.",
      "AMAZER fait son possible pour que le service fonctionne en continu, sans pouvoir garantir l'absence d'interruption. AMAZER n'est pas responsable des produits et services des établissements, ni des paiements faits en dehors de la plateforme.",
      "Ces conditions peuvent évoluer ; la date de mise à jour est indiquée en haut de cette page. Pour toute question : amazer.niger2@gmail.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-gutter pb-16 pt-4">
      <article className="space-y-6 rounded-card border border-border bg-card p-5 sm:p-6">
        <header>
          <h1 className="text-3xl font-semibold text-ink-900">Conditions d&apos;utilisation AMAZER</h1>
          <p className="mt-2 text-sm text-ink-600">Dernière mise à jour : 16/10/2026</p>
        </header>

        <nav aria-label="Sommaire" className="rounded-field bg-surface-1 p-4">
          <p className="text-sm font-semibold text-ink-900">Sommaire</p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="inline-flex min-h-9 items-center text-brand-700 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 space-y-2">
            <h2 id={`${section.id}-title`} className="text-base font-semibold text-ink-900">
              {section.title}
            </h2>
            {section.paragraphs.map((text) => (
              <p key={text.slice(0, 40)} className="text-sm leading-6 text-ink-700">
                {text}
              </p>
            ))}
          </section>
        ))}

        <p className="text-sm text-ink-700">
          Voir aussi la{" "}
          <Link href="/legal/privacy" className="font-semibold text-brand-700 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </article>
    </section>
  );
}
