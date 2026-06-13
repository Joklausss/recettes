"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { buildShoppingList } from "@/lib/shoppingList";
import { buildShoppingText } from "@/lib/export";
import { ShareBar } from "@/components/ShareBar";
import { CATEGORY_LABELS } from "@/lib/config";

export default function CoursesPage() {
  const store = useStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    if (!store.plan) return [];
    return buildShoppingList(
      store.plan,
      store.recipesById,
      store.preferences.servings,
    );
  }, [store.plan, store.recipesById, store.preferences.servings]);

  if (!store.ready) {
    return <p className="pt-10 text-center text-slate-400">Chargement…</p>;
  }

  if (!store.plan) {
    return (
      <EmptyHint text="Générez d'abord un plan de la semaine pour voir votre liste de courses." />
    );
  }

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold">Liste de courses</h1>
        <p className="text-sm text-slate-500">
          Pour {store.preferences.servings} portions · {done}/{total} articles
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
      </header>

      <div className="mb-5">
        <ShareBar
          title="Liste de courses"
          shareLabel="Partager / Note iPhone"
          whatsapp
          getText={() =>
            buildShoppingText(
              store.plan!,
              store.recipesById,
              store.preferences.servings,
            )
          }
        />
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {CATEGORY_LABELS[section.category] ?? section.category}
            </h2>
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {section.items.map((item) => {
                const key = `${item.name}|${item.unit}`;
                const isChecked = !!checked[key];
                return (
                  <li key={key} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() =>
                        setChecked((c) => ({ ...c, [key]: !c[key] }))
                      }
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                          isChecked
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked ? "✓" : ""}
                      </span>
                      <span
                        className={`flex-1 text-sm ${
                          isChecked
                            ? "text-slate-400 line-through"
                            : "text-slate-800"
                        }`}
                      >
                        {item.name}
                        {item.perishable && (
                          <span title="Périssable" className="ml-1">
                            🧊
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-slate-600">
                        {item.qty} {item.unit}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="text-4xl">🛒</div>
      <p className="max-w-xs text-sm text-slate-500">{text}</p>
    </div>
  );
}
