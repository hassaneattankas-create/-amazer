"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ConversationMessage } from "@/types/conversation";

type ConversationThreadProps = {
  title: string;
  subtitle?: string;
  messages: ConversationMessage[];
  isSending: boolean;
  error: string;
  onSend: (body: string) => Promise<boolean>;
  onReport?: (reason: string) => Promise<boolean>;
};

const MAX_LENGTH = 2000;

export function ConversationThread({ title, subtitle, messages, isSending, error, onSend, onReport }: ConversationThreadProps) {
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) {
      return;
    }
    // Le brouillon n'est vide qu'apres un envoi reussi : jamais de saisie perdue.
    if (await onSend(body)) {
      setDraft("");
    }
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onReport || reason.trim().length < 3) {
      return;
    }
    const ok = await onReport(reason.trim());
    setReportStatus(ok ? "Signalement transmis à l'équipe AMAZER." : "Signalement impossible. Réessayez.");
    if (ok) {
      setReportOpen(false);
      setReason("");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink-900">{title}</h2>
          {subtitle ? <p className="text-xs text-ink-600">{subtitle}</p> : null}
        </div>
        {onReport ? (
          <button
            type="button"
            className="min-h-11 shrink-0 text-xs font-medium text-ink-600 hover:text-danger"
            onClick={() => setReportOpen((open) => !open)}
          >
            Signaler
          </button>
        ) : null}
      </div>

      {reportOpen ? (
        <form onSubmit={submitReport} className="mt-3 space-y-2 rounded-field bg-surface-1 p-3">
          <label htmlFor="report-reason" className="text-sm font-medium text-ink-800">
            Pourquoi signalez-vous cette conversation ?
          </label>
          <textarea
            id="report-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-field border border-input bg-background px-3 py-2 text-sm"
            rows={2}
          />
          <Button type="submit" size="sm" variant="outline" disabled={reason.trim().length < 3}>
            Envoyer le signalement
          </Button>
        </form>
      ) : null}
      {reportStatus ? (
        <p className="mt-2 text-xs text-ink-600" role="status">
          {reportStatus}
        </p>
      ) : null}

      <ol className="flex-1 space-y-2 overflow-y-auto py-4" aria-live="polite" aria-label="Messages">
        {messages.length ? (
          messages.map((message) => (
            <li key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs sm:max-w-md whitespace-pre-wrap break-words rounded-card px-3 py-2 text-sm ${
                  message.is_mine ? "bg-brand-600 text-white" : "bg-surface-1 text-ink-900"
                }`}
              >
                {message.body}
                <span className={`mt-1 block text-2xs ${message.is_mine ? "text-white/80" : "text-ink-600"}`}>
                  {new Date(message.created_at).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {message.is_mine && message.read ? " · lu" : ""}
                </span>
              </div>
            </li>
          ))
        ) : (
          <li className="text-sm text-ink-600">Écrivez votre premier message ci-dessous.</li>
        )}
      </ol>

      <form onSubmit={submit} className="border-t border-border pt-3">
        <label htmlFor="message-body" className="sr-only">
          Votre message
        </label>
        <textarea
          id="message-body"
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Votre message…"
          className="w-full rounded-field border border-input bg-background px-3 py-2 text-sm text-ink-900"
        />
        {error ? (
          <p className="mt-1 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-600">
            {draft.length}/{MAX_LENGTH}
          </span>
          <Button type="submit" disabled={isSending || !draft.trim()}>
            {isSending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
