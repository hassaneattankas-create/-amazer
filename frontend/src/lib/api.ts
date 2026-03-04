import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "amazer_access_token";
const REFRESH_TOKEN_KEY = "amazer_refresh_token";

type TokenPair = {
  access_token: string;
  refresh_token: string;
};

function readStoredToken(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(key);
}

export function persistAuthTokens(tokens: TokenPair): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getAccessToken(): string | null {
  return readStoredToken(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return readStoredToken(REFRESH_TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error?.response?.status as number | undefined;
    const requestUrl = String(originalRequest?.url || "");
    const isAuthRoute = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/refresh");

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const refreshResponse = await axios.post<TokenPair>(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refresh_token: refreshToken },
            { timeout: 10000, withCredentials: true }
          );
          persistAuthTokens(refreshResponse.data);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
          return api(originalRequest);
        } catch {
          clearAuthTokens();
        }
      }
    }

    return Promise.reject(error);
  }
);
