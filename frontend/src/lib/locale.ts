/** Pays, devises et langues d'AMAZER. Le paiement reste en XOF ; les autres devises sont indicatives. */

export type CurrencyCode = "XOF" | "XAF" | "EUR" | "USD" | "NGN" | "GHS" | "MAD" | "GNF" | "CAD" | "GBP";
export type LanguageCode = "fr" | "en";

export type Country = { code: string; fr: string; en: string; dial: string; currency: CurrencyCode };

export const DEFAULT_COUNTRY = "NE";
export const DEFAULT_CURRENCY: CurrencyCode = "XOF";
export const DEFAULT_LANGUAGE: LanguageCode = "fr";

export const CURRENCIES: { code: CurrencyCode; label: string; decimals: number }[] = [
  { code: "XOF", label: "Franc CFA (BCEAO)", decimals: 0 },
  { code: "XAF", label: "Franc CFA (BEAC)", decimals: 0 },
  { code: "EUR", label: "Euro", decimals: 2 },
  { code: "USD", label: "Dollar américain", decimals: 2 },
  { code: "NGN", label: "Naira", decimals: 0 },
  { code: "GHS", label: "Cedi", decimals: 2 },
  { code: "MAD", label: "Dirham marocain", decimals: 2 },
  { code: "GNF", label: "Franc guinéen", decimals: 0 },
  { code: "CAD", label: "Dollar canadien", decimals: 2 },
  { code: "GBP", label: "Livre sterling", decimals: 2 },
];

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

// Afrique de l'Ouest d'abord (marche principal), puis le reste du continent et la diaspora.
export const COUNTRIES: Country[] = [
  { code: "NE", fr: "Niger", en: "Niger", dial: "+227", currency: "XOF" },
  { code: "BJ", fr: "Bénin", en: "Benin", dial: "+229", currency: "XOF" },
  { code: "BF", fr: "Burkina Faso", en: "Burkina Faso", dial: "+226", currency: "XOF" },
  { code: "CI", fr: "Côte d'Ivoire", en: "Côte d'Ivoire", dial: "+225", currency: "XOF" },
  { code: "GW", fr: "Guinée-Bissau", en: "Guinea-Bissau", dial: "+245", currency: "XOF" },
  { code: "ML", fr: "Mali", en: "Mali", dial: "+223", currency: "XOF" },
  { code: "SN", fr: "Sénégal", en: "Senegal", dial: "+221", currency: "XOF" },
  { code: "TG", fr: "Togo", en: "Togo", dial: "+228", currency: "XOF" },
  { code: "NG", fr: "Nigeria", en: "Nigeria", dial: "+234", currency: "NGN" },
  { code: "GH", fr: "Ghana", en: "Ghana", dial: "+233", currency: "GHS" },
  { code: "GN", fr: "Guinée", en: "Guinea", dial: "+224", currency: "GNF" },
  { code: "TD", fr: "Tchad", en: "Chad", dial: "+235", currency: "XAF" },
  { code: "CM", fr: "Cameroun", en: "Cameroon", dial: "+237", currency: "XAF" },
  { code: "CF", fr: "Centrafrique", en: "Central African Republic", dial: "+236", currency: "XAF" },
  { code: "CG", fr: "Congo", en: "Congo", dial: "+242", currency: "XAF" },
  { code: "GA", fr: "Gabon", en: "Gabon", dial: "+241", currency: "XAF" },
  { code: "GQ", fr: "Guinée équatoriale", en: "Equatorial Guinea", dial: "+240", currency: "XAF" },
  { code: "DZ", fr: "Algérie", en: "Algeria", dial: "+213", currency: "EUR" },
  { code: "LY", fr: "Libye", en: "Libya", dial: "+218", currency: "USD" },
  { code: "MA", fr: "Maroc", en: "Morocco", dial: "+212", currency: "MAD" },
  { code: "TN", fr: "Tunisie", en: "Tunisia", dial: "+216", currency: "EUR" },
  { code: "MR", fr: "Mauritanie", en: "Mauritania", dial: "+222", currency: "USD" },
  { code: "EG", fr: "Égypte", en: "Egypt", dial: "+20", currency: "USD" },
  { code: "CD", fr: "RD Congo", en: "DR Congo", dial: "+243", currency: "USD" },
  { code: "KE", fr: "Kenya", en: "Kenya", dial: "+254", currency: "USD" },
  { code: "RW", fr: "Rwanda", en: "Rwanda", dial: "+250", currency: "USD" },
  { code: "ZA", fr: "Afrique du Sud", en: "South Africa", dial: "+27", currency: "USD" },
  { code: "FR", fr: "France", en: "France", dial: "+33", currency: "EUR" },
  { code: "BE", fr: "Belgique", en: "Belgium", dial: "+32", currency: "EUR" },
  { code: "DE", fr: "Allemagne", en: "Germany", dial: "+49", currency: "EUR" },
  { code: "IT", fr: "Italie", en: "Italy", dial: "+39", currency: "EUR" },
  { code: "ES", fr: "Espagne", en: "Spain", dial: "+34", currency: "EUR" },
  { code: "CH", fr: "Suisse", en: "Switzerland", dial: "+41", currency: "EUR" },
  { code: "GB", fr: "Royaume-Uni", en: "United Kingdom", dial: "+44", currency: "GBP" },
  { code: "CA", fr: "Canada", en: "Canada", dial: "+1", currency: "CAD" },
  { code: "US", fr: "États-Unis", en: "United States", dial: "+1", currency: "USD" },
  { code: "AE", fr: "Émirats arabes unis", en: "United Arab Emirates", dial: "+971", currency: "USD" },
  { code: "SA", fr: "Arabie saoudite", en: "Saudi Arabia", dial: "+966", currency: "USD" },
  { code: "TR", fr: "Turquie", en: "Turkey", dial: "+90", currency: "USD" },
  { code: "CN", fr: "Chine", en: "China", dial: "+86", currency: "USD" },
];

export function findCountry(code: string | null | undefined): Country {
  return COUNTRIES.find((country) => country.code === code) ?? COUNTRIES[0];
}

export function countryName(code: string, language: LanguageCode): string {
  const country = findCountry(code);
  return language === "en" ? country.en : country.fr;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency.code === value);
}

/** Montant XOF converti et formate dans la devise choisie, ou null si le taux est inconnu. */
export function formatConverted(
  amountXof: number,
  currency: CurrencyCode,
  rates: Partial<Record<string, number>> | undefined,
  language: LanguageCode = "fr"
): string | null {
  const rate = currency === "XOF" ? 1 : rates?.[currency];
  if (!rate || !Number.isFinite(amountXof)) return null;
  const decimals = CURRENCIES.find((item) => item.code === currency)?.decimals ?? 2;
  return new Intl.NumberFormat(language === "en" ? "en-US" : "fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amountXof * rate);
}
