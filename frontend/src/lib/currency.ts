export type SupportedCurrency = "XOF";

export function formatMoney(valueInXof: number, currency: SupportedCurrency = "XOF"): string {
  const amount = Number.isFinite(valueInXof) ? valueInXof : 0;
  const formattedAmount = new Intl.NumberFormat("fr-NE", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formattedAmount} ${currency}`;
}

export function formatXOF(value: number): string {
  return formatMoney(value);
}
