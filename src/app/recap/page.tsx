"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { originCountsOfPlan } from "@/lib/generator";
import { computeOriginCounts } from "@/lib/origin";
import {
  MEALS_PER_WEEK,
  NUTRITION_TARGETS,
  ORIGIN_LABELS,
  PROTEIN_LABELS,
} from "@/lib/config";
import { ORIGIN_DOT } from "@/components/ui";
import { ShareBar } from "@/components/ShareBar";
import { buildFullRecap } from "@/lib/export";
import type { Origin, Protein } from "@/lib/types";

const ORIGINS: Origin[] = ["local", "italian", "asian", "world"];

export default function RecapPage() {
  const store = useStore();

  const data = useMemo(() => {
    if (!store.plan) return null;
    const cooked = store.plan.meals
      .map((m) => store.recipesById.get(m.recipeId))
      .filter((r): r is NonNullable<typeof r> => !!r);

    const originCounts = originCountsOfPlan(store.plan, store.recipesById);
    const target = computeOriginCounts(
      store.preferences.originTargets,
      MEALS_PER_WEEK,
    );

    const proteinCounts: Record<string, number> = {};
    let kcal = 0;
    let protein = 0;
    let fiber = 0;
    let fish = 0;
    let veg = 0;
    let redMeat = 0;
    for (const r of cooked) {
      proteinCounts[r.protein] = (proteinCounts[r.protein] ?? 0) + 1;
      kcal += r.nutrition.kcal;
      protein += r.nutrition.protein_g;
      fiber += r.nutrition.fiber_g;
      if (r.protein === "fish") fish++;
      if (
        r.protein === "veggie" ||
        r.protein === "legumes" ||
        r.protein === "eggs" ||
        r.tags.includes("vegetarian")
      )
        veg++;
      if (r.protein === "red_meat") redMeat++;
    }
    const n = cooked.length || 1;
    return {
      originCounts,
      target,
      proteinCounts,
      avgKcal: Math.round(kcal / n),
      avgProtein: Math.round(protein / n),
      avgFiber: Math.round(fiber / n),
      fish,
      veg,
      redMeat,
    };
  }, [store.plan, store.recipesById, store.preferences.originTargets]);

  if (!store.hydrated) {
    return <p className="pt-10 text-center text-slate-400">Chargement…</p>;
  }
  if (!store.plan || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="text-4xl">📊</div>
        <p className="max-w-xs text-sm text-slate-500">
          Générez un plan pour voir le récapitulatif de la semaine.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Récap de la semaine</h1>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Fiche de la semaine
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Programme + liste de courses + recettes. Partagez vers Notes, Messages,
          Mail ou WhatsApp.
        </p>
        <ShareBar
          title="Menus de la semaine"
          shareLabel="Partager la fiche"
          getText={() =>
            buildFullRecap(
              store.plan!,
              store.recipesById,
              store.preferences.servings,
            )
          }
        />
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Répartition par origine
        </h2>
        <div className="space-y-3">
          {ORIGINS.map((o) => {
            const value = data.originCounts[o];
            const tgt = data.target[o];
            const pct = (value / MEALS_PER_WEEK) * 100;
            return (
              <div key={o}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${ORIGIN_DOT[o]}`} />
                    {ORIGIN_LABELS[o]}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {value} repas{" "}
                    <span className="text-slate-400">(cible {tgt})</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${ORIGIN_DOT[o]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-2">
        <Stat label="kcal / repas" value={data.avgKcal} />
        <Stat label="protéines / repas" value={`${data.avgProtein} g`} />
        <Stat label="fibres / repas" value={`${data.avgFiber} g`} />
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Cibles nutritionnelles
        </h2>
        <ul className="space-y-2 text-sm">
          <Target
            ok={data.fish >= NUTRITION_TARGETS.fishMealsMin}
            label={`Poisson : ${data.fish} repas`}
            goal={`≥ ${NUTRITION_TARGETS.fishMealsMin}`}
          />
          <Target
            ok={data.veg >= NUTRITION_TARGETS.vegetarianMealsMin}
            label={`Végétarien : ${data.veg} repas`}
            goal={`≥ ${NUTRITION_TARGETS.vegetarianMealsMin}`}
          />
          <Target
            ok={data.redMeat <= NUTRITION_TARGETS.redMeatMealsMax}
            label={`Viande rouge : ${data.redMeat} repas`}
            goal={`≤ ${NUTRITION_TARGETS.redMeatMealsMax}`}
          />
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Protéines principales
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.proteinCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([p, count]) => (
              <span
                key={p}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                {PROTEIN_LABELS[p as Protein]} · {count}
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-[11px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

function Target({
  ok,
  label,
  goal,
}: {
  ok: boolean;
  label: string;
  goal: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span>{ok ? "✅" : "⚠️"}</span>
        {label}
      </span>
      <span className="text-slate-400">{goal}</span>
    </li>
  );
}
