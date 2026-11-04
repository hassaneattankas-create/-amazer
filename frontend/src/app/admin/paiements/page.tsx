"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { createPaymentMethod, deletePaymentMethod, listAdminPaymentMethods, updatePaymentMethod } from "@/services/payment-method-service";
import { toast } from "@/store/toast-store";
import type { AdminPaymentMethod, PaymentMethodInput } from "@/types/payment-method";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900";
const labelClass = "block text-sm font-medium text-ink-800";
const EMPTY: PaymentMethodInput = { name: "", account_number: null, account_name: null, instructions: null, is_active: true, sort_order: 10 };

function MethodForm({ initial, kind, busy, submitLabel, onSubmit, onCancel }: { initial: PaymentMethodInput; kind: string; busy: boolean; submitLabel: string; onSubmit: (input: PaymentMethodInput) => void; onCancel?: () => void }) {
  const [form, setForm] = useState(initial);
  const text = (key: "name" | "account_number" | "account_name") => ({
    className: fieldClass,
    value: form[key] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...form, account_number: form.account_number?.trim() || null, account_name: form.account_name?.trim() || null, instructions: form.instructions?.trim() || null });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Nom affiché aux clients
          <input {...text("name")} required minLength={2} maxLength={80} placeholder="Ex. Moov Money" />
        </label>
        <label className={labelClass}>
          {kind === "amana" ? "Numéro (facultatif)" : "Numéro qui reçoit l'argent"}
          <input {...text("account_number")} maxLength={60} inputMode="tel" placeholder="+227 …" />
        </label>
        <label className={labelClass}>
          Au nom de (facultatif)
          <input {...text("account_name")} maxLength={120} placeholder="Ex. AMAZER SARL" />
        </label>
        <label className={labelClass}>
          Ordre d&apos;affichage
          <input className={fieldClass} type="number" min={0} max={999} value={form.sort_order} onChange={(event) => setForm((prev) => ({ ...prev, sort_order: Math.max(0, Number(event.target.value) || 0) }))} />
        </label>
      </div>
      <label className={labelClass}>
        Comment payer (facultatif)
        <textarea
          className="mt-1 min-h-24 w-full rounded-field border border-border bg-card p-3 text-base text-ink-900"
          maxLength={1200}
          value={form.instructions ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, instructions: event.target.value }))}
          placeholder="Ex. Composez *555#, choisissez Transfert, puis saisissez le numéro."
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-800">
        <input type="checkbox" className="h-5 w-5" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
        Proposé aux clients
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? "Enregistrement…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
            Fermer
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function MethodRow({ method, busy, onSave, onDelete }: { method: AdminPaymentMethod; busy: boolean; onSave: (input: PaymentMethodInput) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{method.name}</p>
          <p className="text-sm text-ink-600">
            {method.kind === "amana" ? "Validation automatique" : "Vérifié par AMAZER"} · {method.account_number || "numéro général"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${method.is_active ? "bg-success/10 text-ink-800" : "bg-surface-3 text-ink-700"}`}>{method.is_active ? "Actif" : "Masqué"}</span>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
            {open ? "Fermer" : "Modifier"}
          </Button>
          {!method.built_in ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              aria-label={`Supprimer ${method.name}`}
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Supprimer « ${method.name} » ? Les anciennes commandes restent lisibles.`)) onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-4 border-t border-border pt-4">
          <MethodForm
            initial={{ name: method.name, account_number: method.account_number, account_name: method.account_name, instructions: method.instructions, is_active: method.is_active, sort_order: method.sort_order }}
            kind={method.kind}
            busy={busy}
            submitLabel="Enregistrer"
            onSubmit={(input) => {
              onSave(input);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Moyens de paiement proposés aux clients : nom, numéro et instructions, sans passer par un développeur. */
export default function AdminPaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: methods, isPending, isError, refetch } = useQuery({ queryKey: ["admin-payment-methods"], queryFn: listAdminPaymentMethods });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    void queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
  };
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));
  const create = useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: (method) => {
      toast.success(`${method.name} est proposé aux clients.`);
      setAdding(false);
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ code, input }: { code: string; input: PaymentMethodInput }) => updatePaymentMethod(code, input),
    onSuccess: () => {
      toast.success("Moyen de paiement enregistré.");
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => {
      toast.success("Moyen de paiement supprimé.");
      refresh();
    },
    onError,
  });
  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-gutter pb-14 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
            <CreditCard className="h-6 w-6 text-brand-600" aria-hidden="true" />
            Moyens de paiement
          </h1>
          <p className="mt-1 text-sm text-ink-600">Ajoutez un moyen, il apparaît aussitôt au paiement, avec le numéro et vos instructions.</p>
        </div>
        {!adding ? (
          <Button type="button" className="min-h-11" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter un moyen
          </Button>
        ) : null}
      </header>

      {adding ? (
        <div className="rounded-card border border-border bg-card p-4">
          <p className="mb-3 font-semibold text-ink-900">Nouveau moyen de paiement</p>
          <MethodForm initial={EMPTY} kind="manual" busy={busy} submitLabel="Ajouter" onSubmit={(input) => create.mutate(input)} onCancel={() => setAdding(false)} />
        </div>
      ) : null}

      {isPending ? <div className="h-32 animate-pulse rounded-card bg-surface-3" aria-busy="true" aria-label="Chargement" /> : null}
      {isError ? (
        <div className="rounded-card border border-border bg-card p-4 text-sm">
          <p className="text-danger">Moyens de paiement indisponibles. Votre code PIN est peut-être à ressaisir.</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      ) : null}
      {methods ? (
        <ul className="space-y-3">
          {methods.map((method) => (
            <MethodRow key={method.code} method={method} busy={busy} onSave={(input) => update.mutate({ code: method.code, input })} onDelete={() => remove.mutate(method.code)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
