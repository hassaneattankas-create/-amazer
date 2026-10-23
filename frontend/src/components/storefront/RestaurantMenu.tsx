"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Clock, Plus, UtensilsCrossed } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import type { RestaurantMenuItem, RestaurantMenuOption } from "@/types/restaurant";

type Selected = { menu_item_id: string; quantity: number; selected_options: RestaurantMenuOption[] };

/** Menu du restaurant cote client (modele Uber Eats / Glovo) : rubriques, plats en liste, epuise, ouvert/ferme. */
export function RestaurantMenu({
  menu,
  selectedItems,
  isOpen,
  openLabel,
  onAddDish,
  onToggleOption,
}: {
  menu: RestaurantMenuItem[];
  selectedItems: Selected[];
  isOpen: boolean;
  openLabel: string;
  onAddDish: (dish: RestaurantMenuItem) => void;
  onToggleOption: (menuItemId: string, option: RestaurantMenuOption) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, RestaurantMenuItem[]>();
    const featured = menu.filter((dish) => dish.tags?.some((tag) => tag.toLowerCase() === "plat du jour") && !dish.sold_out);
    if (featured.length) map.set("Plat du jour", featured);
    for (const dish of menu) {
      const key = dish.category || "Plats";
      map.set(key, [...(map.get(key) ?? []), dish]);
    }
    return Array.from(map.entries());
  }, [menu]);
  const anchor = (name: string) => `rubrique-${name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;

  if (!menu.length) {
    return (
      <p className="rounded-card border border-border bg-card p-6 text-sm text-ink-600">Ce restaurant n&apos;a pas encore publié son menu.</p>
    );
  }

  return (
    <section aria-labelledby="menu-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="menu-title" className="flex items-center gap-2 text-xl font-semibold text-ink-900">
          <UtensilsCrossed className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Menu
        </h2>
        <p
          className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-sm font-semibold ${
            isOpen ? "bg-success/20 text-ink-900" : "bg-danger/10 text-danger"
          }`}
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          {openLabel}
        </p>
      </div>
      {!isOpen ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
          Le restaurant ne prend pas de commande pour le moment. Vous pouvez consulter le menu et revenir plus tard.
        </p>
      ) : null}

      {groups.length > 1 ? (
        <nav aria-label="Rubriques du menu" className="sticky top-16 z-sticky -mx-gutter flex gap-2 overflow-x-auto bg-background/95 px-gutter py-2">
          {groups.map(([name, dishes]) => (
            <a
              key={name}
              href={`#${anchor(name)}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-pill border border-border bg-card px-4 text-sm font-semibold text-ink-800 hover:bg-surface-1"
            >
              {name} <span className="ml-1 text-ink-500">{dishes.length}</span>
            </a>
          ))}
        </nav>
      ) : null}

      {groups.map(([name, dishes]) => (
        <section key={name} id={anchor(name)} aria-label={name} className="scroll-mt-32 space-y-2">
          <h3 className="text-lg font-semibold text-ink-900">{name}</h3>
          <ul className="divide-y divide-border rounded-card border border-border bg-card">
            {dishes.map((dish) => {
              const selected = selectedItems.find((item) => item.menu_item_id === dish.id);
              const orderable = isOpen && !dish.sold_out;
              return (
                <li key={`${name}-${dish.id}`} className={`flex gap-3 p-3 ${dish.sold_out ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-ink-900">
                      {dish.name}
                      {selected ? <span className="ml-2 rounded-pill bg-brand-50 px-2 py-0.5 text-xs text-brand-700">× {selected.quantity}</span> : null}
                    </p>
                    {dish.description ? <p className="line-clamp-2 text-sm text-ink-600">{dish.description}</p> : null}
                    <p className="text-sm font-semibold text-ink-900">
                      {formatXOF(dish.base_price)}
                      {dish.sold_out ? <span className="ml-2 font-medium text-danger">Épuisé</span> : null}
                      {!dish.sold_out && dish.estimated_prep_minutes ? (
                        <span className="ml-2 font-normal text-ink-600">· {dish.estimated_prep_minutes} min</span>
                      ) : null}
                    </p>
                    {selected && dish.options.length ? (
                      <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label={`Options pour ${dish.name}`}>
                        {dish.options.map((option) => {
                          const on = selected.selected_options.some((entry) => entry.name === option.name);
                          return (
                            <button
                              key={option.name}
                              type="button"
                              aria-pressed={on}
                              onClick={() => onToggleOption(dish.id, option)}
                              className={`min-h-11 rounded-pill border px-3 text-xs font-medium ${
                                on ? "border-brand-600 bg-brand-50 text-ink-900" : "border-border bg-card text-ink-800"
                              }`}
                            >
                              {option.name}
                              {option.price ? ` +${formatXOF(option.price)}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    ) : dish.options.length ? (
                      <p className="text-xs text-ink-600">{dish.options.length} option(s) au choix après ajout</p>
                    ) : null}
                  </div>
                  <div className="relative h-24 w-24 shrink-0">
                    <div className="h-24 w-24 overflow-hidden rounded-field bg-surface-1">
                      {dish.image_url ? (
                        <Image
                          src={resolveImageUrl(dish.image_url, 200) ?? "/images/placeholders/default.svg"}
                          alt={dish.name}
                          width={192}
                          height={192}
                          sizes="96px"
                          unoptimized
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-ink-400">
                          <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!orderable}
                      onClick={() => onAddDish(dish)}
                      aria-label={`Ajouter ${dish.name}`}
                      className="absolute -bottom-2 -right-2 inline-flex h-11 w-11 items-center justify-center rounded-pill bg-ink-900 text-white shadow-raised hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-400"
                    >
                      <Plus className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
