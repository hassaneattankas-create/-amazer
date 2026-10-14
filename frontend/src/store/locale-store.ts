import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE,
  type CurrencyCode,
  type LanguageCode,
} from "@/lib/locale";

export type LocalePreferences = {
  country: string;
  region: string;
  currency: CurrencyCode;
  language: LanguageCode;
};

type LocaleState = LocalePreferences & {
  /** true une fois que le visiteur (ou son compte) a choisi : on n'ecrase plus avec les valeurs serveur. */
  chosen: boolean;
  setPreferences: (values: Partial<LocalePreferences>, options?: { chosen?: boolean }) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      country: DEFAULT_COUNTRY,
      region: "",
      currency: DEFAULT_CURRENCY,
      language: DEFAULT_LANGUAGE,
      chosen: false,
      setPreferences: (values, options) =>
        set((state) => ({ ...state, ...values, chosen: options?.chosen ?? state.chosen })),
    }),
    {
      name: "amazer-locale",
      storage: createJSONStorage(() => localStorage),
      // Rehydratation apres le premier rendu (AuthPreferenceBootstrap) : evite un ecart serveur/client.
      skipHydration: true,
      partialize: ({ country, region, currency, language, chosen }) => ({ country, region, currency, language, chosen }),
    }
  )
);
