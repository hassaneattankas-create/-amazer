import { api } from "@/lib/api";

type LoginPayload = {
  email: string;
  password: string;
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

type UserResponse = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
};

export async function login(payload: LoginPayload) {
  const response = await api.post<TokenPair>("/api/v1/auth/login", payload);
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<UserResponse>("/api/v1/auth/register", payload);
  return response.data;
}

export async function refreshToken() {
  const response = await api.post<TokenPair>("/api/v1/auth/refresh", {});
  return response.data;
}

export async function logout() {
  await api.post("/api/v1/auth/logout");
}

export async function getCurrentUser() {
  const response = await api.get<UserResponse>("/api/v1/auth/me");
  return response.data;
}
