"use client";

import { useId, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { StationManagerRef } from "@/types/station-space";

import { stationFieldClass, stationLabelClass, type StationSaveFn } from "./station-ui";

export type ManagersEditorProps = {
  managers: StationManagerRef[];
  /** Nom de la station (confirmations, libellés accessibles). */
  stationName: string;
  busy?: boolean;
  disabled?: boolean;
  /** Reçoit l'e-mail saisi (nettoyé). */
  onAdd: StationSaveFn<string>;
  /** Reçoit l'id de l'affectation (StationManagerRef.id), après confirmation. */
  onRemove: (managerId: string) => unknown;
  /** Maximum par station (bouton « Ajouter » masqué au-delà). */
  max?: number;
  emptyText?: string;
};

function displayName(manager: StationManagerRef): string {
  return manager.full_name?.trim() || manager.email;
}

/** Gérants d'une station : liste, ajout par e-mail (compte AMAZER existant), retrait avec confirmation. */
export function ManagersEditor({
  managers,
  stationName,
  busy = false,
  disabled = false,
  onAdd,
  onRemove,
  max = 5,
  emptyText = "Aucun gérant : les relances de mise à jour arrivent au responsable.",
}: ManagersEditorProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const locked = busy || disabled;

  return (
    <div className="space-y-2 text-sm">
      {managers.length === 0 ? (
        <p className="text-ink-600">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border rounded-field border border-border">
          {managers.map((manager) => (
            <li key={manager.id} className="flex items-center gap-2 pl-3">
              <span className="min-w-0 flex-1 py-2">
                <span className="block truncate font-medium text-ink-900">{displayName(manager)}</span>
                {manager.full_name ? <span className="block truncate text-xs text-ink-600">{manager.email}</span> : null}
              </span>
              <button
                type="button"
                disabled={locked}
                aria-label={`Retirer ${displayName(manager)} de « ${stationName} »`}
                onClick={() => {
                  if (window.confirm(`Retirer ${displayName(manager)} de « ${stationName} » ?`)) onRemove(manager.id);
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = email.trim();
            if (!value) return;
            // En cas d'échec, le parent affiche l'erreur et l'e-mail est gardé.
            void onAdd(value)
              .then(() => {
                setEmail("");
                setOpen(false);
              })
              .catch(() => undefined);
          }}
        >
          <label className={stationLabelClass}>
            E-mail du compte AMAZER
            <input
              type="email"
              required
              autoComplete="off"
              value={email}
              disabled={locked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gerant@exemple.com"
              aria-describedby={`${uid}-hint`}
              className={stationFieldClass}
            />
          </label>
          <p id={`${uid}-hint`} className="text-xs text-ink-600">
            La personne crée d&apos;abord un compte gratuit sur AMAZER, puis gère la station depuis « Espace station ».
          </p>
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11 flex-1" disabled={locked}>
              {busy ? "Ajout…" : "Ajouter"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : managers.length < max ? (
        <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Ajouter un gérant
        </Button>
      ) : (
        <p className="text-xs text-ink-600">Maximum {max} gérants par station.</p>
      )}
    </div>
  );
}
