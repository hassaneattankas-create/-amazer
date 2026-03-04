export type SupportedCurrency = "XOF" | "EUR" | "USD";

const DISPLAY_LOCALE_BY_CURRENCY: Record<SupportedCurrency, string> = {
  XOF: "fr-NE",
  EUR: "fr-FR",
  USD: "en-US",
};

// Baseline conversion rates from XOF for UI display.
// These can be replaced later by a live FX provider on backend.
const XOF_TO_CURRENCY_RATE: Record<SupportedCurrency, number> = {
  XOF: 1,
  EUR: 1 / 655.957,
  USD: 1 / 610,
};

export function convertFromXOF(valueInXof: number, currency: SupportedCurrency): number {
  return valueInXof * XOF_TO_CURRENCY_RATE[currency];
}

export function formatMoney(valueInXof: number, currency: SupportedCurrency = "XOF"): string {
  const convertedValue = convertFromXOF(valueInXof, currency);
  return new Intl.NumberFormat(DISPLAY_LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XOF" ? 0 : 2,
  }).format(convertedValue);
}

export function formatXOF(value: number): string {
  return formatMoney(value, "XOF");
}
