"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Drawer } from "vaul";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useT } from "@/lib/i18n";
import { COUNTRIES, CURRENCIES, LANGUAGES, findCountry, type CurrencyCode, type LanguageCode } from "@/lib/locale";
import { updateUserPreferences } from "@/services/auth-service";
import { useLocaleStore } from "@/store/locale-store";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

/** Bouton « NE · XOF » de l'en-tete : pays, region, devise et langue (comme les grandes marketplaces). */
export function LocaleSwitcher() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { country, region, currency, language, setPreferences } = useLocaleStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ country, region, currency, language });
  const [saving, setSaving] = useState(false);

  const openDrawer = (next: boolean) => {
    if (next) setDraft({ country, region, currency, language });
    setOpen(next);
  };

  const save = async () => {
    setSaving(true);
    setPreferences(draft, { chosen: true });
    if (user?.id) {
      try {
        await updateUserPreferences({
          country_code: draft.country,
          region: draft.region,
          preferred_currency: draft.currency,
          preferred_language: draft.language,
        });
        void queryClient.invalidateQueries({ queryKey: ["auth-preferences"] });
      } catch {
        // Preference gardee sur l'appareil ; le compte sera mis a jour au prochain enregistrement.
      }
    }
    setSaving(false);
    setOpen(false);
  };

  const lang = draft.language;

  return (
    <Drawer.Root open={open} onOpenChange={openDrawer}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          aria-label={t("Pays, devise et langue")}
          className="inline-flex min-h-11 items-center gap-1 rounded-field px-2 text-xs font-semibold text-ink-700 hover:bg-surface-1"
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">
            {country} · {currency}
          </span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-overlay bg-black/30" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-modal rounded-t-sheet bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay">
          <div className="mx-auto h-1.5 w-12 rounded-pill bg-surface-3" aria-hidden="true" />
          <div className="mx-auto max-w-md">
            <Drawer.Title className="mt-4 text-lg font-semibold text-ink-900">{t("Pays, devise et langue")}</Drawer.Title>
            <Drawer.Description className="mt-1 text-xs text-ink-600">
              {t("Les prix sont payés en XOF. La conversion est indicative.")}
            </Drawer.Description>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-ink-800">
                {t("Pays")}
                <select
                  className={fieldClass}
                  value={draft.country}
                  onChange={(event) => {
                    const next = findCountry(event.target.value);
                    // Comme les grandes plateformes : la devise suit le pays (modifiable ensuite).
                    setDraft((prev) => ({ ...prev, country: next.code, currency: next.currency }));
                  }}
                >
                  {COUNTRIES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {lang === "en" ? item.en : item.fr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink-800">
                {t("Région ou ville")}
                <input
                  className={fieldClass}
                  value={draft.region}
                  maxLength={120}
                  autoComplete="address-level1"
                  onChange={(event) => setDraft((prev) => ({ ...prev, region: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-ink-800">
                  {t("Devise")}
                  <select
                    className={fieldClass}
                    value={draft.currency}
                    onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as CurrencyCode }))}
                  >
                    {CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} · {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink-800">
                  {t("Langue")}
                  <select
                    className={fieldClass}
                    value={draft.language}
                    onChange={(event) => setDraft((prev) => ({ ...prev, language: event.target.value as LanguageCode }))}
                  >
                    {LANGUAGES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("Annuler")}
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {t("Enregistrer")}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
