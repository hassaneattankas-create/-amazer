"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import {
  decideDigitalProduct,
  listConversationReports,
  listDigitalProducts,
  listPlatformFeedbackAdmin,
  listVendorReviewsAdmin,
  togglePlatformFeedback,
  toggleVendorReview,
} from "@/services/moderation-service";

function ReportsSection() {
  const { data, isPending, isError } = useQuery({ queryKey: ["admin-reports"], queryFn: listConversationReports });

  return (
    <section aria-labelledby="reports-title" className="rounded-card border border-border bg-card p-5">
      <h2 id="reports-title" className="text-lg font-semibold text-ink-900">
        Signalements de conversations
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Le contenu des conversations reste privé : vous voyez le motif, l&apos;auteur et la boutique concernée. Pour
        suspendre un compte (client ou boutique), utilisez « Retirer » dans{" "}
        <Link href="/admin/users" className="font-medium text-brand-600 hover:underline">
          Utilisateurs
        </Link>
        .
      </p>
      {isPending ? <div className="mt-4 h-20 animate-pulse rounded-field bg-surface-1" aria-busy="true" /> : null}
      {isError ? <p className="mt-4 text-sm text-danger">Impossible de charger les signalements.</p> : null}
      {data && !data.length ? <p className="mt-4 text-sm text-ink-600">Aucun signalement pour le moment.</p> : null}
      {data?.length ? (
        <ul className="mt-4 divide-y divide-border">
          {data.map((report) => (
            <li key={report.id} className="py-3 text-sm">
              <p className="font-medium text-ink-900">{report.reason}</p>
              <p className="mt-1 text-xs text-ink-600">
                {new Date(report.created_at).toLocaleString("fr-FR")} · par {report.reporter_email ?? "compte supprimé"} (
                {report.reporter_role === "seller" ? "vendeur" : "client"}) · boutique {report.vendor_name ?? "inconnue"} ·
                conversation {report.conversation_id?.slice(0, 8) ?? "?"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReviewsSection() {
  const queryClient = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ["admin-vendor-reviews"], queryFn: listVendorReviewsAdmin });
  const toggle = useMutation({
    mutationFn: toggleVendorReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-vendor-reviews"] }),
  });
  return (
    <section aria-labelledby="reviews-title" className="space-y-3">
      <h2 id="reviews-title" className="text-lg font-semibold text-ink-900">
        Avis sur les établissements
      </h2>
      {isPending ? (
        <div className="h-20 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {data.map((review) => (
            <li key={review.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${review.is_hidden ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">
                  {review.vendor_name} · {review.rating}/5 · {review.author}
                  {review.is_hidden ? " · masqué" : ""}
                </p>
                {review.comment ? <p className="text-sm text-ink-800">{review.comment}</p> : null}
              </div>
              <Button type="button" size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(review.id)}>
                {review.is_hidden ? "Réafficher" : "Masquer"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Aucun avis pour le moment.</p>
      )}
    </section>
  );
}

/** Avis de la page publique « Avis » : masquer un avis insultant, faux ou publicitaire. */
function PlatformFeedbackSection() {
  const queryClient = useQueryClient();
  const { data = [], isPending } = useQuery({ queryKey: ["admin-platform-feedback"], queryFn: listPlatformFeedbackAdmin });
  const toggle = useMutation({
    mutationFn: togglePlatformFeedback,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-platform-feedback"] }),
  });
  return (
    <section aria-labelledby="platform-feedback-title" className="space-y-3">
      <h2 id="platform-feedback-title" className="text-lg font-semibold text-ink-900">
        Avis sur AMAZER (page « Avis »)
      </h2>
      {isPending ? (
        <div className="h-20 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : data.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {data.slice(0, 100).map((item) => (
            <li key={item.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${item.is_visible ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">
                  {item.full_name} · {item.rating}/5{item.email ? ` · ${item.email}` : ""}
                  {item.is_visible ? "" : " · masqué"}
                </p>
                <p className="text-sm text-ink-800">{item.message}</p>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(item.id)}>
                {item.is_visible ? "Masquer" : "Réafficher"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Aucun avis pour le moment.</p>
      )}
    </section>
  );
}

/** Produits déclarés « numériques » : AMAZER valide avant d'enlever la livraison (un téléphone n'est jamais numérique). */
function DigitalProductsSection() {
  const queryClient = useQueryClient();
  const { data = [], isPending, isError } = useQuery({ queryKey: ["admin-digital-products"], queryFn: () => listDigitalProducts(true) });
  const decide = useMutation({
    mutationFn: ({ priceId, approve }: { priceId: string; approve: boolean }) =>
      decideDigitalProduct(priceId, approve, approve ? "" : "Objet physique : il doit être livré par AMAZER."),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-digital-products"] }),
  });
  return (
    <section aria-labelledby="digital-title" className="space-y-3">
      <div>
        <h2 id="digital-title" className="text-lg font-semibold text-ink-900">
          Produits numériques à valider
        </h2>
        <p className="text-sm text-ink-600">
          Le vendeur a coché « Produit numérique ». Tant que vous n&apos;avez pas validé, le produit est livré normalement. Validez seulement un
          e-book, une formation, un code… ; refusez tout objet (téléphone, vêtement…).
        </p>
      </div>
      {isPending ? (
        <div className="h-20 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : isError ? (
        <p className="text-sm text-danger" role="alert">
          Chargement impossible. Vérifiez votre code PIN puis rechargez la page.
        </p>
      ) : data.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {data.map((item) => (
            <li key={item.price_id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">
                  {item.product_name} · {formatXOF(item.amount)}
                </p>
                <p className="text-sm text-ink-600">{item.vendor_name}</p>
                {item.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-800">{item.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ priceId: item.price_id, approve: true })}>
                  Valider (numérique)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ priceId: item.price_id, approve: false })}
                >
                  Refuser (à livrer)
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Aucun produit numérique en attente.</p>
      )}
    </section>
  );
}

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Modération</h1>
        <p className="mt-1 text-sm text-ink-600">Signalements des utilisateurs, avis sur les établissements et avis sur AMAZER.</p>
      </header>
      <DigitalProductsSection />
      <ReportsSection />
      <ReviewsSection />
      <PlatformFeedbackSection />
    </div>
  );
}
