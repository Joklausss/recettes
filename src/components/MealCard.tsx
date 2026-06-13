"use client";

import Link from "next/link";
import type { Meal, Recipe } from "@/lib/types";
import { OriginBadge, Tag } from "@/components/ui";

interface Props {
  meal: Meal;
  recipe: Recipe | undefined;
  onToggleLock: () => void;
  onRegenerate: () => void;
}

export function MealCard({ meal, recipe, onToggleLock, onRegenerate }: Props) {
  if (!recipe) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400">
        Aucune recette
      </div>
    );
  }

  const totalTime = recipe.prepTimeMin + recipe.cookTimeMin;

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm transition ${
        meal.locked ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/recette/${recipe.id}`} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <OriginBadge origin={recipe.origin} />
            {meal.leftover && (
              <Tag className="bg-purple-100 text-purple-700">♻️ Restes</Tag>
            )}
          </div>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-slate-900">
            {recipe.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>⏱ {totalTime} min</span>
            <span>•</span>
            <span>{recipe.nutrition.kcal} kcal</span>
          </div>
        </Link>

        <div className="flex flex-col gap-1">
          <button
            onClick={onToggleLock}
            aria-label={meal.locked ? "Déverrouiller" : "Verrouiller"}
            className={`rounded-lg p-2 text-base leading-none transition ${
              meal.locked
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {meal.locked ? "🔒" : "🔓"}
          </button>
          {!meal.leftover && (
            <button
              onClick={onRegenerate}
              aria-label="Régénérer ce repas"
              disabled={meal.locked}
              className="rounded-lg bg-slate-100 p-2 text-base leading-none text-slate-500 transition disabled:opacity-40"
            >
              🔄
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
