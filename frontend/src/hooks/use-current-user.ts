"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser, UserResponse } from "@/services/auth-service";
import { AUTH_CHANGE_EVENT } from "@/lib/api";

const ACCESS_TOKEN_KEY = "amazer_access_token";

function hasSessionToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY) || window.sessionStorage.getItem(ACCESS_TOKEN_KEY));
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
