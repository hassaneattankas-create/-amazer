"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { buildAdminFinanceVerifyPayload, getAdminFinanceVerifyError } from "@/lib/admin-finance-verification";
import { verifyAdminFinancePin } from "@/services/finance-service";

/** Une seule saisie du PIN pour tout l'espace admin (valable 30 minutes). */
export function AdminPinGate({ onVerified }: { onVerified: () => void }) {
  const [pin, setPin] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: verifyAdminFinancePin,
    onSuccess: () => {
      setPin("");
      setBirthDate("");
      onVerified();
    },
    onError: (err) => setError(getAdminFinanceVerifyError(err)),
  });

  return (
    <article className="mx-auto max-w-xl rounded-card border border-border bg-card p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-ink-900">
        <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Vérification admin
      </h1>
      <p className="mt-1 text-sm text-ink-600">Une seule saisie ouvre tout l&apos;espace admin pendant 30 minutes.</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate(buildAdminFinanceVerifyPayload(pin, birthDate));
        }}
      >
        <PasswordInput value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN admin" masking="password" aria-label="PIN admin" />
        <PasswordInput
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          placeholder="Date secondaire JJ/MM/AA"
          masking="text"
          autoComplete="off"
          aria-label="Date secondaire"
        />
        <Button type="submit" size="lg" disabled={!pin || !birthDate || mutation.isPending}>
          {mutation.isPending ? "Vérification…" : "Ouvrir l'espace admin"}
        </Button>
      </form>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
