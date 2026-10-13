import type { Metadata } from "next";
import Link from "next/link";

import { ADMIN_EMAIL } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Comment ça marche ? | AMAZER",
  description:
    "Créer un compte, trouver un produit, commander, payer par Nita ou Amana, suivre sa livraison ou ouvrir sa boutique : le guide pas à pas d'AMAZER.",
  alternates: { canonical: "/comment-ca-marche" },
};

type Guide = {
  id: string;
  question: string;
  steps: React.ReactNode[];
  note?: React.ReactNode;
};

type Section = {
  id: string;
  title: string;
  guides: Guide[];
};

const linkClass = "font-medium text-brand-600 hover:underline";

const SECTIONS: Section[] = [
  {
    id: "acheter",
    title: "Acheter sur AMAZER",
    guides: [
      {
        id: "compte",
        question: "Comment créer un compte ?",
        steps: [
          <>
            Ouvrez la page{" "}
            <Link className={linkClass} href="/register">
              Créer un compte
            </Link>
            .
          </>,
          "Saisissez votre adresse e-mail ou votre numéro WhatsApp (+227), votre nom et un mot de passe.",
          "Le mot de passe doit contenir au moins 8 caractères, avec une minuscule, une majuscule, un chiffre et un caractère spécial.",
          "Validez : vous êtes connecté et pouvez commander.",
        ],
      },
      {
        id: "rechercher",
        question: "Comment trouver un produit ou une boutique ?",
        steps: [
          <>
            Utilisez la barre de{" "}
            <Link className={linkClass} href="/search">
              recherche
            </Link>{" "}
            : nom du produit, marque ou catégorie.
          </>,
          <>
            Pour parcourir les commerces, ouvrez la page{" "}
            <Link className={linkClass} href="/boutiques">
              Boutiques
            </Link>{" "}
            puis choisissez une boutique pour voir ses produits, ses horaires et son contact.
          </>,
          "Sur une fiche produit, vous voyez les offres des boutiques qui le vendent, avec leur prix et leur stock.",
        ],
      },
      {
        id: "commander",
        question: "Comment passer une commande ?",
        steps: [
          "Ajoutez les produits depuis leur fiche avec « Ajouter au panier intelligent ».",
          <>
            Ouvrez le{" "}
            <Link className={linkClass} href="/cart">
              panier
            </Link>{" "}
            : vérifiez les quantités et le total.
          </>,
          "Choisissez la livraison : Standard ou Express Niamey. Les frais de livraison s'affichent avant la confirmation ; ils sont comptés par boutique.",
          "Choisissez le mode de paiement (Nita Transfert ou Amana Transfert), puis validez la commande.",
        ],
        note: "Le prix est toujours recalculé par AMAZER au moment de la commande : vous payez le prix affiché par la boutique à cet instant.",
      },
      {
        id: "payer",
        question: "Comment payer ma commande ?",
        steps: [
          "Amana Transfert : sur la page de paiement, cliquez « Démarrer le paiement Amana », validez le montant exact dans l'application AmanaTa, puis cliquez « Vérifier le paiement ». La commande est confirmée dès qu'Amana valide la transaction.",
          "Nita Transfert : envoyez le montant au numéro AMAZER indiqué sur la page de paiement, en mentionnant la référence de paiement. Saisissez ensuite la référence de votre transaction et cliquez « J'ai payé - envoyer la référence ».",
          "Pour Nita, la commande reste « Paiement en attente » jusqu'à ce que l'équipe AMAZER ait vérifié la transaction : la saisie de la référence ne suffit pas à confirmer le paiement.",
        ],
        note: "Ne communiquez jamais un code reçu par SMS, e-mail ou WhatsApp à une personne qui vous le demande, même au nom d'AMAZER.",
      },
      {
        id: "suivre",
        question: "Comment suivre ma commande ?",
        steps: [
          <>
            Ouvrez votre{" "}
            <Link className={linkClass} href="/dashboard">
              tableau de bord
            </Link>
            .
          </>,
          "Chaque commande affiche son avancement : Commande, Préparation, En livraison, Reçu.",
          "Si votre commande contient des produits de plusieurs boutiques, l'avancement de chaque boutique est indiqué séparément.",
          "À la réception, cliquez « J'ai reçu ma commande ».",
        ],
      },
      {
        id: "annuler",
        question: "Comment annuler une commande ?",
        steps: [
          "Tant que la commande n'est pas payée et pas encore en préparation, cliquez « Annuler la commande » dans votre tableau de bord.",
          "Une commande déjà payée ne s'annule pas en ligne : contactez le support avec le numéro de la commande.",
        ],
      },
      {
        id: "contacter",
        question: "Comment contacter un vendeur ?",
        steps: [
          "Ouvrez la page de la boutique et cliquez « Écrire à la boutique ».",
          <>
            Retrouvez toutes vos conversations dans{" "}
            <Link className={linkClass} href="/messages">
              Messages
            </Link>{" "}
            : vous êtes averti par une notification quand la boutique répond.
          </>,
          "Vos échanges sont privés : seuls vous et la boutique les voyez.",
          "En cas de propos abusifs, cliquez « Signaler » dans la conversation : l'équipe AMAZER est prévenue.",
        ],
      },
      {
        id: "reserver",
        question: "Comment réserver une table ou une chambre ?",
        steps: [
          "Sur la page d'un restaurant ou d'un hôtel qui accepte les réservations, remplissez le formulaire de réservation.",
          "Si un acompte est demandé, il se paie directement au numéro du commerçant indiqué sur la page.",
          "Votre réservation est confirmée par le commerçant après vérification de l'acompte.",
        ],
      },
    ],
  },
  {
    id: "vendre",
    title: "Vendre sur AMAZER",
    guides: [
      {
        id: "boutique",
        question: "Comment ouvrir ma boutique ?",
        steps: [
          <>
            Ouvrez la page{" "}
            <Link className={linkClass} href="/vendre">
              Devenir vendeur
            </Link>{" "}
            et cliquez « Ouvrir mon espace vendeur ».
          </>,
          "Créez votre compte (ou connectez-vous), puis choisissez votre profil : boutique, restaurant ou premium entreprise.",
          "Renseignez votre boutique : nom, ville, adresse, logo, description, horaires et numéro WhatsApp.",
          "Les conditions d'abonnement en vigueur sont indiquées dans votre espace vendeur.",
        ],
      },
      {
        id: "publier",
        question: "Comment publier des produits ?",
        steps: [
          <>
            Depuis votre{" "}
            <Link className={linkClass} href="/seller">
              espace vendeur
            </Link>
            , cliquez « Ajouter un produit » : nom, prix, stock, description et photos.
          </>,
          "Vous pouvez modifier à tout moment le prix, le stock et la description dans votre inventaire.",
          "Le stock diminue automatiquement lorsqu'une commande est payée.",
        ],
      },
      {
        id: "commandes-vendeur",
        question: "Comment gérer mes commandes ?",
        steps: [
          <>
            Vos commandes apparaissent dans votre{" "}
            <Link className={linkClass} href="/seller/dashboard">
              tableau de bord vendeur
            </Link>
            .
          </>,
          "Une commande « Paiement en attente » ne peut pas encore être traitée : attendez la confirmation du paiement.",
          "Une fois payée, faites-la avancer : Préparation, puis En livraison.",
          "Dans une commande partagée avec d'autres boutiques, vous ne faites avancer que votre partie.",
          "Les questions de vos clients arrivent dans Messages ; répondez depuis la même page.",
        ],
      },
    ],
  },
  {
    id: "compte",
    title: "Mon compte",
    guides: [
      {
        id: "mot-de-passe",
        question: "J'ai oublié mon mot de passe",
        steps: [
          <>
            Ouvrez la page{" "}
            <Link className={linkClass} href="/forgot-password">
              Mot de passe oublié
            </Link>{" "}
            et saisissez votre e-mail ou votre numéro WhatsApp.
          </>,
          "Saisissez le code à 6 chiffres reçu, puis choisissez un nouveau mot de passe.",
          "Pour votre sécurité, toutes vos sessions ouvertes sont alors déconnectées.",
        ],
      },
      {
        id: "probleme",
        question: "Comment signaler un problème ?",
        steps: [
          <>
            Donnez votre avis ou signalez un souci depuis la page{" "}
            <Link className={linkClass} href="/avis">
              Avis
            </Link>
            .
          </>,
          <>
            Pour une commande ou un paiement, écrivez au support :{" "}
            <a className={linkClass} href={`mailto:${ADMIN_EMAIL}`}>
              {ADMIN_EMAIL}
            </a>
            , en précisant le numéro de la commande.
          </>,
        ],
      },
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <section className="mx-auto max-w-3xl px-gutter py-10">
      <header>
        <h1 className="text-display-sm font-semibold tracking-display text-ink-900">Comment ça marche ?</h1>
        <p className="mt-3 text-base text-ink-600">
          Tout ce qu&apos;il faut savoir pour acheter, payer, suivre une commande ou vendre sur AMAZER, étape par étape.
        </p>
        <nav aria-label="Rubriques" className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-pill border border-border px-4 py-2 text-sm font-medium text-ink-700 hover:border-brand-500 hover:text-brand-600"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mt-10 scroll-mt-24">
          <h2 id={`${section.id}-title`} className="text-xl font-semibold text-ink-900">
            {section.title}
          </h2>
          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-card">
            {section.guides.map((guide) => (
              <details key={guide.id} id={guide.id} className="group px-4 py-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-medium text-ink-900">
                  {guide.question}
                  <span aria-hidden="true" className="text-ink-500 transition-transform duration-fast group-open:rotate-45">
                    +
                  </span>
                </summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-700">
                  {guide.steps.map((step, index) => (
                    <li key={`${guide.id}-${index}`}>{step}</li>
                  ))}
                </ol>
                {guide.note ? (
                  <p className="mt-3 rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-700">{guide.note}</p>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
