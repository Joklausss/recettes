"use client";

import { useStore } from "@/lib/store";
import { MealCard } from "@/components/MealCard";
import { DAY_NAMES, formatWeekRange } from "@/lib/date";
import type { Slot } from "@/lib/types";

const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "lunch", label: "Midi" },
  { slot: "dinner", label: "Soir" },
];

export default function PlanningPage() {
  const store = useStore();

  if (!store.hydrated) {
    return <LoadingState />;
  }

  if (!store.plan) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-5xl">🍽️</div>
        <h1 className="text-xl font-bold">Menus de la semaine</h1>
        <p className="max-w-xs text-sm text-slate-500">
          Générez 14 repas équilibrés (déjeuner + dîner sur 7 jours), variés et
          optimisés pour cuisiner efficacement.
        </p>
        <button
          onClick={store.newWeek}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm active:scale-95"
        >
          Générer ma semaine
        </button>
      </div>
    );
  }

  const { plan, recipesById } = store;

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Ma semaine</h1>
          <p className="text-sm text-slate-500">
            {formatWeekRange(plan.weekStart)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={store.regenerateWeek}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 active:scale-95"
            title="Régénérer la semaine (conserve les repas verrouillés)"
          >
            🔄 Régénérer
          </button>
          <button
            onClick={store.newWeek}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white active:scale-95"
            title="Archiver et passer à une nouvelle semaine"
          >
            ＋ Nouvelle
          </button>
        </div>
      </header>

      <div className="space-y-5">
        {DAY_NAMES.map((dayName, day) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {dayName}
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {SLOTS.map(({ slot, label }) => {
                const meal = plan.meals.find(
                  (m) => m.day === day && m.slot === slot,
                );
                if (!meal) return null;
                return (
                  <div key={slot}>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {label}
                    </div>
                    <MealCard
                      meal={meal}
                      recipe={recipesById.get(meal.recipeId)}
                      onToggleLock={() => store.toggleLock(day, slot)}
                      onRegenerate={() => store.regenerateMeal(day, slot)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl bg-slate-200/70"
        />
      ))}
    </div>
  );
}
