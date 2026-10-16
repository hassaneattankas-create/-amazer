"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { SingleMediaField } from "@/components/seller/MediaFields";
import { Button } from "@/components/ui/button";
import { normalizeImageInputForApi } from "@/lib/image";
import type { RestaurantMenuItem } from "@/types/restaurant";

export const MENU_CATEGORIES = ["Entrées", "Plats", "Grillades", "Accompagnements", "Desserts", "Boissons"];
const PLAT_DU_JOUR = "Plat du jour";
const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

export type DishPayload = {
  name: string;
  description?: string;
  image_url?: string;
  base_price: number;
  category: string;
  tags: string[];
  options: Array<{ name: string; price: number }>;
  estimated_prep_minutes: number;
};

type OptionRow = { name: string; price: string };

/** Formulaire d'un plat (creation ou modification) : rubrique, prix, photo, options avec supplement. */
export function DishForm({
  dish,
  busy,
  categories,
  onSubmit,
  onCancel,
}: {
  dish?: RestaurantMenuItem;
  busy: boolean;
  categories: string[];
  onSubmit: (payload: DishPayload) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(dish?.name ?? "");
  const [price, setPrice] = useState(dish ? String(dish.base_price) : "");
  const [category, setCategory] = useState(dish?.category ?? "Plats");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [image, setImage] = useState(dish?.image_url ?? "");
  const [prep, setPrep] = useState(String(dish?.estimated_prep_minutes ?? 20));
  const [platDuJour, setPlatDuJour] = useState(Boolean(dish?.tags?.some((tag) => tag.toLowerCase() === "plat du jour")));
  const [options, setOptions] = useState<OptionRow[]>(
    (dish?.options ?? []).map((option) => ({ name: option.name, price: String(option.price) }))
  );
  const [error, setError] = useState("");
  const allCategories = Array.from(new Set([...MENU_CATEGORIES, ...categories]));
  const listId = `categories-${dish?.id ?? "new"}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(price);
    if (name.trim().length < 2) return setError("Indiquez le nom du plat.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Indiquez un prix supérieur à 0.");
    const cleanOptions = options
      .filter((option) => option.name.trim())
      .map((option) => ({ name: option.name.trim(), price: Math.max(0, Number(option.price) || 0) }));
    const otherTags = (dish?.tags ?? []).filter((tag) => tag.toLowerCase() !== "plat du jour");
    setError("");
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      image_url: normalizeImageInputForApi(image) ?? undefined,
      base_price: amount,
      category: category.trim() || "Plats",
      tags: platDuJour ? [PLAT_DU_JOUR, ...otherTags].slice(0, 5) : otherTags,
      options: cleanOptions,
      estimated_prep_minutes: Math.min(120, Math.max(5, Number(prep) || 20)),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-border bg-surface-1 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-800">
          Nom du plat
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Riz sauce arachide" required />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Prix (XOF)
          <input className={fieldClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} required />
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Rubrique du menu
          <input className={fieldClass} list={listId} value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id={listId}>
            {allCategories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-ink-800">
          Préparation (minutes)
          <input className={fieldClass} inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <label className="block text-sm font-medium text-ink-800">
        Description
        <textarea
          className={`${fieldClass} h-auto min-h-20 py-2`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ingrédients, portion, accompagnement…"
        />
      </label>
      <SingleMediaField label="Photo du plat" value={image} onChange={setImage} emptyMessage="Une belle photo fait vendre." />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-800">
        <input type="checkbox" className="h-5 w-5" checked={platDuJour} onChange={(e) => setPlatDuJour(e.target.checked)} />
        Plat du jour (mis en avant)
      </label>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-semibold text-ink-900">Options et suppléments</legend>
        <p className="text-xs text-ink-600">Ex. « Supplément viande » 500 F, « Sans piment » 0 F. Le client les choisit en commandant.</p>
        {options.map((option, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label="Nom de l'option"
              className="h-11 min-w-0 flex-1 rounded-field border border-border bg-card px-3 text-sm text-ink-900"
              value={option.name}
              onChange={(e) => setOptions((rows) => rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))}
              placeholder="Nom de l'option"
            />
            <input
              aria-label="Prix de l'option"
              className="h-11 w-24 shrink-0 rounded-field border border-border bg-card px-3 text-sm text-ink-900"
              inputMode="numeric"
              value={option.price}
              onChange={(e) =>
                setOptions((rows) => rows.map((row, i) => (i === index ? { ...row, price: e.target.value.replace(/\D/g, "") } : row)))
              }
              placeholder="0"
            />
            <button
              type="button"
              aria-label="Retirer l'option"
              onClick={() => setOptions((rows) => rows.filter((_, i) => i !== index))}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field border border-border text-ink-700 hover:bg-card"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {options.length < 12 ? (
          <Button type="button" variant="outline" onClick={() => setOptions((rows) => [...rows, { name: "", price: "" }])}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter une option
          </Button>
        ) : null}
      </fieldset>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : dish ? "Enregistrer" : "Publier au menu"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}
