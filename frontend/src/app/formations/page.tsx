import Link from "next/link";
import { BookOpen, ExternalLink, PlayCircle } from "lucide-react";

export const metadata = {
  title: "Formations gratuites — AMAZER",
  description: "Apprendre à revendre sans stock, vendre sur WhatsApp et réussir sa boutique en ligne avec AMAZER.",
};

// Mini-formation AMAZER : courte, concrete, adaptee au marche local.
const LESSONS: { title: string; points: string[] }[] = [
  {
    title: "1. La revente sans stock sur AMAZER",
    points: [
      "Vous choisissez des produits déjà vendus sur AMAZER et fixez votre prix.",
      "Le client paie sur AMAZER : la boutique prépare, un livreur AMAZER livre.",
      "Votre marge (votre prix − prix de la boutique) vous est versée après la livraison, moins la commission AMAZER.",
      "Un petit abonnement mensuel garde votre boutique en ligne (essai gratuit quand AMAZER en propose).",
      "Aucun stock, aucun local, aucune livraison à gérer.",
    ],
  },
  {
    title: "2. Choisir les bons produits",
    points: [
      "Partez de ce que votre entourage achète déjà : alimentation, téléphones, hygiène, maison.",
      "Préférez les produits en stock, avec de bonnes photos et une boutique vérifiée.",
      "Commencez avec 5 à 10 produits, puis gardez ceux qui se vendent.",
    ],
  },
  {
    title: "3. Fixer un prix juste",
    points: [
      "Une marge de 10 à 20 % est raisonnable pour démarrer ; AMAZER plafonne à 3 fois le prix boutique.",
      "Comparez avec le prix du marché : un prix trop haut fait fuir les clients.",
      "Annoncez que la livraison est en plus et que le paiement est sécurisé par AMAZER.",
    ],
  },
  {
    title: "4. Vendre sur WhatsApp",
    points: [
      "Publiez 2 ou 3 produits par jour dans votre statut, avec le prix et votre lien de boutique.",
      "Utilisez WhatsApp Business : catalogue, message d'accueil, réponses rapides.",
      "Répondez vite et poliment : la confiance fait la vente.",
    ],
  },
  {
    title: "5. Facebook, TikTok et vidéos courtes",
    points: [
      "Une vidéo de 15 secondes qui montre le produit vend mieux qu'un long texte.",
      "Lumière du jour, fond simple, produit net : votre téléphone suffit.",
      "Mettez toujours votre lien de boutique AMAZER en description.",
    ],
  },
  {
    title: "6. Confiance et sécurité",
    points: [
      "Faites toujours payer sur AMAZER : jamais d'avance en main propre ou par transfert direct.",
      "Ne promettez pas de délai que vous ne maîtrisez pas : le client suit sa commande sur AMAZER.",
      "Un client satisfait revient et vous recommande.",
    ],
  },
  {
    title: "7. Recevoir vos gains",
    points: [
      "Vos gains nets (après la commission AMAZER) s'affichent dans « Revendre » : « en attente » puis « gagné » une fois livré.",
      "Pensez à renouveler votre abonnement : sans lui, votre boutique est masquée.",
      "Demandez votre versement à AMAZER sur WhatsApp ; il est fait par Nita ou Amana.",
    ],
  },
];

const RESOURCES: { title: string; text: string; href: string; video?: boolean }[] = [
  {
    title: "Vidéos : débuter le dropshipping (Afrique)",
    text: "Sélection de tutoriels YouTube en français.",
    href: "https://www.youtube.com/results?search_query=dropshipping+d%C3%A9butant+afrique",
    video: true,
  },
  {
    title: "Vidéos : vendre avec WhatsApp Business",
    text: "Catalogue, statuts, réponses rapides.",
    href: "https://www.youtube.com/results?search_query=vendre+sur+whatsapp+business+tutoriel",
    video: true,
  },
  {
    title: "Vidéos : photos de produits au smartphone",
    text: "Des photos qui donnent envie, sans matériel.",
    href: "https://www.youtube.com/results?search_query=photo+produit+avec+smartphone+tutoriel",
    video: true,
  },
  {
    title: "Vidéos : vendre sur Facebook Marketplace",
    text: "Publier, répondre, conclure.",
    href: "https://www.youtube.com/results?search_query=facebook+marketplace+vendre+tutoriel+fran%C3%A7ais",
    video: true,
  },
  {
    title: "Google — Ateliers numériques",
    text: "Formations gratuites en marketing digital, avec certificat.",
    href: "https://grow.google/intl/fr_fr/",
  },
  {
    title: "Meta Blueprint",
    text: "Cours gratuits Facebook et Instagram (connexion Facebook requise).",
    href: "https://www.facebook.com/business/learn",
  },
  {
    title: "WhatsApp Business",
    text: "L'application gratuite pour vendre et répondre aux clients.",
    href: "https://business.whatsapp.com/",
  },
  {
    title: "TikTok pour les entreprises",
    text: "Conseils pour vendre avec des vidéos courtes.",
    href: "https://ads.tiktok.com/business/fr",
  },
  {
    title: "Canva",
    text: "Créer gratuitement des visuels et affiches pour vos produits.",
    href: "https://www.canva.com/",
  },
  {
    title: "Shopify — Guide du dropshipping",
    text: "Le guide de référence (en anglais).",
    href: "https://www.shopify.com/blog/what-is-dropshipping",
  },
];

export default function FormationsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8">
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display">
          <BookOpen className="h-6 w-6 text-brand-400" aria-hidden="true" />
          Formations gratuites
        </h1>
        <p className="mt-1 text-sm text-white/80">Revendre sans stock, vendre sur WhatsApp et réussir en ligne.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/revendre"
            className="inline-flex min-h-11 items-center rounded-field bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Commencer à revendre
          </Link>
          <Link
            href="/vendre"
            className="inline-flex min-h-11 items-center rounded-field border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
          >
            Ouvrir ma boutique
          </Link>
        </div>
      </header>

      <section aria-label="Mini-formation AMAZER" className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">La mini-formation AMAZER (10 minutes)</h2>
        {LESSONS.map((lesson, index) => (
          <details key={lesson.title} open={index === 0} className="group rounded-card border border-border bg-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-ink-900">
              {lesson.title}
              <span className="text-ink-500 transition-transform duration-fast group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <ul className="space-y-2 px-4 pb-4 text-sm text-ink-700">
              {lesson.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-brand-600" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section aria-label="Ressources externes" className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">Vidéos et sites pour aller plus loin</h2>
        <p className="text-sm text-ink-600">Ressources gratuites et externes à AMAZER.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RESOURCES.map((resource) => {
            const Icon = resource.video ? PlayCircle : ExternalLink;
            return (
              <li key={resource.href}>
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full gap-3 rounded-card border border-border bg-card p-4 transition-colors duration-fast hover:border-ink-400"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-ink-900">{resource.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-600">{resource.text}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
