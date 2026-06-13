import type {
  Ingredient,
  IngredientCategory,
  Recipe,
  WeekPlan,
} from "./types";
import { CATEGORY_ORDER } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// LISTE DE COURSES CONSOLIDÉE
// Agrège les quantités par (ingrédient + unité), met à l'échelle selon le nombre
// de portions, et regroupe par rayon. Les repas « restes » ne sont pas recomptés
// (le batch est déjà inclus dans la grande portion du dîner d'origine).
// ─────────────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  name: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
  perishable: boolean;
  recipes: string[]; // recettes qui utilisent cet ingrédient
}

export interface ShoppingSection {
  category: IngredientCategory;
  items: ShoppingItem[];
}

function keyOf(ing: Ingredient): string {
  return `${ing.name.trim().toLowerCase()}|${ing.unit.trim().toLowerCase()}`;
}

/** Arrondi propre pour éviter les 0.30000000004. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildShoppingList(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
  servings: number,
): ShoppingSection[] {
  const map = new Map<string, ShoppingItem>();

  for (const meal of plan.meals) {
    // Un repas « restes » réutilise une portion déjà cuisinée : pas de course.
    if (meal.leftover) continue;
    const recipe = recipesById.get(meal.recipeId);
    if (!recipe) continue;

    const scale = servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      const k = keyOf(ing);
      const existing = map.get(k);
      const scaledQty = ing.qty * scale;
      if (existing) {
        existing.qty = round(existing.qty + scaledQty);
        if (!existing.recipes.includes(recipe.name))
          existing.recipes.push(recipe.name);
        existing.perishable = existing.perishable || !!ing.perishable;
      } else {
        map.set(k, {
          name: ing.name,
          qty: round(scaledQty),
          unit: ing.unit,
          category: ing.category,
          perishable: !!ing.perishable,
          recipes: [recipe.name],
        });
      }
    }
  }

  // Regroupe par rayon dans l'ordre d'affichage configuré.
  const byCategory = new Map<IngredientCategory, ShoppingItem[]>();
  for (const item of map.values()) {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(item);
    byCategory.set(item.category, arr);
  }

  const sections: ShoppingSection[] = [];
  const seen = new Set<string>();
  for (const cat of CATEGORY_ORDER) {
    const items = byCategory.get(cat as IngredientCategory);
    if (items && items.length) {
      items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      sections.push({ category: cat as IngredientCategory, items });
      seen.add(cat);
    }
  }
  // Rayons éventuels hors liste d'ordre.
  for (const [cat, items] of byCategory) {
    if (!seen.has(cat)) {
      items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      sections.push({ category: cat, items });
    }
  }

  return sections;
}
