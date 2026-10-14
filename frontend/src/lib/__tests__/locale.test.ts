import { describe, expect, it } from "vitest";

import { translate } from "../i18n";
import { findCountry, formatConverted } from "../locale";

describe("translate", () => {
  it("traduit en anglais et remplace les variables", () => {
    expect(translate("en", "Panier")).toBe("Cart");
    expect(translate("en", "{n} articles", { n: 3 })).toBe("3 items");
  });

  it("garde le français (accents corrigés) et ne montre jamais de clé brute", () => {
    expect(translate("fr", "Hygiene")).toBe("Hygiène");
    expect(translate("en", "Texte non traduit")).toBe("Texte non traduit");
  });
});

describe("formatConverted", () => {
  it("convertit le XOF dans la devise choisie", () => {
    expect(formatConverted(655957, "EUR", { EUR: 1 / 655.957 }, "en")).toBe("€1,000.00");
  });

  it("renvoie null si le taux est inconnu", () => {
    expect(formatConverted(1000, "USD", {}, "fr")).toBeNull();
  });
});

describe("findCountry", () => {
  it("retombe sur le Niger pour un code inconnu", () => {
    expect(findCountry("ZZ").code).toBe("NE");
    expect(findCountry("SN").currency).toBe("XOF");
  });
});
