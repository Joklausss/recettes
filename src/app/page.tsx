"use client";

import { useStore } from "@/lib/store";
import { MealCard } from "@/components/MealCard";
import {
  DAY_NAMES,
  formatWeekRange,
  currentWeekStart,
} from "@/lib/date";
import type { Slot } from "@/lib/types";

const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "lunch", label: "Midi" },
  { slot: "dinner", label: "Soir" },
];

function shortLabel(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export default function PlanningPage() {
  const store = useStore();

  if (!store.ready) {
    return <LoadingState />;
  }

  const { plan, recipesById, currentWeek } = store;
  const isThisWeek = currentWeek === currentWeekStart();

  // Bandeau de sélection des semaines (existantes + semaine courante).
  const weekTabs = Array.from(new Set([...store.weeks, currentWeek])).sort();

  return (
    <div>
      {/* Navigation entre semaines */}
      <header className="mb-3">
        <div className="flex items-center justify-between">
          <NavBtn onClick={() => store.shiftWeek(-1)} aria="Semaine précédente">
            ‹
          </NavBtn>
          <div className="text-center">
            <h1 className="text-lg font-bold leading-tight">
              {isThisWeek ? "Cette semaine" : "Semaine"}
            </h1>
            <p className="text-xs text-slate-500">
              {formatWeekRange(currentWeek)}
            </p>
          </div>
          <NavBtn onClick={() => store.shiftWeek(1)} aria="Semaine suivante">
            ›
          </NavBtn>
        </div>

        {!isThisWeek && (
          <div className="mt-1 text-center">
            <button
              onClick={store.goToToday}
              className="text-xs font-medium text-blue-600"
            >
              ↩ Revenir à cette semaine
            </button>
          </div>
        )}

        {/* Pastilles des semaines planifiées */}
        {weekTabs.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {weekTabs.map((ws) => {
              const active = ws === currentWeek;
              const hasPlan = !!store.plans[ws];
              return (
                <button
                  key={ws}
                  onClick={() => store.goToWeek(ws)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                    active
                      ? "border-blue-500 bg-blue-500 text-white"
                      : hasPlan
                        ? "border-slate-300 bg-white text-slate-600"
                        : "border-dashed border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {shortLabel(ws)}
                  {ws === currentWeekStart() && " •"}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {!plan ? (
        <EmptyWeek onGenerate={store.generateWeek} />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={store.regenerateWeek}
              className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 active:scale-95"
              title="Régénérer (conserve les repas verrouillés)"
            >
              🔄 Régénérer
            </button>
            <button
              onClick={() => {
                if (confirm("Supprimer le plan de cette semaine ?"))
                  store.deleteWeek(currentWeek);
              }}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500 active:scale-95"
              aria-label="Supprimer la semaine"
            >
              🗑
            </button>
          </div>

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
                    return (
                      <div key={slot}>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                          {label}
                        </div>
                        {meal ? (
                          <MealCard
                            meal={meal}
                            recipe={recipesById.get(meal.recipeId)}
                            onToggleLock={() => store.toggleLock(day, slot)}
                            onRegenerate={() => store.regenerateMeal(day, slot)}
                          />
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400">
                            Créneau libre · ajoutez une recette depuis le
                            catalogue
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyWeek({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="text-5xl">🍽️</div>
      <p className="max-w-xs text-sm text-slate-500">
        Aucun menu pour cette semaine. Générez 14 repas équilibrés et variés, ou
        ajoutez des recettes depuis le catalogue.
      </p>
      <button
        onClick={onGenerate}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm active:scale-95"
      >
        Générer cette semaine
      </button>
    </div>
  );
}

function NavBtn({
  children,
  onClick,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  aria: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-600 active:scale-95"
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
      ))}
    </div>
  );
}
