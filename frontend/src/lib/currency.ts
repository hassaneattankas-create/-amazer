export type SupportedCurrency = "XOF";

export function formatMoney(valueInXof: number, currency: SupportedCurrency = "XOF"): string {
  return new Intl.NumberFormat("fr-NE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(valueInXof);
}

export function formatXOF(value: number): string {
  return formatMoney(value);
}
