import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "../cartStore";

const item = (productId: string, quantity?: number) => ({
  productId,
  name: `Produit ${productId}`,
  quantity,
  offersSnapshot: [],
});

const state = () => useCartStore.getState();

beforeEach(() => {
  state().resetSession();
});

describe("cartStore — ajout", () => {
  it("ajoute un article avec une quantité par défaut de 1", () => {
    state().addItem(item("p1"));
    expect(state().items).toHaveLength(1);
    expect(state().items[0].quantity).toBe(1);
  });

  it("cumule les quantités quand le produit est déjà au panier", () => {
    state().addItem(item("p1", 2));
    state().addItem(item("p1", 3));
    expect(state().items).toHaveLength(1);
    expect(state().items[0].quantity).toBe(5);
  });

  it("force une quantité minimale de 1 pour une valeur nulle ou négative", () => {
    state().addItem(item("p1", 0));
    state().addItem(item("p2", -5));
    expect(state().items.map((i) => i.quantity)).toEqual([1, 1]);
  });

  it("garde les produits distincts séparés", () => {
    state().addItem(item("p1"));
    state().addItem(item("p2"));
    expect(state().items.map((i) => i.productId)).toEqual(["p1", "p2"]);
  });
});

describe("cartStore — quantité", () => {
  it("tronque les quantités décimales", () => {
    state().addItem(item("p1"));
    state().setQuantity("p1", 3.9);
    expect(state().items[0].quantity).toBe(3);
  });

  it("ne descend jamais sous 1 — setQuantity(0) ne supprime PAS l'article", () => {
    state().addItem(item("p1"));
    state().setQuantity("p1", 0);
    expect(state().items[0].quantity).toBe(1);
    expect(state().items).toHaveLength(1);
  });

  it("ignore un produit absent sans planter", () => {
    state().addItem(item("p1"));
    state().setQuantity("inconnu", 5);
    expect(state().items).toHaveLength(1);
    expect(state().items[0].quantity).toBe(1);
  });
});

describe("cartStore — suppression", () => {
  it("retire uniquement le produit visé", () => {
    state().addItem(item("p1"));
    state().addItem(item("p2"));
    state().removeItem("p1");
    expect(state().items.map((i) => i.productId)).toEqual(["p2"]);
  });

  it("clearCart vide les articles mais conserve l'historique d'économies", () => {
    state().addItem(item("p1"));
    state().addSavingsRecord(1200);
    state().clearCart();
    expect(state().items).toHaveLength(0);
    expect(state().savingsHistory).toHaveLength(1);
  });

  it("resetSession vide tout", () => {
    state().addItem(item("p1"));
    state().addSavingsRecord(900);
    state().resetSession();
    expect(state().items).toHaveLength(0);
    expect(state().savingsHistory).toHaveLength(0);
  });
});

describe("cartStore — historique d'économies", () => {
  it("empile les enregistrements du plus récent au plus ancien", () => {
    state().addSavingsRecord(100);
    state().addSavingsRecord(200);
    expect(state().savingsHistory.map((r) => r.savings)).toEqual([200, 100]);
  });

  it("ramène une économie négative à 0", () => {
    state().addSavingsRecord(-50);
    expect(state().savingsHistory[0].savings).toBe(0);
  });

  it("plafonne l'historique à 40 entrées", () => {
    for (let i = 0; i < 45; i++) state().addSavingsRecord(i);
    expect(state().savingsHistory).toHaveLength(40);
    expect(state().savingsHistory[0].savings).toBe(44);
  });

  it("génère des identifiants uniques", () => {
    for (let i = 0; i < 20; i++) state().addSavingsRecord(i);
    const ids = new Set(state().savingsHistory.map((r) => r.id));
    expect(ids.size).toBe(20);
  });
});
