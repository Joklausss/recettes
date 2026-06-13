"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { DAY_NAMES } from "@/lib/date";
import type { Slot } from "@/lib/types";

const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "lunch", label: "Midi" },
  { slot: "dinner", label: "Soir" },
];

interface Props {
  recipeId: string;
  variant?: "button" | "icon";
}

export function AddToWeek({ recipeId, variant = "button" }: Props) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openSheet = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const assign = (day: number, slot: Slot) => {
    store.assignMeal(day, slot, recipeId);
    setOpen(false);
    setToast(`Ajouté · ${DAY_NAMES[day]} ${slot === "lunch" ? "midi" : "soir"}`);
    window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={openSheet}
          aria-label="Ajouter à la semaine"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-lg font-bold text-blue-600 active:scale-95"
        >
          ＋
        </button>
      ) : (
        <button
          onClick={openSheet}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
        >
          ＋ Ajouter à la semaine
        </button>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-slate-900 px-4 py-2 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <h3 className="text-base font-bold">Ajouter à la semaine</h3>
            <p className="mb-3 text-xs text-slate-500">
              Choisissez le créneau — le repas sera verrouillé (conservé lors
              d&apos;une régénération).
            </p>

            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
              {DAY_NAMES.map((_, day) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-semibold text-slate-500">
                    {DAY_SHORT[day]}
                  </span>
                  {SLOTS.map(({ slot, label }) => {
                    const cur = store.plan?.meals.find(
                      (m) => m.day === day && m.slot === slot,
                    );
                    const curR = cur && store.recipesById.get(cur.recipeId);
                    return (
                      <button
                        key={slot}
                        onClick={() => assign(day, slot)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-left active:scale-[0.98]"
                      >
                        <div className="text-xs font-medium text-slate-700">
                          {label}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {curR ? curR.name : "libre"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
