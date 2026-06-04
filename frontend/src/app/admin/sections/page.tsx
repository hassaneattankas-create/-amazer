"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import {
  createAdminSection,
  listAdminSections,
  replaceAdminSectionItems,
  updateAdminSection,
} from "@/services/content-service";

export default function AdminSectionsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [sectionType, setSectionType] = useState<"products" | "restaurants" | "mixed">("products");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [itemsText, setItemsText] = useState("");

  const { data: sections, isPending } = useQuery({
    queryKey: ["admin-sections"],
    queryFn: listAdminSections,
  });

  const createMutation = useMutation({
    mutationFn: createAdminSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
      setStatus("Section creee.");
      setTitle("");
      setSlug("");
    },
    onError: () => setStatus("Erreur creation section."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ sectionId, isActive }: { sectionId: string; isActive: boolean }) =>
      updateAdminSection(sectionId, {
        title: sections?.find((entry) => entry.id === sectionId)?.title ?? "Section",
        section_type: sections?.find((entry) => entry.id === sectionId)?.section_type ?? "products",
        sort_order: sections?.find((entry) => entry.id === sectionId)?.sort_order ?? 0,
        is_active: isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
      setStatus("Section mise a jour.");
    },
    onError: () => setStatus("Erreur mise a jour section."),
  });

  const replaceItemsMutation = useMutation({
    mutationFn: ({ sectionId, raw }: { sectionId: string; raw: string }) => {
      const items = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [targetType, identifier] = line.split(":");
          if (targetType === "restaurant") {
            return {
              target_type: "restaurant" as const,
              vendor_id: identifier,
              sort_order: index,
            };
          }
          return {
            target_type: "product" as const,
            product_id: identifier,
            sort_order: index,
          };
        });
      return replaceAdminSectionItems(sectionId, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
      setStatus("Contenu de section mis a jour.");
    },
    onError: () => setStatus("Erreur maj contenu section."),
  });

  const selectedSection = useMemo(
    () => sections?.find((entry) => entry.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-5xl space-y-4 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Sections Dynamiques</h1>
        <p className="mt-2 text-sm text-slate-600">
          Creez des rubriques comme Meilleures Ventes, Nouveautes, Tendances.
        </p>
      </header>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Nouvelle section</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titre (ex: Meilleures ventes)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="Slug (ex: meilleures-ventes)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sectionType}
            onChange={(event) => setSectionType(event.target.value as "products" | "restaurants" | "mixed")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="products">Produits</option>
            <option value="restaurants">Restaurants</option>
            <option value="mixed">Mixte</option>
          </select>
        </div>
        <Button
          type="button"
          onClick={() =>
            createMutation.mutate({
              title,
              slug,
              section_type: sectionType,
              is_active: true,
              sort_order: 0,
            })
          }
          disabled={!title || !slug || createMutation.isPending}
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
        >
          Creer
        </Button>
      </article>

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Sections existantes</h2>
        <div className="mt-4 space-y-3">
          {(sections ?? []).map((section) => (
            <div key={section.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{section.title}</p>
                  <p className="text-xs text-slate-500">
                    slug={section.slug} | type={section.section_type} | items={section.items.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    Editer contenu
                  </Button>
                  <Button
                    type="button"
                    onClick={() => updateMutation.mutate({ sectionId: section.id, isActive: !section.is_active })}
                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {section.is_active ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>

      {selectedSection ? (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Edition: {selectedSection.title}</h2>
          <p className="mt-2 text-xs text-slate-500">
            Une ligne = `product:PRODUCT_ID` ou `restaurant:VENDOR_ID`
          </p>
          <textarea
            value={itemsText}
            onChange={(event) => setItemsText(event.target.value)}
            rows={10}
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="product:uuid-produit-1&#10;product:uuid-produit-2&#10;restaurant:uuid-vendor-1"
          />
          <Button
            type="button"
            onClick={() => replaceItemsMutation.mutate({ sectionId: selectedSection.id, raw: itemsText })}
            className="primary-glow-btn mt-3 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          >
            Enregistrer les items
          </Button>
        </article>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
