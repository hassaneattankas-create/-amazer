"use client";

import { useConvertedPrice } from "@/hooks/use-converted-price";

/** Ligne secondaire « ≈ 15,24 € » sous un prix XOF, seulement si une autre devise est choisie. */
export function ConvertedPrice({ amount, className = "text-xs text-ink-600" }: { amount: number; className?: string }) {
  const convert = useConvertedPrice();
  const value = convert(amount);
  return value ? <span className={className}>{value}</span> : null;
}
