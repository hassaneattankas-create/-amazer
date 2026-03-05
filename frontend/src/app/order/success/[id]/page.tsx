"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getReceiptLink } from "@/services/order-service";

export default function OrderSuccessPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { data, isPending, isError } = useQuery({
    queryKey: ["receipt-link", orderId],
    queryFn: () => getReceiptLink(orderId),
  });

  const receiptUrl = data?.receipt_url ?? `/order/receipt/${orderId}`;
  const absoluteReceiptUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${receiptUrl}`
      : receiptUrl;
  const whatsappText = encodeURIComponent(
    `Bonjour, voici mon recu securise AMAZER pour la commande ${orderId}: ${absoluteReceiptUrl}`
  );
  const whatsappDeepLink = `whatsapp://send?text=${whatsappText}`;
  const whatsappWebLink = `https://wa.me/?text=${whatsappText}`;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      {isPending ? <ProductCardSkeleton /> : null}
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Paiement confirme</h1>
        <p className="mt-2 text-sm text-slate-600">
          Commande: <span className="font-semibold text-slate-900">{orderId}</span>
        </p>
        {isPending ? <p className="mt-3 text-sm text-slate-600">Preparation du recu securise...</p> : null}
        {isError ? <p className="mt-3 text-sm text-rose-600">Impossible de generer le lien de recu.</p> : null}
        <p className="mt-4 text-sm font-bold text-slate-900">
          📸 VEUILLEZ CAPTURER VOTRE REÇU OU LE PARTAGER SUR WHATSAPP POUR LE PRÉSENTER AU VENDEUR
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]">
            <Link href={receiptUrl}>Voir mon recu securise</Link>
          </Button>
          <Button
            asChild
            className="min-h-12 border border-[#1da851] bg-[#25D366] px-6 text-base font-semibold text-white hover:bg-[#1fb857]"
          >
            <a href={whatsappDeepLink} target="_blank" rel="noreferrer">
              Partager sur WhatsApp
            </a>
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Si WhatsApp ne s&apos;ouvre pas, utilisez{" "}
          <a href={whatsappWebLink} target="_blank" rel="noreferrer" className="text-[#25D366] underline">
            ce lien web
          </a>
          .
        </p>
      </article>
    </section>
  );
}
