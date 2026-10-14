/** Liens « cliquer pour discuter » WhatsApp (wa.me), sans API ni frais. */

/** Normalise un numéro nigérien : « 96 95 31 63 », « +227 96953163 », « 0022796953163 » → « 22796953163 ». */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `227${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function whatsappLink(raw: string | null | undefined, message?: string): string | null {
  const number = toWhatsAppNumber(raw);
  if (!number) return null;
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}
