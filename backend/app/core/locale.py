"""Pays, devises et langues pris en charge (preferences d'affichage ; le paiement reste en XOF)."""

SUPPORTED_CURRENCIES: tuple[str, ...] = ("XOF", "XAF", "EUR", "USD", "NGN", "GHS", "MAD", "GNF", "CAD", "GBP")
SUPPORTED_LANGUAGES: tuple[str, ...] = ("fr", "en")
DEFAULT_COUNTRY = "NE"
DEFAULT_CURRENCY = "XOF"
DEFAULT_LANGUAGE = "fr"

CURRENCY_PATTERN = "^(" + "|".join(SUPPORTED_CURRENCIES) + ")$"
LANGUAGE_PATTERN = "^(" + "|".join(SUPPORTED_LANGUAGES) + ")$"
COUNTRY_PATTERN = "^[A-Z]{2}$"
