"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { filterRecipes, sortRecipes, type RecipeQuery } from "@/lib/search";
import { OriginBadge, Tag } from "@/components/ui";
import {
  ORIGIN_LABELS,
  PROTEIN_LABELS,
} from "@/lib/config";
import type { Origin, Protein, Recipe } from "@/lib/types";

const ORIGINS: Origin[] = ["local", "italian", "asian", "world"];
const PROTEINS: Protein[] = [
  "poultry",
  "fish",
  "veggie",
  "legumes",
  "red_meat",
  "eggs",
];
const PAGE = 40;

export default function RecettesPage() {
  const store = useStore();
  const [text, setText] = useState("");
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [quick, setQuick] = useState({
    veg: false,
    fish: false,
    rapide: false,
    favoris: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    if (!store.ready) return [];
    const q: RecipeQuery = {
      text,
      origins,
      proteins,
      vegetarianOnly: quick.veg,
      fishOnly: quick.fish,
      maxTotalTime: quick.rapide ? 30 : undefined,
      favoritesOnly: quick.favoris,
      favoriteIds: store.preferences.favoriteRecipeIds,
    };
    const filtered = filterRecipes(store.allRecipes, q);
    return sortRecipes(filtered, store.preferences.favoriteRecipeIds);
  }, [
    store.ready,
    store.allRecipes,
    store.preferences.favoriteRecipeIds,
    text,
    origins,
    proteins,
    quick,
  ]);

  if (!store.ready) {
    return <p className="pt-10 text-center text-slate-400">Chargement…</p>;
  }

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setLimit(PAGE);
  };

  const shown = results.slice(0, limit);

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Catalogue</h1>

      {/* Recherche */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-slate-50 px-4 pb-2 pt-1">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Rechercher une recette, un ingrédient…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm"
          />
          {text && (
            <button
              onClick={() => setText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 text-slate-400"
              aria-label="Effacer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Toggles rapides */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip active={quick.veg} onClick={() => { setQuick((q) => ({ ...q, veg: !q.veg })); setLimit(PAGE); }}>
            🌱 Végé
          </Chip>
          <Chip active={quick.fish} onClick={() => { setQuick((q) => ({ ...q, fish: !q.fish })); setLimit(PAGE); }}>
            🐟 Poisson
          </Chip>
          <Chip active={quick.rapide} onClick={() => { setQuick((q) => ({ ...q, rapide: !q.rapide })); setLimit(PAGE); }}>
            ⏱ ≤ 30 min
          </Chip>
          <Chip active={quick.favoris} onClick={() => { setQuick((q) => ({ ...q, favoris: !q.favoris })); setLimit(PAGE); }}>
            ★ Favoris
          </Chip>
          <Chip active={showFilters} onClick={() => setShowFilters((v) => !v)}>
            ⚙️ Filtres
          </Chip>
        </div>

        {/* Filtres détaillés */}
        {showFilters && (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Origine</p>
              <div className="flex flex-wrap gap-1.5">
                {ORIGINS.map((o) => (
                  <Chip key={o} active={origins.includes(o)} onClick={() => toggle(origins, o, setOrigins)}>
                    {ORIGIN_LABELS[o]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Protéine</p>
              <div className="flex flex-wrap gap-1.5">
                {PROTEINS.map((p) => (
                  <Chip key={p} active={proteins.includes(p)} onClick={() => toggle(proteins, p, setProteins)}>
                    {PROTEIN_LABELS[p]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mb-2 text-sm text-slate-500">
        {results.length} recette{results.length > 1 ? "s" : ""}
      </p>

      <div className="space-y-2">
        {shown.map((r) => (
          <RecipeRow key={r.id} recipe={r} fav={store.isFavorite(r.id)} />
        ))}
      </div>

      {results.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          Aucune recette ne correspond à votre recherche.
        </p>
      )}

      {limit < results.length && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-4 w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 active:scale-95"
        >
          Voir plus ({results.length - limit} restantes)
        </button>
      )}
    </div>
  );
}

function RecipeRow({ recipe, fav }: { recipe: Recipe; fav: boolean }) {
  const total = recipe.prepTimeMin + recipe.cookTimeMin;
  return (
    <Link
      href={`/recette/${recipe.id}`}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <OriginBadge origin={recipe.origin} />
          {fav && <Tag className="bg-amber-100 text-amber-700">★</Tag>}
        </div>
        <h3 className="mt-1 truncate text-[15px] font-semibold text-slate-900">
          {recipe.name}
        </h3>
        <div className="mt-0.5 text-xs text-slate-500">
          ⏱ {total} min · {recipe.nutrition.kcal} kcal
        </div>
      </div>
      <span className="text-slate-300">›</span>
    </Link>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95 ${
        active
          ? "border-blue-500 bg-blue-500 text-white"
          : "border-slate-300 bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
