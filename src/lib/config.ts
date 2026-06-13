import type { OriginTargets, Preferences } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — Modifiez ces valeurs pour adapter l'application.
// (Voir le README, section « Personnalisation ».)
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre de repas générés par semaine : 7 jours × (déjeuner + dîner). */
export const MEALS_PER_WEEK = 14;
export const DAYS_PER_WEEK = 7;

/**
 * Répartition cible par origine (somme = 1).
 * Locale 40 % · Italienne 25 % · Asiatique 20 % · Du monde 15 %.
 * Pour changer la région « locale », adaptez surtout le seed (src/data/recipes.ts)
 * et, si besoin, ces pourcentages.
 */
export const DEFAULT_ORIGIN_TARGETS: OriginTargets = {
  local: 0.4,
  italian: 0.25,
  asian: 0.2,
  world: 0.15,
};

/** Nombre de portions par défaut (utilisé pour mettre les quantités à l'échelle). */
export const DEFAULT_SERVINGS = 4;

/** Batch cooking « cuisiner une fois, manger deux fois » activé par défaut. */
export const DEFAULT_BATCH_COOKING = true;

/** Fenêtre d'historique (semaines) sur laquelle on interdit la répétition d'une recette. */
export const NO_REPEAT_WEEKS = 4;

/** Cibles nutritionnelles hebdomadaires vérifiées/ajustées par le planificateur. */
export const NUTRITION_TARGETS = {
  fishMealsMin: 2,
  vegetarianMealsMin: 3,
  redMeatMealsMax: 3,
};

export const DEFAULT_PREFERENCES: Preferences = {
  servings: DEFAULT_SERVINGS,
  batchCookingEnabled: DEFAULT_BATCH_COOKING,
  excludedIngredients: [],
  excludedRecipeIds: [],
  favoriteRecipeIds: [],
  originTargets: DEFAULT_ORIGIN_TARGETS,
};

export const ORIGIN_LABELS: Record<string, string> = {
  local: "Locale",
  italian: "Italienne",
  asian: "Asiatique",
  world: "Du monde",
};

export const PROTEIN_LABELS: Record<string, string> = {
  red_meat: "Viande rouge",
  poultry: "Volaille",
  fish: "Poisson",
  legumes: "Légumineuses",
  eggs: "Œufs",
  veggie: "Végé",
};

export const BASE_LABELS: Record<string, string> = {
  pasta: "Pâtes",
  rice: "Riz",
  potato: "Pommes de terre",
  grains: "Céréales",
  bread: "Pain",
  none: "Sans féculent",
};

export const METHOD_LABELS: Record<string, string> = {
  oven: "Four",
  pan: "Poêle",
  simmer: "Mijoté",
  raw: "Cru / Salade",
  soup: "Soupe",
  steam: "Vapeur",
};

export const CATEGORY_LABELS: Record<string, string> = {
  legumes: "Légumes",
  fruits: "Fruits",
  frais: "Produits frais",
  viande: "Boucherie",
  poisson: "Poissonnerie",
  epicerie: "Épicerie",
  surgele: "Surgelés",
  boulangerie: "Boulangerie",
  boissons: "Boissons",
};

/** Ordre d'affichage des rayons dans la liste de courses. */
export const CATEGORY_ORDER: string[] = [
  "legumes",
  "fruits",
  "frais",
  "viande",
  "poisson",
  "boulangerie",
  "epicerie",
  "surgele",
  "boissons",
];
