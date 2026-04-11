import axios, { AxiosRequestConfig } from "axios";

import { getBackendOriginFromEnv, getMobileSiteOriginFromEnv } from "@/lib/backend-origin";
import { clearAuthTokens, getClientAccessToken, getClientCookieValue, getClientRefreshToken, persistAuthTokens } from "@/lib/api";
import { isMobileAppBuild } from "@/lib/mobile-app";

function resolveMobileAdminProxyBase(): string {
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/api/admin-proxy`;
  }
  return `${getBackendOriginFromEnv()}/api/v1`;
}

const ADMIN_PROXY_BASE_URL = isMobileAppBuild() ? resolveMobileAdminProxyBase() : "/api/admin-proxy";

function resolveAuthRefreshUrl(): string {
  if (!isMobileAppBuild()) {
    return "/backend-api/api/v1/auth/refresh";
  }
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/backend-api/api/v1/auth/refresh`;
  }
  return `${getBackendOriginFromEnv()}/api/v1/auth/refresh`;
}

const ADMIN_REFRESH_URL = resolveAuthRefreshUrl();

const adminProxyApi = axios.create({
  baseURL: ADMIN_PROXY_BASE_URL,
  timeout: 60000,
  withCredentials: true,
});

adminProxyApi.interceptors.request.use((config) => {
  const accessToken = getClientAccessToken();
  const csrfToken = getClientCookieValue("csrf_token");
  config.headers = config.headers || {};
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const method = (config.method || "get").toLowerCase();
  if (csrfToken && ["post", "put", "patch", "delete"].includes(method)) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

adminProxyApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error?.response?.status as number | undefined;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = getClientRefreshToken();
        const refreshResponse = await axios.post<{ access_token: string; refresh_token: string }>(
          ADMIN_REFRESH_URL,
          refreshToken ? { refresh_token: refreshToken } : {},
          { timeout: 65000, withCredentials: true }
        );
        persistAuthTokens(refreshResponse.data);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
        return adminProxyApi(originalRequest);
      } catch {
        clearAuthTokens();
      }
    }

    return Promise.reject(error);
  }
);

export async function adminProxyRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await adminProxyApi.request<T>(config);
  return response.data;
}
