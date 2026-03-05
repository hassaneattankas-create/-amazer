import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "amazer_access_token";
const REFRESH_TOKEN_KEY = "amazer_refresh_token";
const ACCESS_TOKEN_COOKIE_KEY = "amazer_access_token";
export const AUTH_CHANGE_EVENT = "amazer-auth-changed";
const AUTH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type TokenPair = {
  access_token: string;
  refresh_token: string;
};

function readStoredToken(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromLocalStorage = window.localStorage.getItem(key);
  if (fromLocalStorage) {
    return fromLocalStorage;
  }
  const fromSessionStorage = window.sessionStorage.getItem(key);
  if (fromSessionStorage) {
    window.localStorage.setItem(key, fromSessionStorage);
    return fromSessionStorage;
  }
  return null;
}

function writeStoredToken(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
}

function removeStoredToken(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

export function persistAuthTokens(tokens: TokenPair): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStoredToken(ACCESS_TOKEN_KEY, tokens.access_token);
  writeStoredToken(REFRESH_TOKEN_KEY, tokens.refresh_token);
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=${encodeURIComponent(tokens.access_token)}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}${secureFlag}`;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearAuthTokens(): void {
  if (typeof window === "undefined") {
    return;
  }
  removeStoredToken(ACCESS_TOKEN_KEY);
  removeStoredToken(REFRESH_TOKEN_KEY);
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function getAccessToken(): string | null {
  return readStoredToken(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return readStoredToken(REFRESH_TOKEN_KEY);
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
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
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const csrfToken = getCookieValue("csrf_token");
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["X-CSRF-Token"] = csrfToken;
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
