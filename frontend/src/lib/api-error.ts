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

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybe = error as ApiErrorShape;
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
