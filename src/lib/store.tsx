"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CURATED } from "@/data/curated";
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
// PERSISTANCE & ÉTAT GLOBAL (multi-semaines)
// Choix : localStorage. On conserve PLUSIEURS plans (un par semaine, indexés par
// le lundi ISO) + un pointeur `currentWeek`. L'historique no-repeat / la
// convergence des origines sont dérivés des semaines précédentes existantes.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "menus-hebdo-state-v1";

interface PersistedState {
  preferences: Preferences;
  customRecipes: Recipe[];
  /** Plans indexés par weekStart (lundi ISO, ex. "2026-06-08"). */
  plans: Record<string, WeekPlan>;
  /** Semaine actuellement affichée. */
  currentWeek: string;
}

function defaultState(): PersistedState {
  return {
    preferences: DEFAULT_PREFERENCES,
    customRecipes: [],
    plans: {},
    currentWeek: currentWeekStart(),
  };
}

/** Décale un weekStart (lundi ISO) de `weeks` semaines. */
function shiftWeekStart(weekStart: string, weeks: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return isoDate(d);
}

function load(): PersistedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const base = defaultState();
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(parsed.preferences as Partial<Preferences>),
    };
    const customRecipes = (parsed.customRecipes as Recipe[]) ?? [];

    // Migration depuis l'ancien format mono-semaine { plan, history }.
    if (parsed.plan && !parsed.plans) {
      const old = parsed.plan as WeekPlan;
      return {
        preferences,
        customRecipes,
        plans: { [old.weekStart]: old },
        currentWeek: old.weekStart,
      };
    }

    const plans = (parsed.plans as Record<string, WeekPlan>) ?? {};
    const currentWeek =
      (parsed.currentWeek as string) ||
      Object.keys(plans).sort().pop() ||
      base.currentWeek;
    return { preferences, customRecipes, plans, currentWeek };
  } catch {
    return defaultState();
  }
}

/** Historique (no-repeat + convergence) : jusqu'à N semaines avant `weekStart`. */
function buildHistory(
  plans: Record<string, WeekPlan>,
  weekStart: string,
  byId: Map<string, Recipe>,
): HistoryWeek[] {
  return Object.values(plans)
    .filter((p) => p.weekStart < weekStart)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, NO_REPEAT_WEEKS)
    .map((p) => ({
      weekStart: p.weekStart,
      recipeIds: Array.from(new Set(p.meals.map((m) => m.recipeId))),
      originCounts: originCountsOfPlan(p, byId),
    }));
}

interface StoreValue {
  preferences: Preferences;
  customRecipes: Recipe[];
  plans: Record<string, WeekPlan>;
  currentWeek: string;
  /** Plan de la semaine affichée (dérivé). */
  plan: WeekPlan | null;
  /** weekStarts ayant un plan, triés chronologiquement. */
  weeks: string[];
  hydrated: boolean;
  /** localStorage chargé ET recettes générées récupérées. */
  ready: boolean;
  allRecipes: Recipe[];
  recipesById: Map<string, Recipe>;
  generateWeek: () => void;
  regenerateWeek: () => void;
  regenerateMeal: (day: number, slot: Slot) => void;
  assignMeal: (day: number, slot: Slot, recipeId: string) => void;
  toggleLock: (day: number, slot: Slot) => void;
  goToWeek: (weekStart: string) => void;
  shiftWeek: (weeks: number) => void;
  goToToday: () => void;
  deleteWeek: (weekStart: string) => void;
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
  const [generated, setGenerated] = useState<Recipe[]>([]);
  const [recipesReady, setRecipesReady] = useState(false);
  const poolRef = useRef<Recipe[]>(CURATED);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  // Chargement asynchrone du gros catalogue (asset statique, mis en cache).
  useEffect(() => {
    let cancelled = false;
    fetch("/recipes.generated.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Recipe[]) => {
        if (cancelled) return;
        setGenerated(data);
        poolRef.current = [...CURATED, ...data];
        setRecipesReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRecipesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota plein / mode privé : on ignore
    }
  }, [state, hydrated]);

  const allRecipes = useMemo(
    () => [...CURATED, ...generated, ...state.customRecipes],
    [generated, state.customRecipes],
  );
  const recipesById = useMemo(
    () => new Map(allRecipes.map((r) => [r.id, r] as const)),
    [allRecipes],
  );

  // Options de génération communes (lues depuis l'état courant `s`).
  const genOptions = (s: PersistedState, weekStart: string) => {
    const all = [...poolRef.current, ...s.customRecipes];
    const byId = new Map(all.map((r) => [r.id, r] as const));
    return {
      recipes: all,
      originTargets: s.preferences.originTargets,
      history: buildHistory(s.plans, weekStart, byId),
      excludedIngredients: s.preferences.excludedIngredients,
      excludedRecipeIds: s.preferences.excludedRecipeIds,
      favoriteRecipeIds: s.preferences.favoriteRecipeIds,
      batchCookingEnabled: s.preferences.batchCookingEnabled,
      noRepeatWeeks: NO_REPEAT_WEEKS,
      weekStart,
      seed: Math.floor(Math.random() * 1_000_000),
    };
  };

  const generateWeek = useCallback(() => {
    setState((s) => {
      const weekStart = s.currentWeek;
      const plan = generateWeekPlan({ ...genOptions(s, weekStart), lockedMeals: [] });
      return { ...s, plans: { ...s.plans, [weekStart]: plan } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerateWeek = useCallback(() => {
    setState((s) => {
      const weekStart = s.currentWeek;
      const lockedMeals = s.plans[weekStart]?.meals.filter((m) => m.locked) ?? [];
      const plan = generateWeekPlan({ ...genOptions(s, weekStart), lockedMeals });
      return { ...s, plans: { ...s.plans, [weekStart]: plan } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerateMeal = useCallback((day: number, slot: Slot) => {
    setState((s) => {
      const existing = s.plans[s.currentWeek];
      if (!existing) return s;
      const plan = regenerateSingleMeal(
        existing,
        day,
        slot,
        genOptions(s, existing.weekStart),
      );
      return { ...s, plans: { ...s.plans, [s.currentWeek]: plan } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assignMeal = useCallback(
    (day: number, slot: Slot, recipeId: string) => {
      setState((s) => {
        const weekStart = s.currentWeek;
        const current = s.plans[weekStart];
        const existing = current?.meals ?? [];
        const replaced = existing.find((m) => m.day === day && m.slot === slot);
        const meals = existing.filter(
          (m) =>
            !(m.day === day && m.slot === slot) &&
            !(replaced && m.leftover && m.recipeId === replaced.recipeId),
        );
        meals.push({ day, slot, recipeId, leftover: false, locked: true });
        const plan: WeekPlan = {
          id: current?.id ?? `plan-${weekStart}`,
          weekStart,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          meals,
        };
        return { ...s, plans: { ...s.plans, [weekStart]: plan } };
      });
    },
    [],
  );

  const toggleLock = useCallback((day: number, slot: Slot) => {
    setState((s) => {
      const current = s.plans[s.currentWeek];
      if (!current) return s;
      const meals = current.meals.map((m) =>
        m.day === day && m.slot === slot ? { ...m, locked: !m.locked } : m,
      );
      return {
        ...s,
        plans: { ...s.plans, [s.currentWeek]: { ...current, meals } },
      };
    });
  }, []);

  const goToWeek = useCallback((weekStart: string) => {
    setState((s) => ({ ...s, currentWeek: weekStart }));
  }, []);

  const shiftWeek = useCallback((weeks: number) => {
    setState((s) => ({ ...s, currentWeek: shiftWeekStart(s.currentWeek, weeks) }));
  }, []);

  const goToToday = useCallback(() => {
    setState((s) => ({ ...s, currentWeek: currentWeekStart() }));
  }, []);

  const deleteWeek = useCallback((weekStart: string) => {
    setState((s) => {
      const plans = { ...s.plans };
      delete plans[weekStart];
      return { ...s, plans };
    });
  }, []);

  const toggleFavorite = useCallback((recipeId: string) => {
    setState((s) => {
      const favs = new Set(s.preferences.favoriteRecipeIds);
      if (favs.has(recipeId)) favs.delete(recipeId);
      else favs.add(recipeId);
      return {
        ...s,
        preferences: { ...s.preferences, favoriteRecipeIds: Array.from(favs) },
      };
    });
  }, []);

  const setPreferences = useCallback((partial: Partial<Preferences>) => {
    setState((s) => ({ ...s, preferences: { ...s.preferences, ...partial } }));
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
        preferences: { ...s.preferences, excludedRecipeIds: Array.from(ex) },
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

  const plan = state.plans[state.currentWeek] ?? null;
  const weeks = useMemo(() => Object.keys(state.plans).sort(), [state.plans]);

  const value: StoreValue = {
    preferences: state.preferences,
    customRecipes: state.customRecipes,
    plans: state.plans,
    currentWeek: state.currentWeek,
    plan,
    weeks,
    hydrated,
    ready: hydrated && recipesReady,
    allRecipes,
    recipesById,
    generateWeek,
    regenerateWeek,
    regenerateMeal,
    assignMeal,
    toggleLock,
    goToWeek,
    shiftWeek,
    goToToday,
    deleteWeek,
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
