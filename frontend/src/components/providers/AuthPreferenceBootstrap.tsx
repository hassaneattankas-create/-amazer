"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { isCurrencyCode } from "@/lib/locale";
import { getUserPreferences } from "@/services/auth-service";
import { useLocaleStore } from "@/store/locale-store";

/** Applique les preferences du compte (pays, region, devise, langue) et la langue du document. */
export function AuthPreferenceBootstrap() {
  const { data: currentUser } = useCurrentUser();
  const setPreferences = useLocaleStore((state) => state.setPreferences);
  const language = useLocaleStore((state) => state.language);

  useEffect(() => {
    void useLocaleStore.persist.rehydrate();
  }, []);

  const { data: preferences } = useQuery({
    queryKey: ["auth-preferences", currentUser?.id],
    queryFn: getUserPreferences,
    enabled: Boolean(currentUser?.id),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!preferences) return;
    setPreferences(
      {
        country: preferences.country_code,
        region: preferences.region ?? "",
        currency: isCurrencyCode(preferences.preferred_currency) ? preferences.preferred_currency : "XOF",
        language: preferences.preferred_language === "en" ? "en" : "fr",
      },
      { chosen: true }
    );
  }, [preferences, setPreferences]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
