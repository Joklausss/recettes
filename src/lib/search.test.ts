import { describe, it, expect } from "vitest";
import { filterRecipes, sortRecipes, normalize } from "./search";
import { RECIPES } from "@/data/recipes";
import type { Recipe } from "./types";

function r(over: Partial<Recipe>): Recipe {
  return {
    id: over.id ?? "x",
    name: over.name ?? "Plat",
    origin: over.origin ?? "local",
    protein: over.protein ?? "veggie",
    base: over.base ?? "rice",
    cookingMethod: over.cookingMethod ?? "pan",
    prepTimeMin: over.prepTimeMin ?? 10,
    cookTimeMin: over.cookTimeMin ?? 15,
    difficulty: over.difficulty ?? 1,
    servings: 4,
    batchFriendly: false,
    tags: over.tags ?? [],
    ingredients: over.ingredients ?? [
      { name: "Riz", qty: 300, unit: "g", category: "epicerie" },
    ],
    nutrition: { kcal: 400, protein_g: 10, carbs_g: 60, fat_g: 8, fiber_g: 5 },
    instructions: [],
    featured: over.featured,
  };
}

describe("normalize", () => {
  it("met en minuscules et retire les accents", () => {
    expect(normalize("Poêlée d'Épinards")).toBe("poelee d'epinards");
  });
});

describe("filterRecipes", () => {
  const data = [
    r({ id: "a", name: "Curry de pois chiches", protein: "legumes", origin: "asian", ingredients: [{ name: "Pois chiches", qty: 400, unit: "g", category: "epicerie" }] }),
    r({ id: "b", name: "Saumon grillé", protein: "fish", origin: "local", prepTimeMin: 10, cookTimeMin: 15 }),
    r({ id: "c", name: "Bœuf bourguignon", protein: "red_meat", origin: "local", prepTimeMin: 25, cookTimeMin: 120 }),
    r({ id: "d", name: "Pizza margherita", protein: "veggie", origin: "italian", tags: ["vegetarian"] }),
  ];

  it("recherche par nom (insensible aux accents)", () => {
    expect(filterRecipes(data, { text: "boeuf" }).map((x) => x.id)).toEqual(["c"]);
  });

  it("recherche dans les ingrédients", () => {
    expect(filterRecipes(data, { text: "pois chiches" }).map((x) => x.id)).toEqual(["a"]);
  });

  it("exige tous les mots (ET)", () => {
    expect(filterRecipes(data, { text: "saumon grille" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterRecipes(data, { text: "saumon pizza" })).toHaveLength(0);
  });

  it("filtre par origine", () => {
    expect(filterRecipes(data, { origins: ["local"] }).map((x) => x.id).sort()).toEqual(["b", "c"]);
  });

  it("filtre par protéine", () => {
    expect(filterRecipes(data, { proteins: ["fish"] }).map((x) => x.id)).toEqual(["b"]);
  });

  it("filtre poisson et végé", () => {
    expect(filterRecipes(data, { fishOnly: true }).map((x) => x.id)).toEqual(["b"]);
    expect(filterRecipes(data, { vegetarianOnly: true }).map((x) => x.id).sort()).toEqual(["a", "d"]);
  });

  it("filtre par temps total max", () => {
    expect(filterRecipes(data, { maxTotalTime: 30 }).map((x) => x.id).sort()).toEqual(["a", "b", "d"]);
  });

  it("filtre les favoris", () => {
    expect(
      filterRecipes(data, { favoritesOnly: true, favoriteIds: ["c"] }).map((x) => x.id),
    ).toEqual(["c"]);
  });

  it("combine plusieurs critères", () => {
    expect(
      filterRecipes(data, { origins: ["local"], maxTotalTime: 30 }).map((x) => x.id),
    ).toEqual(["b"]);
  });

  it("renvoie tout sans critère", () => {
    expect(filterRecipes(data, {})).toHaveLength(4);
  });

  it("fonctionne sur le vrai catalogue", () => {
    const veg = filterRecipes(RECIPES, { vegetarianOnly: true });
    expect(veg.length).toBeGreaterThan(100);
    const found = filterRecipes(RECIPES, { text: "curry" });
    expect(found.length).toBeGreaterThan(5);
  });
});

describe("sortRecipes", () => {
  it("place les favoris en tête puis trie par nom", () => {
    const data = [r({ id: "z", name: "Zucchini" }), r({ id: "a", name: "Artichaut" }), r({ id: "m", name: "Melon" })];
    const sorted = sortRecipes(data, ["m"]);
    expect(sorted.map((x) => x.id)).toEqual(["m", "a", "z"]);
  });
});
