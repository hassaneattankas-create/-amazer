"use client";

import Link from "next/link";

import { useCurrentUser } from "@/hooks/use-current-user";
import { isInternalEmail } from "@/services/auth-service";

/** Rappel discret : sans e-mail ni WhatsApp, les notifications restent seulement sur le site. */
export function ContactReminder() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  const missingEmail = isInternalEmail(user.email);
  const missingPhone = !user.whatsapp_phone;
  if (!missingEmail && !missingPhone) return null;
  const missing = missingEmail && missingPhone ? "votre e-mail et votre WhatsApp" : missingEmail ? "votre e-mail" : "votre WhatsApp";
  return (
    <p className="rounded-field border border-border bg-surface-1 px-3 py-2 text-sm text-ink-800">
      Ajoutez {missing} pour recevoir ces notifications directement.{" "}
      <Link href="/dashboard" className="font-semibold text-brand-700 hover:underline">
        Ajouter
      </Link>
    </p>
  );
}
