"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { createReview, listReviews } from "@/services/review-service";

type ReviewSystemProps = {
  productId: string;
};

export function ReviewSystem({ productId }: ReviewSystemProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => listReviews(productId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createReview(productId, {
        rating,
        comment,
        photo_url: photoUrl || undefined,
      }),
    onError: (error) =>
      setMessage({ ok: false, text: getApiErrorMessage(error, "Avis impossible pour le moment. Connectez-vous puis réessayez.") }),
    onSuccess: () => {
      setMessage({ ok: true, text: "Merci ! Votre avis est publié." });
      setComment("");
      setPhotoUrl("");
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
  });

  return (
    <article className="premium-card border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-ink-900">Avis clients</h2>
      <p className="mt-1 text-sm text-ink-600">Seuls les clients qui ont reçu ce produit peuvent le noter.</p>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600">Votre note</p>
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => {
            const current = index + 1;
            const active = current <= rating;
            return (
              <button
                key={current}
                type="button"
                aria-label={`${current} étoile${current > 1 ? "s" : ""}`}
                aria-pressed={current === rating}
                onClick={() => setRating(current)}
                className="inline-flex h-11 w-11 items-center justify-center"
              >
                <Star className={`h-5 w-5 transition ${active ? "fill-[#FFB200] text-[#FFB200]" : "text-slate-300"}`} />
              </button>
            );
          })}
        </div>
        <Input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-3"
          aria-label="Votre commentaire"
          placeholder="Votre commentaire"
        />
        <Input
          value={photoUrl}
          onChange={(event) => setPhotoUrl(event.target.value)}
          className="mt-2"
          aria-label="Lien vers une photo (facultatif)"
          placeholder="Lien vers une photo (facultatif)"
        />
        <Button
          type="button"
          disabled={!comment.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="primary-glow-btn mt-3 bg-brand-600 text-white hover:bg-brand-700"
        >
          {mutation.isPending ? "Publication…" : "Publier mon avis"}
        </Button>
        {message ? (
          <p className={`mt-2 text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{review.user_name}</p>
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={`${review.id}-${index}`}
                  className={`h-4 w-4 ${index < Math.round(review.rating) ? "fill-[#FFB200] text-[#FFB200]" : "text-slate-300"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-700">{review.comment}</p>
            {review.photo_url ? (
              <a className="mt-2 inline-block text-xs text-brand-600 underline" href={review.photo_url} target="_blank" rel="noreferrer">
                Voir la photo
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}
