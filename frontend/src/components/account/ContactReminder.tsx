"use client";

import Link from "next/link";

import { useCurrentUser } from "@/hooks/use-current-user";
import { isInternalEmail } from "@/services/auth-service";

/** Rappel discret : sans e-mail, les notifications restent seulement sur le site. */
export function ContactReminder() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  if (!isInternalEmail(user.email)) return null;
  return (
    <p className="rounded-field border border-border bg-surface-1 px-3 py-2 text-sm text-ink-800">
      Ajoutez votre e-mail pour recevoir ces notifications directement.{" "}
      <Link href="/dashboard" className="font-semibold text-brand-700 hover:underline">
        Ajouter
      </Link>
    </p>
  );
}
