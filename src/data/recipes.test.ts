import { describe, it, expect } from "vitest";
import { RECIPES } from "./recipes";
import type {
  Base,
  CookingMethod,
  IngredientCategory,
  Origin,
  Protein,
} from "@/lib/types";

const ORIGINS: Origin[] = ["local", "italian", "asian", "world"];
const PROTEINS: Protein[] = [
  "red_meat",
  "poultry",
  "fish",
  "legumes",
  "eggs",
  "veggie",
];
const BASES: Base[] = ["pasta", "rice", "potato", "grains", "bread", "none"];
const METHODS: CookingMethod[] = [
  "oven",
  "pan",
  "simmer",
  "raw",
  "soup",
  "steam",
];
const CATEGORIES: IngredientCategory[] = [
  "legumes",
  "fruits",
  "frais",
  "viande",
  "poisson",
  "epicerie",
  "surgele",
  "boulangerie",
  "boissons",
];

describe("catalogue de recettes", () => {
  it("contient au moins 500 recettes", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(500);
  });

  it("a des identifiants uniques", () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offre suffisamment de variété par origine (≥ 40 chacune)", () => {
    for (const o of ORIGINS) {
      const n = RECIPES.filter((r) => r.origin === o).length;
      expect(n, `origine ${o}`).toBeGreaterThanOrEqual(40);
    }
  });

  it("dispose d'assez de recettes poisson et végétariennes", () => {
    const fish = RECIPES.filter((r) => r.protein === "fish").length;
    const veg = RECIPES.filter(
      (r) =>
        r.protein === "veggie" ||
        r.protein === "legumes" ||
        r.protein === "eggs",
    ).length;
    expect(fish).toBeGreaterThanOrEqual(40);
    expect(veg).toBeGreaterThanOrEqual(80);
  });

  it("respecte le schéma Recipe pour chaque entrée", () => {
    for (const r of RECIPES) {
      expect(typeof r.id, r.id).toBe("string");
      expect(r.name.length, r.id).toBeGreaterThan(0);
      expect(ORIGINS, r.id).toContain(r.origin);
      expect(PROTEINS, r.id).toContain(r.protein);
      expect(BASES, r.id).toContain(r.base);
      expect(METHODS, r.id).toContain(r.cookingMethod);
      expect([1, 2, 3], r.id).toContain(r.difficulty);
      expect(r.servings, r.id).toBeGreaterThan(0);
      expect(typeof r.batchFriendly, r.id).toBe("boolean");
      expect(Array.isArray(r.tags), r.id).toBe(true);

      expect(r.ingredients.length, r.id).toBeGreaterThan(0);
      for (const ing of r.ingredients) {
        expect(ing.name.length, r.id).toBeGreaterThan(0);
        expect(ing.qty, `${r.id}/${ing.name}`).toBeGreaterThanOrEqual(0);
        expect(typeof ing.unit, r.id).toBe("string");
        expect(CATEGORIES, `${r.id}/${ing.name}`).toContain(ing.category);
      }

      const nut = r.nutrition;
      for (const k of ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const) {
        expect(nut[k], `${r.id}/${k}`).toBeGreaterThan(0);
        expect(Number.isFinite(nut[k]), `${r.id}/${k}`).toBe(true);
      }

      expect(r.instructions.length, r.id).toBeGreaterThan(0);
    }
  });
});
