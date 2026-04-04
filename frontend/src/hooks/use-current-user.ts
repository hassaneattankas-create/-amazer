"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser, UserResponse } from "@/services/auth-service";
import { AUTH_CHANGE_EVENT, getClientRefreshToken } from "@/lib/api";

const ACCESS_TOKEN_KEY = "amazer_access_token";

function hasSessionToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) || window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const cookie = typeof document !== "undefined" ? document.cookie : "";
  const hasCookieSession =
    cookie.includes("amazer_access_token=") ||
    cookie.includes("access_token=") ||
    cookie.includes("csrf_token=");
  return Boolean(storedToken || hasCookieSession || getClientRefreshToken());
}

export function useCurrentUser() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const syncTokenState = () => setEnabled(hasSessionToken());
    syncTokenState();
    window.addEventListener("storage", syncTokenState);
    window.addEventListener(AUTH_CHANGE_EVENT, syncTokenState);
    return () => {
      window.removeEventListener("storage", syncTokenState);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncTokenState);
    };
  }, []);

  return useQuery<UserResponse>({
    queryKey: ["auth-current-user"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
    enabled,
  });
}
