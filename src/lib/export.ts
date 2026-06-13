import type { Recipe, WeekPlan } from "./types";
import { buildShoppingList } from "./shoppingList";
import {
  CATEGORY_LABELS,
  METHOD_LABELS,
  ORIGIN_LABELS,
} from "./config";
import { DAY_NAMES, formatWeekRange } from "./date";

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT TEXTE — fabrique des fiches lisibles (programme, courses, recettes)
// destinées au partage (Web Share / WhatsApp / Notes). Module pur, sans API
// navigateur, pour être testable et réutilisable.
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_LABEL: Record<string, string> = { lunch: "Midi", dinner: "Soir" };

/** 1) Programme de la semaine. */
export function buildPlanText(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
): string {
  const lines: string[] = [];
  lines.push(`📅 PROGRAMME — semaine du ${formatWeekRange(plan.weekStart)}`);
  for (let day = 0; day < 7; day++) {
    lines.push("");
    lines.push(DAY_NAMES[day]);
    for (const slot of ["lunch", "dinner"] as const) {
      const meal = plan.meals.find((m) => m.day === day && m.slot === slot);
      if (!meal) continue;
      const r = recipesById.get(meal.recipeId);
      if (!r) continue;
      const total = r.prepTimeMin + r.cookTimeMin;
      const leftover = meal.leftover ? " ♻️ restes" : "";
      lines.push(
        `  • ${SLOT_LABEL[slot]} : ${r.name} (${ORIGIN_LABELS[r.origin]}, ${total} min)${leftover}`,
      );
    }
  }
  return lines.join("\n");
}

/** 2) Liste de courses consolidée. */
export function buildShoppingText(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
  servings: number,
): string {
  const sections = buildShoppingList(plan, recipesById, servings);
  const lines: string[] = [];
  lines.push(`🛒 LISTE DE COURSES — ${servings} portions`);
  for (const section of sections) {
    lines.push("");
    lines.push(`— ${CATEGORY_LABELS[section.category] ?? section.category} —`);
    for (const item of section.items) {
      lines.push(`☐ ${item.name} — ${item.qty} ${item.unit}`.trim());
    }
  }
  return lines.join("\n");
}

/** 3) Recettes de chaque plat (sans doublon, dans l'ordre de la semaine). */
export function buildRecipesText(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  lines.push("🍽️ RECETTES");
  let i = 1;
  for (const meal of plan.meals) {
    if (seen.has(meal.recipeId)) continue;
    seen.add(meal.recipeId);
    const r = recipesById.get(meal.recipeId);
    if (!r) continue;
    const total = r.prepTimeMin + r.cookTimeMin;
    lines.push("");
    lines.push(`${i}. ${r.name} — ${ORIGIN_LABELS[r.origin]} · ${total} min · ${r.servings} portions · ${METHOD_LABELS[r.cookingMethod]}`);
    lines.push("Ingrédients :");
    for (const ing of r.ingredients) {
      lines.push(`  - ${ing.name} : ${ing.qty} ${ing.unit}`.trimEnd());
    }
    lines.push("Préparation :");
    r.instructions.forEach((step, idx) => lines.push(`  ${idx + 1}) ${step}`));
    i++;
  }
  return lines.join("\n");
}

/** Fiche complète : programme + courses + recettes. */
export function buildFullRecap(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
  servings: number,
): string {
  const sep = "\n\n━━━━━━━━━━━━━━━━━━━━\n\n";
  return [
    `🗓️ MENUS DE LA SEMAINE\n${formatWeekRange(plan.weekStart)}`,
    buildPlanText(plan, recipesById),
    buildShoppingText(plan, recipesById, servings),
    buildRecipesText(plan, recipesById),
  ].join(sep);
}

/**
 * Version compacte pour WhatsApp : programme + liste de courses + noms des
 * plats, sans les étapes détaillées. Tient dans un seul message (les liens
 * `wa.me` tronquent les textes trop longs). La fiche intégrale reste
 * disponible via le partage natif / la copie.
 */
export function buildCompactRecap(
  plan: WeekPlan,
  recipesById: Map<string, Recipe>,
  servings: number,
): string {
  const sep = "\n\n━━━━━━━━━━━━━━━━━━━━\n\n";
  return [
    `🗓️ MENUS DE LA SEMAINE\n${formatWeekRange(plan.weekStart)}`,
    buildPlanText(plan, recipesById),
    buildShoppingText(plan, recipesById, servings),
    "ℹ️ Recettes détaillées disponibles via « Partager la fiche ».",
  ].join(sep);
}
