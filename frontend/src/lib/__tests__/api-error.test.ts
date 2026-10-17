import { describe, expect, it } from "vitest";

import { getApiErrorMessage } from "@/lib/api-error";

const validation = (item: object) => ({ response: { status: 422, data: { detail: [item] } } });

describe("getApiErrorMessage", () => {
  it("traduit un champ obligatoire vide", () => {
    expect(getApiErrorMessage(validation({ type: "string_too_short", loc: ["body", "brand"], ctx: { min_length: 1 } }), "x")).toBe(
      "Indiquez la marque."
    );
  });

  it("explique un prix invalide", () => {
    expect(getApiErrorMessage(validation({ type: "greater_than", loc: ["body", "amount"], ctx: { gt: 0 } }), "x")).toBe(
      "Le prix doit être supérieur à 0."
    );
  });

  it("garde le message francais du serveur", () => {
    expect(getApiErrorMessage({ response: { status: 400, data: { detail: "Photo trop lourde." } } }, "x")).toBe("Photo trop lourde.");
  });

  it("signale une coupure internet", () => {
    expect(getApiErrorMessage({ code: "ERR_NETWORK", request: {} }, "x")).toMatch(/connexion internet/);
  });

  it("utilise le message de secours sinon", () => {
    expect(getApiErrorMessage({ response: { status: 500, data: {} } }, "Réessayez.")).toBe("Réessayez.");
  });
});
