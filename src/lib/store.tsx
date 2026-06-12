"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RECIPES } from "@/data/recipes";
import { DEFAULT_PREFERENCES, NO_REPEAT_WEEKS } from "@/lib/config";
import {
  generateWeekPlan,
  originCountsOfPlan,
  regenerateSingleMeal,
  type HistoryWeek,
} from "@/lib/generator";
import { currentWeekStart, isoDate } from "@/lib/date";
import type { Preferences, Recipe, Slot, WeekPlan } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTANCE & ÉTAT GLOBAL
// Choix : localStorage (voir README). Simple à déployer sur Vercel, aucun
// serveur ni base de données ; toute la logique tourne côté client.
// La logique de persistance est isolée ici pour pouvoir basculer vers une base
// (Prisma/SQLite) plus tard sans toucher à l'UI.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "menus-hebdo-state-v1";

interface PersistedState {
  preferences: Preferences;
  customRecipes: Recipe[];
  plan: WeekPlan | null;
  history: HistoryWeek[];
}

function defaultState(): PersistedState {
  return {
    preferences: DEFAULT_PREFERENCES,
    customRecipes: [],
    plan: null,
    history: [],
  };
}

function load(): PersistedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...defaultState(),
      ...parsed,
      preferences: { ...DEFAULT_PREFERENCES, ...parsed.preferences },
    };
  } catch {
    return defaultState();
  }
}

interface StoreValue extends PersistedState {
  hydrated: boolean;
  allRecipes: Recipe[];
  recipesById: Map<string, Recipe>;
  regenerateWeek: () => void;
  newWeek: () => void;
  regenerateMeal: (day: number, slot: Slot) => void;
  toggleLock: (day: number, slot: Slot) => void;
  toggleFavorite: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;
  setPreferences: (partial: Partial<Preferences>) => void;
  addExcludedIngredient: (name: string) => void;
  removeExcludedIngredient: (name: string) => void;
  toggleExcludedRecipe: (recipeId: string) => void;
  addCustomRecipe: (recipe: Recipe) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  // Persiste à chaque changement (après hydratation).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota plein / mode privé : on ignore silencieusement
    }
  }, [state, hydrated]);

  const allRecipes = useMemo(
    () => [...RECIPES, ...state.customRecipes],
    [state.customRecipes],
  );
  const recipesById = useMemo(
    () => new Map(allRecipes.map((r) => [r.id, r] as const)),
    [allRecipes],
  );

  const regenerateWeek = useCallback(() => {
    setState((s) => {
      const weekStart = s.plan?.weekStart ?? currentWeekStart();
      const lockedMeals =
        s.plan?.meals.filter((m) => m.locked) ?? [];
      const plan = generateWeekPlan({
        recipes: [...RECIPES, ...s.customRecipes],
        originTargets: s.preferences.originTargets,
        history: s.history,
        lockedMeals,
        excludedIngredients: s.preferences.excludedIngredients,
        excludedRecipeIds: s.preferences.excludedRecipeIds,
        favoriteRecipeIds: s.preferences.favoriteRecipeIds,
        batchCookingEnabled: s.preferences.batchCookingEnabled,
        noRepeatWeeks: NO_REPEAT_WEEKS,
        weekStart,
        seed: Math.floor(Math.random() * 1_000_000),
      });
      return { ...s, plan };
    });
  }, []);

  const newWeek = useCallback(() => {
    setState((s) => {
      const all = [...RECIPES, ...s.customRecipes];
      const byId = new Map(all.map((r) => [r.id, r] as const));
      // Archive le plan courant dans l'historique.
      let history = s.history;
      let weekStart = currentWeekStart();
      if (s.plan) {
        const archived: HistoryWeek = {
          weekStart: s.plan.weekStart,
          recipeIds: Array.from(
            new Set(s.plan.meals.map((m) => m.recipeId)),
          ),
          originCounts: originCountsOfPlan(s.plan, byId),
        };
        history = [archived, ...s.history].slice(0, NO_REPEAT_WEEKS);
        const next = new Date(s.plan.weekStart);
        next.setDate(next.getDate() + 7);
        weekStart = isoDate(next);
      }
      const plan = generateWeekPlan({
        recipes: all,
        originTargets: s.preferences.originTargets,
        history,
        lockedMeals: [],
        excludedIngredients: s.preferences.excludedIngredients,
        excludedRecipeIds: s.preferences.excludedRecipeIds,
        favoriteRecipeIds: s.preferences.favoriteRecipeIds,
        batchCookingEnabled: s.preferences.batchCookingEnabled,
        noRepeatWeeks: NO_REPEAT_WEEKS,
        weekStart,
        seed: Math.floor(Math.random() * 1_000_000),
      });
      return { ...s, plan, history };
    });
  }, []);

  const regenerateMeal = useCallback((day: number, slot: Slot) => {
    setState((s) => {
      if (!s.plan) return s;
      const plan = regenerateSingleMeal(s.plan, day, slot, {
        recipes: [...RECIPES, ...s.customRecipes],
        originTargets: s.preferences.originTargets,
        history: s.history,
        excludedIngredients: s.preferences.excludedIngredients,
        excludedRecipeIds: s.preferences.excludedRecipeIds,
        favoriteRecipeIds: s.preferences.favoriteRecipeIds,
        batchCookingEnabled: s.preferences.batchCookingEnabled,
        noRepeatWeeks: NO_REPEAT_WEEKS,
        weekStart: s.plan.weekStart,
      });
      return { ...s, plan };
    });
  }, []);

  const toggleLock = useCallback((day: number, slot: Slot) => {
    setState((s) => {
      if (!s.plan) return s;
      const meals = s.plan.meals.map((m) =>
        m.day === day && m.slot === slot ? { ...m, locked: !m.locked } : m,
      );
      return { ...s, plan: { ...s.plan, meals } };
    });
  }, []);

  const toggleFavorite = useCallback((recipeId: string) => {
    setState((s) => {
      const favs = new Set(s.preferences.favoriteRecipeIds);
      if (favs.has(recipeId)) favs.delete(recipeId);
      else favs.add(recipeId);
      return {
        ...s,
        preferences: {
          ...s.preferences,
          favoriteRecipeIds: Array.from(favs),
        },
      };
    });
  }, []);

  const setPreferences = useCallback((partial: Partial<Preferences>) => {
    setState((s) => ({
      ...s,
      preferences: { ...s.preferences, ...partial },
    }));
  }, []);

  const addExcludedIngredient = useCallback((name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return;
    setState((s) => {
      if (s.preferences.excludedIngredients.includes(n)) return s;
      return {
        ...s,
        preferences: {
          ...s.preferences,
          excludedIngredients: [...s.preferences.excludedIngredients, n],
        },
      };
    });
  }, []);

  const removeExcludedIngredient = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      preferences: {
        ...s.preferences,
        excludedIngredients: s.preferences.excludedIngredients.filter(
          (x) => x !== name,
        ),
      },
    }));
  }, []);

  const toggleExcludedRecipe = useCallback((recipeId: string) => {
    setState((s) => {
      const ex = new Set(s.preferences.excludedRecipeIds);
      if (ex.has(recipeId)) ex.delete(recipeId);
      else ex.add(recipeId);
      return {
        ...s,
        preferences: {
          ...s.preferences,
          excludedRecipeIds: Array.from(ex),
        },
      };
    });
  }, []);

  const addCustomRecipe = useCallback((recipe: Recipe) => {
    setState((s) => ({ ...s, customRecipes: [...s.customRecipes, recipe] }));
  }, []);

  const isFavorite = useCallback(
    (recipeId: string) => state.preferences.favoriteRecipeIds.includes(recipeId),
    [state.preferences.favoriteRecipeIds],
  );

  const value: StoreValue = {
    ...state,
    hydrated,
    allRecipes,
    recipesById,
    regenerateWeek,
    newWeek,
    regenerateMeal,
    toggleLock,
    toggleFavorite,
    isFavorite,
    setPreferences,
    addExcludedIngredient,
    removeExcludedIngredient,
    toggleExcludedRecipe,
    addCustomRecipe,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return ctx;
}
