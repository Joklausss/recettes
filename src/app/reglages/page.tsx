"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { computeOriginCounts } from "@/lib/origin";
import { MEALS_PER_WEEK, ORIGIN_LABELS } from "@/lib/config";
import type { Origin } from "@/lib/types";

const ORIGINS: Origin[] = ["local", "italian", "asian", "world"];

export default function ReglagesPage() {
  const store = useStore();
  const [ingredient, setIngredient] = useState("");

  if (!store.hydrated) {
    return <p className="pt-10 text-center text-slate-400">Chargement…</p>;
  }

  const { preferences } = store;
  const previewCounts = computeOriginCounts(
    preferences.originTargets,
    MEALS_PER_WEEK,
  );

  const setServings = (delta: number) =>
    store.setPreferences({
      servings: Math.min(12, Math.max(1, preferences.servings + delta)),
    });

  const setOrigin = (origin: Origin, pct: number) =>
    store.setPreferences({
      originTargets: { ...preferences.originTargets, [origin]: pct / 100 },
    });

  const favorites = store.allRecipes.filter((r) =>
    preferences.favoriteRecipeIds.includes(r.id),
  );
  const refused = store.allRecipes.filter((r) =>
    preferences.excludedRecipeIds.includes(r.id),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Réglages</h1>

      {/* Portions */}
      <Card title="Portions par repas">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            Quantités de la liste de courses
          </span>
          <div className="flex items-center gap-3">
            <Stepper onClick={() => setServings(-1)}>−</Stepper>
            <span className="w-6 text-center text-lg font-bold tabular-nums">
              {preferences.servings}
            </span>
            <Stepper onClick={() => setServings(1)}>＋</Stepper>
          </div>
        </div>
      </Card>

      {/* Batch cooking */}
      <Card title="Batch cooking">
        <label className="flex items-center justify-between">
          <span className="pr-4 text-sm text-slate-600">
            « Cuisiner une fois, manger deux fois » : un dîner couvre le déjeuner
            du lendemain (repas « restes »).
          </span>
          <input
            type="checkbox"
            checked={preferences.batchCookingEnabled}
            onChange={(e) =>
              store.setPreferences({ batchCookingEnabled: e.target.checked })
            }
            className="h-6 w-6 shrink-0 accent-blue-600"
          />
        </label>
      </Card>

      {/* Répartition par origine */}
      <Card title="Répartition par origine">
        <div className="space-y-4">
          {ORIGINS.map((o) => (
            <div key={o}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{ORIGIN_LABELS[o]}</span>
                <span className="tabular-nums text-slate-500">
                  {Math.round(preferences.originTargets[o] * 100)}% ·{" "}
                  {previewCounts[o]} repas
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(preferences.originTargets[o] * 100)}
                onChange={(e) => setOrigin(o, Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">
            Les proportions sont normalisées automatiquement pour aboutir à 14
            repas.
          </p>
        </div>
      </Card>

      {/* Exclusions / allergies */}
      <Card title="Ingrédients exclus / allergies">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            store.addExcludedIngredient(ingredient);
            setIngredient("");
          }}
          className="flex gap-2"
        >
          <input
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            placeholder="ex. arachide, porc, lactose…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white active:scale-95"
          >
            Ajouter
          </button>
        </form>
        {preferences.excludedIngredients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {preferences.excludedIngredients.map((ing) => (
              <button
                key={ing}
                onClick={() => store.removeExcludedIngredient(ing)}
                className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
              >
                {ing} ✕
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Favoris */}
      <Card title={`Favoris (${favorites.length})`}>
        {favorites.length === 0 ? (
          <p className="text-sm text-slate-400">
            Ajoutez des favoris depuis une fiche recette : ils sont privilégiés
            lors de la génération.
          </p>
        ) : (
          <ul className="space-y-1">
            {favorites.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recette/${r.id}`}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span>★ {r.name}</span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recettes refusées */}
      {refused.length > 0 && (
        <Card title={`Recettes refusées (${refused.length})`}>
          <ul className="space-y-1">
            {refused.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">🚫 {r.name}</span>
                <button
                  onClick={() => store.toggleExcludedRecipe(r.id)}
                  className="text-blue-600"
                >
                  Réactiver
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Ajouter une recette */}
      <Link
        href="/ajouter"
        className="block rounded-xl bg-slate-900 px-4 py-3 text-center font-semibold text-white active:scale-95"
      >
        ＋ Ajouter une recette perso
      </Link>

      <p className="pb-4 text-center text-xs text-slate-400">
        Données enregistrées localement sur cet appareil.
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stepper({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-700 active:scale-95"
    >
      {children}
    </button>
  );
}
