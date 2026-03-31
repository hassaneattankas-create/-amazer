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
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["receipt-link", orderId],
    queryFn: () => getReceiptLink(orderId),
  });

  const receiptUrl = data?.receipt_url ?? null;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      {isPending ? <ProductCardSkeleton /> : null}
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Paiement confirme</h1>
        <p className="mt-2 text-sm text-slate-600">
          Commande: <span className="font-semibold text-slate-900">{orderId}</span>
        </p>
        {isPending ? <p className="mt-3 text-sm text-slate-600">Preparation du recu securise...</p> : null}
        {isError ? (
          <p className="mt-3 text-sm text-rose-600">
            Impossible de generer le lien securise du recu pour l&apos;instant. Reessayez ci-dessous.
          </p>
        ) : null}
        <p className="mt-4 text-sm font-semibold text-slate-900">
          Ouvrez ensuite votre recu securise pour le telecharger ou le partager en PDF au vendeur.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {receiptUrl ? (
            <Button asChild className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]">
              <Link href={receiptUrl}>Voir mon recu securise</Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
            >
              {isFetching ? "Preparation..." : "Reessayer le recu"}
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Le partage du recu par lien a ete retire. Utilisez uniquement le PDF du recu.
        </p>
      </article>
    </section>
  );
}
