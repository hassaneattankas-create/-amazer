"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Stars } from "@/components/storefront/VendorReviews";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { listMyShopReviews, replyToReview } from "@/services/seller-service";

/** Avis recus : note moyenne et reponse publique aux clients (comme sur Booking / Google). */
export function SellerReviewsPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-shop-reviews"], queryFn: listMyShopReviews });
  const [replying, setReplying] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => replyToReview(id, reply),
    onSuccess: () => {
      setReplying(null);
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["my-shop-reviews"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Réponse impossible.")),
  });
  if (!data) return null;

  return (
    <section aria-labelledby="my-reviews-title" className="space-y-2 rounded-card border border-border bg-card p-4">
      <h2 id="my-reviews-title" className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink-900">
        Avis clients
        {data.count ? (
          <span className="flex items-center gap-1 text-sm font-normal text-ink-700">
            <span className="font-bold text-ink-900">{data.average.toLocaleString("fr-FR")}</span>
            <Stars value={data.average} /> ({data.count})
          </span>
        ) : null}
      </h2>
      {data.items.length ? (
        <ul className="divide-y divide-border">
          {data.items.slice(0, 5).map((review) => (
            <li key={review.id} className="space-y-1 py-2">
              <p className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-ink-900">{review.author}</span>
                <Stars value={review.rating} size="h-3.5 w-3.5" />
              </p>
              {review.comment ? <p className="text-sm text-ink-800">{review.comment}</p> : null}
              {review.reply ? (
                <p className="text-xs text-ink-600">Votre réponse : {review.reply}</p>
              ) : replying === review.id ? (
                <div className="space-y-2">
                  <textarea
                    aria-label="Votre réponse"
                    className="min-h-20 w-full rounded-field border border-border bg-card px-3 py-2 text-sm"
                    maxLength={600}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Merci pour votre visite…"
                  />
                  <Button type="button" size="sm" disabled={text.trim().length < 2 || mutation.isPending} onClick={() => mutation.mutate({ id: review.id, reply: text.trim() })}>
                    Publier la réponse
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold text-brand-700 hover:underline"
                  onClick={() => {
                    setError("");
                    setReplying(review.id);
                    setText("");
                  }}
                >
                  Répondre
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Pas encore d&apos;avis. Vos clients pourront noter après une commande livrée, un séjour ou un voyage.</p>
      )}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
