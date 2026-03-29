"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import {
  buildAdminFinanceVerifyPayload,
  getAdminFinanceVerifyError,
} from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getAdminUserStats,
  listAdminUsers,
  removeAdminUser,
  restoreAdminUser,
  verifyAdminFinancePin,
} from "@/services/finance-service";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinStatus, setPinStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const pinMutation = useMutation({
    mutationFn: verifyAdminFinancePin,
    onSuccess: () => {
      setPinVerified(true);
      setPinStatus("Verification admin valide. Gestion utilisateurs activee.");
      setPin("");
      setBirthDate("");
    },
    onError: (error) => {
      setPinStatus(getAdminFinanceVerifyError(error));
    },
  });

  const { data: stats, isPending: isStatsPending } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: getAdminUserStats,
    enabled: pinVerified,
  });

  const { data: users, isPending: isUsersPending } = useQuery({
    queryKey: ["admin-users", searchTerm],
    queryFn: () => listAdminUsers(searchTerm || undefined, 250),
    enabled: pinVerified,
  });

  const removeMutation = useMutation({
    mutationFn: removeAdminUser,
    onSuccess: () => {
      setActionStatus("Compte retire de l'application (desactive).");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
    },
    onError: (error) => {
      setActionStatus(getApiErrorMessage(error, "Impossible de retirer cet utilisateur."));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAdminUser,
    onSuccess: () => {
      setActionStatus("Compte restaure avec succes.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
    },
    onError: (error) => {
      setActionStatus(getApiErrorMessage(error, "Impossible de restaurer cet utilisateur."));
    },
  });

  const isBusy = removeMutation.isPending || restoreMutation.isPending;
  const rows = useMemo(() => users ?? [], [users]);

  if (!pinVerified) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h1 className="luxury-title text-2xl font-semibold">Admin Utilisateurs</h1>
          <p className="mt-2 text-sm text-slate-600">
            Verification requise pour gerer les comptes clients, vendeurs et administrateur.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Si tu inverses la date et le PIN, l&apos;app corrige automatiquement.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              type="password"
              placeholder="PIN admin"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              placeholder="Date secondaire JJ/MM/AA"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <Button
              type="button"
              onClick={() => pinMutation.mutate(buildAdminFinanceVerifyPayload(pin, birthDate))}
              disabled={!pin || !birthDate || pinMutation.isPending}
              className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
            >
              Verifier
            </Button>
          </div>
          {pinStatus ? <p className="mt-3 text-sm text-slate-700">{pinStatus}</p> : null}
        </article>
      </section>
    );
  }

  if (isStatsPending || isUsersPending || !stats) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Gestion Complete Des Utilisateurs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Vous suivez ici l&apos;activite globale de l&apos;application et vous pouvez retirer/restaurer n&apos;importe quel compte.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Utilisateurs</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total_users}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Comptes Actifs</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.active_users}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Nouveaux 7 Jours</p>
          <p className="mt-2 text-2xl font-semibold text-[#FF4D00]">{stats.new_users_last_7_days}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Comptes Vendeurs</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.seller_accounts}</p>
        </article>
      </div>

      <article className="premium-card border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Liste Des Comptes</h2>
            <p className="text-sm text-slate-600">
              Client, vendeur ou admin: vous pouvez desactiver ou restaurer l&apos;acces a l&apos;app.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Rechercher email ou nom"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
            />
            <Button
              type="button"
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => setSearchTerm(searchDraft.trim())}
            >
              Rechercher
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Etat</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2 text-slate-900">{user.full_name}</td>
                  <td className="px-3 py-2 text-slate-700">{user.email}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {user.is_admin ? "Admin" : user.is_seller ? "Vendeur" : "Client"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {user.is_active ? "Actif" : "Retire"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {user.is_admin ? (
                      <span className="text-xs text-slate-500">Compte protege</span>
                    ) : user.is_active ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-rose-600 text-white hover:bg-rose-500"
                        disabled={isBusy}
                        onClick={() => removeMutation.mutate(user.id)}
                      >
                        Retirer
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={isBusy}
                        onClick={() => restoreMutation.mutate(user.id)}
                      >
                        Restaurer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {actionStatus ? <p className="mt-3 text-sm text-slate-700">{actionStatus}</p> : null}
      </article>
    </section>
  );
}
