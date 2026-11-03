import { describe, expect, it } from "vitest";

import { activityDetailText } from "./station-space";

describe("activityDetailText", () => {
  it("retire le titre répété", () => {
    expect(activityDetailText("Livraison Gasoil 12 000 L")).toBe("Gasoil 12 000 L");
    expect(activityDetailText("Position enregistrée : 13.51370, 2.10980")).toBe("13.51370, 2.10980");
    expect(activityDetailText("Gérant ajouté : ali@test.ne")).toBe("ali@test.ne");
    expect(activityDetailText("Retour traité : Gaz livré")).toBe("Gaz livré");
  });

  it("n'affiche rien quand le détail n'apporte rien", () => {
    expect(activityDetailText("Retour traité")).toBeNull();
    expect(activityDetailText(null)).toBeNull();
  });

  it("garde les détails utiles", () => {
    expect(activityDetailText("Gasoil : rupture")).toBe("Gasoil : rupture");
    expect(activityDetailText("Rien n'a changé")).toBe("Rien n'a changé");
  });
});
