"use client";

import { useQuery } from "@tanstack/react-query";

import { getCurrentUser, UserResponse } from "@/services/auth-service";

const ACCESS_TOKEN_KEY = "amazer_access_token";

function hasSessionToken(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(window.sessionStorage.getItem(ACCESS_TOKEN_KEY));
}

export function useCurrentUser() {
  return useQuery<UserResponse>({
    queryKey: ["auth-current-user"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
    enabled: hasSessionToken(),
  });
}
