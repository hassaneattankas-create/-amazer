"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { PasswordInput } from "@/components/PasswordInput";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import {
  getAdminFinanceDataError,
  buildAdminFinanceVerifyPayload,
  getAdminFinanceVerifyError,
} from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAdminAdClickStats } from "@/services/content-service";
import { formatXOF } from "@/lib/currency";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import {
  createAdminTransfer,
  decideAdminSellerSubscriptionPayment,
  dispatchAdminOrder,
  getAdminFinanceSummary,
  listAdminOrders,
  listAdminSellerSubscriptionPayments,
  getAdminTreasuryHistory,
  getAdminWalletSummary,
  resetAdminFinanceCounters,
  verifyAdminFinancePin,
} from "@/services/finance-service";
import { hasAdminFinanceVerified } from "@/lib/api";

const AdminRevenueChart = dynamic(
  () => import("@/components/admin/AdminRevenueChart").then((m) => m.AdminRevenueChart),
  {
    ssr: false,
    loading: () => <div className="mt-5 h-72 animate-pulse rounded-xl bg-slate-100" />,
  }
);

export default function AdminFinancePage() {
  const queryClient = useQueryClient();
  const seenAdminOrderIdsRef = useRef<Set<string>>(new Set());
  const seenSellerPaymentIdsRef = useRef<Set<string>>(new Set());
  const adminOrdersInitializedRef = useRef(false);
  const sellerPaymentsInitializedRef = useRef(false);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [pinStatus, setPinStatus] = useState("");
  const [pin, setPin] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pinVerified, setPinVerified] = useState(() => hasAdminFinanceVerified());
  const [transferAmount, setTransferAmount] = useState("");
  const [bankName, setBankName] = useState<"BOA" | "SONIBANK">("BOA");
  const [transferStatus, setTransferStatus] = useState("");
  const [paymentDecisionNote, setPaymentDecisionNote] = useState("");
  const [resetStatus, setResetStatus] = useState("");

  const {
    data: summary,
    isPending: isSummaryPending,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery({
    queryKey: ["admin-finance-summary"],
    queryFn: getAdminFinanceSummary,
    enabled: pinVerified,
  });
  const {
    data: wallet,
    isPending: isWalletPending,
    isError: isWalletError,
    error: walletError,
  } = useQuery({
    queryKey: ["admin-wallet-summary"],
    queryFn: getAdminWalletSummary,
    enabled: pinVerified,
  });
  const {
    data: history,
    isPending: isHistoryPending,
    isError: isHistoryError,
    error: historyError,
  } = useQuery({
    queryKey: ["admin-treasury-history"],
    queryFn: getAdminTreasuryHistory,
    enabled: pinVerified,
  });
  const { data: adClicks, error: adClicksError } = useQuery({
    queryKey: ["admin-ad-click-stats"],
    queryFn: getAdminAdClickStats,
    enabled: pinVerified,
  });
  const { data: adminOrders, isError: isOrdersError, error: ordersError } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listAdminOrders(30),
    enabled: pinVerified,
    refetchInterval: 5000,
  });
  const { data: sellerPayments = [], error: sellerPaymentsError } = useQuery({
    queryKey: ["admin-seller-subscription-payments"],
    queryFn: () => listAdminSellerSubscriptionPayments("pending", 100),
    enabled: pinVerified,
    refetchInterval: 8000,
  });

  const pinMutation = useMutation({
    mutationFn: verifyAdminFinancePin,
    onSuccess: () => {
      setPinVerified(true);
      setPinStatus("Verification admin valide. Acces autorise.");
      setPin("");
      setBirthDate("");
    },
    onError: (error) => setPinStatus(getAdminFinanceVerifyError(error)),
  });


  const transferMutation = useMutation({
    mutationFn: createAdminTransfer,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-wallet-summary"] });
      setTransferStatus(
        `Virement simule vers ${result.bank_name}: ${formatXOF(result.amount)} (${result.status}).`
      );
      setTransferAmount("");
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      setTransferStatus(error.response?.data?.detail ?? "Erreur pendant le virement simule.");
    },
  });
  const dispatchMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "livraison" | "recu" }) =>
      dispatchAdminOrder(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setTransferStatus("Statut client mis a jour.");
    },
  });
  const sellerPaymentDecisionMutation = useMutation({
    mutationFn: ({
      paymentId,
      decision,
      admin_note,
    }: {
      paymentId: string;
      decision: "approved" | "rejected";
      admin_note?: string;
    }) => decideAdminSellerSubscriptionPayment(paymentId, { decision, admin_note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance-summary"] });
      setPaymentDecisionNote("");
      setSettingsStatus("Decision paiement vendeur enregistree.");
    },
    onError: (error) =>
      setSettingsStatus(
        getApiErrorMessage(error, getAdminFinanceDataError(error)),
      ),
  });
  const resetCountersMutation = useMutation({
    mutationFn: resetAdminFinanceCounters,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wallet-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-treasury-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ad-click-stats"] });
      setResetStatus("Compteurs remis a zero. Les nouveaux calculs partent de maintenant.");
    },
    onError: (error) => {
      setResetStatus(getApiErrorMessage(error, "Impossible de reinitialiser les compteurs."));
    },
  });

  const criticalPageError = useMemo(() => {
    const firstError = summaryError ?? walletError ?? null;
    return firstError ? getAdminFinanceDataError(firstError) : "";
  }, [summaryError, walletError]);
  const secondaryErrors = useMemo(
    () =>
      [
        historyError ? `Historique: ${getAdminFinanceDataError(historyError)}` : null,
        adClicksError ? `Publicite: ${getAdminFinanceDataError(adClicksError)}` : null,
        ordersError ? `Commandes: ${getAdminFinanceDataError(ordersError)}` : null,
        sellerPaymentsError ? `Paiements vendeurs: ${getAdminFinanceDataError(sellerPaymentsError)}` : null,
      ].filter(Boolean) as string[],
    [adClicksError, historyError, ordersError, sellerPaymentsError]
  );
  const chartData = useMemo(() => summary?.revenue_last_30_days ?? [], [summary]);
  const availableForTransfer = useMemo(() => {
    if (!wallet) {
      return 0;
    }
    return Math.max(0, wallet.total_all - wallet.amazer_commission_total - wallet.service_fee_total);
  }, [wallet]);
  useEffect(() => {
    const known = seenAdminOrderIdsRef.current;
    if (!pinVerified || !adminOrders?.length) {
      return;
    }
    if (!adminOrdersInitializedRef.current) {
      for (const order of adminOrders) {
        known.add(order.id);
      }
      adminOrdersInitializedRef.current = true;
      return;
    }
    const newOrders = adminOrders.filter((order) => order.status === "commande" && !known.has(order.id));
    for (const order of adminOrders) {
      known.add(order.id);
    }
    if (!newOrders.length) {
      return;
    }
    const latest = newOrders[0];
    notifyLocalOrderEvent({
      title: "Nouvelle commande client",
      body: `${latest.customer_name} a passe une commande de ${formatXOF(latest.total_amount)}.`,
      tag: `admin-order-${latest.id}`,
      href: "/admin/finance",
    });
    setTransferStatus(`Nouvelle commande detectee: ${latest.customer_name} (${formatXOF(latest.total_amount)}).`);
  }, [adminOrders, pinVerified]);

  useEffect(() => {
    if (!pinVerified || !sellerPayments?.length) {
      return;
    }
    const known = seenSellerPaymentIdsRef.current;
    if (!sellerPaymentsInitializedRef.current) {
      for (const row of sellerPayments) {
        known.add(row.id);
      }
      sellerPaymentsInitializedRef.current = true;
      return;
    }
    const fresh = sellerPayments.filter((row) => !known.has(row.id));
    for (const row of sellerPayments) {
      known.add(row.id);
    }
    if (!fresh.length) {
      return;
    }
    const latest = fresh[0];
    notifyLocalOrderEvent({
      title: "Paiement vendeur en attente",
      body: `${latest.business_name} — ${formatXOF(latest.amount_claimed)} (${latest.payment_mode.toUpperCase()}).`,
      tag: `seller-pay-${latest.id}`,
      href: "/admin/finance",
    });
    setTransferStatus(
      `Validation requise: ${latest.business_name} (${formatXOF(latest.amount_claimed)}).`,
    );
  }, [sellerPayments, pinVerified]);

  if (!pinVerified) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h1 className="luxury-title text-2xl font-semibold">Dashboard Tresorerie Admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Acces prive: saisissez le secret admin et la cle secondaire pour consulter les fonds.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Si tu inverses la date et le PIN, l&apos;app corrige automatiquement.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PasswordInput
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN admin"
              masking="password"
              wrapperClassName="min-w-0 flex-1"
            />
            <PasswordInput
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              placeholder="Date secondaire JJ/MM/AA"
              masking="text"
              autoComplete="off"
              wrapperClassName="min-w-0 flex-1"
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

  if (
    isSummaryPending ||
    isWalletPending ||
    !wallet
  ) {
    if ((isSummaryError || isWalletError) && criticalPageError) {
      return (
        <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
          <article className="premium-card border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-xl font-semibold text-rose-700">Finance admin indisponible</h1>
            <p className="mt-2 text-sm text-rose-700">{criticalPageError}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setPinVerified(false)}>
                Revalider le PIN
              </Button>
              <Button type="button" variant="outline" onClick={() => window.location.assign("/login?next=/admin/finance")}>
                Me reconnecter
              </Button>
            </div>
          </article>
        </section>
      );
    }
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      {secondaryErrors.length ? (
        <article className="premium-card border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Certaines sections admin sont indisponibles</h2>
          <div className="mt-2 space-y-1 text-sm text-amber-900">
            {secondaryErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </article>
      ) : null}
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Admin Finance</h1>
        <p className="mt-2 text-sm text-slate-600">
          Wallet prive: Nita/Amana, commission automatique, historique chiffre et virement simule.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Note: les prix des produits sont definis par les vendeurs. Ici vous gerez uniquement les pourcentages et frais AMAZER.
        </p>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Parametrage financier</h2>
        <p className="mt-2 text-sm text-slate-600">
          Pour eviter les doublons, tous les parametres (commission, abonnements, livraison, support)
          sont maintenant centralises dans une seule categorie: <strong>Admin Tarifs</strong>.
        </p>
        <Button
          type="button"
          className="mt-4 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => window.location.assign("/admin/tarifs")}
        >
          Ouvrir Admin Tarifs
        </Button>
        {settingsStatus ? <p className="mt-2 text-sm text-slate-700">{settingsStatus}</p> : null}
      </article>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Flux Nita</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{formatXOF(wallet.total_nita)}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Flux Amana</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{formatXOF(wallet.total_amana)}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Flux Total Collecte</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{formatXOF(wallet.total_all)}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Clics publicitaires</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{adClicks?.total_clicks ?? 0}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Clics publicitaires (7 jours)</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{adClicks?.clicks_last_7_days ?? 0}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Commission AMAZER</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">
            {formatXOF(wallet.amazer_commission_total)}
          </p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Frais de Service</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{formatXOF(wallet.service_fee_total)}</p>
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Disponible a Virer</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{formatXOF(availableForTransfer)}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Total des Commissions Collectees
          </p>
          <AnimatedPrice
            value={summary?.total_commissions_collected ?? 0}
            className="mt-2 text-3xl font-semibold text-[#FF4D00]"
          />
        </article>
        <article className="premium-card border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Nombre de Vendeurs Actifs</p>
          <p className="mt-2 text-3xl font-semibold text-[#FF4D00]">{summary?.active_sellers ?? 0}</p>
        </article>
      </div>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Reinitialisation des compteurs</h2>
        <p className="mt-2 text-sm text-slate-600">
          Remet a zero les compteurs finances et clics pub sans supprimer l&apos;historique des commandes.
        </p>
        <Button
          type="button"
          disabled={resetCountersMutation.isPending}
          onClick={() => resetCountersMutation.mutate()}
          className="mt-4 border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        >
          {resetCountersMutation.isPending ? "Reinitialisation..." : "Remettre les compteurs a zero"}
        </Button>
        {resetStatus ? <p className="mt-3 text-sm text-slate-700">{resetStatus}</p> : null}
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Virement Simule (BOA / SONIBANK)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Simulation interne uniquement. Aucun transfert bancaire reel n est execute.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={bankName}
            onChange={(event) => setBankName(event.target.value as "BOA" | "SONIBANK")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="BOA">BOA</option>
            <option value="SONIBANK">SONIBANK</option>
          </select>
          <input
            value={transferAmount}
            onChange={(event) => setTransferAmount(event.target.value)}
            placeholder="Montant XOF"
            inputMode="numeric"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <Button
            type="button"
            disabled={transferMutation.isPending || !transferAmount}
            onClick={() =>
              transferMutation.mutate({
                bank_name: bankName,
                amount: Number(transferAmount),
              })
            }
            className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            Virement
          </Button>
        </div>
        {transferStatus ? <p className="mt-3 text-sm text-slate-700">{transferStatus}</p> : null}
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Validations paiements vendeurs</h2>
        <p className="mt-2 text-sm text-slate-600">
          Les comptes vendeurs restent bloques tant que le paiement n&apos;est pas approuve.
        </p>
        <input
          value={paymentDecisionNote}
          onChange={(event) => setPaymentDecisionNote(event.target.value)}
          placeholder="Note admin (optionnel)"
          className="mt-3 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
        <div className="mt-4 space-y-3">
          {sellerPayments.length ? (
            sellerPayments.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {row.business_name} ({row.seller_email || "email inconnu"})
                  </p>
                  <p className="text-sm text-[#FF4D00]">{formatXOF(row.amount_claimed)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Ref: {row.transaction_reference} | {row.payment_mode.toUpperCase()} | {row.months} mois
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={sellerPaymentDecisionMutation.isPending}
                    onClick={() =>
                      sellerPaymentDecisionMutation.mutate({
                        paymentId: row.id,
                        decision: "approved",
                        admin_note: paymentDecisionNote.trim() || undefined,
                      })
                    }
                    className="border border-emerald-300 bg-emerald-50 text-emerald-700"
                  >
                    Valider
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      sellerPaymentDecisionMutation.isPending || !paymentDecisionNote.trim()
                    }
                    onClick={() =>
                      sellerPaymentDecisionMutation.mutate({
                        paymentId: row.id,
                        decision: "rejected",
                        admin_note: paymentDecisionNote.trim(),
                      })
                    }
                    className="border border-rose-300 bg-rose-50 text-rose-700"
                  >
                    Refuser (note obligatoire)
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune demande de paiement en attente.</p>
          )}
        </div>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Revenus AMAZER - 30 derniers jours</h2>
        <div className="mt-5">
          <AdminRevenueChart data={chartData} />
        </div>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Historique Securise des Transactions</h2>
        <p className="mt-2 text-sm text-slate-600">
          Les codes sont stockes chiffres en base. Vue reservee a l admin.
        </p>
        {isHistoryPending ? <p className="mt-4 text-sm text-slate-500">Chargement de l&apos;historique...</p> : null}
        {!isHistoryPending && isHistoryError ? (
          <p className="mt-4 text-sm text-amber-700">{getAdminFinanceDataError(historyError)}</p>
        ) : null}
        {!isHistoryPending && !isHistoryError ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Paiement</th>
                <th className="pb-2">Montant</th>
                <th className="pb-2">Code Dechiffre</th>
                <th className="pb-2">Code Chiffre</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).slice(0, 80).map((row) => (
                <tr key={`${row.source}-${row.order_id}`} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">
                    {new Date(row.created_at).toLocaleString("fr-FR", { hour12: false })}
                  </td>
                  <td className="py-2 text-slate-700">{row.source}</td>
                  <td className="py-2 text-slate-700">{row.payment_mode}</td>
                  <td className="py-2 font-medium text-slate-900">{formatXOF(row.amount)}</td>
                  <td className="py-2 text-slate-700">{row.decrypted_transaction_code ?? "-"}</td>
                  <td className="py-2 font-mono text-xs text-slate-600">
                    {row.encrypted_transaction_code ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : null}
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="luxury-title text-lg font-semibold">Pilotage Manuel Livraison</h2>
        <p className="mt-2 text-sm text-slate-600">Bouton &quot;Envoyer Livreur&quot; pour mise a jour temps reel.</p>
        {isOrdersError ? <p className="mt-4 text-sm text-amber-700">{getAdminFinanceDataError(ordersError)}</p> : null}
        <div className="mt-4 space-y-3">
          {(adminOrders ?? []).slice(0, 12).map((order) => (
            <div key={order.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {order.customer_name} | {order.id.slice(0, 8)} | {order.status}
                </p>
                <p className="text-sm text-[#FF4D00]">{formatXOF(order.total_amount)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => dispatchMutation.mutate({ orderId: order.id, status: "livraison" })}
                  className="border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                >
                  Envoyer Livreur
                </Button>
                <Button
                  type="button"
                  onClick={() => dispatchMutation.mutate({ orderId: order.id, status: "recu" })}
                  className="border border-emerald-300 bg-emerald-50 text-emerald-700"
                >
                  Marquer Livre
                </Button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
