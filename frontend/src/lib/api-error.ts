type ApiErrorShape = {
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
      code?: string;
    };
  };
};

export function getHttpResponseStatus(error: unknown): number | null {
  const status = (error as ApiErrorShape)?.response?.status;
  return typeof status === "number" ? status : null;
}

/** Nom lisible des champs les plus courants (messages de validation du serveur). */
const FIELD_LABELS: Record<string, string> = {
  name: "le nom",
  product_name: "le nom du produit",
  full_name: "le nom",
  brand: "la marque",
  amount: "le prix",
  base_price: "le prix",
  promo_amount: "le prix promo",
  stock_quantity: "le stock",
  description: "la description",
  main_image_url: "la photo",
  image_url: "la photo",
  category_id: "la catégorie",
  phone: "le téléphone",
  whatsapp_phone: "le numéro WhatsApp",
  customer_phone: "le téléphone",
  guest_phone: "le téléphone",
  email: "l'e-mail",
  password: "le mot de passe",
  identifier: "l'identifiant",
  business_name: "le nom de la boutique",
  delivery_address: "l'adresse de livraison",
  check_in_date: "la date d'arrivée",
  check_out_date: "la date de départ",
  guest_count: "le nombre de personnes",
  rating: "la note",
  comment: "le commentaire",
};

type ValidationItem = { msg?: string; type?: string; loc?: Array<string | number>; ctx?: Record<string, unknown> };

/** Message de validation du serveur (en anglais) -> phrase francaise qui dit quoi corriger. */
function validationMessage(item: ValidationItem): string | null {
  const key = String([...(item.loc ?? [])].reverse().find((part) => typeof part === "string" && part !== "body") ?? "");
  const field = FIELD_LABELS[key] ?? (key ? `le champ « ${key} »` : "un champ");
  const ctx = item.ctx ?? {};
  switch (item.type) {
    case "missing":
      return `Indiquez ${field}.`;
    case "string_too_short":
      return ctx.min_length === 1 ? `Indiquez ${field}.` : `${capital(field)} est trop court (${ctx.min_length} caractères minimum).`;
    case "string_too_long":
      return `${capital(field)} est trop long (${ctx.max_length} caractères maximum).`;
    case "greater_than":
    case "greater_than_equal":
      return `${capital(field)} doit être supérieur à ${ctx.gt ?? ctx.ge ?? 0}.`;
    case "less_than":
    case "less_than_equal":
      return `${capital(field)} doit être inférieur à ${ctx.lt ?? ctx.le}.`;
    case "float_parsing":
    case "int_parsing":
    case "float_type":
    case "int_type":
      return `${capital(field)} doit être un nombre.`;
    case "string_pattern_mismatch":
      return `${capital(field)} n'a pas le bon format.`;
    default:
      return item.msg ? `Vérifiez ${field}.` : null;
  }
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybe = error as ApiErrorShape & { code?: string; message?: string; request?: unknown; isAxiosError?: boolean };
  // Erreur preparee par le site lui-meme (ex. photo illisible) : son message est deja en francais.
  if (error instanceof Error && !maybe.isAxiosError && !maybe.response && error.message) {
    return error.message;
  }
  if (!maybe?.response && (maybe?.code === "ERR_NETWORK" || maybe?.code === "ECONNABORTED" || maybe?.request)) {
    return "Connexion impossible. Vérifiez votre connexion internet puis réessayez.";
  }
  const status = maybe?.response?.status;
  if (status === 413) return "Fichier trop lourd. Choisissez une photo plus légère.";
  if (status === 401) return "Votre session a expiré. Reconnectez-vous puis réessayez.";
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const message = validationMessage(detail[0] as ValidationItem);
    if (message) {
      return message;
    }
  }
  const code = maybe?.response?.data?.code;
  const translatedByCode: Record<string, string> = {
    unauthorized: "Acces non autorise.",
    forbidden: "Action interdite.",
    conflict: "Cette information existe deja.",
    validation_error: "Certaines donnees sont invalides.",
    too_many_requests: "Trop de tentatives. Patientez un instant.",
  };
  if (code && translatedByCode[code]) {
    return translatedByCode[code];
  }
  return fallback;
}
