"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getSellerProfile } from "@/services/seller-service";
import { verifyReceipt } from "@/services/order-service";
import { ReceiptVerifyResult } from "@/types/order";

function extractTokenFromScan(raw: string): string {
  try {
    const url = new URL(raw);
    const token = url.searchParams.get("token");
    return token ?? raw;
  } catch {
    return raw;
  }
}

function SellerDeliveryScanContent() {
  const searchParams = useSearchParams();
  const queryToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState("");
  const [gps, setGps] = useState("");
  const [result, setResult] = useState<ReceiptVerifyResult | null>(null);
  const tokenValue = token || queryToken;
  const { data: currentUser } = useCurrentUser();
  const { data: sellerProfile } = useQuery({
    queryKey: ["delivery-scan-seller-profile"],
    queryFn: getSellerProfile,
    enabled: Boolean(currentUser?.id),
    staleTime: 60_000,
  });
  const vendorId = sellerProfile?.vendor_id ?? "";

  const mutation = useMutation({
    mutationFn: verifyReceipt,
    onSuccess: (payload) => {
      setResult(payload);
    },
    onError: () => {
      setResult({
        order_id: "inconnu",
        status: "blocked",
        message: "Verification livraison impossible.",
        scanned_at: null,
      });
    },
  });

  const onDetected = useCallback((raw: string) => {
    const extracted = extractTokenFromScan(raw);
    setToken(extracted);
  }, []);

  const isBlocked = result?.status === "blocked";

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-14 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Validation Livraison QR</h1>
        <p className="mt-2 text-sm text-slate-600">
          Le livreur scanne le QR du client au moment de la remise pour confirmer qu il est bien en face.
        </p>
        {!currentUser ? (
          <p className="mt-2 text-sm text-rose-600">Connectez-vous avec un compte vendeur/livreur.</p>
        ) : null}
        {!vendorId ? (
          <p className="mt-2 text-sm text-amber-700">Aucun profil vendeur detecte sur ce compte.</p>
        ) : null}

        <div className="relative mt-5 flex flex-col gap-3">
          <input
            value={tokenValue}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Token recu (ou URL scannee)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <BarcodeScannerDrawer onDetected={onDetected} />
          <input
            value={gps}
            onChange={(event) => setGps(event.target.value)}
            placeholder="GPS (optionnel)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <Button
            type="button"
            disabled={!tokenValue || !vendorId || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                token: tokenValue,
                vendor_id: vendorId,
                gps: gps || undefined,
              })
            }
            className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            Confirmer la livraison
          </Button>
        </div>
      </article>

      {result ? (
        <article
          className={`premium-card p-6 ${
            isBlocked
              ? "animate-pulse border-2 border-rose-500 bg-rose-600 text-white"
              : "border border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          <h2 className="text-xl font-semibold">{isBlocked ? "Verification refusee" : "Livraison validee"}</h2>
          <p className="mt-2 text-sm">{result.message}</p>
          <p className="mt-1 text-xs opacity-90">Commande: {result.order_id}</p>
          <p className="mt-1 text-xs opacity-90">
            Horodatage scan: {result.scanned_at ? new Date(result.scanned_at).toLocaleString("fr-FR") : "-"}
          </p>
        </article>
      ) : null}
    </section>
  );
}

export default function SellerDeliveryScanPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-4xl px-4 pb-14 sm:px-6" />}>
      <SellerDeliveryScanContent />
    </Suspense>
  );
}
