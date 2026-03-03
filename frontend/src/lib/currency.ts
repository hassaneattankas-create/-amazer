export const XOF_CURRENCY_FORMATTER = new Intl.NumberFormat("fr-NE", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function formatXOF(value: number): string {
  return XOF_CURRENCY_FORMATTER.format(value);
}
