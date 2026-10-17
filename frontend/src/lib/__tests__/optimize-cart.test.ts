import { describe, expect, it } from "vitest";

import { optimizeCart } from "../optimize-cart";
import type { Offer } from "@/types/product";

function offer(vendorId: string, amount: number, stock = 5): Offer {
  return {
    price_id: `p-${vendorId}`,
    vendor: { id: vendorId, name: `Boutique ${vendorId}`, slug: vendorId, is_active: true, is_verified: false },
    currency: "XOF",
    amount,
    stock_quantity: stock,
    is_active: true,
    ranking: { price_competitiveness: 0, stock_signal: 0, text_relevance: 0, vendor_signal: 0, score_total: 0 },
  };
}

describe("optimizeCart", () => {
  it("garde la boutique choisie même si une autre est moins chère", () => {
    const result = optimizeCart([{ productId: "x", name: "Riz", quantity: 2, offersSnapshot: [offer("a", 5000), offer("b", 4000)] }]);
    expect(result.optimizedPlan[0].vendorId).toBe("a");
    expect(result.subtotal).toBe(10000);
  });

  it("signale un article en rupture", () => {
    const result = optimizeCart([{ productId: "x", name: "Riz", quantity: 3, offersSnapshot: [offer("a", 5000, 1)] }]);
    expect(result.status).toBe("unavailable_item");
  });

  it("ne facture pas de livraison pour une boutique dont tous les articles sont numériques", () => {
    const digital = optimizeCart([{ productId: "e", name: "E-book", quantity: 1, offersSnapshot: [offer("a", 3000)], isDigital: true }], {
      defaultShippingFee: 1500,
    });
    expect(digital.shippingFee).toBe(0);
    const mixed = optimizeCart(
      [
        { productId: "e", name: "E-book", quantity: 1, offersSnapshot: [offer("a", 3000)], isDigital: true },
        { productId: "r", name: "Riz", quantity: 1, offersSnapshot: [offer("a", 5000)] },
      ],
      { defaultShippingFee: 1500 }
    );
    expect(mixed.shippingFee).toBe(1500);
  });
});
