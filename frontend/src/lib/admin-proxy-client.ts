import axios, { AxiosRequestConfig } from "axios";

import { getBackendOriginFromEnv, getMobileSiteOriginFromEnv } from "@/lib/backend-origin";
import { getClientAccessToken, getClientCookieValue } from "@/lib/api";
import { isMobileAppBuild } from "@/lib/mobile-app";

function resolveMobileAdminProxyBase(): string {
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/api/admin-proxy`;
  }
  return `${getBackendOriginFromEnv()}/api/v1`;
}

const ADMIN_PROXY_BASE_URL = isMobileAppBuild() ? resolveMobileAdminProxyBase() : "/api/admin-proxy";

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

export async function adminProxyRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await adminProxyApi.request<T>(config);
  return response.data;
}
