"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  BASE_LABELS,
  CATEGORY_LABELS,
  METHOD_LABELS,
  ORIGIN_LABELS,
  PROTEIN_LABELS,
} from "@/lib/config";
import type {
  Base,
  CookingMethod,
  Ingredient,
  IngredientCategory,
  Origin,
  Protein,
  Recipe,
} from "@/lib/types";

type IngRow = {
  name: string;
  qty: string;
  unit: string;
  category: IngredientCategory;
};

export default function AjouterPage() {
  const store = useStore();
  const router = useRouter();

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<Origin>("local");
  const [protein, setProtein] = useState<Protein>("poultry");
  const [base, setBase] = useState<Base>("none");
  const [cookingMethod, setCookingMethod] = useState<CookingMethod>("pan");
  const [prepTimeMin, setPrep] = useState("15");
  const [cookTimeMin, setCook] = useState("20");
  const [difficulty, setDifficulty] = useState("1");
  const [servings, setServings] = useState("4");
  const [batchFriendly, setBatch] = useState(false);
  const [tags, setTags] = useState("");
  const [kcal, setKcal] = useState("500");
  const [proteinG, setProteinG] = useState("25");
  const [carbsG, setCarbsG] = useState("50");
  const [fatG, setFatG] = useState("18");
  const [fiberG, setFiberG] = useState("6");
  const [instructions, setInstructions] = useState("");
  const [rows, setRows] = useState<IngRow[]>([
    { name: "", qty: "", unit: "", category: "legumes" },
  ]);

  const updateRow = (i: number, patch: Partial<IngRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () =>
    setRows((r) => [...r, { name: "", qty: "", unit: "", category: "epicerie" }]);
  const removeRow = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const ingredients: Ingredient[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        qty: Number(r.qty) || 0,
        unit: r.unit.trim() || "",
        category: r.category,
      }));

    const recipe: Recipe = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      origin,
      protein,
      base,
      cookingMethod,
      prepTimeMin: Number(prepTimeMin) || 0,
      cookTimeMin: Number(cookTimeMin) || 0,
      difficulty: (Number(difficulty) as 1 | 2 | 3) || 1,
      servings: Number(servings) || 4,
      batchFriendly,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ingredients,
      nutrition: {
        kcal: Number(kcal) || 0,
        protein_g: Number(proteinG) || 0,
        carbs_g: Number(carbsG) || 0,
        fat_g: Number(fatG) || 0,
        fiber_g: Number(fiberG) || 0,
      },
      instructions: instructions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    store.addCustomRecipe(recipe);
    router.push(`/recette/${recipe.id}`);
  };

  return (
    <div>
      <Link href="/reglages" className="mb-3 inline-block text-sm text-blue-600">
        ← Réglages
      </Link>
      <h1 className="mb-4 text-xl font-bold">Nouvelle recette</h1>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="ex. Curry de patate douce"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Origine">
            <Select value={origin} onChange={(v) => setOrigin(v as Origin)} options={ORIGIN_LABELS} />
          </Field>
          <Field label="Protéine">
            <Select value={protein} onChange={(v) => setProtein(v as Protein)} options={PROTEIN_LABELS} />
          </Field>
          <Field label="Base / féculent">
            <Select value={base} onChange={(v) => setBase(v as Base)} options={BASE_LABELS} />
          </Field>
          <Field label="Cuisson">
            <Select value={cookingMethod} onChange={(v) => setCookingMethod(v as CookingMethod)} options={METHOD_LABELS} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Prépa (min)">
            <input type="number" min={0} value={prepTimeMin} onChange={(e) => setPrep(e.target.value)} className="input" />
          </Field>
          <Field label="Cuisson (min)">
            <input type="number" min={0} value={cookTimeMin} onChange={(e) => setCook(e.target.value)} className="input" />
          </Field>
          <Field label="Portions">
            <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulté (1-3)">
            <input type="number" min={1} max={3} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input" />
          </Field>
          <Field label="Tags (séparés par ,)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="vegetarian, rapide" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={batchFriendly} onChange={(e) => setBatch(e.target.checked)} className="h-5 w-5 accent-blue-600" />
          Adaptée au batch cooking (grande portion)
        </label>

        {/* Ingrédients */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Ingrédients</span>
            <button type="button" onClick={addRow} className="text-sm text-blue-600">
              ＋ Ligne
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="flex gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="Ingrédient"
                    className="input flex-1"
                  />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="px-2 text-red-500">
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    value={row.qty}
                    onChange={(e) => updateRow(i, { qty: e.target.value })}
                    placeholder="Qté"
                    type="number"
                    className="input"
                  />
                  <input
                    value={row.unit}
                    onChange={(e) => updateRow(i, { unit: e.target.value })}
                    placeholder="Unité"
                    className="input"
                  />
                  <Select
                    value={row.category}
                    onChange={(v) => updateRow(i, { category: v as IngredientCategory })}
                    options={CATEGORY_LABELS}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nutrition */}
        <div>
          <span className="mb-2 block text-sm font-semibold text-slate-600">
            Nutrition (par portion)
          </span>
          <div className="grid grid-cols-5 gap-2">
            <Field label="kcal" small>
              <input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className="input" />
            </Field>
            <Field label="prot." small>
              <input type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} className="input" />
            </Field>
            <Field label="gluc." small>
              <input type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} className="input" />
            </Field>
            <Field label="lip." small>
              <input type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} className="input" />
            </Field>
            <Field label="fibres" small>
              <input type="number" value={fiberG} onChange={(e) => setFiberG(e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        <Field label="Préparation (une étape par ligne)">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="input"
            placeholder={"Faire revenir l'oignon.\nAjouter le reste et mijoter."}
          />
        </Field>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white active:scale-95"
        >
          Enregistrer la recette
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  small,
}: {
  label: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1 block font-medium text-slate-600 ${
          small ? "text-[11px]" : "text-sm"
        }`}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      {Object.entries(options).map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
