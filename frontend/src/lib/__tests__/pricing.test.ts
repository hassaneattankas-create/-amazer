import { describe, expect, it } from "vitest";
import { formatMoney, formatXOF } from "../currency";
import { computeRestaurantOrderSummary } from "../restaurant-order-pricing";

describe("formatMoney", () => {
  it("formate un montant en XOF sans décimale", () => {
    expect(formatMoney(2500)).toMatch(/^2\s?500 XOF$/);
  });

  it("arrondit à l'entier", () => {
    expect(formatMoney(1234.67)).toMatch(/^1\s?235 XOF$/);
  });

  it("neutralise NaN et Infinity en 0 plutôt que d'afficher une valeur absurde", () => {
    expect(formatMoney(Number.NaN)).toBe("0 XOF");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("0 XOF");
  });

  it("accepte 0 et les négatifs sans planter", () => {
    expect(formatMoney(0)).toBe("0 XOF");
    expect(formatMoney(-500)).toContain("500 XOF");
  });

  it("formatXOF délègue à formatMoney", () => {
    expect(formatXOF(7000)).toBe(formatMoney(7000));
  });
});

describe("computeRestaurantOrderSummary", () => {
  it("calcule commission, frais et total sur un cas nominal", () => {
    const s = computeRestaurantOrderSummary(10_000, 1_000, 0.1, 250);
    expect(s.platformCommission).toBe(1_000);
    expect(s.platformServiceFee).toBe(250);
    expect(s.totalAmount).toBe(12_250);
  });

  it("n'applique AUCUN frais de service quand le panier est vide", () => {
    const s = computeRestaurantOrderSummary(0, 1_000, 0.1, 250);
    expect(s.platformServiceFee).toBe(0);
    expect(s.platformCommission).toBe(0);
    expect(s.totalAmount).toBe(1_000);
  });

  it("ramène les entrées négatives à 0 — jamais de total négatif", () => {
    const s = computeRestaurantOrderSummary(-5_000, -800, -0.2, -100);
    expect(s).toMatchObject({
      itemsSubtotal: 0,
      deliveryFee: 0,
      platformCommission: 0,
      platformServiceFee: 0,
      totalAmount: 0,
    });
  });

  it("supporte une commission à 0 %", () => {
    const s = computeRestaurantOrderSummary(8_000, 500, 0, 0);
    expect(s.platformCommission).toBe(0);
    expect(s.totalAmount).toBe(8_500);
  });

  it("le total est toujours la somme de ses composants", () => {
    const cases: [number, number, number, number][] = [
      [10_000, 1_000, 0.1, 250],
      [3_500, 0, 0.15, 100],
      [250, 2_000, 0.05, 50],
    ];
    for (const [sub, del, rate, fee] of cases) {
      const s = computeRestaurantOrderSummary(sub, del, rate, fee);
      expect(s.totalAmount).toBeCloseTo(
        s.itemsSubtotal + s.deliveryFee + s.platformCommission + s.platformServiceFee,
        6
      );
    }
  });
});
