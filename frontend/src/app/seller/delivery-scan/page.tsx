"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
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
  // Vendeur, livreur ou admin : le serveur verifie les droits sur la commande.
  const canVerify = Boolean(vendorId) || currentUser?.role === "courier" || currentUser?.role === "admin";

  const mutation = useMutation({
    mutationFn: verifyReceipt,
    onSuccess: (payload) => setResult(payload),
    onError: (error) =>
      setResult({
        order_id: "",
        status: "blocked",
        message: getApiErrorMessage(error, "Vérification impossible. Réessayez."),
        scanned_at: null,
      }),
  });

  const onDetected = useCallback((raw: string) => setToken(extractTokenFromScan(raw)), []);
  const isBlocked = result?.status === "blocked";

  return (
    <section className="mx-auto w-full max-w-xl space-y-4 px-gutter pb-14 pt-4">
      <article className="rounded-card border border-border bg-card p-5">
        <h1 className="text-2xl font-semibold text-ink-900">Confirmer une livraison</h1>
        <p className="mt-1 text-sm text-ink-600">Scannez le QR code du reçu du client au moment de la remise.</p>
        {!currentUser ? (
          <p className="mt-2 text-sm text-danger">Connectez-vous avec un compte vendeur, livreur ou admin.</p>
        ) : !canVerify ? (
          <p className="mt-2 text-sm text-warning">Ce compte ne peut pas confirmer de livraison.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          <BarcodeScannerDrawer
            mode="qr"
            onDetected={onDetected}
            triggerLabel="Scanner le QR code"
            triggerClassName="min-h-11 w-full rounded-field bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          />
          <label className="block text-sm font-medium text-ink-800" htmlFor="receipt-token">
            Ou collez le lien du reçu
          </label>
          <input
            id="receipt-token"
            value={tokenValue}
            onChange={(event) => setToken(event.target.value)}
            className="h-11 w-full rounded-field border border-border px-3 text-sm"
          />
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!tokenValue || !canVerify || mutation.isPending}
            onClick={() => mutation.mutate({ token: extractTokenFromScan(tokenValue), vendor_id: vendorId || undefined })}
          >
            {mutation.isPending ? "Vérification…" : "Confirmer la livraison"}
          </Button>
        </div>
      </article>

      {result ? (
        <article
          className={`rounded-card border p-5 ${isBlocked ? "border-danger bg-surface-1" : "border-success bg-surface-1"}`}
          role="status"
        >
          <h2 className={`text-lg font-semibold ${isBlocked ? "text-danger" : "text-success"}`}>
            {isBlocked ? "Vérification refusée" : "Livraison confirmée"}
          </h2>
          <p className="mt-1 text-sm text-ink-800">{result.message}</p>
          {result.scanned_at ? (
            <p className="mt-1 text-xs text-ink-600">{new Date(result.scanned_at).toLocaleString("fr-FR")}</p>
          ) : null}
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
