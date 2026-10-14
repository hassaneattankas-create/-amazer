"use client";

import { FormEvent, useState } from "react";
import { ArrowUpDown, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { SearchSort } from "@/types/product";

export type PriceFilter = { min?: number; max?: number };

type SearchToolbarProps = {
  /** `null` pendant le chargement initial : on n'affiche pas un faux « 0 article ». */
  resultCount: number | null;
  isUpdating: boolean;
  hasTextQuery: boolean;
  sort: SearchSort;
  onSortChange: (sort: SearchSort) => void;
  price: PriceFilter;
  onPriceChange: (price: PriceFilter) => void;
  includeOutOfStock: boolean;
  onIncludeOutOfStockChange: (value: boolean) => void;
};

const SORT_LABELS: Record<SearchSort, string> = {
  relevance: "Pertinence",
  newest: "Nouveautés",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
};

function parsePrice(value: string): number | undefined {
  const parsed = Number(value.replace(/\s/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

/** Barre de tri et de filtres des listes de produits (tri et filtres appliques cote serveur). */
export function SearchToolbar({
  resultCount,
  isUpdating,
  hasTextQuery,
  sort,
  onSortChange,
  price,
  onPriceChange,
  includeOutOfStock,
  onIncludeOutOfStockChange,
}: SearchToolbarProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [minDraft, setMinDraft] = useState(price.min ? String(price.min) : "");
  const [maxDraft, setMaxDraft] = useState(price.max ? String(price.max) : "");
  const activeFilters = (price.min ? 1 : 0) + (price.max ? 1 : 0) + (includeOutOfStock ? 1 : 0);
  const sortOptions: SearchSort[] = hasTextQuery
    ? ["relevance", "newest", "price_asc", "price_desc"]
    : ["newest", "price_asc", "price_desc"];

  const applyPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let min = parsePrice(minDraft);
    let max = parsePrice(maxDraft);
    if (min && max && min > max) {
      [min, max] = [max, min];
    }
    onPriceChange({ min, max });
    setOpen(false);
  };

  const resetFilters = () => {
    setMinDraft("");
    setMaxDraft("");
    onPriceChange({});
    onIncludeOutOfStockChange(false);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600" aria-live="polite">
          {resultCount === null ? t("Chargement…") : t(resultCount > 1 ? "{n} articles" : "{n} article", { n: resultCount })}
          {resultCount !== null && isUpdating ? " · mise à jour…" : ""}
        </p>
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Trier par</span>
            <ArrowUpDown className="pointer-events-none absolute left-3 h-4 w-4 text-ink-500" aria-hidden="true" />
            <select
              value={sortOptions.includes(sort) ? sort : sortOptions[0]}
              onChange={(event) => onSortChange(event.target.value as SearchSort)}
              className="h-11 appearance-none rounded-field border border-border bg-card pl-9 pr-4 text-sm font-medium text-ink-800 hover:border-ink-400"
            >
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {t(SORT_LABELS[option])}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            aria-controls="search-filters"
            onClick={() => setOpen((value) => !value)}
            className="h-11"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtres
            {activeFilters ? (
              <span className="ml-1 rounded-pill bg-ink-900 px-2 text-xs text-white">{activeFilters}</span>
            ) : null}
          </Button>
        </div>
      </div>

      {open ? (
        <form
          id="search-filters"
          onSubmit={applyPrice}
          className="mt-3 grid gap-4 rounded-card border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <label htmlFor="price-min" className="text-sm font-medium text-ink-800">
              Prix minimum (XOF)
            </label>
            <input
              id="price-min"
              inputMode="numeric"
              value={minDraft}
              onChange={(event) => setMinDraft(event.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="0"
              className="mt-1 h-11 w-full rounded-field border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="price-max" className="text-sm font-medium text-ink-800">
              Prix maximum (XOF)
            </label>
            <input
              id="price-max"
              inputMode="numeric"
              value={maxDraft}
              onChange={(event) => setMaxDraft(event.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="Sans limite"
              className="mt-1 h-11 w-full rounded-field border border-input bg-background px-3 text-sm"
            />
          </div>
          <Button type="submit" className="h-11">
            Appliquer
          </Button>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-700 sm:col-span-3">
            <input
              type="checkbox"
              checked={includeOutOfStock}
              onChange={(event) => onIncludeOutOfStockChange(event.target.checked)}
              className="h-4 w-4"
            />
            Afficher aussi les produits en rupture de stock
          </label>
        </form>
      ) : null}

      {activeFilters ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {price.min || price.max ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-surface-3 px-3 py-1 text-ink-800">
              Prix : {price.min ? `${price.min.toLocaleString("fr-FR")} XOF` : "0"} –{" "}
              {price.max ? `${price.max.toLocaleString("fr-FR")} XOF` : "sans limite"}
            </span>
          ) : null}
          {includeOutOfStock ? (
            <span className="rounded-pill bg-surface-3 px-3 py-1 text-ink-800">Ruptures incluses</span>
          ) : null}
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-9 items-center gap-1 font-medium text-brand-700 hover:underline"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Effacer les filtres
          </button>
        </div>
      ) : null}
    </div>
  );
}
