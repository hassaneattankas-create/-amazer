"use client";

import Link from "next/link";
import { Store } from "lucide-react";

import { AnimatedPrice } from "@/components/AnimatedPrice";
import { Button } from "@/components/ui/button";
import { Offer } from "@/types/product";

type VendorOfferProps = {
  offer: Offer;
};

export function VendorOffer({ offer }: VendorOfferProps) {
  return (
    <article className="premium-card border border-slate-200 bg-white p-4 transition hover:border-[#FF4D00]/40">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm text-slate-700">
            <Store className="h-4 w-4 text-[#FF4D00]" />
            {offer.vendor.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Stock: {offer.stock_quantity > 0 ? offer.stock_quantity : "Rupture"}
          </p>
        </div>

        <div className="text-right">
          <AnimatedPrice value={offer.amount} className="text-lg font-semibold text-[#FF4D00]" />
          <Button
            asChild
            size="sm"
            className="mt-2 border border-[#FF4D00]/25 bg-[#FF4D00]/10 text-[#FF4D00] hover:bg-[#FF4D00]/15"
          >
            <Link href={`/shop/${offer.vendor.id}`}>Voir l&apos;offre</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
