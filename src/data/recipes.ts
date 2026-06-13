import type { Recipe } from "@/lib/types";
import { CURATED } from "./curated";
import generated from "../../public/recipes.generated.json";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue complet (curées + générées).
//
// ⚠️ Ce module importe le gros JSON et n'est utilisé que par les TESTS
// (accès synchrone). L'application cliente NE l'importe pas : elle charge
// `public/recipes.generated.json` via fetch (voir src/lib/store.tsx) afin de
// garder le bundle initial léger.
// ─────────────────────────────────────────────────────────────────────────────

export const GENERATED = generated as unknown as Recipe[];

export const RECIPES: Recipe[] = [...CURATED, ...GENERATED];

export default RECIPES;
