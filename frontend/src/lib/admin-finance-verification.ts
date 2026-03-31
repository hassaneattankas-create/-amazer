import { getApiErrorMessage } from "@/lib/api-error";
import { VerifyPinPayload } from "@/types/finance";

function looksLikeBirthDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{2,4}$/.test(value.trim());
}

function looksLikePin(value: string): boolean {
  return /^\d{4,}$/.test(value.trim());
}

export function buildAdminFinanceVerifyPayload(pin: string, birthDate: string): VerifyPinPayload {
  const normalizedPin = pin.trim();
  const normalizedBirthDate = birthDate.trim();

  if (looksLikeBirthDate(normalizedPin) && looksLikePin(normalizedBirthDate)) {
    return {
      pin: normalizedBirthDate,
      birth_date: normalizedPin,
    };
  }

  return {
    pin: normalizedPin,
    birth_date: normalizedBirthDate,
  };
}

export function getAdminFinanceVerifyError(error: unknown): string {
  const detail = getApiErrorMessage(error, "Verification admin invalide.");

  if (detail === "Admin MFA is required") {
    return "Le backend public demande encore une ancienne verification admin. Les cles sont bonnes en local, mais Render doit etre redeploye sur la version actuelle.";
  }

  if (detail === "Invalid finance PIN") {
    return "Les cles admin ne correspondent pas. Verifie le PIN et la date secondaire.";
  }

  return detail;
}

export function getAdminFinanceDataError(error: unknown): string {
  const detail = getApiErrorMessage(error, "Impossible de charger les donnees admin.");

  if (detail === "Finance PIN verification required") {
    return "La verification admin a expire. Revalidez le PIN pour recharger cette page.";
  }

  if (detail === "Could not validate credentials") {
    return "Votre session a expire. Reconnectez-vous puis revenez dans l'espace admin.";
  }

  if (detail === "Admin MFA is required") {
    return "Le backend public n'est pas encore aligne sur la version admin actuelle. Le redeploiement Render est encore necessaire.";
  }

  return detail;
}
