"use client";

import { useQuery } from "@tanstack/react-query";

import { formatConverted } from "@/lib/locale";
import { getExchangeRates } from "@/services/locale-service";
import { useLocaleStore } from "@/store/locale-store";

/**
 * Prix indicatif dans la devise du visiteur (« ≈ 15,24 € »), ou null si la devise est le XOF
 * ou si le taux est indisponible. Le prix payé reste toujours celui affiché en XOF.
 */
export function useConvertedPrice() {
  const currency = useLocaleStore((state) => state.currency);
  const language = useLocaleStore((state) => state.language);
  const { data } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
    enabled: currency !== "XOF",
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
  return (amountXof: number): string | null => {
    if (currency === "XOF") return null;
    const formatted = formatConverted(amountXof, currency, data?.rates, language);
    return formatted ? `≈ ${formatted}` : null;
  };
}
