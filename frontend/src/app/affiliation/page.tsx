"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Copy, MousePointerClick } from "lucide-react";

import { AffiliateWallet } from "@/components/affiliate/AffiliateWallet";
import { AmbassadorPanel } from "@/components/affiliate/AmbassadorPanel";
import { SellerPitchKit } from "@/components/affiliate/SellerPitchKit";
import { WhatsAppIcon } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { withAffiliateRef } from "@/lib/affiliate";
import { publicSiteOrigin } from "@/lib/backend-origin";
import { formatXOF } from "@/lib/currency";
import { getMyAffiliate } from "@/services/affiliate-service";

const STEPS = [
  { title: "Copiez votre lien", text: "ou le lien d'un produit ou d'une boutique" },
  { title: "Partagez-le", text: "aux commerçants et à vos proches" },
  { title: "Ils s'inscrivent", text: "ou commandent via votre lien (30 jours)" },
  { title: "Vous gagnez", text: "sur leurs abonnements et leur 1re commande" },
];

const siteOrigin = publicSiteOrigin;

/** Programme d'affiliation (modele Amazon Partenaires / Jumia) : simple, sans stock ni abonnement. */
export default function AffiliationPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const loggedIn = Boolean(user?.id);
  const [productUrl, setProductUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: me, isPending } = useQuery({ queryKey: ["affiliate-me"], queryFn: getMyAffiliate, enabled: loggedIn });

  const homeLink = me ? withAffiliateRef(`${siteOrigin()}/`, me.code) : "";
  let customLink = "";
  if (me && productUrl.trim()) {
    try {
      const parsed = new URL(productUrl.trim());
      customLink = /(^|\.)amazer\.store$|^localhost$/.test(parsed.hostname) ? withAffiliateRef(parsed.toString(), me.code) : "";
    } catch {
      customLink = "";
    }
  }

  const copy = (text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setMessage({ ok: true, text: "Lien copié. Partagez-le !" }))
      .catch(() => setMessage({ ok: false, text: "Copie impossible : sélectionnez le lien." }));
  };
  const shareOnWhatsApp = (link: string) =>
    `https://wa.me/?text=${encodeURIComponent(`Je te recommande AMAZER : paiement sécurisé et livraison. ${link}`)}`;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8">
        <h1 className="text-display-sm font-semibold tracking-display">Programme d&apos;affiliation</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          Faites connaître AMAZER et gagnez de l&apos;argent. Gratuit, sans stock, sans abonnement.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-field bg-white/10 px-3 py-2 text-sm">
            <p className="font-semibold">Vous amenez un vendeur</p>
            <p className="text-white/80">
              {me ? `${me.seller_share_percent} %` : "Une part"} de chacun de ses abonnements
              {me ? ` pendant ${me.seller_share_months} mois` : ""}.
            </p>
          </div>
          <div className="rounded-field bg-white/10 px-3 py-2 text-sm">
            <p className="font-semibold">Vous amenez un client</p>
            <p className="text-white/80">
              {me ? formatXOF(me.customer_bonus) : "Un bonus"} pour sa première commande livrée.
            </p>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-field bg-white/10 px-3 py-2 text-sm">
              <span className="font-semibold">
                {index + 1}. {step.title}
              </span>{" "}
              <span className="text-white/80">{step.text}</span>
            </li>
          ))}
        </ol>
      </header>

      {!loggedIn && !userLoading ? (
        <div className="rounded-card border border-border bg-card p-5 text-center">
          <p className="font-semibold text-ink-900">Créez un compte gratuit pour obtenir votre lien.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild>
              <Link href="/register?next=/affiliation">Créer un compte</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?next=/affiliation">Se connecter</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {loggedIn ? (
        isPending || !me ? (
          <div className="h-40 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
        ) : (
          <>
            <AffiliateWallet me={me} />
            <p className="flex items-start gap-2 text-sm text-ink-700">
              <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {me.clicks} visite{me.clicks > 1 ? "s" : ""} via vos liens · {me.referred_sellers} vendeur
                {me.referred_sellers > 1 ? "s" : ""} et {me.referred_customers} client{me.referred_customers > 1 ? "s" : ""} inscrits
              </span>
            </p>

            <div className="space-y-3 rounded-card border border-border bg-card p-4">
              <p className="text-sm font-semibold text-ink-900">
                Votre code : <span className="rounded-field bg-surface-1 px-2 py-0.5 font-mono tracking-widest">{me.code}</span>
              </p>
              <p className="break-all text-sm text-ink-700">{homeLink}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => copy(homeLink)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copier mon lien
                </Button>
                <Button type="button" variant="outline" onClick={() => copy(withAffiliateRef(`${siteOrigin()}/vendre`, me.code))}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Lien pour les vendeurs
                </Button>
                <a
                  href={shareOnWhatsApp(homeLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-field border border-success px-4 text-sm font-semibold text-success hover:bg-surface-1"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Partager sur WhatsApp
                </a>
              </div>
            </div>

            <div className="space-y-2 rounded-card border border-border bg-card p-4">
              <label htmlFor="product-url" className="block text-sm font-semibold text-ink-900">
                Lien d&apos;un produit précis
              </label>
              <p className="text-xs text-ink-600">
                Collez le lien d&apos;un produit ou d&apos;une boutique AMAZER. Astuce : sur chaque produit, le bouton « Partager et
                gagner » le fait pour vous.
              </p>
              <input
                id="product-url"
                type="url"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                placeholder="https://amazer.store/product/…"
                className="h-11 w-full rounded-field border border-border bg-card px-3 text-sm"
              />
              {customLink ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => copy(customLink)}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copier ce lien
                  </Button>
                  <a
                    href={shareOnWhatsApp(customLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-field border border-success px-4 text-sm font-semibold text-success hover:bg-surface-1"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    WhatsApp
                  </a>
                </div>
              ) : productUrl.trim() ? (
                <p className="text-xs text-danger">Ce n&apos;est pas un lien AMAZER.</p>
              ) : null}
            </div>

            <SellerPitchKit sellerLink={withAffiliateRef(`${siteOrigin()}/vendre`, me.code)} />

            <AmbassadorPanel me={me} />

            {message ? (
              <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
                {message.text}
              </p>
            ) : null}
          </>
        )
      ) : null}

      {!loggedIn && !userLoading ? <SellerPitchKit sellerLink={null} /> : null}

      <div className="rounded-card border border-border bg-card p-4 text-sm text-ink-700">
        <p className="font-semibold text-ink-900">Règles simples</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>La personne doit s&apos;inscrire ou commander dans les 30 jours après le clic (le dernier lien cliqué compte).</li>
          <li>Vendeur amené : vous touchez votre part à chaque abonnement payé, pendant la durée indiquée.</li>
          <li>Client amené : bonus versé pour sa première commande, une fois livrée. Le client paie le prix normal.</li>
          <li>Un clic seul ne rapporte rien : seuls les abonnements payés et les commandes livrées comptent.</li>
          <li>Vos propres inscriptions et achats ne comptent pas (même personne, même téléphone ou même numéro).</li>
          <li>Chaque gain attend un délai de sécurité{me ? ` de ${me.hold_days} jours` : ""} avant d&apos;être payable.</li>
          <li>Paiement sur demande, par Nita, Amana, Airtel Money ou Moov Money{me ? `, à partir de ${formatXOF(me.min_payout)}` : ""}.</li>
          <li>Toute fraude (faux comptes, auto-parrainage) entraîne l&apos;annulation des gains et la suspension du compte.</li>
          <li>
            Règles complètes :{" "}
            <Link href="/legal/terms#affiliation" className="font-semibold text-brand-700 hover:underline">
              conditions de l&apos;affiliation
            </Link>
            .
          </li>
        </ul>
        <Link href="/formations" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:underline">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Formations gratuites pour bien partager
        </Link>
      </div>
    </section>
  );
}
