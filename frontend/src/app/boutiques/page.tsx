"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Input } from "@/components/ui/input";
import { listStorefronts } from "@/services/catalog-service";

export default function BoutiquesPage() {
  const [query, setQuery] = useState("");
  const { data: stores = [], isPending } = useQuery({
    queryKey: ["catalog-storefronts", query],
    queryFn: () => listStorefronts(query),
  });

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Boutiques</h1>
        <p className="mt-2 text-sm text-slate-600">Consultez et recherchez vos boutiques preferees.</p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une boutique..."
          className="mt-4"
        />
      </header>

      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <article key={store.id} className="premium-card border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{store.business_name || store.name}</h2>
                  <p className="text-xs text-slate-500">
                    {(store.activity_type || "shop").toUpperCase()} • {store.city || "Niamey"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {store.storefront_tier === "premium" ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Premium
                    </span>
                  ) : null}
                  {store.is_verified ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Verifie
                    </span>
                  ) : null}
                </div>
              </div>
              {store.description ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{store.description}</p> : null}
              <p className="mt-2 text-sm text-slate-600">
                {store.product_count} produits | {store.promotion_count} promos | {store.service_count} services
              </p>
              {store.room_type_count ? (
                <p className="mt-1 text-xs text-slate-500">{store.room_type_count} type(s) de chambre</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {store.phone ? `Tel: ${store.phone}` : "Contact non renseigne"}
              </p>
              <div className="mt-3">
                <Link
                  href={`/shop/${store.id}`}
                  className="inline-flex rounded-md border border-[#FF4D00]/40 bg-[#FF4D00]/10 px-3 py-1.5 text-xs font-medium text-[#FF4D00]"
                >
                  Ouvrir la boutique
                </Link>
              </div>
            </article>
          ))}
          {!stores.length ? (
            <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Aucune boutique trouvee.
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
