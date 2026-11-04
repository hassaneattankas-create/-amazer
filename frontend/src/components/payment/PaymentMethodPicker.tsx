"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { listPaymentMethods } from "@/services/payment-method-service";
import type { PaymentMethod } from "@/types/payment-method";

/** Moyens actifs, partagés par tous les écrans de paiement. */
export function usePaymentMethods() {
  return useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods, staleTime: 5 * 60_000 });
}

export function methodHint(method: PaymentMethod): string {
  return method.kind === "amana" ? "Vous validez dans votre application" : "Vous envoyez l'argent, AMAZER vérifie";
}

type PaymentMethodPickerProps = {
  value: string;
  onChange: (code: string) => void;
  /** Titre lu par les lecteurs d'écran. */
  label?: string;
};

/** Choix du moyen de paiement : la liste vient des réglages admin. Si le moyen choisi n'existe plus, le premier est retenu. */
export function PaymentMethodPicker({ value, onChange, label = "Moyen de paiement" }: PaymentMethodPickerProps) {
  const { data: methods, isPending, isError, refetch } = usePaymentMethods();

  useEffect(() => {
    if (methods?.length && !methods.some((method) => method.code === value)) onChange(methods[0].code);
  }, [methods, value, onChange]);

  if (isPending) return <div className="h-16 animate-pulse rounded-field bg-surface-2" aria-busy="true" aria-label="Chargement des moyens de paiement" />;
  if (isError) {
    return (
      <p className="text-sm text-danger" role="alert">
        Moyens de paiement indisponibles.{" "}
        <button type="button" className="min-h-11 font-semibold underline" onClick={() => void refetch()}>
          Réessayer
        </button>
      </p>
    );
  }
  if (!methods.length) return <p className="text-sm text-ink-700">Aucun moyen de paiement n&apos;est ouvert pour le moment. Contactez le support.</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={label}>
      {methods.map((method) => {
        const selected = method.code === value;
        return (
          <button
            key={method.code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(method.code)}
            className={cn(
              "flex min-h-14 items-center justify-between gap-2 rounded-field border p-3 text-left transition-colors duration-fast",
              selected ? "border-brand-600 bg-brand-50" : "border-border bg-card hover:border-brand-500",
            )}
          >
            <span className="min-w-0">
              <span className="block font-semibold text-ink-900">{method.name}</span>
              <span className="block text-xs text-ink-600">{methodHint(method)}</span>
            </span>
            {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
