import type {
  Base,
  CookingMethod,
  Origin,
  Protein,
  Recipe,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// RECHERCHE & FILTRES — module pur et testable.
// Filtre le catalogue par texte (nom, ingrédients, tags) et par critères
// (origine, protéine, base, cuisson, temps, végé/poisson, favoris).
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipeQuery {
  text?: string;
  origins?: Origin[];
  proteins?: Protein[];
  bases?: Base[];
  methods?: CookingMethod[];
  /** Temps total max (prep + cuisson) en minutes. */
  maxTotalTime?: number;
  vegetarianOnly?: boolean;
  fishOnly?: boolean;
  favoritesOnly?: boolean;
  favoriteIds?: string[];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

function isVegetarian(r: Recipe): boolean {
  return (
    r.protein === "veggie" ||
    r.protein === "legumes" ||
    r.protein === "eggs" ||
    r.tags.includes("vegetarian")
  );
}

/** Texte indexé d'une recette (nom + tags + ingrédient vedette + ingrédients). */
function haystack(r: Recipe): string {
  return normalize(
    [
      r.name,
      r.featured ?? "",
      r.tags.join(" "),
      r.ingredients.map((i) => i.name).join(" "),
    ].join(" "),
  );
}

function matchesText(r: Recipe, text: string): boolean {
  const tokens = normalize(text).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = haystack(r);
  return tokens.every((t) => hay.includes(t));
}

export function filterRecipes(recipes: Recipe[], q: RecipeQuery): Recipe[] {
  const favs = new Set(q.favoriteIds ?? []);
  return recipes.filter((r) => {
    if (q.text && !matchesText(r, q.text)) return false;
    if (q.origins?.length && !q.origins.includes(r.origin)) return false;
    if (q.proteins?.length && !q.proteins.includes(r.protein)) return false;
    if (q.bases?.length && !q.bases.includes(r.base)) return false;
    if (q.methods?.length && !q.methods.includes(r.cookingMethod)) return false;
    if (
      q.maxTotalTime != null &&
      r.prepTimeMin + r.cookTimeMin > q.maxTotalTime
    )
      return false;
    if (q.vegetarianOnly && !isVegetarian(r)) return false;
    if (q.fishOnly && r.protein !== "fish") return false;
    if (q.favoritesOnly && !favs.has(r.id)) return false;
    return true;
  });
}

/** Tri : favoris d'abord, puis ordre alphabétique (fr). */
export function sortRecipes(
  recipes: Recipe[],
  favoriteIds: string[] = [],
): Recipe[] {
  const favs = new Set(favoriteIds);
  return [...recipes].sort((a, b) => {
    const fa = favs.has(a.id) ? 0 : 1;
    const fb = favs.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.name.localeCompare(b.name, "fr");
  });
}
