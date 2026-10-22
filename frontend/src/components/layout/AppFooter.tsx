"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { OPEN_INSTALL_EVENT } from "@/components/InstallAppBanner";
import { ADMIN_EMAIL } from "@/lib/admin";
import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { useT } from "@/lib/i18n";
import { getPublicContactInfo } from "@/services/finance-service";

const COLUMNS = [
  {
    title: "Acheter",
    links: [
      { href: "/boutiques", label: "Boutiques" },
      { href: "/promotions", label: "Promotions" },
      { href: "/restaurant", label: "Restaurants" },
      { href: "/hotels", label: "Premium : hôtels, transport, entreprises" },
      { href: "/pharmacies", label: "Pharmacies" },
      { href: "/stations", label: "Stations-essence" },
      { href: "/comment-ca-marche", label: "Comment ça marche ?" },
    ],
  },
  {
    title: "Vendre",
    links: [
      { href: "/vendre", label: "Devenir vendeur" },
      { href: "/revendre", label: "Revendre sans stock" },
      { href: "/affiliation", label: "Affiliation" },
      { href: "/formations", label: "Formations gratuites" },
      { href: "/seller", label: "Espace vendeur" },
      { href: "/comment-ca-marche#vendre", label: "Guide du vendeur" },
      { href: "/livreur", label: "Devenir livreur" },
    ],
  },
  {
    title: "Aide et légal",
    links: [
      { href: "/avis", label: "Signaler un problème" },
      { href: "/legal/terms", label: "Conditions d'utilisation" },
      { href: "/legal/privacy", label: "Politique de confidentialité" },
      { href: "/legal/account-deletion", label: "Suppression de compte" },
    ],
  },
] as const;

export function AppFooter() {
  const t = useT();
  // E-mail support réglé par l'admin (Réglages) ; à défaut, l'adresse AMAZER.
  const { data: contact } = useQuery({ queryKey: ["public-contact-info"], queryFn: getPublicContactInfo, staleTime: 10 * 60_000 });
  const supportEmail = contact?.support_email || ADMIN_EMAIL;
  return (
    <footer className="mt-12 border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-gutter py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-xl font-extrabold tracking-display text-ink-900">
            <Image src="/logo-amazer-mark-128.png" alt="" width={36} height={36} className="h-9 w-9" />
            AMAZER
          </p>
          <p className="mt-2 text-sm text-ink-600">
            {t("La marketplace africaine : boutiques, restaurants et services, du Niger vers le monde.")}
          </p>
          <WhatsAppButton
            variant="outline"
            label={t("Écrire à AMAZER")}
            message="Bonjour AMAZER, j'ai une question."
            className="mt-4"
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_INSTALL_EVENT))}
            className="mt-3 block min-h-9 text-sm font-semibold text-brand-700 hover:underline"
          >
            {t("Installer l'application")}
          </button>
          <p className="mt-3 text-sm text-ink-700">
            {t("Support :")}{" "}
            <a href={`mailto:${supportEmail}`} className="font-medium text-brand-700 hover:underline">
              {supportEmail}
            </a>
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={t(column.title)}>
            <p className="text-sm font-semibold text-ink-900">{t(column.title)}</p>
            <ul className="mt-3 space-y-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-9 items-center text-sm text-ink-600 hover:text-brand-700 hover:underline">
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-7xl px-gutter py-4 text-xs text-ink-600">
          © {new Date().getFullYear()} AMAZER · Niamey, Niger
        </p>
      </div>
    </footer>
  );
}
