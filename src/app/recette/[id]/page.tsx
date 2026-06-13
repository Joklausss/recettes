"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { OriginBadge, Tag } from "@/components/ui";
import {
  BASE_LABELS,
  METHOD_LABELS,
  PROTEIN_LABELS,
} from "@/lib/config";

export default function RecipePage({ params }: { params: { id: string } }) {
  const store = useStore();

  if (!store.ready) {
    return <p className="pt-10 text-center text-slate-400">Chargement…</p>;
  }

  const recipe = store.recipesById.get(params.id);
  if (!recipe) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Recette introuvable.</p>
        <Link href="/" className="mt-3 inline-block text-blue-600">
          ← Retour au planning
        </Link>
      </div>
    );
  }

  const fav = store.isFavorite(recipe.id);
  const excluded = store.preferences.excludedRecipeIds.includes(recipe.id);
  const totalTime = recipe.prepTimeMin + recipe.cookTimeMin;

  return (
    <div>
      <Link href="/" className="mb-3 inline-block text-sm text-blue-600">
        ← Planning
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <OriginBadge origin={recipe.origin} />
        {recipe.batchFriendly && (
          <Tag className="bg-purple-100 text-purple-700">♻️ Batch</Tag>
        )}
        {recipe.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      <h1 className="text-2xl font-bold">{recipe.name}</h1>

      <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
        <span>⏱ {totalTime} min</span>
        <span>•</span>
        <span>👤 {recipe.servings} portions</span>
        <span>•</span>
        <span>{"🔥".repeat(recipe.difficulty)}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => store.toggleFavorite(recipe.id)}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium active:scale-95 ${
            fav
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {fav ? "★ Favori" : "☆ Ajouter aux favoris"}
        </button>
        <button
          onClick={() => store.toggleExcludedRecipe(recipe.id)}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium active:scale-95 ${
            excluded
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {excluded ? "🚫 Refusée" : "Refuser cette recette"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <NutriCell label="kcal" value={recipe.nutrition.kcal} />
        <NutriCell label="prot." value={`${recipe.nutrition.protein_g}g`} />
        <NutriCell label="gluc." value={`${recipe.nutrition.carbs_g}g`} />
        <NutriCell label="fibres" value={`${recipe.nutrition.fiber_g}g`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <Tag>Protéine : {PROTEIN_LABELS[recipe.protein]}</Tag>
        <Tag>Base : {BASE_LABELS[recipe.base]}</Tag>
        <Tag>Cuisson : {METHOD_LABELS[recipe.cookingMethod]}</Tag>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Ingrédients ({recipe.servings} portions)
        </h2>
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {recipe.ingredients.map((ing, i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0"
            >
              <span className="text-slate-800">{ing.name}</span>
              <span className="font-medium tabular-nums text-slate-600">
                {ing.qty} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Préparation
        </h2>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {i + 1}
              </span>
              <p className="text-sm text-slate-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function NutriCell({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-100 p-2">
      <div className="text-sm font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
