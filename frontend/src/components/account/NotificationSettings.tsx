"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail } from "lucide-react";

import { WhatsAppIcon } from "@/components/contact/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { findCountry } from "@/lib/locale";
import {
  getUserPreferences,
  isInternalEmail,
  updateMyContact,
  updateUserPreferences,
} from "@/services/auth-service";
import { useLocaleStore } from "@/store/locale-store";

const fieldClass = "h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors duration-fast disabled:opacity-50 ${
        checked ? "bg-success" : "bg-surface-3"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-pill bg-white shadow-resting transition-transform duration-fast ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/**
 * « Comment vous joindre » : comme les grandes plateformes, les notifications partent aussi
 * par e-mail et WhatsApp. On aide l'utilisateur a ajouter le contact qui manque.
 */
export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const country = useLocaleStore((state) => state.country);
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [message, setMessage] = useState("");

  const { data: prefs } = useQuery({
    queryKey: ["auth-preferences", user?.id],
    queryFn: getUserPreferences,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const contact = useMutation({
    mutationFn: updateMyContact,
    onSuccess: () => {
      setMessage("Contact ajouté. Vous recevrez vos notifications dessus.");
      setEmailDraft("");
      setPhoneDraft("");
      void queryClient.invalidateQueries({ queryKey: ["auth-current-user"] });
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Enregistrement impossible. Vérifiez la saisie.")),
  });

  const channels = useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["auth-preferences"] }),
    onError: () => setMessage("Réglage non enregistré. Réessayez."),
  });

  if (!user) return null;
  const hasEmail = !isInternalEmail(user.email);
  const hasPhone = Boolean(user.whatsapp_phone);
  const dial = findCountry(country).dial;

  const submitPhone = () => {
    const raw = phoneDraft.replace(/[^\d+]/g, "");
    contact.mutate({ whatsapp_phone: raw.startsWith("+") ? raw : `${dial}${raw.replace(/^0+/, "")}` });
  };

  return (
    <article className="rounded-card border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <Bell className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Notifications
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Commandes, paiements, messages et livraisons : en plus du site, vous les recevez par e-mail.
      </p>

      <ul className="mt-4 divide-y divide-border">
        <li className="flex flex-wrap items-center gap-3 py-3">
          <Mail className="h-5 w-5 shrink-0 text-ink-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">E-mail</p>
            {hasEmail ? (
              <p className="truncate text-sm text-ink-600">{user.email}</p>
            ) : (
              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  contact.mutate({ email: emailDraft.trim() });
                }}
              >
                <label htmlFor="add-email" className="sr-only">
                  Votre adresse e-mail
                </label>
                <input
                  id="add-email"
                  type="email"
                  autoComplete="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="nom@exemple.com"
                  className={fieldClass}
                />
                <Button type="submit" disabled={contact.isPending || emailDraft.trim().length < 6}>
                  Ajouter
                </Button>
              </form>
            )}
          </div>
          {hasEmail ? (
            <Toggle
              label="Notifications par e-mail"
              checked={prefs?.notify_email !== false}
              disabled={channels.isPending}
              onChange={(value) => channels.mutate({ notify_email: value })}
            />
          ) : null}
        </li>
        <li className="flex flex-wrap items-center gap-3 py-3">
          <WhatsAppIcon className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">WhatsApp</p>
            {hasPhone ? (
              <p className="text-sm text-ink-600">{user.whatsapp_phone}</p>
            ) : (
              <form
                className="mt-2 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPhone();
                }}
              >
                <label htmlFor="add-phone" className="sr-only">
                  Votre numéro WhatsApp
                </label>
                <div className="flex w-full">
                  <span className="inline-flex items-center rounded-l-field border border-r-0 border-border bg-surface-1 px-3 text-sm text-ink-700">
                    {dial}
                  </span>
                  <input
                    id="add-phone"
                    type="tel"
                    autoComplete="tel-national"
                    value={phoneDraft}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder="90 00 00 00"
                    className="h-11 w-full rounded-r-field border border-border bg-card px-3 text-sm text-ink-900"
                  />
                </div>
                <Button type="submit" disabled={contact.isPending || phoneDraft.replace(/\D/g, "").length < 8}>
                  Ajouter
                </Button>
              </form>
            )}
          </div>
          {hasPhone ? <span className="text-xs text-ink-600">Notifications WhatsApp : bientôt</span> : null}
        </li>
      </ul>
      {message ? (
        <p className="mt-2 text-sm text-ink-800" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
