import { describe, expect, it } from "vitest";

import { activityDetailText, hasStationSpace, stationSpaceSummary } from "./station-space";

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

describe("espace station du compte", () => {
  const me = (cities: number, stations: number) => ({ is_owner: false, owner_brand: null, cities, stations });

  it("reconnait un responsable ou un gerant", () => {
    expect(hasStationSpace(me(1, 0))).toBe(true);
    expect(hasStationSpace(me(0, 2))).toBe(true);
    expect(hasStationSpace({ ...me(1, 0), is_owner: true })).toBe(true);
  });

  it("ignore les autres comptes", () => {
    expect(hasStationSpace(me(0, 0))).toBe(false);
    expect(hasStationSpace(null)).toBe(false);
    expect(hasStationSpace(undefined)).toBe(false);
  });

  it("resume les villes et les stations", () => {
    expect(stationSpaceSummary(me(1, 0))).toBe("1 ville");
    expect(stationSpaceSummary(me(2, 3))).toBe("2 villes · 3 stations");
  });
});
