"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser, UserResponse } from "@/services/auth-service";
import { AUTH_CHANGE_EVENT, getClientRefreshToken, syncPersistedAuthSession } from "@/lib/api";

const ACCESS_TOKEN_KEY = "amazer_access_token";

function hasSessionToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  syncPersistedAuthSession();
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
  // Vrai une fois la session cherchée sur l'appareil : avant, on ne sait pas encore si l'utilisateur est connecté.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const syncTokenState = () => {
      setEnabled(hasSessionToken());
      setChecked(true);
    };
    syncTokenState();
    window.addEventListener("storage", syncTokenState);
    window.addEventListener(AUTH_CHANGE_EVENT, syncTokenState);
    return () => {
      window.removeEventListener("storage", syncTokenState);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncTokenState);
    };
  }, []);

  const query = useQuery<UserResponse>({
    queryKey: ["auth-current-user"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
    enabled,
  });
  // isLoading reste vrai tant que la session n'a pas été cherchée : une page protégée ne redirige
  // jamais vers la connexion un utilisateur en réalité connecté.
  return { ...query, isLoading: !checked || query.isLoading };
}
