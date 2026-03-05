"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { enableMfa, getMfaStatus, setupMfa } from "@/services/auth-service";

function MfaSetupContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState("");
  const [setupPayload, setSetupPayload] = useState<{
    secret_key: string;
    otpauth_url: string;
  } | null>(null);

  const { data: mfaStatus, refetch: refetchMfaStatus, isPending } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: getMfaStatus,
    retry: false,
  });

  const setupMutation = useMutation({
    mutationFn: setupMfa,
    onSuccess: (payload) => {
      setSetupPayload({ secret_key: payload.secret_key, otpauth_url: payload.otpauth_url });
      setStatus("Scannez le QR code puis saisissez le code a 6 chiffres.");
    },
    onError: (error) => {
      setStatus(getApiErrorMessage(error, "Impossible de preparer la securite MFA."));
    },
  });

  const enableMutation = useMutation({
    mutationFn: enableMfa,
    onSuccess: async () => {
      setStatus("Securite MFA activee.");
      await refetchMfaStatus();
      window.location.assign(nextPath);
    },
    onError: (error) => {
      setStatus(getApiErrorMessage(error, "Code MFA invalide."));
    },
  });

  useEffect(() => {
    if (mfaStatus?.enabled) {
      window.location.assign(nextPath);
    }
  }, [mfaStatus?.enabled, nextPath]);

  if (isPending) {
    return (
      <section className="mx-auto max-w-xl px-4 py-10">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-2xl font-semibold">Verification securite obligatoire</h1>
        <p className="mt-2 text-sm text-slate-600">
          Activez la double authentification pour terminer la connexion de votre compte.
        </p>

        {!setupPayload ? (
          <Button
            type="button"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="primary-glow-btn mt-4 w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            {setupMutation.isPending ? "Preparation..." : "Configurer ma securite MFA"}
          </Button>
        ) : (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4">
            <QRCodeSVG value={setupPayload.otpauth_url} size={170} />
            <p className="text-xs text-slate-600">Cle secrete: {setupPayload.secret_key}</p>
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="Code 6 chiffres"
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
            <Button
              type="button"
              onClick={() => enableMutation.mutate(mfaCode)}
              disabled={enableMutation.isPending || !mfaCode.trim()}
              className="w-full border border-[#FF4D00]/40 bg-[#FF4D00]/10 text-[#FF4D00] hover:bg-[#FF4D00]/15"
            >
              {enableMutation.isPending ? "Activation..." : "Valider mon code MFA"}
            </Button>
          </div>
        )}

        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}

export default function MfaSetupPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-xl px-4 py-10">
          <ProductCardSkeleton />
        </section>
      }
    >
      <MfaSetupContent />
    </Suspense>
  );
}

