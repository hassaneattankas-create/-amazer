"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatXOF } from "@/lib/currency";
import { confirmPayment, getPaymentIntent } from "@/services/order-service";

export default function OrderPayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;
  const [providerReference, setProviderReference] = useState("");
  const [status, setStatus] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["payment-intent", orderId],
    queryFn: () => getPaymentIntent(orderId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      confirmPayment(orderId, {
        provider_reference: providerReference || undefined,
      }),
    onSuccess: () => {
      setStatus("Paiement confirme. Redirection...");
      window.setTimeout(() => router.push(`/order/success/${orderId}`), 600);
    },
    onError: () => setStatus("Confirmation impossible. Reessayez."),
  });

  const payLabel = useMemo(() => {
    if (!data) {
      return "Payer";
    }
    return data.payment_mode === "nita" ? "Payer avec Nita" : "Payer avec Amana";
  }, [data]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Finaliser le paiement</h1>
        <p className="mt-2 text-sm text-slate-600">
          Plus besoin de code long. Utilisez la reference courte puis confirmez.
        </p>

        {isPending ? <p className="mt-3 text-sm text-slate-500">Preparation du paiement...</p> : null}
        {isError ? <p className="mt-3 text-sm text-rose-600">Impossible de charger le paiement.</p> : null}

        {data ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
              <p className="text-xs text-slate-500">Reference paiement</p>
              <p className="mt-1 text-2xl font-semibold tracking-wide text-[#FF4D00]">{data.payment_reference}</p>
              <p className="mt-2 text-sm text-slate-700">Montant: {formatXOF(data.amount)}</p>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 p-4">
              <QRCodeCanvas value={data.qr_payload} size={180} includeMargin />
              <p className="text-xs text-slate-500">Scanner pour ouvrir le paiement</p>
            </div>

            <Button asChild className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]">
              <a href={data.payment_url} target="_blank" rel="noreferrer">
                {payLabel}
              </a>
            </Button>

            <Input
              value={providerReference}
              onChange={(event) => setProviderReference(event.target.value)}
              placeholder="Reference operateur (optionnel)"
            />

            <Button
              onClick={() => mutation.mutate()}
              className="w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              disabled={mutation.isPending}
            >
              J&apos;ai paye - confirmer
            </Button>
          </div>
        ) : null}

        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
