"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { reportStation } from "@/services/local-services-service";
import type { StationReportKind } from "@/types/local-services";

const KINDS: { value: StationReportKind; label: string }[] = [
  { value: "wrong_status", label: "Disponibilité fausse" },
  { value: "closed", label: "Station fermée" },
  { value: "wrong_place", label: "Mauvaise adresse ou position" },
  { value: "other", label: "Autre problème" },
];

/** « Signaler une erreur » : le client prévient la station qu'une information est fausse (sans compte). */
export function ReportStationButton({ vendorId, outletId, name }: { vendorId: string; outletId?: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StationReportKind>("wrong_status");
  const [comment, setComment] = useState("");
  const mutation = useMutation({
    mutationFn: () => reportStation({ vendor_id: vendorId, outlet_id: outletId ?? null, kind, comment: comment.trim() || null }),
  });

  if (mutation.isSuccess) {
    return (
      <p className="mt-3 text-center text-xs text-success" role="status">
        Merci, la station est prévenue.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 self-center text-xs font-medium text-ink-600 hover:text-ink-900 hover:underline"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Signaler une erreur
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2 rounded-field bg-surface-1 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-ink-900">Qu&apos;est-ce qui ne va pas chez {name} ?</legend>
        <div className="mt-2 grid gap-1">
          {KINDS.map((option) => (
            <label key={option.value} className="flex min-h-10 items-center gap-2 text-sm text-ink-800">
              <input type="radio" name={`report-${outletId ?? vendorId}`} value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm text-ink-800">
        Précision (facultatif)
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={300}
          className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
        />
      </label>
      {mutation.isError ? <p className="text-xs text-danger">{getApiErrorMessage(mutation.error, "Envoi impossible. Réessayez.")}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className="min-h-11 flex-1 rounded-field bg-ink-900 px-3 text-sm font-semibold text-white disabled:opacity-60">
          {mutation.isPending ? "Envoi…" : "Envoyer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-field border border-border px-3 text-sm font-semibold text-ink-800">
          Annuler
        </button>
      </div>
    </form>
  );
}
