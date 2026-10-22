import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "@/lib/api-error";

const axiosError = (status: number, detail: unknown, url: string) => ({
  isAxiosError: true,
  config: { url },
  response: { status, data: { detail } },
});

describe("getApiErrorMessage", () => {
  it("affiche la vraie raison d'un refus de connexion", () => {
    expect(getApiErrorMessage(axiosError(401, "Identifiant ou mot de passe incorrect.", "/api/v1/auth/login"), "x")).toBe(
      "Identifiant ou mot de passe incorrect."
    );
  });

  it("garde « session expirée » pour les autres 401", () => {
    expect(getApiErrorMessage(axiosError(401, "Invalid or expired access token", "/api/v1/orders/me"), "x")).toMatch(/session a expiré/);
  });

  it("traduit une erreur de validation du serveur", () => {
    expect(getApiErrorMessage(axiosError(422, [{ type: "missing", loc: ["body", "email"] }], "/api/v1/auth/register"), "x")).toBe(
      "Indiquez l'e-mail."
    );
  });
});
