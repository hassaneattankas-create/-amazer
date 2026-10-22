"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, Link2, PackageOpen, Search, Share2, Trash2, Wallet } from "lucide-react";

import { WhatsAppIcon } from "@/components/contact/WhatsAppButton";
import { ResellerSubscriptionPanel } from "@/components/reseller/ResellerSubscriptionPanel";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProductSearch } from "@/hooks/use-product-search";
import { getApiErrorMessage } from "@/lib/api-error";
import { publicSiteOrigin } from "@/lib/backend-origin";
import { formatXOF } from "@/lib/currency";
import { getResellerShopRoute } from "@/lib/mobile-routes";
import { resolveProductImageUrl } from "@/lib/product-image";
import {
  createResellerListing,
  deleteResellerListing,
  getMyResellerAccount,
  getMyResellerEarnings,
  listMyResellerListings,
  updateResellerListing,
} from "@/services/reseller-service";

const STEPS = [
  { title: "Choisissez", text: "des produits AMAZER à revendre" },
  { title: "Fixez votre prix", text: "votre marge s'ajoute au prix de la boutique" },
  { title: "Partagez", text: "votre lien sur WhatsApp, Facebook, TikTok…" },
  { title: "Encaissez", text: "votre marge après chaque livraison (moins la commission AMAZER)" },
];

/** Prix conseille : +15 % arrondi a 50 XOF (marge courante en revente sans stock). */
function suggestedPrice(amount: number): number {
  return Math.ceil((amount * 1.15) / 50) * 50;
}

const siteOrigin = publicSiteOrigin;

export default function RevendrePage() {
  const queryClient = useQueryClient();
  // isLoading (et non isPending) : pour un visiteur la requete est desactivee, donc jamais « en cours ».
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const loggedIn = Boolean(user?.id);

  const { data: listings = [], isPending: listingsPending } = useQuery({
    queryKey: ["reseller-listings"],
    queryFn: listMyResellerListings,
    enabled: loggedIn,
  });
  const { data: earnings } = useQuery({ queryKey: ["reseller-earnings"], queryFn: getMyResellerEarnings, enabled: loggedIn });
  const { data: account } = useQuery({ queryKey: ["reseller-account"], queryFn: getMyResellerAccount, enabled: loggedIn });
  // Part du revendeur apres la commission AMAZER sur la marge.
  const keepRatio = 1 - (account?.commission_percent ?? 0) / 100;
  const { data: catalog, isFetching: catalogLoading, isPending: catalogPending } = useProductSearch({
    query: debounced,
    barcode: "",
    limit: 24,
    sort: debounced ? "relevance" : "newest",
    inStockOnly: true,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["reseller-listings"] });
  };
  const onError = (error: unknown) => setMessage({ ok: false, text: getApiErrorMessage(error, "Action impossible.") });
  const create = useMutation({
    mutationFn: createResellerListing,
    onSuccess: (listing) => {
      setMessage({ ok: true, text: `« ${listing.product_name} » ajouté à votre boutique.` });
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; resale_amount?: number; is_active?: boolean }) => updateResellerListing(id, payload),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({ mutationFn: deleteResellerListing, onSuccess: refresh, onError });

  const shopUrl = user ? `${siteOrigin()}${getResellerShopRoute(user.id)}` : "";
  const listedPriceIds = new Set(listings.map((item) => item.price_id));

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8">
        <h1 className="text-display-sm font-semibold tracking-display">Revendez sans stock</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          Le dropshipping AMAZER : vous vendez, la boutique prépare, AMAZER livre. Vous gardez la marge.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-field bg-white/10 px-3 py-2 text-sm">
              <span className="font-semibold">
                {index + 1}. {step.title}
              </span>{" "}
              <span className="text-white/80">{step.text}</span>
            </li>
          ))}
        </ol>
        <Link href="/formations" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-400 hover:underline">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Formations gratuites : bien démarrer
        </Link>
      </header>

      {!loggedIn && !userLoading ? (
        <div className="rounded-card border border-border bg-card p-5 text-center">
          <p className="font-semibold text-ink-900">Créez un compte gratuit pour commencer à revendre.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild>
              <Link href="/register?next=/revendre">Créer un compte</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?next=/revendre">Se connecter</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {loggedIn ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-sm text-ink-600">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Gagné net (commandes livrées)
              </p>
              <p className="mt-1 text-2xl font-bold text-ink-900">{formatXOF(earnings?.earned ?? 0)}</p>
              <p className="mt-1 text-xs text-ink-600">
                Déjà reçu {formatXOF(earnings?.paid ?? 0)} · à recevoir {formatXOF(earnings?.to_pay ?? earnings?.earned ?? 0)}
              </p>
            </div>
            <div className="rounded-card border border-border bg-card p-4">
              <p className="text-sm text-ink-600">En attente de livraison</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">{formatXOF(earnings?.pending ?? 0)}</p>
            </div>
            <div className="rounded-card border border-border bg-card p-4">
              <p className="text-sm text-ink-600">Produits revendus</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">{listings.filter((item) => item.is_active).length}</p>
            </div>
          </div>
          <p className="text-xs text-ink-600">
            Montants nets, après la commission AMAZER. Vos gains vous sont versés (Nita ou Amana) après livraison ; pour un
            versement, écrivez-nous sur WhatsApp.
          </p>
          {account ? <ResellerSubscriptionPanel account={account} /> : null}

          <div className="rounded-card border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Votre boutique
            </p>
            <p className="mt-1 break-all text-sm text-ink-700">{shopUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(shopUrl)
                    .then(() => setMessage({ ok: true, text: "Lien copié." }))
                    .catch(() => setMessage({ ok: false, text: "Copie impossible : sélectionnez le lien." }));
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copier le lien
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Découvrez ma boutique sur AMAZER (paiement sécurisé, livraison) : ${shopUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-field border border-success px-4 text-sm font-semibold text-success hover:bg-surface-1"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Partager sur WhatsApp
              </a>
              <Button asChild variant="outline">
                <Link href={user ? getResellerShopRoute(user.id) : "#"}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Voir ma boutique
                </Link>
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {message ? (
        <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
          {message.text}
        </p>
      ) : null}

      {loggedIn ? (
        <section aria-label="Mes produits revendus" className="space-y-2">
          <h2 className="text-lg font-semibold text-ink-900">Mes produits ({listings.length})</h2>
          {listingsPending ? (
            <div className="h-20 animate-pulse rounded-card bg-surface-3" />
          ) : listings.length ? (
            <ul className="divide-y divide-border rounded-card border border-border bg-card">
              {listings.map((item) => {
                const draft = drafts[item.id] ?? String(item.resale_amount);
                return (
                  <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-3 p-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-field bg-surface-1">
                      <Image src={resolveProductImageUrl({ raw: item.image_url })} alt="" fill sizes="56px" unoptimized className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{item.product_name}</p>
                      <p className="text-xs text-ink-600">
                        Prix boutique {formatXOF(item.supplier_amount)} · vous gagnez{" "}
                        <span className="font-semibold text-success">{formatXOF(Math.round(item.margin * keepRatio))}</span> ·{" "}
                        {item.sales_count} vendu
                        {item.sales_count > 1 ? "s" : ""}
                        {!item.in_stock ? " · rupture" : ""}
                      </p>
                    </div>
                    <label className="sr-only" htmlFor={`price-${item.id}`}>
                      Mon prix pour {item.product_name}
                    </label>
                    <input
                      id={`price-${item.id}`}
                      inputMode="numeric"
                      value={draft}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: event.target.value.replace(/\D/g, "") }))}
                      onBlur={() => {
                        const value = Number(draft);
                        if (value && value !== item.resale_amount) update.mutate({ id: item.id, resale_amount: value });
                      }}
                      className="h-11 w-28 rounded-field border border-border px-3 text-right text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ id: item.id, is_active: !item.is_active })}
                    >
                      {item.is_active ? "Masquer" : "Afficher"}
                    </Button>
                    <button
                      type="button"
                      aria-label={`Retirer ${item.product_name}`}
                      onClick={() => remove.mutate(item.id)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-field text-ink-600 hover:bg-surface-1 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-card border border-border bg-card p-4 text-sm text-ink-600">
              <PackageOpen className="h-5 w-5" aria-hidden="true" />
              Aucun produit pour l&apos;instant. Choisissez-en ci-dessous.
            </p>
          )}
        </section>
      ) : null}

      <section aria-label="Choisir des produits" className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">Choisir des produits à revendre</h2>
        <div className="relative">
          <label htmlFor="reseller-search" className="sr-only">
            Rechercher un produit à revendre
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input
            id="reseller-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Riz, téléphone, savon…"
            className="h-12 w-full rounded-pill border border-border bg-card pl-12 pr-4 text-base text-ink-900"
          />
        </div>
        {catalogPending ? (
          <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-card bg-surface-3" />
            ))}
          </div>
        ) : null}
        <ul className="grid gap-2 sm:grid-cols-2" aria-busy={catalogLoading}>
          {(catalog?.items ?? []).map((product) => {
            const offer = product.best_offer;
            const already = listedPriceIds.has(offer.price_id);
            const draftKey = `new-${offer.price_id}`;
            const draft = drafts[draftKey] ?? String(suggestedPrice(offer.amount));
            const margin = Math.max(0, Number(draft || 0) - offer.amount);
            return (
              <li key={product.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-field bg-surface-1">
                  <Image
                    src={resolveProductImageUrl({ raw: product.main_image_url, categorySlug: product.category?.slug })}
                    alt=""
                    fill
                    sizes="56px"
                    unoptimized
                    className="object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="line-clamp-2 text-sm font-semibold text-ink-900">{product.name}</p>
                  <p className="text-xs text-ink-600">
                    Boutique {formatXOF(offer.amount)} · vous gagnez{" "}
                    <span className="font-semibold text-success">{formatXOF(Math.round(margin * keepRatio))}</span>
                  </p>
                </div>
                {already ? (
                  <span className="text-xs font-semibold text-success">Ajouté</span>
                ) : (
                  <form
                    className="ml-auto flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!loggedIn) {
                        window.location.assign("/login?next=/revendre");
                        return;
                      }
                      create.mutate({ price_id: offer.price_id, resale_amount: Number(draft) });
                    }}
                  >
                    <label className="sr-only" htmlFor={draftKey}>
                      Mon prix de revente
                    </label>
                    <input
                      id={draftKey}
                      inputMode="numeric"
                      value={draft}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [draftKey]: event.target.value.replace(/\D/g, "") }))}
                      className="h-11 w-24 rounded-field border border-border px-2 text-right text-sm"
                    />
                    <Button type="submit" size="sm" disabled={create.isPending}>
                      Revendre
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
