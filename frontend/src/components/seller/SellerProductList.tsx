"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Search, Trash2 } from "lucide-react";

import { SingleMediaField } from "@/components/seller/MediaFields";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { normalizeImageInputForApi, resolveImageUrl } from "@/lib/image";
import type { SellerInventoryItem } from "@/types/seller";

export type InventoryUpdate = {
  priceId: string;
  amount: number;
  stock: number;
  is_active?: boolean;
  promo_amount?: number;
  promo_days?: number;
  clear_promo?: boolean;
  is_digital?: boolean;
  main_image_url?: string;
  product_name?: string;
  brand?: string;
  description?: string;
};

type Filter = "all" | "online" | "hidden" | "low";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "online", label: "En ligne" },
  { key: "hidden", label: "Masqués" },
  { key: "low", label: "Stock faible" },
];
const PAGE = 20;
const LOW_STOCK = 3;
const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/**
 * Catalogue vendeur a la maniere de Shopify : une ligne par produit, recherche et filtres,
 * edition seulement quand on clique « Modifier ».
 */
export function SellerProductList({
  inventory,
  busy,
  onUpdate,
  onDelete,
}: {
  inventory: SellerInventoryItem[];
  busy: boolean;
  onUpdate: (update: InventoryUpdate) => void;
  onDelete: (priceId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: inventory.length,
      online: inventory.filter((item) => item.is_active).length,
      hidden: inventory.filter((item) => !item.is_active).length,
      low: inventory.filter((item) => item.stock_quantity <= LOW_STOCK).length,
    }),
    [inventory]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory.filter((item) => {
      if (filter === "online" && !item.is_active) return false;
      if (filter === "hidden" && item.is_active) return false;
      if (filter === "low" && item.stock_quantity > LOW_STOCK) return false;
      return !needle || `${item.product_name} ${item.brand}`.toLowerCase().includes(needle);
    });
  }, [inventory, query, filter]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="product-search" className="sr-only">
          Rechercher dans mes produits
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE);
          }}
          placeholder="Rechercher un produit…"
          className="h-11 w-full rounded-field border border-border bg-card pl-9 pr-3 text-sm"
        />
      </div>
      <div className="-mx-gutter flex gap-2 overflow-x-auto px-gutter" role="tablist" aria-label="Filtrer les produits">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            onClick={() => {
              setFilter(item.key);
              setLimit(PAGE);
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium ${
              filter === item.key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700"
            }`}
          >
            {item.label}
            <span className={filter === item.key ? "text-white/70" : "text-ink-500"}>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {visible.slice(0, limit).map((item) => (
            <li key={item.price_id} className="p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-field bg-surface-1">
                  {item.main_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveImageUrl(item.main_image_url) ?? ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-ink-400" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{item.product_name}</p>
                  <p className="text-xs text-ink-600">
                    {item.promo_price ? (
                      <>
                        <span className="font-semibold text-brand-700">Promo {formatXOF(item.promo_price)}</span>{" "}
                        <span className="line-through">{formatXOF(item.regular_amount ?? item.amount)}</span> · jusqu&apos;au{" "}
                        {formatPromoEnd(item.promo_until)}
                      </>
                    ) : (
                      formatXOF(item.amount)
                    )}{" "}
                    · stock{" "}
                    <span className={item.stock_quantity <= LOW_STOCK ? "font-semibold text-danger" : ""}>{item.stock_quantity}</span>
                    {" · "}
                    <span className={item.is_active ? "text-success" : "text-ink-500"}>{item.is_active ? "En ligne" : "Masqué"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Modifier ${item.product_name}`}
                  aria-expanded={editing === item.price_id}
                  onClick={() => setEditing(editing === item.price_id ? null : item.price_id)}
                  className="inline-flex h-11 shrink-0 items-center gap-1 rounded-field border border-border px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Modifier</span>
                </button>
              </div>
              {editing === item.price_id ? (
                <ProductEditor
                  item={item}
                  busy={busy}
                  onSave={(update) => {
                    onUpdate(update);
                    setEditing(null);
                  }}
                  onToggle={() => onUpdate({ priceId: item.price_id, amount: item.regular_amount ?? item.amount, stock: item.stock_quantity, is_active: !item.is_active })}
                  onDelete={() => {
                    if (window.confirm(`Supprimer « ${item.product_name} » ?`)) onDelete(item.price_id);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
          {inventory.length ? "Aucun produit ne correspond." : "Aucun produit pour l'instant. Ajoutez-en un depuis l'onglet « Ajouter »."}
        </p>
      )}
      {visible.length > limit ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => setLimit((value) => value + PAGE)}>
            Voir plus ({visible.length - limit})
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const PROMO_DAYS = [1, 3, 7, 14, 30];

function formatPromoEnd(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
}

function ProductEditor({
  item,
  busy,
  onSave,
  onToggle,
  onDelete,
}: {
  item: SellerInventoryItem;
  busy: boolean;
  onSave: (update: InventoryUpdate) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    name: item.product_name,
    brand: item.brand,
    description: item.description ?? "",
    amount: String(item.regular_amount ?? item.amount),
    stock: String(item.stock_quantity),
    promo: item.promo_price ? String(item.promo_price) : "",
    days: "",
    digital: Boolean(item.is_digital),
    image: item.main_image_url ?? "",
  });
  const [promoError, setPromoError] = useState("");
  const set = (key: keyof typeof draft) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const digits = (value: string) => value.replace(/\D/g, "");

  return (
    <div className="mt-3 space-y-3 rounded-field bg-surface-1 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-800">
          Nom
          <input className={fieldClass} value={draft.name} onChange={(e) => set("name")(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Marque
          <input className={fieldClass} value={draft.brand} onChange={(e) => set("brand")(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-ink-800">
          Prix normal XOF
          <input inputMode="numeric" className={fieldClass} value={draft.amount} onChange={(e) => set("amount")(digits(e.target.value))} />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Stock
          <input inputMode="numeric" className={fieldClass} value={draft.stock} onChange={(e) => set("stock")(digits(e.target.value))} />
        </label>
      </div>
      <fieldset className="min-w-0 space-y-2 rounded-field border border-border bg-card p-3">
        <legend className="px-1 text-sm font-semibold text-ink-900">Promotion</legend>
        {item.promo_price ? (
          <p className="text-sm text-ink-700">
            En cours : {formatXOF(item.promo_price)}, jusqu&apos;au {formatPromoEnd(item.promo_until)}
          </p>
        ) : (
          <p className="text-xs text-ink-600">
            Mettez un prix plus bas et une durée. Le produit apparaît dans « Promotions » avec le prix normal barré, puis revient seul à son prix normal.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-ink-800">
            Prix promo XOF
            <input
              inputMode="numeric"
              placeholder="Aucune"
              className={fieldClass}
              value={draft.promo}
              onChange={(e) => set("promo")(digits(e.target.value))}
            />
          </label>
          <label className="block text-sm font-medium text-ink-800">
            Durée
            <select className={fieldClass} value={draft.days} onChange={(e) => set("days")(e.target.value)}>
              <option value="">{item.promo_price ? "Même date" : "7 jours"}</option>
              {PROMO_DAYS.map((days) => (
                <option key={days} value={String(days)}>
                  {days} jour{days > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {promoError ? (
          <p className="text-sm text-danger" role="alert">
            {promoError}
          </p>
        ) : null}
        {item.promo_price ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              onSave({ priceId: item.price_id, amount: Number(draft.amount) || (item.regular_amount ?? item.amount), stock: Number(draft.stock || 0), clear_promo: true })
            }
          >
            Arrêter la promo
          </Button>
        ) : null}
      </fieldset>
      <label className="block text-sm font-medium text-ink-800">
        Description
        <textarea className={`${fieldClass} h-auto min-h-20 py-2`} value={draft.description} onChange={(e) => set("description")(e.target.value)} />
      </label>
      <SingleMediaField label="Photo" value={draft.image} onChange={set("image")} emptyMessage="Choisissez une photo" />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-800">
        <input type="checkbox" className="h-5 w-5" checked={draft.digital} onChange={(e) => setDraft((prev) => ({ ...prev, digital: e.target.checked }))} />
        Produit numérique : pas de frais de livraison
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            const promo = Number(draft.promo);
            const normal = Number(draft.amount) || (item.regular_amount ?? item.amount);
            if (promo > 0 && promo >= normal) {
              setPromoError(`Le prix promo doit être inférieur au prix normal (${formatXOF(normal)}).`);
              return;
            }
            setPromoError("");
            onSave({
              priceId: item.price_id,
              amount: normal,
              stock: Number(draft.stock || 0),
              product_name: draft.name.trim() || undefined,
              brand: draft.brand.trim() || undefined,
              description: draft.description.trim() || undefined,
              main_image_url: draft.image !== (item.main_image_url ?? "") ? normalizeImageInputForApi(draft.image) ?? "" : undefined,
              ...(draft.digital !== Boolean(item.is_digital) ? { is_digital: draft.digital } : {}),
              ...(promo > 0 ? { promo_amount: promo, ...(draft.days ? { promo_days: Number(draft.days) } : {}) } : {}),
              ...(!promo && item.promo_price ? { clear_promo: true } : {}),
            });
          }}
        >
          Enregistrer
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onToggle}>
          {item.is_active ? "Masquer" : "Remettre en ligne"}
        </Button>
        <Button type="button" variant="outline" className="ml-auto border-danger text-danger" disabled={busy} onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
