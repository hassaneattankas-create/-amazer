"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createFeedback, listFeedback } from "@/services/feedback-service";

const fieldClass = "mt-1 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";
const RATING_LABELS = ["", "Très mauvais", "Mauvais", "Correct", "Bien", "Excellent"];

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? "fill-warning text-warning" : "text-ink-300"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Avis clients a la Trustpilot : note moyenne, repartition, avis recents, depot simple. */
export default function AvisPage() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);

  const { data: feedback = [], isPending } = useQuery({
    queryKey: ["customer-feedback"],
    queryFn: () => listFeedback(120),
  });

  const summary = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const item of feedback) counts[Math.min(5, Math.max(1, Math.round(item.rating)))] += 1;
    const total = feedback.length;
    const average = total ? feedback.reduce((sum, item) => sum + item.rating, 0) / total : 0;
    return { counts, total, average };
  }, [feedback]);

  const mutation = useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-feedback"] });
      setMessage("");
      setRating(0);
      setStatus({ ok: true, text: "Merci ! Votre avis est publié." });
    },
    onError: () => setStatus({ ok: false, text: "Envoi impossible. Réessayez dans un instant." }),
  });

  const name = fullName || user?.full_name || "";
  const canSend = name.trim().length >= 2 && message.trim().length >= 8 && rating > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setStatus(null);
    mutation.mutate({ full_name: name.trim(), email: email.trim() || undefined, message: message.trim(), rating });
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 px-gutter pb-14 pt-4">
      <header className="grid gap-4 rounded-card border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Avis clients</h1>
          {summary.total ? (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-4xl font-bold text-ink-900">{summary.average.toFixed(1).replace(".", ",")}</span>
              <div>
                <Stars value={summary.average} size="h-5 w-5" />
                <p className="text-sm text-ink-600">{summary.total} avis</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-600">Soyez le premier à donner votre avis.</p>
          )}
        </div>
        {summary.total ? (
          <ul className="space-y-1 text-sm" aria-label="Répartition des notes">
            {[5, 4, 3, 2, 1].map((n) => {
              const share = summary.total ? (summary.counts[n] / summary.total) * 100 : 0;
              return (
                <li key={n} className="flex items-center gap-2">
                  <span className="w-12 text-ink-700">{n} étoiles</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-3">
                    <span className="block h-full rounded-pill bg-warning" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-8 text-right text-ink-600">{summary.counts[n]}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-ink-900">Donner mon avis</h2>
        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Votre note</legend>
          <div className="mt-1 flex items-center gap-1" role="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} sur 5 : ${RATING_LABELS[n]}`}
                onClick={() => setRating(n)}
                className="flex h-11 w-11 items-center justify-center rounded-field hover:bg-surface-1"
              >
                <Star className={`h-7 w-7 ${n <= rating ? "fill-warning text-warning" : "text-ink-300"}`} aria-hidden="true" />
              </button>
            ))}
            {rating ? <span className="ml-2 text-sm font-medium text-ink-800">{RATING_LABELS[rating]}</span> : null}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink-800">
            Nom
            <input className={`${fieldClass} h-11`} value={name} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm font-medium text-ink-800">
            E-mail (facultatif, non publié)
            <input
              className={`${fieldClass} h-11`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-ink-800">
          Votre expérience
          <textarea
            className={`${fieldClass} min-h-28 py-2`}
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Qu'avez-vous apprécié ? Que peut-on améliorer ?"
          />
        </label>
        <Button type="submit" size="lg" disabled={!canSend || mutation.isPending}>
          {mutation.isPending ? "Envoi…" : "Publier mon avis"}
        </Button>
        {status ? (
          <p className={`text-sm ${status.ok ? "text-success" : "text-danger"}`} role="status">
            {status.text}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm text-ink-700">
          Un problème avec une commande ?
          <WhatsAppButton variant="link" label="Écrivez-nous" message="Bonjour AMAZER, j'ai un problème avec une commande." />
        </p>
      </form>

      <section aria-label="Avis récents" className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">Avis récents</h2>
        {isPending ? (
          <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
        ) : feedback.length ? (
          feedback.map((item) => (
            <article key={item.id} className="rounded-card border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink-900">{item.full_name}</p>
                <Stars value={item.rating} />
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-800">{item.message}</p>
            </article>
          ))
        ) : (
          <p className="rounded-card border border-border bg-card p-4 text-sm text-ink-600">Aucun avis pour le moment.</p>
        )}
      </section>
    </section>
  );
}
