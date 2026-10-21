"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { withAffiliateRef } from "@/lib/affiliate";
import { getMobileSiteOriginFromEnv } from "@/lib/backend-origin";
import { formatXOF } from "@/lib/currency";
import { getMyAffiliate } from "@/services/affiliate-service";
import { toast } from "@/store/toast-store";

type Props =
  /** Vendeur : le lien de SA boutique, avec son code d'affilié. */
  | { variant: "seller"; vendorId: string; shopName?: string }
  /** Client : son lien AMAZER personnel. */
  | { variant: "client" };

function siteOrigin(): string {
  return getMobileSiteOriginFromEnv() || (typeof window !== "undefined" ? window.location.origin : "https://amazer.store");
}

/** Encourage à partager : boutique (vendeur) ou AMAZER (client), toujours avec le code d'affilié. */
export function AffiliateShareCard(props: Props) {
  const { data, isPending, isError } = useQuery({ queryKey: ["affiliate-me"], queryFn: getMyAffiliate, staleTime: 300_000 });
  if (isPending || isError || !data?.code) return null;

  const seller = props.variant === "seller";
  const link = withAffiliateRef(seller ? `${siteOrigin()}/shop/${props.vendorId}` : `${siteOrigin()}/`, data.code);
  const bonus = formatXOF(data.customer_bonus);
  const message = seller
    ? `Découvrez ma boutique ${props.shopName ?? ""} sur AMAZER : commandez en ligne, paiement sécurisé. ${link}`.replace("  ", " ")
    : `Boutiques, restaurants, hôtels, pharmacies de garde… tout le Niger dans une seule application : ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible : sélectionnez le lien et copiez-le.");
    }
  };

  return (
    <section className="rounded-card border border-brand-200 bg-brand-50 p-4 sm:p-5" aria-labelledby="share-card-title">
      <h2 id="share-card-title" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <Gift className="h-5 w-5 text-brand-600" aria-hidden="true" />
        {seller ? "Partagez votre boutique, gagnez plus" : "Gagnez de l'argent avec AMAZER"}
      </h2>
      <p className="mt-1 text-sm text-ink-700">
        {seller
          ? `Envoyez ce lien à vos clients sur WhatsApp, Facebook et TikTok. En plus de vos ventes, chaque nouveau client qui achète grâce à lui vous rapporte ${bonus}.`
          : `Vous êtes affilié gratuitement. Partagez votre lien : ${bonus} pour chaque nouveau client qui achète, et ${data.seller_share_percent} % de l'abonnement de chaque vendeur que vous amenez.`}
      </p>
      <p className="mt-3 break-all rounded-field border border-brand-200 bg-card px-3 py-2 text-sm text-ink-800">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Partager sur WhatsApp
          </a>
        </Button>
        <Button type="button" variant="outline" onClick={() => void copy()}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copier le lien
        </Button>
        <Link href="/affiliation" className="inline-flex min-h-10 items-center text-sm font-medium text-brand-700 hover:underline">
          Mes gains d&apos;affiliation
        </Link>
      </div>
    </section>
  );
}
