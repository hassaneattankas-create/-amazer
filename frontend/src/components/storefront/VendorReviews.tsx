"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { getVendorReviews, postVendorReview } from "@/services/seller-service";

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toLocaleString("fr-FR")} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`${size} ${star <= Math.round(value) ? "fill-brand-500 text-brand-500" : "text-ink-300"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Avis verifies (modele Booking / Uber Eats) : note moyenne, repartition, avis et reponses, formulaire. */
export function VendorReviews({ vendorId, name }: { vendorId: string; name: string }) {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: raw } = useQuery({ queryKey: ["vendor-reviews", vendorId], queryFn: () => getVendorReviews(vendorId), staleTime: 60_000 });
  const data = raw && Array.isArray(raw.items) ? raw : undefined;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const mutation = useMutation({
    mutationFn: () => postVendorReview(vendorId, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      setMessage({ ok: true, text: "Merci ! Votre avis est publié." });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["vendor-reviews", vendorId] });
    },
    onError: (error) => setMessage({ ok: false, text: getApiErrorMessage(error, "Avis impossible pour le moment.") }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating) return setMessage({ ok: false, text: "Choisissez une note de 1 à 5 étoiles." });
    setMessage(null);
    mutation.mutate();
  };

  return (
    <section aria-labelledby="reviews-title" className="space-y-3 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="reviews-title" className="text-xl font-semibold text-ink-900">
            Avis clients
          </h2>
          {data?.count ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-700">
              <span className="text-2xl font-bold text-ink-900">{data.average.toLocaleString("fr-FR")}</span>
              <Stars value={data.average} />
              <span>
                {data.count} avis vérifié{data.count > 1 ? "s" : ""}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-600">Pas encore d&apos;avis. Seuls les clients ayant commandé ou séjourné peuvent noter.</p>
          )}
        </div>
        {user?.id ? (
          <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
            Donner mon avis
          </Button>
        ) : (
          <Link href="/login" className="text-sm font-semibold text-brand-700 hover:underline">
            Se connecter pour donner un avis
          </Link>
        )}
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-2 rounded-field bg-surface-1 p-3">
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-ink-800">Votre note pour {name}</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  aria-pressed={rating === star}
                  onClick={() => setRating(star)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-field hover:bg-card"
                >
                  <Star className={`h-7 w-7 ${star <= rating ? "fill-brand-500 text-brand-500" : "text-ink-300"}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium text-ink-800">
            Votre commentaire (facultatif)
            <textarea
              className="mt-1 min-h-20 w-full rounded-field border border-border bg-card px-3 py-2 text-sm"
              maxLength={600}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Qualité, accueil, rapidité…"
            />
          </label>
          <p className="text-xs text-ink-600">
            Avis honnête et respectueux :{" "}
            <Link href="/legal/terms#avis" className="font-semibold text-brand-700 hover:underline">
              règles des avis
            </Link>
            .
          </p>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Envoi…" : "Publier mon avis"}
          </Button>
        </form>
      ) : null}
      {message ? (
        <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
          {message.text}
        </p>
      ) : null}

      {data?.items.length ? (
        <ul className="divide-y divide-border">
          {data.items.map((review) => (
            <li key={review.id} className="space-y-1 py-3">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink-900">{review.author}</span>
                <Stars value={review.rating} size="h-3.5 w-3.5" />
                <span className="text-ink-500">{shortDate(review.created_at)}</span>
              </p>
              {review.comment ? <p className="text-sm text-ink-800">{review.comment}</p> : null}
              {review.reply ? (
                <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
                  <span className="font-semibold">Réponse de l&apos;établissement : </span>
                  {review.reply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
