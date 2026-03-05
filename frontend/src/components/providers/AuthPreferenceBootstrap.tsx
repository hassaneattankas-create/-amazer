"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { getUserPreferences } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export function AuthPreferenceBootstrap() {
  const { data: currentUser } = useCurrentUser();
  const preferredCurrency = useAuthStore((state) => state.preferredCurrency);
  const setPreferredCurrency = useAuthStore((state) => state.setPreferredCurrency);

  const { data: preferences } = useQuery({
    queryKey: ["auth-preferences", currentUser?.id],
    queryFn: getUserPreferences,
    enabled: Boolean(currentUser?.id),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!preferences?.preferred_currency) {
      return;
    }
    if (preferences.preferred_currency !== preferredCurrency) {
      setPreferredCurrency(preferences.preferred_currency);
    }
  }, [preferences?.preferred_currency, preferredCurrency, setPreferredCurrency]);

  return null;
}

