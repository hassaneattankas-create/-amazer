import { api, clearAuthTokens, persistAuthTokens } from "@/lib/api";

type LoginPayload = {
  email: string;
  password: string;
  mfa_code?: string;
};

type RegisterPayload = {
  email: string;
  full_name: string;
  password: string;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserResponse = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
};

export type UserPreferencesResponse = {
  preferred_currency: "XOF";
};

type MfaStatusResponse = {
  enabled: boolean;
  required_for_account: boolean;
};

type MfaSetupResponse = {
  secret_key: string;
  otpauth_url: string;
  issuer: string;
  account: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getResponseStatus(error: unknown): number | null {
  const maybe = error as { response?: { status?: unknown } };
  const status = maybe?.response?.status;
  return typeof status === "number" ? status : null;
}

export async function login(payload: LoginPayload) {
  const response = await api.post<TokenPair>("/api/v1/auth/login", {
    ...payload,
    email: normalizeEmail(payload.email),
  });
  persistAuthTokens(response.data);
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<UserResponse>("/api/v1/auth/register", {
    ...payload,
    email: normalizeEmail(payload.email),
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
    email: payload.email,
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

export async function getCurrentUser() {
  const response = await api.get<UserResponse>("/api/v1/auth/me");
  return response.data;
}

export async function getMfaStatus() {
  const response = await api.get<MfaStatusResponse>("/api/v1/auth/mfa/status");
  return response.data;
}

export async function setupMfa() {
  const response = await api.post<MfaSetupResponse>("/api/v1/auth/mfa/setup");
  return response.data;
}

export async function enableMfa(code: string) {
  await api.post("/api/v1/auth/mfa/enable", { code });
}

export async function getUserPreferences() {
  const response = await api.get<UserPreferencesResponse>("/api/v1/auth/preferences");
  return response.data;
}

export async function updateUserPreferences(payload: UserPreferencesResponse) {
  const response = await api.put<UserPreferencesResponse>("/api/v1/auth/preferences", payload);
  return response.data;
}
