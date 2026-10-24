"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { addFuelManager, listFuelManagers, removeFuelManager } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";

/** Gérants d'une station : comptes AMAZER qui ne peuvent que mettre à jour ses disponibilités. */
export function OutletManagersBlock({ outletId, outletName }: { outletId: string; outletName: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const { data: all = [] } = useQuery({ queryKey: ["fuel-managers"], queryFn: listFuelManagers });
  const managers = all.filter((m) => m.outlet_id === outletId);
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));

  const add = useMutation({
    mutationFn: () => addFuelManager({ outlet_id: outletId, email: email.trim() }),
    onSuccess: (list) => {
      queryClient.setQueryData(["fuel-managers"], list);
      toast.success(`Gérant ajouté à « ${outletName} ». Il a reçu une notification.`);
      setEmail("");
      setOpen(false);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: removeFuelManager,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fuel-managers"] });
      toast.success("Gérant retiré.");
    },
    onError,
  });

  return (
    <div className="mt-3 rounded-field bg-surface-1 p-3 text-sm">
      <p className="font-semibold text-ink-900">Gérants de la station</p>
      {managers.length === 0 ? (
        <p className="mt-1 text-xs text-ink-600">Aucun gérant : c&apos;est vous qui recevez les relances de mise à jour.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-ink-800">
                {m.full_name} · {m.email}
              </span>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Retirer ${m.full_name} de « ${outletName} » ?`)) remove.mutate(m.id);
                }}
                aria-label={`Retirer ${m.full_name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim()) add.mutate();
          }}
        >
          <label className="block text-xs text-ink-700">
            E-mail du compte AMAZER du gérant
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="gerant@exemple.com"
              className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900"
            />
          </label>
          <p className="text-xs text-ink-600">
            Le gérant crée d&apos;abord un compte gratuit sur amazer.store. Il met ensuite la station à jour depuis amazer.store/gerant-station.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={add.isPending} className="min-h-11 flex-1 rounded-field bg-ink-900 px-3 font-semibold text-white disabled:opacity-60">
              {add.isPending ? "Ajout…" : "Ajouter"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-field border border-border px-3 font-semibold text-ink-800">
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700 hover:underline">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Ajouter un gérant
        </button>
      )}
    </div>
  );
}
