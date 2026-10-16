"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import {
  createRestaurantMenuItem,
  deleteSellerRestaurantMenuItem,
  listSellerRestaurantMenu,
  updateSellerRestaurantMenuItem,
  type RestaurantMenuUpdate,
} from "@/services/restaurant-service";
import type { RestaurantMenuItem } from "@/types/restaurant";

import { DishForm, type DishPayload } from "./DishForm";

export const SELLER_MENU_KEY = ["seller-restaurant-menu-dashboard"];

/** Menu du restaurant : rubriques, epuise en un clic, modifier, retirer, supprimer, ajouter. */
export function RestaurantMenuManager({ startWithForm = false }: { startWithForm?: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(startWithForm ? "new" : null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: menu = [], isPending } = useQuery({ queryKey: SELLER_MENU_KEY, queryFn: listSellerRestaurantMenu });

  const done = (text: string) => {
    setMessage({ ok: true, text });
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: SELLER_MENU_KEY });
  };
  const fail = (error: unknown) => setMessage({ ok: false, text: getApiErrorMessage(error, "Action impossible. Réessayez.") });

  const create = useMutation({ mutationFn: (payload: DishPayload) => createRestaurantMenuItem(payload), onSuccess: () => done("Plat publié au menu."), onError: fail });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RestaurantMenuUpdate }) => updateSellerRestaurantMenuItem(id, payload),
    onSuccess: () => done("Menu mis à jour."),
    onError: fail,
  });
  const remove = useMutation({ mutationFn: deleteSellerRestaurantMenuItem, onSuccess: () => done("Plat supprimé du menu."), onError: fail });

  const groups = useMemo(() => {
    const map = new Map<string, RestaurantMenuItem[]>();
    for (const dish of menu) {
      const key = dish.category || "Plats";
      map.set(key, [...(map.get(key) ?? []), dish]);
    }
    return Array.from(map.entries());
  }, [menu]);
  const categories = groups.map(([name]) => name);
  const soldOut = menu.filter((dish) => dish.sold_out && dish.is_available).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <UtensilsCrossed className="h-5 w-5 text-brand-600" aria-hidden="true" />
            Mon menu
          </h2>
          <p className="text-sm text-ink-600">
            {menu.length} plat{menu.length > 1 ? "s" : ""}
            {soldOut ? ` · ${soldOut} épuisé${soldOut > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {editing !== "new" ? (
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter un plat
          </Button>
        ) : null}
      </div>

      {message ? (
        <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`} role="status">
          {message.text}
        </p>
      ) : null}

      {editing === "new" ? (
        <DishForm busy={create.isPending} categories={categories} onSubmit={(payload) => create.mutate(payload)} onCancel={() => setEditing(null)} />
      ) : null}

      {isPending ? (
        <div className="h-32 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : !menu.length && editing !== "new" ? (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
          Votre menu est vide. Ajoutez votre premier plat avec une photo : les clients commandent ce qu&apos;ils voient.
        </p>
      ) : (
        groups.map(([category, dishes]) => (
          <section key={category} aria-label={category} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-label text-ink-600">
              {category} · {dishes.length}
            </h3>
            <ul className="divide-y divide-border rounded-card border border-border bg-card">
              {dishes.map((dish) => (
                <li key={dish.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-field bg-surface-1">
                      {dish.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveImageUrl(dish.image_url) ?? ""} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UtensilsCrossed className="h-5 w-5 text-ink-400" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${dish.is_available ? "text-ink-900" : "text-ink-500"}`}>{dish.name}</p>
                      <p className="text-xs text-ink-600">
                        {formatXOF(dish.base_price)}
                        {dish.options.length ? ` · ${dish.options.length} option${dish.options.length > 1 ? "s" : ""}` : ""}
                        {!dish.is_available ? " · Retiré du menu" : dish.sold_out ? " · Épuisé" : ""}
                      </p>
                    </div>
                    {dish.is_available ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!dish.sold_out}
                        aria-label={`${dish.name} disponible`}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: dish.id, payload: { sold_out: !dish.sold_out } })}
                        className={`min-h-11 shrink-0 rounded-pill px-3 text-xs font-semibold ${
                          dish.sold_out ? "bg-danger/10 text-danger" : "bg-success/15 text-ink-900"
                        }`}
                      >
                        {dish.sold_out ? "Épuisé" : "Disponible"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Modifier ${dish.name}`}
                      aria-expanded={editing === dish.id}
                      onClick={() => setEditing(editing === dish.id ? null : dish.id)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field border border-border text-ink-800 hover:bg-surface-1"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  {editing === dish.id ? (
                    <div className="mt-3 space-y-2">
                      <DishForm
                        dish={dish}
                        busy={update.isPending}
                        categories={categories}
                        onSubmit={(payload) => update.mutate({ id: dish.id, payload })}
                        onCancel={() => setEditing(null)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: dish.id, payload: { is_available: !dish.is_available } })}
                        >
                          {dish.is_available ? "Retirer du menu (temporaire)" : "Remettre au menu"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-danger text-danger"
                          disabled={remove.isPending}
                          onClick={() => window.confirm(`Supprimer « ${dish.name} » du menu ?`) && remove.mutate(dish.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
