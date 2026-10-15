import { describe, expect, it } from "vitest";

import { COURSES, RESOURCES } from "./courses";

describe("formations", () => {
  it("chaque module a un objectif, au moins 3 points et un exercice", () => {
    for (const course of COURSES) {
      for (const module of course.modules) {
        expect(module.goal.length).toBeGreaterThan(10);
        expect(module.points.length).toBeGreaterThanOrEqual(3);
        expect(module.exercise.length).toBeGreaterThan(10);
      }
    }
  });

  it("les ressources externes sont en https et sans doublon", () => {
    const links = RESOURCES.map((resource) => resource.href);
    expect(links.every((href) => href.startsWith("https://"))).toBe(true);
    expect(new Set(links).size).toBe(links.length);
  });
});
