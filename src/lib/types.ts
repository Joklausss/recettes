// Domaine métier : types partagés par le seed, le générateur et l'UI.

export type Origin = "local" | "italian" | "asian" | "world";

export type Protein =
  | "red_meat"
  | "poultry"
  | "fish"
  | "legumes"
  | "eggs"
  | "veggie";

export type Base = "pasta" | "rice" | "potato" | "grains" | "bread" | "none";

export type CookingMethod =
  | "oven"
  | "pan"
  | "simmer"
  | "raw"
  | "soup"
  | "steam";

/** Rayon de courses pour regrouper la liste. */
export type IngredientCategory =
  | "legumes"
  | "fruits"
  | "frais"
  | "viande"
  | "poisson"
  | "epicerie"
  | "surgele"
  | "boulangerie"
  | "boissons";

export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
  /** Périssable → placé en début de semaine. */
  perishable?: boolean;
}

export interface Nutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface Recipe {
  id: string;
  name: string;
  origin: Origin;
  protein: Protein;
  base: Base;
  cookingMethod: CookingMethod;
  prepTimeMin: number;
  cookTimeMin: number;
  difficulty: 1 | 2 | 3;
  servings: number;
  batchFriendly: boolean;
  tags: string[];
  ingredients: Ingredient[];
  nutrition: Nutrition; // par portion
  instructions: string[];
  /** Ingrédient/légume vedette, pénalisé pour la variété. */
  featured?: string;
}

export type Slot = "lunch" | "dinner";

export interface Meal {
  /** 0 = lundi … 6 = dimanche */
  day: number;
  slot: Slot;
  recipeId: string;
  /** Repas issu d'un batch cooking (« restes » du dîner de la veille). */
  leftover: boolean;
  /** Repas verrouillé : conservé lors d'une régénération. */
  locked: boolean;
}

export interface WeekPlan {
  id: string;
  /** ISO date du lundi de la semaine. */
  weekStart: string;
  meals: Meal[];
  createdAt: string;
}

export interface OriginTargets {
  local: number;
  italian: number;
  asian: number;
  world: number;
}

export interface Preferences {
  servings: number;
  batchCookingEnabled: boolean;
  excludedIngredients: string[]; // noms en minuscules
  excludedRecipeIds: string[];
  favoriteRecipeIds: string[];
  originTargets: OriginTargets; // proportions (somme = 1)
}
