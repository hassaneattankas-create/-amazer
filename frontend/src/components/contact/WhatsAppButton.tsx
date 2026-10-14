"use client";

import { useQuery } from "@tanstack/react-query";

import { getPublicContactInfo } from "@/services/finance-service";
import { whatsappLink } from "@/lib/whatsapp";

/** Logo WhatsApp (marque reconnue des utilisateurs : on l'affiche tel quel pour le bouton de contact). */
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.27 11.27 0 0 0 12.04.7C5.79.7.69 5.8.69 12.06c0 2 .52 3.95 1.52 5.67L.6 23.6l6.02-1.58a11.33 11.33 0 0 0 5.42 1.38h.01c6.26 0 11.36-5.1 11.36-11.35 0-3.04-1.18-5.89-3.32-8.04" />
    </svg>
  );
}

type WhatsAppButtonProps = {
  /** Numero a contacter ; sans valeur, on utilise le WhatsApp du support AMAZER. */
  phone?: string | null;
  message?: string;
  label?: string;
  variant?: "solid" | "outline" | "link";
  className?: string;
};

const VARIANTS = {
  solid: "inline-flex min-h-11 items-center justify-center gap-2 rounded-field bg-success px-4 text-sm font-semibold text-white hover:opacity-90",
  outline:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-field border border-success px-4 text-sm font-semibold text-success hover:bg-surface-1",
  link: "inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-success hover:underline",
} as const;

/** Bouton « Écrire sur WhatsApp » : ouvre la conversation, le message est pré-rempli. */
export function WhatsAppButton({ phone, message, label = "WhatsApp", variant = "solid", className = "" }: WhatsAppButtonProps) {
  const { data: contact } = useQuery({
    queryKey: ["public-contact-info"],
    queryFn: getPublicContactInfo,
    staleTime: 10 * 60_000,
    enabled: !phone,
    refetchOnWindowFocus: false,
  });
  const href = whatsappLink(phone ?? contact?.support_whatsapp ?? contact?.support_phone, message);
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${VARIANTS[variant]} ${className}`}>
      <WhatsAppIcon className={variant === "link" ? "h-4 w-4" : "h-5 w-5"} />
      {label}
    </a>
  );
}
