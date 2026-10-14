import { api } from "@/lib/api";

export type ExchangeRates = {
  base: "XOF";
  rates: Record<string, number>;
  updated_at: string | null;
  source: string;
};

export async function getExchangeRates(): Promise<ExchangeRates> {
  return (await api.get<ExchangeRates>("/api/v1/locale/exchange-rates")).data;
}
