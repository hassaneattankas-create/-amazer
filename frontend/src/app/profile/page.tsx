"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-error";
import { getUserPreferences, updateUserPreferences } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const preferredCurrency = useAuthStore((state) => state.preferredCurrency);
  const setPreferredCurrency = useAuthStore((state) => state.setPreferredCurrency);
  const { data: preferences } = useQuery({
    queryKey: ["auth-preferences"],
    queryFn: getUserPreferences,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: (payload) => {
      setPreferredCurrency(payload.preferred_currency);
      queryClient.invalidateQueries({ queryKey: ["auth-preferences"] });
    },
  });

  const effectiveCurrency = preferences?.preferred_currency ?? preferredCurrency;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-14 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Profil</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gerer vos preferences d&apos;affichage sur AMAZER.
        </p>
      </header>

      <article className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-2xl">
        <label htmlFor="currency-select" className="text-sm font-medium text-slate-700">
          Devise
        </label>
        <select
          id="currency-select"
          value={effectiveCurrency}
          onChange={(event) => {
            const nextCurrency = event.target.value as "XOF" | "EUR" | "USD";
            setPreferredCurrency(nextCurrency);
            saveMutation.mutate({ preferred_currency: nextCurrency });
          }}
          className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-900"
        >
          <option value="XOF">Franc CFA (XOF) - Defaut</option>
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US Dollar (USD)</option>
        </select>
        {saveMutation.isError ? (
          <p className="mt-2 text-xs text-rose-600">
            {getApiErrorMessage(saveMutation.error, "Impossible de sauvegarder votre preference.")}
          </p>
        ) : null}
      </article>
    </section>
  );
}
