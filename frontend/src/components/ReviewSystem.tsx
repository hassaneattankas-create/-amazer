"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReview, listReviews } from "@/services/review-service";

type ReviewSystemProps = {
  productId: string;
};

export function ReviewSystem({ productId }: ReviewSystemProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

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
    onSuccess: () => {
      setComment("");
      setPhotoUrl("");
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
  });

  return (
    <article className="premium-card border border-slate-200 bg-white p-6">
      <h2 className="luxury-title text-lg font-semibold">Avis clients & photos</h2>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600">Votre note</p>
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => {
            const current = index + 1;
            const active = current <= rating;
            return (
              <button key={current} type="button" onClick={() => setRating(current)}>
                <Star className={`h-5 w-5 transition ${active ? "fill-[#FFB200] text-[#FFB200]" : "text-slate-300"}`} />
              </button>
            );
          })}
        </div>
        <Input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-3"
          placeholder="Votre commentaire"
        />
        <Input
          value={photoUrl}
          onChange={(event) => setPhotoUrl(event.target.value)}
          className="mt-2"
          placeholder="URL photo (optionnel)"
        />
        <Button
          type="button"
          disabled={!comment.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="primary-glow-btn mt-3 bg-[#FF4D00] text-white hover:bg-[#e74700]"
        >
          {mutation.isPending ? "Publication..." : "Publier mon avis"}
        </Button>
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
              <a className="mt-2 inline-block text-xs text-[#FF4D00] underline" href={review.photo_url} target="_blank" rel="noreferrer">
                Voir la photo
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}
