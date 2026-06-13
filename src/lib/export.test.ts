import { describe, it, expect } from "vitest";
import {
  buildPlanText,
  buildShoppingText,
  buildRecipesText,
  buildFullRecap,
  buildCompactRecap,
} from "./export";
import type { Recipe, WeekPlan } from "./types";

function recipe(id: string, name: string): Recipe {
  return {
    id,
    name,
    origin: "local",
    protein: "veggie",
    base: "rice",
    cookingMethod: "pan",
    prepTimeMin: 10,
    cookTimeMin: 15,
    difficulty: 1,
    servings: 4,
    batchFriendly: true,
    tags: [],
    ingredients: [
      { name: "Riz", qty: 300, unit: "g", category: "epicerie" },
      { name: "Tomates", qty: 3, unit: "pièces", category: "legumes" },
    ],
    nutrition: { kcal: 400, protein_g: 10, carbs_g: 60, fat_g: 8, fiber_g: 5 },
    instructions: ["Cuire le riz.", "Ajouter les tomates."],
  };
}

const recipesById = new Map<string, Recipe>([
  ["a", recipe("a", "Plat A")],
  ["b", recipe("b", "Plat B")],
]);

const plan: WeekPlan = {
  id: "p",
  weekStart: "2026-06-08",
  createdAt: "",
  meals: [
    { day: 0, slot: "lunch", recipeId: "a", leftover: false, locked: false },
    { day: 0, slot: "dinner", recipeId: "b", leftover: false, locked: false },
    { day: 1, slot: "lunch", recipeId: "b", leftover: true, locked: false },
  ],
};

describe("export texte", () => {
  it("le programme liste les repas avec le créneau", () => {
    const t = buildPlanText(plan, recipesById);
    expect(t).toContain("PROGRAMME");
    expect(t).toContain("Midi : Plat A");
    expect(t).toContain("Soir : Plat B");
    expect(t).toContain("♻️ restes");
  });

  it("la liste de courses agrège et met à l'échelle", () => {
    const t = buildShoppingText(plan, recipesById, 2);
    // Plat A + Plat B contiennent chacun 300 g de riz (pour 4) ; à 2 portions :
    // 150 g + 150 g = 300 g. Le repas « restes » n'est pas recompté.
    expect(t).toContain("Riz — 300 g");
    expect(t).toContain("LISTE DE COURSES — 2 portions");
  });

  it("les recettes sont listées sans doublon", () => {
    const t = buildRecipesText(plan, recipesById);
    expect((t.match(/Plat B/g) ?? []).length).toBe(1);
    expect(t).toContain("Préparation :");
    expect(t).toContain("Cuire le riz.");
  });

  it("la fiche complète réunit les trois sections", () => {
    const t = buildFullRecap(plan, recipesById, 4);
    expect(t).toContain("PROGRAMME");
    expect(t).toContain("LISTE DE COURSES");
    expect(t).toContain("RECETTES");
  });

  it("la version compacte (WhatsApp) omet les étapes détaillées", () => {
    const t = buildCompactRecap(plan, recipesById, 4);
    expect(t).toContain("PROGRAMME");
    expect(t).toContain("LISTE DE COURSES");
    expect(t).not.toContain("Préparation :");
    // Plus courte que la fiche intégrale.
    expect(t.length).toBeLessThan(buildFullRecap(plan, recipesById, 4).length);
  });
});
