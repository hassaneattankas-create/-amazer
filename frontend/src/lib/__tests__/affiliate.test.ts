import { describe, expect, it } from "vitest";

import { withAffiliateRef } from "../affiliate";

describe("withAffiliateRef", () => {
  it("ajoute le code au lien", () => {
    expect(withAffiliateRef("https://amazer.store/product/abc", "XY23AB")).toBe("https://amazer.store/product/abc?ref=XY23AB");
  });

  it("remplace un ancien code et garde les autres paramètres", () => {
    expect(withAffiliateRef("https://amazer.store/?q=riz&ref=OLD123", "NEW234")).toBe("https://amazer.store/?q=riz&ref=NEW234");
  });
});
