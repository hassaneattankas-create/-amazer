"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAdminWelcome, updateAdminWelcome, type WelcomeSettings } from "@/services/finance-service";

const fieldClass = "mt-1 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/** Ce que reçoit une personne qui vient de s'inscrire (même calcul que le serveur). */
function preview(values: WelcomeSettings): string {
  const lines = [values.message.replaceAll("{prenom}", "Aïcha")];
  if (values.whatsapp_group_url) lines.push("", `Rejoignez le groupe WhatsApp AMAZER : ${values.whatsapp_group_url}`);
  if (values.whatsapp_channel_url) lines.push(values.whatsapp_group_url ? "" : "", `Suivez la chaîne WhatsApp AMAZER : ${values.whatsapp_channel_url}`);
  return lines.join("\n").replace(/\n\n\n/g, "\n\n");
}

/** Admin : message envoyé après chaque création de compte, avec les liens du groupe et de la chaîne WhatsApp. */
export function WelcomeMessageSettings() {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery({ queryKey: ["admin-welcome"], queryFn: getAdminWelcome, retry: false });
  // Brouillon de l'admin ; tant qu'il n'a rien touché, on affiche les réglages enregistrés.
  const [draft, setForm] = useState<WelcomeSettings | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const form = draft ?? (data ? { ...data, whatsapp_group_url: data.whatsapp_group_url ?? "", whatsapp_channel_url: data.whatsapp_channel_url ?? "" } : null);

  const save = useMutation({
    mutationFn: updateAdminWelcome,
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin-welcome"], saved);
      setStatus({ ok: true, text: "Message enregistré : il partira à chaque nouvelle inscription." });
    },
    onError: (err) => setStatus({ ok: false, text: getAdminFinanceDataError(err) || getApiErrorMessage(err, "Enregistrement impossible.") }),
  });

  if (isPending) return <div className="h-40 animate-pulse rounded-card bg-surface-2" aria-busy="true" />;
  if (error && !form) return <p className="text-sm text-danger">{getAdminFinanceDataError(error) || "Chargement impossible."}</p>;
  if (!form) return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setStatus(null);
    save.mutate({
      title: form.title.trim(),
      message: form.message.trim(),
      whatsapp_group_url: form.whatsapp_group_url?.trim() || null,
      whatsapp_channel_url: form.whatsapp_channel_url?.trim() || null,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-ink-600">
        Envoyé à chaque personne qui crée un compte : notification sur le site et le téléphone, et copie par e-mail et WhatsApp quand ces envois sont
        activés. Écrivez <strong>{"{prenom}"}</strong> pour mettre le prénom de la personne.
      </p>
      <label className="block text-sm font-medium text-ink-800">
        Titre
        <input className={`${fieldClass} h-11`} value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label className="block text-sm font-medium text-ink-800">
        Message
        <textarea className={`${fieldClass} min-h-32 py-2`} value={form.message} maxLength={1500} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </label>
      <label className="block text-sm font-medium text-ink-800">
        Lien du groupe WhatsApp
        <input
          className={`${fieldClass} h-11`}
          value={form.whatsapp_group_url ?? ""}
          placeholder="https://chat.whatsapp.com/…"
          inputMode="url"
          onChange={(e) => setForm({ ...form, whatsapp_group_url: e.target.value })}
        />
      </label>
      <label className="block text-sm font-medium text-ink-800">
        Lien de la chaîne WhatsApp
        <input
          className={`${fieldClass} h-11`}
          value={form.whatsapp_channel_url ?? ""}
          placeholder="https://whatsapp.com/channel/…"
          inputMode="url"
          onChange={(e) => setForm({ ...form, whatsapp_channel_url: e.target.value })}
        />
      </label>
      <div className="rounded-field bg-surface-1 p-3">
        <p className="text-xs font-semibold uppercase tracking-label text-ink-600">Aperçu</p>
        <p className="mt-1 text-sm font-semibold text-ink-900">{form.title}</p>
        <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{preview(form)}</p>
      </div>
      <Button type="submit" size="lg" disabled={save.isPending || form.title.trim().length < 3 || form.message.trim().length < 10}>
        {save.isPending ? "Enregistrement…" : "Enregistrer le message"}
      </Button>
      {status ? (
        <p className={`text-sm ${status.ok ? "text-success" : "text-danger"}`} role="status">
          {status.text}
        </p>
      ) : null}
    </form>
  );
}
