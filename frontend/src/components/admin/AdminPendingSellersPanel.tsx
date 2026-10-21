"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { decideAdminPendingSeller, listAdminPendingSellers } from "@/services/finance-service";
import { toast } from "@/store/toast-store";

/** Pré-inscriptions vendeurs payées : vérifier le paiement puis créer la boutique (ou rejeter). */
export function AdminPendingSellersPanel() {
  const queryClient = useQueryClient();
  const { data: pending = [] } = useQuery({
    queryKey: ["admin-pending-sellers"],
    queryFn: () => listAdminPendingSellers("pending"),
    refetchInterval: 30000,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => decideAdminPendingSeller(id, { decision }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-pending-sellers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      toast.success(result.status === "approved" ? "Compte vendeur créé et boutique activée." : "Demande rejetée.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Impossible de traiter la demande.")),
  });

  if (!pending.length) return null;

  return (
    <article className="rounded-card border border-brand-200 bg-brand-50 p-4 sm:p-6" aria-labelledby="pending-sellers-title">
      <h2 id="pending-sellers-title" className="text-lg font-semibold text-ink-900">
        Inscriptions vendeurs à valider ({pending.length})
      </h2>
      <p className="mt-1 text-sm text-ink-600">Vérifiez le paiement sur le compte AMAZER avant de confirmer.</p>
      <div className="mt-3 space-y-2">
        {pending.map((reg) => (
          <div key={reg.id} className="flex flex-wrap items-start justify-between gap-2 rounded-field border border-brand-200 bg-card p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{reg.business_name || reg.full_name}</p>
              <p className="text-xs text-ink-600">
                {reg.full_name} · {reg.identifier}
              </p>
              <p className="text-xs text-ink-600">
                {reg.activity_type} · {reg.months} mois · {reg.payment_mode?.toUpperCase()} · {new Date(reg.submitted_at).toLocaleString("fr-FR")}
              </p>
              <p className={`text-xs font-medium ${reg.transaction_reference ? "text-ink-800" : "text-danger"}`}>
                {reg.transaction_reference ? `Référence : ${reg.transaction_reference}` : "Aucune référence fournie"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: reg.id, decision: "approved" })}>
                Confirmer le paiement
              </Button>
              <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: reg.id, decision: "rejected" })}>
                Rejeter
              </Button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
