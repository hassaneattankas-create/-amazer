"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, PlusCircle } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSellerProduct,
  getSellerProfile,
  upsertSellerProfile,
} from "@/services/seller-service";

export default function SellerPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [profileForm, setProfileForm] = useState({
    business_name: "",
    city: "Niamey",
    phone: "",
    address: "",
  });
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    amount: "",
    stock_quantity: "1",
    description: "",
    main_image_url: "",
  });

  const { data: profile, isPending } = useQuery({
    queryKey: ["seller-profile"],
    queryFn: getSellerProfile,
  });

  const profileMutation = useMutation({
    mutationFn: upsertSellerProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setStatus("Profil vendeur enregistre.");
    },
    onError: () => setStatus("Erreur lors de l'enregistrement du profil."),
  });

  const productMutation = useMutation({
    mutationFn: createSellerProduct,
    onSuccess: () => setStatus("Produit liste avec succes."),
    onError: () => setStatus("Erreur lors de la creation du produit."),
  });

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <header className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold">Seller Central Niamey</h1>
        <p className="mt-2 text-sm text-slate-600">
          Interface commerçants pour publier des offres locales.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/seller/dashboard">Aller au dashboard de stock</Link>
        </Button>
      </header>

      {isPending ? (
        <ProductCardSkeleton />
      ) : (
        <article className="premium-card border border-slate-200 bg-white p-6">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-[#FF4D00]" />
            Profil vendeur
          </h2>
          {profile ? (
            <p className="mt-2 text-sm text-emerald-700">
              Profil actif: {profile.business_name} ({profile.city})
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Aucun profil active pour ce compte.</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nom du commerce"
              value={profileForm.business_name}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, business_name: event.target.value }))
              }
            />
            <Input
              placeholder="Ville"
              value={profileForm.city}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
            />
            <Input
              placeholder="Telephone"
              value={profileForm.phone}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Input
              placeholder="Adresse"
              value={profileForm.address}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </div>
          <Button
            className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
            onClick={() => profileMutation.mutate(profileForm)}
          >
            Enregistrer le profil
          </Button>
        </article>
      )}

      <article className="premium-card border border-slate-200 bg-white p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
          <PlusCircle className="h-5 w-5 text-[#FF4D00]" />
          Lister un produit
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nom produit"
            value={productForm.name}
            onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="Marque"
            value={productForm.brand}
            onChange={(event) => setProductForm((prev) => ({ ...prev, brand: event.target.value }))}
          />
          <Input
            placeholder="Prix XOF"
            type="number"
            value={productForm.amount}
            onChange={(event) => setProductForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <Input
            placeholder="Stock"
            type="number"
            value={productForm.stock_quantity}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, stock_quantity: event.target.value }))
            }
          />
          <Input
            placeholder="Image URL"
            value={productForm.main_image_url}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, main_image_url: event.target.value }))
            }
          />
          <Input
            placeholder="Description"
            value={productForm.description}
            onChange={(event) =>
              setProductForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
        <Button
          className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
          onClick={() =>
            productMutation.mutate({
              name: productForm.name,
              brand: productForm.brand,
              amount: Number(productForm.amount || 0),
              stock_quantity: Number(productForm.stock_quantity || 0),
              description: productForm.description || undefined,
              main_image_url: productForm.main_image_url || undefined,
              currency: "XOF",
            })
          }
        >
          Publier mon produit
        </Button>
      </article>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
