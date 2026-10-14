"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminFinanceDataError } from "@/lib/admin-finance-verification";
import { getApiErrorMessage } from "@/lib/api-error";
import { sendAdminMessage, type AdminMessageAudience } from "@/services/finance-service";

const AUDIENCES: { value: AdminMessageAudience; label: string }[] = [
  { value: "all", label: "Tout le monde" },
  { value: "customers", label: "Clients" },
  { value: "sellers", label: "Vendeurs" },
  { value: "couriers", label: "Livreurs" },
  { value: "user", label: "Une personne" },
];

const fieldClass = "mt-1 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

export default function AdminMessagesPage() {
  const [audience, setAudience] = useState<AdminMessageAudience>("all");
  const [userEmail, setUserEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const send = useMutation({
    mutationFn: sendAdminMessage,
    onSuccess: (result) => {
      setStatus({ ok: true, text: `Message envoyé à ${result.recipients} personne(s) : sur le site et par e-mail.` });
      setTitle("");
      setBody("");
      setHref("");
    },
    onError: (error) =>
      setStatus({ ok: false, text: getAdminFinanceDataError(error) || getApiErrorMessage(error, "Envoi impossible.") }),
  });

  const canSend =
    title.trim().length >= 3 && body.trim().length >= 3 && (audience !== "user" || userEmail.trim().length >= 6);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const label = AUDIENCES.find((item) => item.value === audience)?.label ?? "";
    if (audience !== "user" && !window.confirm(`Envoyer ce message à : ${label} ?`)) return;
    setStatus(null);
    send.mutate({
      audience,
      user_email: audience === "user" ? userEmail.trim() : undefined,
      title: title.trim(),
      body: body.trim(),
      href: href.trim().startsWith("/") ? href.trim() : undefined,
    });
  }

  return (
    <section className="max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-600">
          Envoyé automatiquement : notification sur le site et e-mail à chaque destinataire.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-border bg-card p-5">
        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Destinataires</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AUDIENCES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={audience === item.value}
                onClick={() => setAudience(item.value)}
                className={`min-h-11 rounded-pill border px-4 text-sm font-medium ${
                  audience === item.value ? "border-ink-900 bg-ink-900 text-white" : "border-border text-ink-700 hover:border-ink-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {audience === "user" ? (
          <label className="block text-sm font-medium text-ink-800">
            E-mail ou numéro WhatsApp de la personne
            <input className={`${fieldClass} h-11`} value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
          </label>
        ) : null}

        <label className="block text-sm font-medium text-ink-800">
          Titre
          <input className={`${fieldClass} h-11`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Message
          <textarea
            className={`${fieldClass} min-h-32 py-2`}
            value={body}
            maxLength={600}
            onChange={(e) => setBody(e.target.value)}
          />
          <span className="mt-1 block text-xs text-ink-600">{body.length}/600</span>
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Lien sur le site (facultatif)
          <input
            className={`${fieldClass} h-11`}
            value={href}
            placeholder="/promotions"
            onChange={(e) => setHref(e.target.value)}
          />
        </label>

        <p className="text-xs text-ink-600">
          Formule e-mail gratuite (Brevo) : environ 300 e-mails par jour. Au-delà, le message reste visible sur le site.
        </p>

        <Button type="submit" size="lg" disabled={!canSend || send.isPending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {send.isPending ? "Envoi…" : "Envoyer"}
        </Button>
        {status ? (
          <p className={`text-sm ${status.ok ? "text-success" : "text-danger"}`} role="status">
            {status.text}{" "}
            {!status.ok && status.text.includes("PIN") ? (
              <Link href="/admin/users" className="font-semibold underline">
                Valider le PIN
              </Link>
            ) : null}
          </p>
        ) : null}
      </form>
    </section>
  );
}
