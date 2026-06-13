import type {
  Meal,
  Origin,
  Recipe,
  Slot,
  WeekPlan,
} from "./types";
import {
  DAYS_PER_WEEK,
  MEALS_PER_WEEK,
  NUTRITION_TARGETS,
} from "./config";
import type { OriginTargets } from "./types";
import { computeOriginCounts, ORIGINS } from "./origin";
import { createRng, seedFromString, type Rng } from "./rng";

// ─────────────────────────────────────────────────────────────────────────────
// GÉNÉRATEUR DE PLAN HEBDOMADAIRE
//
// Module pur et isolé (aucune dépendance UI / stockage) afin d'être testable.
// Sélectionne 14 repas sous contrainte de répartition par origine et d'équilibre
// nutritionnel, en optimisant un score variété ↔ efficacité.
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryWeek {
  weekStart: string;
  recipeIds: string[];
  /** Repas par origine cette semaine-là (pour la convergence des moyennes). */
  originCounts: Record<Origin, number>;
}

export interface GenerateOptions {
  recipes: Recipe[];
  originTargets: OriginTargets;
  /** Historique récent (semaines précédentes) — du plus récent au plus ancien. */
  history?: HistoryWeek[];
  /** Repas déjà verrouillés à conserver (par jour+créneau). */
  lockedMeals?: Meal[];
  excludedIngredients?: string[];
  excludedRecipeIds?: string[];
  favoriteRecipeIds?: string[];
  batchCookingEnabled?: boolean;
  /** Fenêtre (semaines) d'interdiction de répétition d'une recette. */
  noRepeatWeeks?: number;
  weekStart?: string;
  /** Graine explicite (sinon dérivée de weekStart). */
  seed?: number;
}

// Poids du score (variété ↔ efficacité ↔ nutrition).
const W = {
  favorite: 4,
  proteinRepeat: 3,
  baseRepeat: 2.2,
  methodRepeat: 1.6,
  featuredRepeat: 2.5,
  sharedIngredient: 0.8,
  nutritionUrgency: 5,
  perishableEarly: 1.2,
  prepTimeWeekday: 0.05,
  jitter: 0.5,
};

interface Chosen {
  recipe: Recipe;
  day: number;
  slot: Slot;
}

const SLOTS: Slot[] = ["lunch", "dinner"];

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function recipeHasExcludedIngredient(
  recipe: Recipe,
  excluded: Set<string>,
): boolean {
  if (excluded.size === 0) return false;
  return recipe.ingredients.some((ing) => {
    const n = normalize(ing.name);
    for (const ex of excluded) {
      if (n.includes(ex)) return true;
    }
    return false;
  });
}

function countPerishable(recipe: Recipe): number {
  return recipe.ingredients.filter((i) => i.perishable).length;
}

/** Score de variété : pénalise les répétitions avec les recettes déjà choisies. */
function varietyPenalty(candidate: Recipe, chosen: Chosen[]): number {
  let penalty = 0;
  for (const c of chosen) {
    if (c.recipe.protein === candidate.protein) penalty += W.proteinRepeat;
    if (c.recipe.base !== "none" && c.recipe.base === candidate.base)
      penalty += W.baseRepeat;
    if (c.recipe.cookingMethod === candidate.cookingMethod)
      penalty += W.methodRepeat;
    if (
      candidate.featured &&
      c.recipe.featured &&
      normalize(candidate.featured) === normalize(c.recipe.featured)
    )
      penalty += W.featuredRepeat;
  }
  return penalty;
}

/** Bonus d'efficacité : ingrédients partagés avec les recettes déjà retenues. */
function sharingBonus(
  candidate: Recipe,
  chosenIngredients: Map<string, number>,
): number {
  let bonus = 0;
  for (const ing of candidate.ingredients) {
    const n = normalize(ing.name);
    if (chosenIngredients.has(n)) bonus += W.sharedIngredient;
  }
  return bonus;
}

interface NutritionState {
  fish: number;
  veg: number;
  redMeat: number;
}

function isVegetarian(r: Recipe): boolean {
  return (
    r.protein === "veggie" ||
    r.protein === "legumes" ||
    r.protein === "eggs" ||
    r.tags.includes("vegetarian")
  );
}

/**
 * Urgence nutritionnelle : pousse poisson / végétarien lorsqu'on est en retard
 * sur les cibles hebdomadaires compte tenu des repas restants.
 */
function nutritionScore(
  candidate: Recipe,
  state: NutritionState,
  slotsRemaining: number,
): number {
  let score = 0;

  const fishNeed = NUTRITION_TARGETS.fishMealsMin - state.fish;
  if (fishNeed > 0 && candidate.protein === "fish") {
    score += W.nutritionUrgency * (fishNeed / Math.max(1, slotsRemaining));
  }

  const vegNeed = NUTRITION_TARGETS.vegetarianMealsMin - state.veg;
  if (vegNeed > 0 && isVegetarian(candidate)) {
    score += W.nutritionUrgency * (vegNeed / Math.max(1, slotsRemaining));
  }

  return score;
}

/** Le slot peut-il accueillir un candidat « viande rouge » sans dépasser le max ? */
function redMeatAllowed(candidate: Recipe, state: NutritionState): boolean {
  if (candidate.protein !== "red_meat") return true;
  return state.redMeat < NUTRITION_TARGETS.redMeatMealsMax;
}

interface Candidate {
  recipe: Recipe;
  score: number;
}

function addIngredients(map: Map<string, number>, recipe: Recipe) {
  for (const ing of recipe.ingredients) {
    const n = normalize(ing.name);
    map.set(n, (map.get(n) ?? 0) + 1);
  }
}

function updateNutrition(state: NutritionState, recipe: Recipe) {
  if (recipe.protein === "fish") state.fish++;
  if (isVegetarian(recipe)) state.veg++;
  if (recipe.protein === "red_meat") state.redMeat++;
}

/**
 * Génère un plan de 14 repas.
 *
 * Déroulé :
 *  1. Filtre les recettes éligibles (exclusions, allergies, non-répétition récente).
 *  2. Calcule la répartition par origine (avec compensation de l'historique).
 *  3. Intègre les repas verrouillés.
 *  4. Sélectionne créneau par créneau la meilleure recette (score variété ↔ efficacité).
 *  5. Applique le batch cooking (« cuisiner une fois, manger deux fois »).
 */
export function generateWeekPlan(options: GenerateOptions): WeekPlan {
  const {
    recipes,
    originTargets,
    history = [],
    lockedMeals = [],
    excludedIngredients = [],
    excludedRecipeIds = [],
    favoriteRecipeIds = [],
    batchCookingEnabled = true,
    noRepeatWeeks = 4,
    weekStart = new Date().toISOString().slice(0, 10),
  } = options;

  const rng = createRng(options.seed ?? seedFromString(weekStart));
  const excludedIng = new Set(excludedIngredients.map(normalize));
  const excludedIds = new Set(excludedRecipeIds);
  const favorites = new Set(favoriteRecipeIds);

  // Recettes utilisées récemment (fenêtre de non-répétition).
  const recentRecipeIds = new Set<string>();
  history.slice(0, noRepeatWeeks).forEach((w) => {
    w.recipeIds.forEach((id) => recentRecipeIds.add(id));
  });

  // Pool de base : pas exclues, pas d'ingrédient interdit.
  const basePool = recipes.filter(
    (r) =>
      !excludedIds.has(r.id) && !recipeHasExcludedIngredient(r, excludedIng),
  );
  // Pool prioritaire : sans recette récente. Sinon on retombe sur basePool.
  const freshPool = basePool.filter((r) => !recentRecipeIds.has(r.id));

  // Répartition par origine pour 14 repas.
  const histAgg = history.slice(0, noRepeatWeeks).reduce(
    (acc, w) => {
      for (const o of ORIGINS) acc.counts[o] += w.originCounts[o] ?? 0;
      acc.weeks++;
      return acc;
    },
    { weeks: 0, counts: { local: 0, italian: 0, asian: 0, world: 0 } as Record<Origin, number> },
  );
  const originCounts = computeOriginCounts(
    originTargets,
    MEALS_PER_WEEK,
    histAgg,
  );

  // Grille des créneaux (calendrier).
  const lockedByKey = new Map<string, Meal>();
  for (const m of lockedMeals) {
    if (m.locked) lockedByKey.set(`${m.day}-${m.slot}`, m);
  }

  const remainingOrigin = { ...originCounts };
  const chosen: Chosen[] = [];
  const chosenIngredients = new Map<string, number>();
  const nutrition: NutritionState = { fish: 0, veg: 0, redMeat: 0 };
  const usedThisWeek = new Set<string>();
  const meals: Meal[] = [];
  // Slots réservés au batch cooking : clé "day-slot" → recette de la veille.
  const leftoverSlots = new Map<string, Recipe>();

  const byId = new Map(recipes.map((r) => [r.id, r] as const));

  // Favoris : on les ajoute au score via un boost direct sur le pool.
  const favoriteBoost = (r: Recipe) => (favorites.has(r.id) ? W.favorite : 0);

  let slotsRemaining = MEALS_PER_WEEK;

  // Pré-comptage des repas verrouillés (origine + nutrition + variété).
  for (const m of lockedMeals) {
    const r = byId.get(m.recipeId);
    if (!r || !m.locked) continue;
    remainingOrigin[r.origin] = Math.max(0, remainingOrigin[r.origin] - 1);
  }

  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    for (const slot of SLOTS) {
      const key = `${day}-${slot}`;

      // 1) Repas verrouillé.
      const locked = lockedByKey.get(key);
      if (locked) {
        const r = byId.get(locked.recipeId);
        meals.push({ ...locked, leftover: locked.leftover });
        if (r) {
          chosen.push({ recipe: r, day, slot });
          addIngredients(chosenIngredients, r);
          updateNutrition(nutrition, r);
          usedThisWeek.add(r.id);
        }
        slotsRemaining--;
        continue;
      }

      // 2) Slot « restes » (batch cooking de la veille).
      const leftover = leftoverSlots.get(key);
      if (leftover) {
        meals.push({
          day,
          slot,
          recipeId: leftover.id,
          leftover: true,
          locked: false,
        });
        remainingOrigin[leftover.origin] = Math.max(
          0,
          remainingOrigin[leftover.origin] - 1,
        );
        slotsRemaining--;
        continue;
      }

      // 3) Choix de l'origine à servir : celle dont il reste le plus à pourvoir.
      const origin = pickOrigin(remainingOrigin, rng);
      if (!origin) {
        // Sécurité : plus de quota → on prend n'importe quelle origine restante.
        slotsRemaining--;
        continue;
      }

      // 4) Sélection de la recette (pool frais, sinon repli sur le pool de base).
      let recipe = pickBestWithFavorites(
        origin,
        freshPool,
        usedThisWeek,
        chosen,
        chosenIngredients,
        nutrition,
        day,
        slotsRemaining,
        rng,
        favoriteBoost,
      );
      if (!recipe) {
        recipe = pickBestWithFavorites(
          origin,
          basePool,
          usedThisWeek,
          chosen,
          chosenIngredients,
          nutrition,
          day,
          slotsRemaining,
          rng,
          favoriteBoost,
        );
      }
      if (!recipe) {
        // Aucune recette disponible pour cette origine : on abandonne le quota.
        remainingOrigin[origin] = 0;
        slotsRemaining--;
        continue;
      }

      meals.push({
        day,
        slot,
        recipeId: recipe.id,
        leftover: false,
        locked: false,
      });
      remainingOrigin[origin] = Math.max(0, remainingOrigin[origin] - 1);
      chosen.push({ recipe, day, slot });
      addIngredients(chosenIngredients, recipe);
      updateNutrition(nutrition, recipe);
      usedThisWeek.add(recipe.id);
      slotsRemaining--;

      // 5) Batch cooking : un dîner batchFriendly couvre le déjeuner du lendemain.
      if (
        batchCookingEnabled &&
        recipe.batchFriendly &&
        slot === "dinner" &&
        day + 1 < DAYS_PER_WEEK
      ) {
        const nextKey = `${day + 1}-lunch`;
        if (
          !lockedByKey.has(nextKey) &&
          !leftoverSlots.has(nextKey) &&
          remainingOrigin[recipe.origin] > 0
        ) {
          leftoverSlots.set(nextKey, recipe);
        }
      }
    }
  }

  return {
    id: `plan-${weekStart}`,
    weekStart,
    meals,
    createdAt: new Date().toISOString(),
  };
}

/** Choisit l'origine la plus en retard sur son quota (tie-break aléatoire). */
function pickOrigin(
  remaining: Record<Origin, number>,
  rng: Rng,
): Origin | null {
  const available = ORIGINS.filter((o) => remaining[o] > 0);
  if (available.length === 0) return null;
  available.sort((a, b) => remaining[b] - remaining[a] || rng() - 0.5);
  return available[0];
}

function pickBestWithFavorites(
  origin: Origin,
  pool: Recipe[],
  usedThisWeek: Set<string>,
  chosen: Chosen[],
  chosenIngredients: Map<string, number>,
  nutrition: NutritionState,
  day: number,
  slotsRemaining: number,
  rng: Rng,
  favoriteBoost: (r: Recipe) => number,
): Recipe | null {
  // On réutilise pickBest mais en injectant le boost favori via un tri secondaire.
  const candidates: Candidate[] = [];
  for (const recipe of pool) {
    if (recipe.origin !== origin) continue;
    if (usedThisWeek.has(recipe.id)) continue;
    if (!redMeatAllowed(recipe, nutrition)) continue;

    let score = favoriteBoost(recipe);
    score -= varietyPenalty(recipe, chosen);
    score += sharingBonus(recipe, chosenIngredients);
    score += nutritionScore(recipe, nutrition, slotsRemaining);

    const perishable = countPerishable(recipe);
    const weekProgress = day / (DAYS_PER_WEEK - 1);
    score += W.perishableEarly * perishable * (0.5 - weekProgress);
    score -= W.prepTimeWeekday * (recipe.prepTimeMin + recipe.cookTimeMin) * 0.1;
    score += rng() * W.jitter;

    candidates.push({ recipe, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].recipe;
}

/**
 * Régénère un seul repas (jour + créneau) en conservant tous les autres.
 * Les autres repas sont verrouillés ; la recette actuelle du créneau ciblé est
 * exclue pour garantir un changement.
 */
export function regenerateSingleMeal(
  plan: WeekPlan,
  day: number,
  slot: Slot,
  options: Omit<GenerateOptions, "lockedMeals">,
): WeekPlan {
  const current = plan.meals.find((m) => m.day === day && m.slot === slot);
  const lockedMeals: Meal[] = plan.meals
    .filter((m) => !(m.day === day && m.slot === slot))
    // Ne pas verrouiller un « reste » dépendant du dîner qu'on régénère.
    .filter((m) => !(m.leftover && current && m.recipeId === current.recipeId))
    .map((m) => ({ ...m, locked: true }));

  const excludedRecipeIds = [
    ...(options.excludedRecipeIds ?? []),
    ...(current ? [current.recipeId] : []),
  ];

  const regenerated = generateWeekPlan({
    ...options,
    lockedMeals,
    excludedRecipeIds,
    // Nouvelle graine pour varier le tirage.
    seed: (options.seed ?? 0) + Math.floor(Math.random() * 1_000_000) + 1,
  });

  // Conserve les métadonnées du plan d'origine.
  return { ...plan, meals: regenerated.meals };
}

/** Compte les repas par origine d'un plan (utile pour le récap et l'historique). */
export function originCountsOfPlan(
  plan: WeekPlan,
  byId: Map<string, Recipe>,
): Record<Origin, number> {
  const counts: Record<Origin, number> = {
    local: 0,
    italian: 0,
    asian: 0,
    world: 0,
  };
  for (const m of plan.meals) {
    const r = byId.get(m.recipeId);
    if (r) counts[r.origin]++;
  }
  return counts;
}
