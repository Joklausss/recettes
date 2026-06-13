import { describe, it, expect } from "vitest";
import { RECIPES } from "@/data/recipes";
import { DEFAULT_ORIGIN_TARGETS, MEALS_PER_WEEK } from "@/lib/config";
import {
  computeOriginCounts,
  largestRemainder,
  ORIGINS,
} from "@/lib/origin";
import {
  generateWeekPlan,
  originCountsOfPlan,
  type HistoryWeek,
} from "@/lib/generator";
import { buildShoppingList } from "@/lib/shoppingList";
import type { Origin, Recipe, WeekPlan } from "@/lib/types";

const byId = new Map(RECIPES.map((r) => [r.id, r] as const));

function gen(overrides = {}): WeekPlan {
  return generateWeekPlan({
    recipes: RECIPES,
    originTargets: DEFAULT_ORIGIN_TARGETS,
    seed: 42,
    weekStart: "2026-06-08",
    ...overrides,
  });
}

function nonLeftover(plan: WeekPlan) {
  return plan.meals.filter((m) => !m.leftover);
}

describe("répartition par origine", () => {
  it("le plus fort reste tombe exactement au total", () => {
    const counts = largestRemainder({ ...DEFAULT_ORIGIN_TARGETS }, 14);
    const sum = ORIGINS.reduce((s, o) => s + counts[o], 0);
    expect(sum).toBe(14);
  });

  it("respecte les pourcentages cibles (6/3/3/2)", () => {
    const counts = computeOriginCounts(DEFAULT_ORIGIN_TARGETS, 14);
    expect(counts).toEqual({ local: 6, italian: 3, asian: 3, world: 2 });
  });

  it("converge vers les cibles en compensant l'historique", () => {
    // Semaine passée biaisée vers l'italien : on doit corriger à la baisse.
    const history = {
      weeks: 1,
      counts: { local: 4, italian: 7, asian: 2, world: 1 } as Record<
        Origin,
        number
      >,
    };
    const counts = computeOriginCounts(DEFAULT_ORIGIN_TARGETS, 14, history);
    const sum = ORIGINS.reduce((s, o) => s + counts[o], 0);
    expect(sum).toBe(14);
    // L'italien était surreprésenté → il doit baisser sous sa cible nominale (3-4).
    expect(counts.italian).toBeLessThanOrEqual(3);
    expect(counts.local).toBeGreaterThanOrEqual(6);
  });
});

describe("génération du plan", () => {
  it("produit exactement 14 repas", () => {
    const plan = gen();
    expect(plan.meals).toHaveLength(MEALS_PER_WEEK);
  });

  it("couvre 7 jours × 2 créneaux sans trou", () => {
    const plan = gen();
    const keys = new Set(plan.meals.map((m) => `${m.day}-${m.slot}`));
    expect(keys.size).toBe(14);
    for (let d = 0; d < 7; d++) {
      expect(keys.has(`${d}-lunch`)).toBe(true);
      expect(keys.has(`${d}-dinner`)).toBe(true);
    }
  });

  it("ne répète pas une même recette cuisinée dans la semaine", () => {
    const plan = gen();
    const cooked = nonLeftover(plan).map((m) => m.recipeId);
    expect(new Set(cooked).size).toBe(cooked.length);
  });

  it("respecte la répartition par origine à ±1", () => {
    const plan = gen();
    const counts = originCountsOfPlan(plan, byId);
    const target = computeOriginCounts(DEFAULT_ORIGIN_TARGETS, 14);
    for (const o of ORIGINS) {
      expect(Math.abs(counts[o] - target[o])).toBeLessThanOrEqual(1);
    }
  });

  it("est déterministe pour une même graine", () => {
    const a = gen();
    const b = gen();
    expect(a.meals.map((m) => m.recipeId)).toEqual(
      b.meals.map((m) => m.recipeId),
    );
  });

  it("produit des plans différents selon la graine", () => {
    const a = gen({ seed: 1 });
    const b = gen({ seed: 9999 });
    expect(a.meals.map((m) => m.recipeId)).not.toEqual(
      b.meals.map((m) => m.recipeId),
    );
  });
});

describe("équilibre nutritionnel hebdomadaire", () => {
  // Teste sur plusieurs graines pour vérifier la robustesse des cibles.
  const seeds = [1, 2, 7, 42, 100, 256, 777, 2026];

  it("au moins 2 repas de poisson", () => {
    for (const seed of seeds) {
      const plan = gen({ seed });
      const fish = nonLeftover(plan).filter(
        (m) => byId.get(m.recipeId)?.protein === "fish",
      ).length;
      expect(fish, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("au moins 3 repas végétariens", () => {
    for (const seed of seeds) {
      const plan = gen({ seed });
      const veg = nonLeftover(plan).filter((m) => {
        const r = byId.get(m.recipeId);
        return (
          r &&
          (r.protein === "veggie" ||
            r.protein === "legumes" ||
            r.protein === "eggs" ||
            r.tags.includes("vegetarian"))
        );
      }).length;
      expect(veg, `seed ${seed}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("limite la viande rouge à 3 repas max", () => {
    for (const seed of seeds) {
      const plan = gen({ seed });
      const red = nonLeftover(plan).filter(
        (m) => byId.get(m.recipeId)?.protein === "red_meat",
      ).length;
      expect(red, `seed ${seed}`).toBeLessThanOrEqual(3);
    }
  });
});

describe("contraintes utilisateur", () => {
  it("exclut les recettes refusées", () => {
    const excludedRecipeIds = ["ita-bolognese", "loc-poulet-roti"];
    const plan = gen({ excludedRecipeIds });
    const ids = plan.meals.map((m) => m.recipeId);
    expect(ids).not.toContain("ita-bolognese");
    expect(ids).not.toContain("loc-poulet-roti");
  });

  it("exclut les recettes contenant un ingrédient interdit", () => {
    const plan = gen({ excludedIngredients: ["saumon"] });
    for (const m of plan.meals) {
      const r = byId.get(m.recipeId)!;
      expect(
        r.ingredients.some((i) => i.name.toLowerCase().includes("saumon")),
      ).toBe(false);
    }
  });

  it("ne reprogramme pas une recette utilisée les semaines récentes", () => {
    const history: HistoryWeek[] = [
      {
        weekStart: "2026-06-01",
        recipeIds: ["loc-boeuf-bourguignon", "ita-pesto", "asi-pho-poulet"],
        originCounts: { local: 6, italian: 3, asian: 3, world: 2 },
      },
    ];
    const plan = gen({ history });
    const ids = plan.meals.map((m) => m.recipeId);
    expect(ids).not.toContain("loc-boeuf-bourguignon");
    expect(ids).not.toContain("ita-pesto");
    expect(ids).not.toContain("asi-pho-poulet");
  });

  it("conserve les repas verrouillés", () => {
    const lockedMeals = [
      {
        day: 2,
        slot: "dinner" as const,
        recipeId: "ita-pizza-margherita",
        leftover: false,
        locked: true,
      },
    ];
    const plan = gen({ lockedMeals });
    const meal = plan.meals.find((m) => m.day === 2 && m.slot === "dinner");
    expect(meal?.recipeId).toBe("ita-pizza-margherita");
    expect(meal?.locked).toBe(true);
  });

  it("favorise les recettes en favori", () => {
    // Sur plusieurs graines, un favori fortement boosté apparaît souvent.
    let appearances = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const seed of seeds) {
      const plan = gen({ seed, favoriteRecipeIds: ["loc-poulet-roti"] });
      if (plan.meals.some((m) => m.recipeId === "loc-poulet-roti"))
        appearances++;
    }
    expect(appearances).toBeGreaterThan(seeds.length / 2);
  });
});

describe("batch cooking", () => {
  it("génère des repas « restes » quand activé", () => {
    // On force l'activation et on cherche au moins un leftover sur plusieurs graines.
    let found = false;
    for (const seed of [1, 2, 3, 42, 100]) {
      const plan = gen({ seed, batchCookingEnabled: true });
      if (plan.meals.some((m) => m.leftover)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("un reste suit toujours le dîner correspondant la veille", () => {
    const plan = gen({ batchCookingEnabled: true });
    for (const m of plan.meals.filter((x) => x.leftover)) {
      expect(m.slot).toBe("lunch");
      const prevDinner = plan.meals.find(
        (x) => x.day === m.day - 1 && x.slot === "dinner",
      );
      expect(prevDinner?.recipeId).toBe(m.recipeId);
    }
  });

  it("ne produit aucun reste quand le batch est désactivé", () => {
    const plan = gen({ batchCookingEnabled: false });
    expect(plan.meals.some((m) => m.leftover)).toBe(false);
  });
});

describe("liste de courses", () => {
  it("agrège les quantités d'un même ingrédient", () => {
    const recipes: Recipe[] = [
      makeRecipe("r1", [{ name: "Tomates", qty: 3, unit: "pièces" }]),
      makeRecipe("r2", [{ name: "Tomates", qty: 2, unit: "pièces" }]),
    ];
    const plan: WeekPlan = {
      id: "p",
      weekStart: "2026-06-08",
      createdAt: "",
      meals: [
        { day: 0, slot: "lunch", recipeId: "r1", leftover: false, locked: false },
        { day: 0, slot: "dinner", recipeId: "r2", leftover: false, locked: false },
      ],
    };
    const sections = buildShoppingList(
      plan,
      new Map(recipes.map((r) => [r.id, r])),
      4,
    );
    const tomato = sections
      .flatMap((s) => s.items)
      .find((i) => i.name === "Tomates");
    expect(tomato?.qty).toBe(5);
    expect(tomato?.recipes).toHaveLength(2);
  });

  it("met les quantités à l'échelle du nombre de portions", () => {
    const recipes: Recipe[] = [
      makeRecipe("r1", [{ name: "Riz", qty: 300, unit: "g" }]),
    ];
    const plan: WeekPlan = {
      id: "p",
      weekStart: "2026-06-08",
      createdAt: "",
      meals: [
        { day: 0, slot: "lunch", recipeId: "r1", leftover: false, locked: false },
      ],
    };
    // Recette pour 4 portions → 2 portions = moitié.
    const sections = buildShoppingList(
      plan,
      new Map(recipes.map((r) => [r.id, r])),
      2,
    );
    const riz = sections.flatMap((s) => s.items).find((i) => i.name === "Riz");
    expect(riz?.qty).toBe(150);
  });

  it("ne compte pas les ingrédients d'un repas « restes »", () => {
    const recipes: Recipe[] = [
      makeRecipe("r1", [{ name: "Riz", qty: 300, unit: "g" }]),
    ];
    const plan: WeekPlan = {
      id: "p",
      weekStart: "2026-06-08",
      createdAt: "",
      meals: [
        { day: 0, slot: "dinner", recipeId: "r1", leftover: false, locked: false },
        { day: 1, slot: "lunch", recipeId: "r1", leftover: true, locked: false },
      ],
    };
    const sections = buildShoppingList(
      plan,
      new Map(recipes.map((r) => [r.id, r])),
      4,
    );
    const riz = sections.flatMap((s) => s.items).find((i) => i.name === "Riz");
    expect(riz?.qty).toBe(300); // une seule fois, pas deux
  });
});

// Helper minimal pour fabriquer une recette de test.
function makeRecipe(
  id: string,
  ingredients: { name: string; qty: number; unit: string }[],
): Recipe {
  return {
    id,
    name: id,
    origin: "local",
    protein: "veggie",
    base: "rice",
    cookingMethod: "pan",
    prepTimeMin: 10,
    cookTimeMin: 10,
    difficulty: 1,
    servings: 4,
    batchFriendly: false,
    tags: [],
    ingredients: ingredients.map((i) => ({ ...i, category: "epicerie" })),
    nutrition: { kcal: 400, protein_g: 10, carbs_g: 60, fat_g: 8, fiber_g: 5 },
    instructions: [],
  };
}
