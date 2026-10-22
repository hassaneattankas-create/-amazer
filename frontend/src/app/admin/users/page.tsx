"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { requestAdminPin } from "@/lib/admin-pin";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage, getHttpResponseStatus } from "@/lib/api-error";
import {
  getAdminUserStats,
  listAdminUsers,
  permanentlyDeleteAdminUser,
  removeAdminUser,
  restoreAdminUser,
  updateAdminUserRole,
  type AdminUserRole,
} from "@/services/finance-service";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  // Le PIN est vérifié une seule fois par la mise en page admin.
  const pinVerified = true;
  const [actionStatus, setActionStatus] = useState("");
  // « Gérer le compte » depuis la liste des vendeurs : /admin/users?q=e-mail
  const initialSearch = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "";
  const [searchDraft, setSearchDraft] = useState(initialSearch);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [showInactive, setShowInactive] = useState(false);

  // PIN expiré ou refusé : la mise en page admin redemande le PIN.
  const resetAdminVerification = (message: string) => {
    void message;
    requestAdminPin();
  };

  const buildAdminActionMessage = (error: unknown, fallback: string) => {
    const adminMessage = getAdminFinanceDataError(error);
    const status = getHttpResponseStatus(error);
    const message = getApiErrorMessage(error, adminMessage || fallback);

    if (
      adminMessage.includes("Revalidez le PIN") ||
      adminMessage.includes("Reconnectez-vous") ||
      status === 401
    ) {
      resetAdminVerification(adminMessage || message);
    }

    return message;
  };

  const {
    data: stats,
    isPending: isStatsPending,
    isError: isStatsError,
    error: statsError,
  } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: getAdminUserStats,
    enabled: pinVerified,
  });

  const {
    data: users,
    isPending: isUsersPending,
    isError: isUsersError,
    error: usersError,
  } = useQuery({
    queryKey: ["admin-users", searchTerm],
    queryFn: () => listAdminUsers(searchTerm || undefined, 250),
    enabled: pinVerified,
  });

  const removeMutation = useMutation({
    mutationFn: removeAdminUser,
    onSuccess: () => {
      setActionStatus("Compte retiré de l'application (désactivé).");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
    },
    onError: (error) => {
      setActionStatus(buildAdminActionMessage(error, "Impossible de retirer cet utilisateur."));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAdminUser,
    onSuccess: () => {
      setActionStatus(
        "Compte restauré. Pour un vendeur dont l'abonnement a expiré, la boutique reste hors ligne jusqu'au paiement (ou « Offrir 1 mois » dans Vendeurs et tarifs)."
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
    },
    onError: (error) => {
      setActionStatus(buildAdminActionMessage(error, "Impossible de restaurer cet utilisateur."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: permanentlyDeleteAdminUser,
    onSuccess: () => {
      setActionStatus("Compte supprimé définitivement.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
    },
    onError: (error) => {
      setActionStatus(buildAdminActionMessage(error, "Impossible de supprimer cet utilisateur."));
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AdminUserRole }) => updateAdminUserRole(userId, role),
    onSuccess: (updated) => {
      setActionStatus(
        updated.is_admin ? "Rôle : administrateur." : updated.role === "courier" ? "Rôle : livreur." : "Rôle : client."
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      setActionStatus(buildAdminActionMessage(error, "Impossible de modifier le role de cet utilisateur."));
    },
  });

  const isBusy =
    removeMutation.isPending || restoreMutation.isPending || roleMutation.isPending || deleteMutation.isPending;
  const rows = useMemo(() => {
    const list = users ?? [];
    if (showInactive) {
      return list;
    }
    return list.filter((u) => u.is_active);
  }, [users, showInactive]);
  const usersPageError = useMemo(
    () => (usersError ? getAdminFinanceDataError(usersError) : ""),
    [usersError]
  );

  if (isUsersPending || (isStatsPending && !users)) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  if (usersPageError) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-700">Utilisateurs admin indisponibles</h1>
          <p className="mt-2 text-sm text-rose-700">{usersPageError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={requestAdminPin}>
              Revalider le PIN
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.assign("/login?next=/admin/users")}
            >
              Me reconnecter
            </Button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      {isStatsError && !isUsersError ? (
        <article className="premium-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Statistiques indisponibles: {getAdminFinanceDataError(statsError)}
        </article>
      ) : null}
      {isUsersError && !isStatsError ? (
        <article className="premium-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Liste utilisateurs indisponible: {getAdminFinanceDataError(usersError)}
        </article>
      ) : null}
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink-900">Utilisateurs</h1>
        <p className="mt-2 text-sm text-ink-600">
          Tous les comptes : clients, vendeurs, livreurs et admins. C&apos;est ici qu&apos;on retire, restaure ou supprime un compte,
          et qu&apos;on donne un rôle. Pour l&apos;activité, l&apos;abonnement et le tarif d&apos;un vendeur : « Fiche vendeur ».
        </p>
      </header>

      {!isStatsError && stats ? (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Comptes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total_users}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Actifs</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.active_users}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Nouveaux (7 jours)</p>
          <p className="mt-2 text-2xl font-semibold text-brand-600">{stats.new_users_last_7_days}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Vendeurs actifs</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.seller_accounts}</p>
        </article>
      </div>
      ) : null}

      {!isUsersError ? (
      <article className="premium-card border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Liste des comptes</h2>
            <p className="text-sm text-slate-600">{rows.length} compte{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""}</p>
          </div>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchTerm(searchDraft.trim());
            }}
          >
            <label className="sr-only" htmlFor="admin-user-search">
              Rechercher un compte
            </label>
            <input
              id="admin-user-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Nom, e-mail ou téléphone"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
            />
            <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
              Rechercher
            </Button>
          </form>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Afficher les comptes retirés (désactivés)
          </label>
        </div>

        {actionStatus ? (
          <p className="mt-3 rounded-field bg-surface-1 p-3 text-sm text-ink-800" role="status">
            {actionStatus}
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-border rounded-card border border-border">
          {rows.map((user) => (
            <li key={user.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                  {user.full_name}
                  <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-700">
                    {user.is_admin ? "Admin" : user.role === "courier" ? "Livreur" : user.is_seller ? "Vendeur" : "Client"}
                  </span>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
                      user.is_active ? "bg-success/10 text-success" : "bg-surface-2 text-ink-700"
                    }`}
                  >
                    {user.is_active ? "Actif" : "Retiré"}
                  </span>
                </p>
                <p className="mt-0.5 break-all text-xs text-ink-600">
                  {user.email}
                  {user.whatsapp_phone ? ` · ${user.whatsapp_phone}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  Inscrit le {user.created_at ? new Date(user.created_at).toLocaleDateString("fr-FR") : "—"}
                  {user.is_seller ? (
                    <>
                      {" · "}
                      <Link href={`/admin/tarifs?q=${encodeURIComponent(user.email)}`} className="font-medium text-brand-700 hover:underline">
                        Fiche vendeur
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                {user.is_admin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-600">Compte protégé</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => roleMutation.mutate({ userId: user.id, role: "user" })}
                    >
                      Retirer admin
                    </Button>
                  </div>
                ) : user.is_active ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-rose-600 text-white hover:bg-rose-500"
                      disabled={isBusy}
                      onClick={() => {
                        const shop = user.is_seller ? " Sa boutique sera aussi mise hors ligne." : "";
                        if (window.confirm(`Retirer le compte de ${user.full_name} ? Il ne pourra plus se connecter.${shop}`)) {
                          removeMutation.mutate(user.id);
                        }
                      }}
                    >
                      Retirer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => {
                        if (window.confirm(`Donner à ${user.full_name} tous les droits administrateur (argent, comptes, tarifs) ?`)) {
                          roleMutation.mutate({ userId: user.id, role: "admin" });
                        }
                      }}
                    >
                      Nommer admin
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        roleMutation.mutate({ userId: user.id, role: user.role === "courier" ? "user" : "courier" })
                      }
                    >
                      {user.role === "courier" ? "Retirer livreur" : "Nommer livreur"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      disabled={isBusy}
                      onClick={() => restoreMutation.mutate(user.id)}
                    >
                      Restaurer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-danger text-danger"
                      disabled={isBusy}
                      onClick={() => {
                        if (window.confirm(`Supprimer définitivement ${user.email} ? Action irréversible.`)) {
                          deleteMutation.mutate(user.id);
                        }
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </article>
      ) : null}
    </section>
  );
}
