"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

import { getApiErrorMessage } from "@/lib/api-error";
import { enableMfa, getMfaStatus, setupMfa } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const preferredCurrency = useAuthStore((state) => state.preferredCurrency);
  const setPreferredCurrency = useAuthStore((state) => state.setPreferredCurrency);
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState("");

  const { data: mfaStatus, refetch: refetchMfaStatus } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: getMfaStatus,
  });

  const [setupPayload, setSetupPayload] = useState<{
    secret_key: string;
    otpauth_url: string;
  } | null>(null);

  const setupMutation = useMutation({
    mutationFn: setupMfa,
    onSuccess: (payload) => {
      setSetupPayload({ secret_key: payload.secret_key, otpauth_url: payload.otpauth_url });
      setStatus("MFA initialise. Scannez le QR puis entrez le code 6 chiffres.");
    },
    onError: (error) => {
      setStatus(getApiErrorMessage(error, "Impossible de demarrer la configuration MFA."));
    },
  });

  const enableMutation = useMutation({
    mutationFn: enableMfa,
    onSuccess: async () => {
      setStatus("MFA active avec succes.");
      setSetupPayload(null);
      setMfaCode("");
      await refetchMfaStatus();
    },
    onError: (error) => {
      setStatus(getApiErrorMessage(error, "Code MFA invalide."));
    },
  });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-14 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Parametres Profil</h1>
        <p className="mt-2 text-sm text-slate-600">
          Preference de devise pour l&apos;affichage des montants.
        </p>
      </header>

      <article className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-2xl">
        <label htmlFor="currency-select" className="text-sm font-medium text-slate-700">
          Devise
        </label>
        <select
          id="currency-select"
          value={preferredCurrency}
          onChange={(event) =>
            setPreferredCurrency(event.target.value as "XOF" | "EUR" | "USD")
          }
          className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-900"
        >
          <option value="XOF">Franc CFA (XOF) - Defaut</option>
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US Dollar (USD)</option>
        </select>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Securite MFA (Google Authenticator)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Statut: {mfaStatus?.enabled ? "active" : "inactive"}
          {mfaStatus?.required_for_account ? " (obligatoire pour ce compte)" : ""}
        </p>

        {!mfaStatus?.enabled ? (
          <button
            type="button"
            onClick={() => setupMutation.mutate()}
            className="mt-4 rounded-lg bg-[#FF4D00] px-4 py-2 text-sm font-medium text-white"
          >
            Initialiser MFA
          </button>
        ) : null}

        {setupPayload ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4">
            <QRCodeSVG value={setupPayload.otpauth_url} size={160} />
            <p className="text-xs text-slate-600">Cle secrete: {setupPayload.secret_key}</p>
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="Code 6 chiffres"
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => enableMutation.mutate(mfaCode)}
              className="rounded-lg border border-[#FF4D00]/40 bg-[#FF4D00]/10 px-4 py-2 text-sm font-medium text-[#FF4D00]"
            >
              Activer MFA
            </button>
          </div>
        ) : null}

        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </article>
    </section>
  );
}
