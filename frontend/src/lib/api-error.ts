type ApiErrorShape = {
  response?: {
    data?: {
      detail?: unknown;
      code?: string;
    };
  };
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybe = error as ApiErrorShape;
  const code = maybe?.response?.data?.code;
  const translatedByCode: Record<string, string> = {
    unauthorized: "Acces non autorise.",
    forbidden: "Action interdite.",
    conflict: "Cette information existe deja.",
    validation_error: "Certaines donnees sont invalides.",
  };
  if (code && translatedByCode[code]) {
    return translatedByCode[code];
  }
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) {
      return first.msg;
    }
  }
  return fallback;
}
