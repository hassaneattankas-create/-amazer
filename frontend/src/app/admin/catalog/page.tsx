"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import {
  createAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from "@/services/content-service";

export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    parent_id: "",
    is_active: true,
  });
  const [selectedId, setSelectedId] = useState("");

  const { data: categories = [], isPending } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: listAdminCategories,
  });

  const selected = useMemo(
    () => categories.find((item) => item.id === selectedId) ?? null,
    [categories, selectedId]
  );

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setStatus("Categorie creee.");
      setForm({ name: "", slug: "", parent_id: "", is_active: true });
    },
    onError: () => setStatus("Creation categorie impossible."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => {
      const entry = categories.find((item) => item.id === id);
      if (!entry) {
        throw new Error("Categorie introuvable");
      }
      return updateAdminCategory(id, {
        name: entry.name,
        slug: entry.slug,
        parent_id: entry.parent_id,
        is_active: active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setStatus("Categorie mise a jour.");
    },
    onError: () => setStatus("Mise a jour categorie impossible."),
  });

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Admin Rubriques & Categories</h1>
        <p className="mt-2 text-sm text-slate-600">
          Creez vos categories ici, et gerez les rubriques dynamiques depuis les sections.
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/admin/sections">Ouvrir les Rubriques Dynamiques</Link>
        </Button>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Nouvelle categorie</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nom"
          />
          <input
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="slug (technologie, restaurant...)"
          />
          <select
            value={form.parent_id}
            onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Aucune categorie parent</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Active
          </label>
        </div>
        <Button
          className="mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          onClick={() =>
            createMutation.mutate({
              name: form.name,
              slug: form.slug,
              parent_id: form.parent_id || undefined,
              is_active: form.is_active,
            })
          }
          disabled={!form.name || !form.slug || createMutation.isPending}
        >
          Creer
        </Button>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Categories existantes</h2>
        <div className="mt-3 space-y-2">
          {categories.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <button
                type="button"
                className="text-left"
                onClick={() => setSelectedId(item.id)}
              >
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.slug} {item.parent_id ? `| parent: ${item.parent_id}` : ""}
                </p>
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMutation.mutate({ id: item.id, active: !item.is_active })}
              >
                {item.is_active ? "Désactiver" : "Activer"}
              </Button>
            </div>
          ))}
        </div>
        {selected ? (
          <p className="mt-2 text-xs text-slate-500">
            Selection en cours: {selected.name}
          </p>
        ) : null}
      </article>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
