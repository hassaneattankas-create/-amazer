import { describe, expect, it } from "vitest";

import { toWhatsAppNumber, whatsappLink } from "./whatsapp";

describe("toWhatsAppNumber", () => {
  it("ajoute l'indicatif du Niger à un numéro local", () => {
    expect(toWhatsAppNumber("96 95 31 63")).toBe("22796953163");
  });
  it("accepte les formats internationaux", () => {
    expect(toWhatsAppNumber("+227 96953163")).toBe("22796953163");
    expect(toWhatsAppNumber("0022796953163")).toBe("22796953163");
  });
  it("refuse une saisie invalide", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("123")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encode le message pré-rempli", () => {
    expect(whatsappLink("+227 96953163", "Bonjour AMAZER")).toBe("https://wa.me/22796953163?text=Bonjour%20AMAZER");
  });
  it("retourne null sans numéro valide", () => {
    expect(whatsappLink(undefined, "x")).toBeNull();
  });
});
