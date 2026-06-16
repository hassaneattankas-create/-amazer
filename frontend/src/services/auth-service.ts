import { api, clearAuthTokens, persistAuthTokens } from "@/lib/api";
import type { SellerProfilePayload } from "@/types/seller";

type LoginPayload = {
  identifier: string;
  password: string;
};

type RegisterPayload = {
  identifier: string;
  full_name: string;
  password: string;
  seller_profile?: SellerProfilePayload;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type RegisterResponse = {
  success: boolean;
  user_id: string;
  email: string;
  verification_channel: string;
  verification_destination_masked: string;
  verification_code_preview: string | null;
};

export type UserResponse = {
  id: string;
  email: string;
  full_name: string;
  whatsapp_phone: string | null;
  is_active: boolean;
  created_at: string;
};

export type UserPreferencesResponse = {
  preferred_currency: "XOF";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    return normalizeEmail(trimmed);
  }
  const compact = trimmed.replace(/\s+/g, "");
  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length === 8) {
    return `+227${digitsOnly}`;
  }
  if (digitsOnly.startsWith("227") && digitsOnly.length >= 11) {
    return `+${digitsOnly}`;
  }
  return compact;
}

function getResponseStatus(error: unknown): number | null {
  const maybe = error as { response?: { status?: unknown } };
  const status = maybe?.response?.status;
  return typeof status === "number" ? status : null;
}

export async function login(payload: LoginPayload) {
  const response = await api.post<TokenPair>("/api/v1/auth/login", {
    identifier: normalizeIdentifier(payload.identifier),
    password: payload.password,
  });
  persistAuthTokens(response.data);
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<RegisterResponse>("/api/v1/auth/register", {
    identifier: normalizeIdentifier(payload.identifier),
    full_name: payload.full_name,
    password: payload.password,
    seller_profile: payload.seller_profile,
  });
  return response.data;
}

export async function verifyAccount(payload: { identifier: string; code: string }) {
  const response = await api.post<{ success: boolean; message: string }>("/api/v1/auth/verify-account", {
    identifier: normalizeIdentifier(payload.identifier),
    code: payload.code.trim(),
  });
  return response.data;
}

export async function registerAndLogin(payload: RegisterPayload): Promise<TokenPair> {
  try {
    await register(payload);
  } catch (error) {
    if (getResponseStatus(error) !== 409) {
      throw error;
    }
  }
  return login({
    identifier: payload.identifier,
    password: payload.password,
  });
}

export async function refreshToken() {
  const response = await api.post<TokenPair>("/api/v1/auth/refresh", {});
  persistAuthTokens(response.data);
  return response.data;
}

export async function logout() {
  try {
    await api.post("/api/v1/auth/logout");
  } finally {
    clearAuthTokens();
  }
}

export async function deleteMyAccount(payload: { password: string }) {
  try {
    await api.post("/api/v1/auth/delete-account", payload);
  } finally {
    clearAuthTokens();
  }
}

export async function getCurrentUser() {
  const response = await api.get<UserResponse>("/api/v1/auth/me");
  return response.data;
}

export async function getUserPreferences() {
  const response = await api.get<UserPreferencesResponse>("/api/v1/auth/preferences");
  return response.data;
}

export async function updateUserPreferences(payload: UserPreferencesResponse) {
  const response = await api.put<UserPreferencesResponse>("/api/v1/auth/preferences", payload);
  return response.data;
}

export type SellerPreRegisterPayload = {
  full_name: string;
  identifier: string;
  password: string;
  business_name?: string;
  activity_type: string;
  storefront_tier: string;
  payment_mode: string;
  months: number;
  transaction_reference?: string;
};

export type SellerPreRegisterResponse = {
  id: string;
  status: string;
  message: string;
};

export async function preRegisterSeller(payload: SellerPreRegisterPayload): Promise<SellerPreRegisterResponse> {
  const response = await api.post<SellerPreRegisterResponse>("/api/v1/auth/pre-register-seller", payload);
  return response.data;
}

export type SellerPreRegisterStatusResponse = {
  id: string;
  status: "pending" | "approved" | "rejected";
  business_name?: string | null;
  identifier?: string | null;
  message: string;
};

export async function getPreRegisterSellerStatus(
  regId: string,
): Promise<SellerPreRegisterStatusResponse> {
  const response = await api.get<SellerPreRegisterStatusResponse>(
    `/api/v1/auth/pre-register-seller/${regId}`,
  );
  return response.data;
}
