// @ts-nocheck
/**
 * Générateur de seed de recettes.
 *
 * Produit ~460 recettes réalistes et nommées, réparties sur les 4 origines,
 * à partir de briques culinaires cohérentes (protéines, bases/féculents,
 * légumes, sauces/thèmes par cuisine). La nutrition est calculée à partir de
 * profils par protéine + base + légumes (valeurs plausibles, cohérentes), et
 * les catégories de rayon sont portées directement par les fragments
 * d'ingrédients (pas de devinette).
 *
 * Déterministe (RNG seedé) → la sortie est reproductible.
 *   node scripts/generate-recipes.mjs
 * Écrit : src/data/recipes.generated.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "recipes.generated.json");

// ── RNG déterministe (mulberry32) ───────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260613);
const rand = (n) => Math.floor(rng() * n);
const pick = (arr) => arr[rand(arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── Helpers d'ingrédients ────────────────────────────────────────────────────
const ing = (name, qty, unit, category, perishable = false) => ({
  name,
  qty,
  unit,
  category,
  perishable,
});

const OIL = ing("Huile d'olive", 2, "c. à soupe", "epicerie");
const ONION = ing("Oignon", 1, "pièce", "legumes");
const GARLIC = ing("Ail", 2, "gousses", "legumes");

// ── Profils nutritionnels (par portion) ──────────────────────────────────────
const PROTEIN_PROFILE = {
  red_meat: { p: 32, f: 20 },
  poultry: { p: 35, f: 10 },
  fish: { p: 30, f: 12 },
  legumes: { p: 18, f: 7 },
  eggs: { p: 20, f: 14 },
  veggie: { p: 11, f: 9 },
};
const BASE_CARBS = {
  pasta: 70,
  rice: 65,
  potato: 45,
  grains: 60,
  bread: 42,
  none: 14,
};

function computeNutrition(protein, base, method, vegCount, extraFat = 0) {
  const pp = PROTEIN_PROFILE[protein];
  const protein_g = Math.round(pp.p + (rng() * 6 - 3));
  const fat_g = Math.round(pp.f + extraFat + (rng() * 6 - 3));
  const carbs_g = Math.round(BASE_CARBS[base] + vegCount * 4 + (rng() * 8 - 4));
  const fiber_g = Math.round(
    3 + vegCount * 2 + (base === "none" ? 0 : 1) + (rng() * 3),
  );
  const kcal = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  return {
    kcal,
    protein_g: Math.max(6, protein_g),
    carbs_g: Math.max(8, carbs_g),
    fat_g: Math.max(4, fat_g),
    fiber_g: Math.max(1, fiber_g),
  };
}

// ── Temps & difficulté selon le mode de cuisson ──────────────────────────────
const METHOD_TIME = {
  oven: [30, 55],
  simmer: [35, 90],
  pan: [12, 25],
  raw: [0, 8],
  soup: [25, 45],
  steam: [15, 25],
};
function timesFor(method) {
  const [lo, hi] = METHOD_TIME[method];
  const cookTimeMin = lo + rand(hi - lo + 1);
  const prepTimeMin = 10 + rand(16);
  let difficulty = 1;
  const total = prepTimeMin + cookTimeMin;
  if (total > 50) difficulty = 2;
  if (total > 100 || method === "simmer") difficulty = Math.min(3, difficulty + 1);
  return { prepTimeMin, cookTimeMin, difficulty };
}

const isVeg = (p) => p === "veggie" || p === "legumes" || p === "eggs";

function makeTags(protein, base, method, total, theme) {
  const tags = [];
  if (isVeg(protein)) tags.push("vegetarian");
  if (protein === "fish") tags.push("fish");
  if (total <= 30) tags.push("rapide");
  if (method === "simmer" || method === "soup") tags.push("mijoté");
  if (theme) tags.push(theme);
  return Array.from(new Set(tags));
}

function batchFor(method) {
  return method === "simmer" || method === "soup" || method === "oven";
}

// ── Bases / féculents (fragments) ────────────────────────────────────────────
const BASES = {
  rice: { label: "riz", base: "rice", ing: [ing("Riz", 300, "g", "epicerie")] },
  basmati: {
    label: "riz basmati",
    base: "rice",
    ing: [ing("Riz basmati", 300, "g", "epicerie")],
  },
  pasta: {
    label: "pâtes",
    base: "pasta",
    ing: [ing("Pâtes", 400, "g", "epicerie")],
  },
  potato: {
    label: "pommes de terre",
    base: "potato",
    ing: [ing("Pommes de terre", 800, "g", "legumes")],
  },
  mash: {
    label: "purée",
    base: "potato",
    ing: [
      ing("Pommes de terre", 800, "g", "legumes"),
      ing("Lait", 15, "cl", "frais", true),
      ing("Beurre", 30, "g", "frais", true),
    ],
  },
  semolina: {
    label: "semoule",
    base: "grains",
    ing: [ing("Semoule", 300, "g", "epicerie")],
  },
  bread: {
    label: "pain",
    base: "bread",
    ing: [ing("Pain de campagne", 1, "pièce", "boulangerie", true)],
  },
  greens: {
    label: "salade",
    base: "none",
    ing: [ing("Salade verte", 1, "pièce", "legumes", true)],
  },
  veggies: {
    label: "poêlée de légumes",
    base: "none",
    ing: [ing("Mélange de légumes", 500, "g", "legumes", true)],
  },
};

// ── Légumes vedettes (fragment + featured) ───────────────────────────────────
const VEG = [
  { f: "courgette", ing: ing("Courgettes", 2, "pièces", "legumes", true) },
  { f: "carotte", ing: ing("Carottes", 3, "pièces", "legumes") },
  { f: "poivron", ing: ing("Poivrons", 2, "pièces", "legumes", true) },
  { f: "brocoli", ing: ing("Brocoli", 1, "pièce", "legumes", true) },
  { f: "épinard", ing: ing("Épinards", 200, "g", "legumes", true) },
  { f: "champignon", ing: ing("Champignons", 250, "g", "legumes", true) },
  { f: "aubergine", ing: ing("Aubergine", 1, "pièce", "legumes", true) },
  { f: "haricot vert", ing: ing("Haricots verts", 300, "g", "legumes", true) },
  { f: "tomate", ing: ing("Tomates", 4, "pièces", "legumes", true) },
  { f: "petits pois", ing: ing("Petits pois", 200, "g", "surgele") },
  { f: "fenouil", ing: ing("Fenouil", 2, "pièces", "legumes", true) },
  { f: "poireau", ing: ing("Poireaux", 3, "pièces", "legumes", true) },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTION DES RECETTES
// ─────────────────────────────────────────────────────────────────────────────
const recipes = [];
const seenNames = new Set();
const seenSig = new Set();

function add(origin, protein, base, method, name, frags, opts = {}) {
  const key = name.toLowerCase();
  if (seenNames.has(key)) return false;
  const sig = `${origin}|${protein}|${base}|${method}|${opts.featured ?? ""}|${opts.theme ?? ""}`;
  // Évite trop de quasi-doublons de même signature.
  const sigCount = seenSigCount.get(sig) ?? 0;
  if (sigCount >= 6) return false;

  const ingredients = [];
  const names = new Set();
  for (const fr of frags) {
    for (const it of fr) {
      const nk = it.name.toLowerCase();
      if (names.has(nk)) continue;
      names.add(nk);
      ingredients.push(it);
    }
  }
  const vegCount = ingredients.filter((i) => i.category === "legumes").length;
  const { prepTimeMin, cookTimeMin, difficulty } = timesFor(method);
  const total = prepTimeMin + cookTimeMin;

  recipes.push({
    origin,
    protein,
    base,
    cookingMethod: method,
    name,
    prepTimeMin,
    cookTimeMin,
    difficulty,
    servings: 4,
    batchFriendly: batchFor(method),
    tags: makeTags(protein, base, method, total, opts.theme),
    featured: opts.featured,
    ingredients,
    nutrition: computeNutrition(protein, base, method, vegCount, opts.extraFat ?? 0),
    instructions: opts.instructions ?? defaultInstructions(method),
  });
  seenNames.add(key);
  seenSigCount.set(sig, sigCount + 1);
  return true;
}
const seenSigCount = new Map();

function defaultInstructions(method) {
  switch (method) {
    case "oven":
      return [
        "Préchauffer le four à 200 °C.",
        "Disposer les ingrédients dans un plat et assaisonner.",
        "Enfourner jusqu'à belle coloration et cuisson à cœur.",
      ];
    case "simmer":
      return [
        "Faire revenir l'oignon et l'ail.",
        "Ajouter le reste des ingrédients et couvrir de liquide.",
        "Laisser mijoter à feu doux, rectifier l'assaisonnement.",
      ];
    case "soup":
      return [
        "Faire suer les légumes.",
        "Couvrir de bouillon et cuire jusqu'à tendreté.",
        "Mixer ou servir tel quel, ajuster l'assaisonnement.",
      ];
    case "raw":
      return [
        "Préparer et couper tous les ingrédients.",
        "Assembler dans un saladier ou un bol.",
        "Assaisonner et servir frais.",
      ];
    case "steam":
      return [
        "Cuire la base à la vapeur ou à l'eau.",
        "Cuire la garniture à la vapeur pour préserver les nutriments.",
        "Dresser et napper de sauce.",
      ];
    default:
      return [
        "Préparer les ingrédients.",
        "Saisir la protéine puis les légumes à la poêle.",
        "Mélanger, assaisonner et servir aussitôt.",
      ];
  }
}

// ── Fragments protéines réutilisables ────────────────────────────────────────
const P = {
  poulet: () => ({ p: "poultry", ing: [ing("Filets de poulet", 500, "g", "viande", true)] }),
  cuisses: () => ({ p: "poultry", ing: [ing("Cuisses de poulet", 4, "pièces", "viande", true)] }),
  dinde: () => ({ p: "poultry", ing: [ing("Escalopes de dinde", 500, "g", "viande", true)] }),
  boeuf: () => ({ p: "red_meat", ing: [ing("Bœuf", 500, "g", "viande", true)] }),
  boeufHache: () => ({ p: "red_meat", ing: [ing("Bœuf haché", 400, "g", "viande", true)] }),
  porc: () => ({ p: "red_meat", ing: [ing("Sauté de porc", 500, "g", "viande", true)] }),
  veau: () => ({ p: "red_meat", ing: [ing("Veau", 600, "g", "viande", true)] }),
  saumon: () => ({ p: "fish", ing: [ing("Pavés de saumon", 4, "pièces", "poisson", true)] }),
  cabillaud: () => ({ p: "fish", ing: [ing("Dos de cabillaud", 4, "pièces", "poisson", true)] }),
  truite: () => ({ p: "fish", ing: [ing("Filets de truite", 4, "pièces", "poisson", true)] }),
  dorade: () => ({ p: "fish", ing: [ing("Dorade", 2, "pièces", "poisson", true)] }),
  crevettes: () => ({ p: "fish", ing: [ing("Crevettes", 400, "g", "poisson", true)] }),
  thon: () => ({ p: "fish", ing: [ing("Thon", 400, "g", "poisson", true)] }),
  tofu: () => ({ p: "veggie", ing: [ing("Tofu ferme", 400, "g", "frais", true)] }),
  oeufs: () => ({ p: "eggs", ing: [ing("Œufs", 6, "pièces", "frais", true)] }),
  lentilles: () => ({ p: "legumes", ing: [ing("Lentilles", 350, "g", "epicerie")] }),
  poisChiches: () => ({ p: "legumes", ing: [ing("Pois chiches", 400, "g", "epicerie")] }),
  haricotsRouges: () => ({ p: "legumes", ing: [ing("Haricots rouges", 400, "g", "epicerie")] }),
};

// =============================================================================
// LOCALE (français / régional)
// =============================================================================
function buildLocal() {
  const meats = [
    { label: "Poulet", make: P.poulet },
    { label: "Émincé de dinde", make: P.dinde },
    { label: "Sauté de veau", make: P.veau },
    { label: "Sauté de porc", make: P.porc },
    { label: "Pavé de bœuf", make: P.boeuf },
  ];
  const sauces = [
    { name: "à la moutarde", extra: [ing("Moutarde", 2, "c. à soupe", "epicerie"), ing("Crème fraîche", 15, "cl", "frais", true)], theme: "crémeux" },
    { name: "forestier", extra: [ing("Champignons", 250, "g", "legumes", true), ing("Crème fraîche", 15, "cl", "frais", true)], featured: "champignon" },
    { name: "à la provençale", extra: [ing("Tomates", 3, "pièces", "legumes", true), ing("Herbes de Provence", 1, "c. à café", "epicerie")], featured: "tomate", theme: "été" },
    { name: "au thym et citron", extra: [ing("Citron", 1, "pièce", "fruits"), ing("Thym", 1, "c. à café", "epicerie")] },
    { name: "à la crème et au poivre", extra: [ing("Crème fraîche", 20, "cl", "frais", true), ing("Poivre", 1, "c. à café", "epicerie")], theme: "crémeux" },
    { name: "au miel et romarin", extra: [ing("Miel", 2, "c. à soupe", "epicerie"), ing("Romarin", 1, "branche", "legumes", true)] },
    { name: "aux oignons confits", extra: [ing("Oignons", 4, "pièces", "legumes")], featured: "oignon" },
  ];
  const accomps = ["potato", "mash", "rice", "veggies", "pasta", "greens"];
  for (const m of shuffle(meats)) {
    for (const s of shuffle(sauces)) {
      for (const a of shuffle(accomps)) {
        const prot = m.make();
        const b = BASES[a];
        const method = a === "potato" || a === "mash" ? (rng() > 0.5 ? "oven" : "pan") : "pan";
        const name = `${m.label} ${s.name}, ${b.label}`;
        add("local", prot.p, b.base, method, name, [prot.ing, b.ing, s.extra], {
          featured: s.featured ?? a,
          theme: s.theme,
        });
      }
    }
  }

  // Poissons
  const fishes = [
    { label: "Saumon", make: P.saumon },
    { label: "Cabillaud", make: P.cabillaud },
    { label: "Truite", make: P.truite },
    { label: "Dorade", make: P.dorade },
  ];
  const fishPreps = [
    { name: "en papillote", method: "oven" },
    { name: "rôti au four", method: "oven" },
    { name: "poêlé au beurre", method: "pan", extra: [ing("Beurre", 40, "g", "frais", true)] },
    { name: "vapeur", method: "steam" },
  ];
  const fishSides = ["rice", "potato", "veggies", "greens"];
  for (const f of shuffle(fishes)) {
    for (const prep of shuffle(fishPreps)) {
      for (const v of shuffle(VEG).slice(0, 3)) {
        const side = pick(fishSides);
        const prot = f.make();
        const b = BASES[side];
        const name = `${f.label} ${prep.name}, ${v.f} et ${b.label}`;
        add("local", "fish", b.base, prep.method, name, [prot.ing, b.ing, [v.ing], prep.extra ?? []], {
          featured: v.f,
        });
      }
    }
  }

  // Veloutés / soupes de légumes
  const veloutes = [
    ["potiron", "Potiron", 1, "kg"],
    ["courgette", "Courgettes", 800, "g"],
    ["poireau", "Poireaux", 4, "pièces"],
    ["champignon", "Champignons", 400, "g"],
    ["carotte", "Carottes", 6, "pièces"],
    ["tomate", "Tomates", 6, "pièces"],
    ["brocoli", "Brocoli", 2, "pièces"],
    ["châtaigne", "Châtaignes", 400, "g"],
    ["petits pois", "Petits pois", 400, "g"],
    ["panais", "Panais", 5, "pièces"],
    ["butternut", "Butternut", 1, "kg"],
    ["lentille corail", "Lentilles corail", 250, "g"],
  ];
  for (const [f, n, q, u] of veloutes) {
    const prot = f === "lentille corail" ? "legumes" : "veggie";
    add("local", prot, "none", "soup", `Velouté de ${f}`, [
      [ing(n, q, u, f === "lentille corail" ? "epicerie" : "legumes", true)],
      [ONION, ing("Crème fraîche", 10, "cl", "frais", true), ing("Bouillon de légumes", 75, "cl", "epicerie")],
    ], { featured: f, theme: "soupe" });
  }

  // Gratins & tartes végétariens
  const veggieMains = [
    { name: "Gratin de courgettes", method: "oven", f: "courgette", extra: [ing("Courgettes", 800, "g", "legumes", true), ing("Crème fraîche", 20, "cl", "frais", true), ing("Gruyère râpé", 80, "g", "frais", true)], base: "none" },
    { name: "Gratin de chou-fleur", method: "oven", f: "chou-fleur", extra: [ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Béchamel", 40, "cl", "epicerie"), ing("Gruyère râpé", 80, "g", "frais", true)], base: "none" },
    { name: "Tarte aux légumes du soleil", method: "oven", f: "poivron", extra: [ing("Pâte brisée", 1, "rouleau", "frais", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true)], base: "none" },
    { name: "Quiche aux poireaux", method: "oven", f: "poireau", extra: [ing("Pâte brisée", 1, "rouleau", "frais", true), ing("Poireaux", 3, "pièces", "legumes", true), ing("Œufs", 3, "pièces", "frais", true), ing("Crème fraîche", 20, "cl", "frais", true)], base: "none", p: "eggs" },
    { name: "Gratin dauphinois aux épinards", method: "oven", f: "épinard", extra: [ing("Pommes de terre", 800, "g", "legumes"), ing("Épinards", 200, "g", "legumes", true), ing("Crème fraîche", 25, "cl", "frais", true)], base: "potato" },
    { name: "Poêlée de légumes et œufs", method: "pan", f: "courgette", extra: [ing("Courgettes", 2, "pièces", "legumes", true), ing("Œufs", 4, "pièces", "frais", true)], base: "none", p: "eggs" },
    { name: "Galettes de lentilles", method: "pan", f: "lentille", extra: [ing("Lentilles", 300, "g", "epicerie"), ing("Carotte", 1, "pièce", "legumes")], base: "none", p: "legumes" },
  ];
  for (const v of veggieMains) {
    add("local", v.p ?? "veggie", v.base, v.method, v.name, [v.extra], { featured: v.f });
  }

  // Omelettes / œufs
  const omGarn = ["champignon", "fromage", "fines herbes", "lardons", "épinard", "courgette", "pomme de terre"];
  for (const g of omGarn) {
    add("local", "eggs", "none", "pan", `Omelette aux ${g}s`, [
      [ing("Œufs", 8, "pièces", "frais", true), ing(cap(g), 200, "g", "legumes", true), ing("Salade verte", 1, "pièce", "legumes", true)],
    ], { featured: g });
  }

  // Plats mijotés classiques
  const stews = [
    { name: "Bœuf carottes", p: "red_meat", base: "none", f: "carotte", extra: [ing("Bœuf à mijoter", 800, "g", "viande", true), ing("Carottes", 5, "pièces", "legumes")] },
    { name: "Poule au pot", p: "poultry", base: "none", f: "poireau", extra: [ing("Poule", 1, "pièce", "viande", true), ing("Poireaux", 3, "pièces", "legumes", true), ing("Carottes", 4, "pièces", "legumes")] },
    { name: "Sauté de veau aux olives", p: "red_meat", base: "rice", f: "tomate", extra: [ing("Veau", 700, "g", "viande", true), ing("Olives", 100, "g", "epicerie"), ing("Tomates", 4, "pièces", "legumes", true)] },
    { name: "Petit salé aux lentilles", p: "legumes", base: "none", f: "lentille", extra: [ing("Lentilles vertes", 350, "g", "epicerie"), ing("Saucisses", 4, "pièces", "viande", true), ing("Carottes", 3, "pièces", "legumes")] },
    { name: "Dahl de lentilles corail", p: "legumes", base: "rice", f: "lentille corail", extra: [ing("Lentilles corail", 300, "g", "epicerie"), ing("Lait de coco", 20, "cl", "epicerie"), ing("Tomates", 2, "pièces", "legumes", true)] },
  ];
  for (const s of stews) {
    add("local", s.p, s.base, "simmer", s.name, [s.extra, s.base !== "none" ? BASES[s.base].ing : []], { featured: s.f });
  }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// =============================================================================
// ITALIENNE
// =============================================================================
function buildItalian() {
  const shapes = ["Spaghetti", "Penne", "Fusilli", "Tagliatelles", "Rigatoni", "Farfalle", "Linguine"];
  const pastaSauces = [
    { name: "à la tomate et basilic", p: "veggie", extra: [ing("Tomates concassées", 400, "g", "epicerie"), ing("Basilic frais", 1, "bouquet", "legumes", true)], f: "tomate" },
    { name: "bolognaise", p: "red_meat", extra: [ing("Bœuf haché", 400, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie")], f: "tomate" },
    { name: "à la carbonara", p: "eggs", extra: [ing("Œufs", 3, "pièces", "frais", true), ing("Pancetta", 150, "g", "viande", true), ing("Parmesan", 60, "g", "frais", true)], f: "parmesan", extraFat: 6 },
    { name: "au pesto", p: "veggie", extra: [ing("Pesto", 150, "g", "epicerie"), ing("Pignons de pin", 40, "g", "epicerie")], f: "basilic" },
    { name: "aux légumes grillés", p: "veggie", extra: [ing("Courgette", 1, "pièce", "legumes", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Aubergine", 1, "pièce", "legumes", true)], f: "courgette" },
    { name: "aux fruits de mer", p: "fish", extra: [ing("Fruits de mer", 400, "g", "poisson", true), ing("Ail", 3, "gousses", "legumes")], f: "ail" },
    { name: "arrabbiata", p: "veggie", extra: [ing("Tomates concassées", 400, "g", "epicerie"), ing("Piment", 1, "pièce", "legumes")], f: "tomate", theme: "épicé" },
    { name: "aux champignons", p: "veggie", extra: [ing("Champignons", 300, "g", "legumes", true), ing("Crème", 15, "cl", "frais", true)], f: "champignon" },
    { name: "au thon et câpres", p: "fish", extra: [ing("Thon", 2, "boîtes", "epicerie"), ing("Câpres", 30, "g", "epicerie"), ing("Tomates", 3, "pièces", "legumes", true)], f: "tomate" },
    { name: "à la crème et jambon", p: "red_meat", extra: [ing("Jambon", 150, "g", "viande", true), ing("Crème", 20, "cl", "frais", true), ing("Petits pois", 150, "g", "surgele")], f: "petits pois" },
    { name: "primavera", p: "veggie", extra: [ing("Petits pois", 150, "g", "surgele"), ing("Asperges", 200, "g", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true)], f: "asperge" },
    { name: "au gorgonzola et noix", p: "veggie", extra: [ing("Gorgonzola", 150, "g", "frais", true), ing("Noix", 50, "g", "epicerie")], f: "gorgonzola" },
    { name: "puttanesca", p: "veggie", extra: [ing("Tomates concassées", 400, "g", "epicerie"), ing("Olives noires", 100, "g", "epicerie"), ing("Câpres", 30, "g", "epicerie")], f: "tomate" },
    { name: "aglio e olio", p: "veggie", extra: [ing("Ail", 4, "gousses", "legumes"), ing("Persil", 1, "bouquet", "legumes", true), ing("Piment", 1, "pièce", "legumes")], f: "ail" },
  ];
  for (const sh of shuffle(shapes)) {
    for (const s of shuffle(pastaSauces)) {
      const method = s.p === "red_meat" || s.name.includes("arrabbiata") || s.name.includes("puttanesca") ? "simmer" : "pan";
      const name = `${sh} ${s.name}`;
      add("italian", s.p, "pasta", method, name, [BASES.pasta.ing, s.extra], {
        featured: s.f,
        theme: s.theme,
        extraFat: s.extraFat,
      });
    }
  }

  // Risotti
  const risottos = [
    ["aux champignons", "veggie", [ing("Champignons", 300, "g", "legumes", true)], "champignon"],
    ["au safran (alla milanese)", "veggie", [ing("Safran", 1, "dose", "epicerie")], "safran"],
    ["aux asperges", "veggie", [ing("Asperges", 300, "g", "legumes", true)], "asperge"],
    ["aux courgettes", "veggie", [ing("Courgettes", 2, "pièces", "legumes", true)], "courgette"],
    ["au potiron", "veggie", [ing("Potiron", 500, "g", "legumes", true)], "potiron"],
    ["aux fruits de mer", "fish", [ing("Fruits de mer", 400, "g", "poisson", true)], "fruits de mer"],
    ["au citron", "veggie", [ing("Citron", 2, "pièces", "fruits")], "citron"],
    ["aux petits pois", "veggie", [ing("Petits pois", 250, "g", "surgele")], "petits pois"],
    ["au gorgonzola", "veggie", [ing("Gorgonzola", 150, "g", "frais", true)], "gorgonzola"],
    ["aux tomates séchées", "veggie", [ing("Tomates séchées", 100, "g", "epicerie")], "tomate"],
  ];
  for (const [name, p, extra, f] of risottos) {
    add("italian", p, "rice", "pan", `Risotto ${name}`, [
      [ing("Riz arborio", 350, "g", "epicerie"), ONION, ing("Vin blanc", 10, "cl", "boissons"), ing("Parmesan", 70, "g", "frais", true), ing("Bouillon de légumes", 1, "L", "epicerie")],
      extra,
    ], { featured: f });
  }

  // Pizzas & focaccia
  const pizzas = [
    ["Margherita", [ing("Mozzarella", 250, "g", "frais", true), ing("Basilic frais", 1, "bouquet", "legumes", true)], "mozzarella", "veggie"],
    ["Reine", [ing("Jambon", 150, "g", "viande", true), ing("Champignons", 200, "g", "legumes", true), ing("Mozzarella", 200, "g", "frais", true)], "champignon", "red_meat"],
    ["Végétarienne", [ing("Poivrons", 2, "pièces", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true), ing("Mozzarella", 200, "g", "frais", true)], "poivron", "veggie"],
    ["Quatre fromages", [ing("Mozzarella", 150, "g", "frais", true), ing("Gorgonzola", 80, "g", "frais", true), ing("Chèvre", 80, "g", "frais", true), ing("Parmesan", 50, "g", "frais", true)], "fromage", "veggie"],
    ["Tonno", [ing("Thon", 2, "boîtes", "epicerie"), ing("Oignon rouge", 1, "pièce", "legumes"), ing("Mozzarella", 200, "g", "frais", true)], "thon", "fish"],
  ];
  for (const [name, extra, f, p] of pizzas) {
    add("italian", p, "bread", "oven", `Pizza ${name}`, [
      [ing("Pâte à pizza", 2, "pâtons", "frais", true), ing("Sauce tomate", 250, "g", "epicerie")],
      extra,
    ], { featured: f });
  }

  // Escalopes & plats au four
  const italMains = [
    { name: "Escalope milanaise et spaghetti", p: "poultry", base: "pasta", method: "pan", f: "chapelure", extra: [ing("Escalopes de poulet", 4, "pièces", "viande", true), ing("Chapelure", 150, "g", "epicerie"), ing("Œufs", 2, "pièces", "frais", true)] },
    { name: "Aubergines parmigiana", p: "veggie", base: "none", method: "oven", f: "aubergine", extra: [ing("Aubergines", 3, "pièces", "legumes", true), ing("Sauce tomate", 400, "g", "epicerie"), ing("Mozzarella", 200, "g", "frais", true)] },
    { name: "Saltimbocca de veau", p: "red_meat", base: "grains", method: "pan", f: "sauge", extra: [ing("Veau", 600, "g", "viande", true), ing("Jambon cru", 4, "tranches", "viande", true), ing("Sauge", 1, "bouquet", "legumes", true), ing("Polenta", 250, "g", "epicerie")] },
    { name: "Gnocchi à la sorrentina", p: "veggie", base: "potato", method: "oven", f: "mozzarella", extra: [ing("Gnocchi", 600, "g", "frais", true), ing("Sauce tomate", 400, "g", "epicerie"), ing("Mozzarella", 200, "g", "frais", true)] },
    { name: "Osso buco à la milanaise", p: "red_meat", base: "rice", method: "simmer", f: "tomate", extra: [ing("Jarret de veau", 800, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes")] },
    { name: "Poulet alla cacciatora", p: "poultry", base: "rice", method: "simmer", f: "tomate", extra: [ing("Cuisses de poulet", 4, "pièces", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Olives", 100, "g", "epicerie")] },
  ];
  for (const m of italMains) {
    add("italian", m.p, m.base, m.method, m.name, [m.extra, m.base !== "none" ? BASES[m.base === "pasta" ? "pasta" : m.base === "rice" ? "rice" : m.base === "grains" ? "semolina" : "potato"].ing : []], { featured: m.f });
  }

  // Soupes italiennes
  const itSoups = [
    ["Minestrone", "veggie", [ing("Haricots blancs", 250, "g", "epicerie"), ing("Courgette", 1, "pièce", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), ing("Petites pâtes", 100, "g", "epicerie")], "courgette"],
    ["Pasta e fagioli", "legumes", [ing("Haricots borlotti", 400, "g", "epicerie"), ing("Petites pâtes", 200, "g", "epicerie"), ing("Tomates concassées", 200, "g", "epicerie")], "haricot"],
    ["Ribollita toscane", "veggie", [ing("Chou kale", 200, "g", "legumes", true), ing("Haricots blancs", 250, "g", "epicerie"), ing("Pain rassis", 150, "g", "boulangerie", true)], "chou"],
  ];
  for (const [name, p, extra, f] of itSoups) {
    add("italian", p, "none", "soup", name, [extra, [ONION, GARLIC]], { featured: f, theme: "soupe" });
  }
}

// =============================================================================
// ASIATIQUE
// =============================================================================
function buildAsian() {
  const proteins = [
    { label: "poulet", make: P.poulet },
    { label: "bœuf", make: P.boeuf },
    { label: "crevettes", make: P.crevettes },
    { label: "tofu", make: P.tofu },
    { label: "porc", make: P.porc },
  ];
  const wokSauces = [
    { name: "teriyaki", extra: [ing("Sauce teriyaki", 6, "c. à soupe", "epicerie")], theme: "rapide" },
    { name: "aigre-douce", extra: [ing("Sauce aigre-douce", 6, "c. à soupe", "epicerie"), ing("Ananas", 150, "g", "fruits")] },
    { name: "au gingembre et soja", extra: [ing("Sauce soja", 4, "c. à soupe", "epicerie"), ing("Gingembre", 1, "morceau", "legumes")] },
    { name: "sauce cacahuète", extra: [ing("Beurre de cacahuète", 3, "c. à soupe", "epicerie"), ing("Lait de coco", 15, "cl", "epicerie")], theme: "épicé" },
    { name: "au sésame", extra: [ing("Graines de sésame", 3, "c. à soupe", "epicerie"), ing("Sauce soja", 3, "c. à soupe", "epicerie")] },
    { name: "sauce d'huître", extra: [ing("Sauce d'huître", 4, "c. à soupe", "epicerie")] },
    { name: "au basilic thaï", extra: [ing("Basilic thaï", 1, "bouquet", "legumes", true), ing("Sauce soja", 3, "c. à soupe", "epicerie")] },
  ];
  const asianBases = [
    { key: "rice", label: "riz", base: "rice", ing: BASES.rice.ing },
    { key: "noodles", label: "nouilles sautées", base: "pasta", ing: [ing("Nouilles chinoises", 300, "g", "epicerie")] },
    { key: "ricenoodles", label: "nouilles de riz", base: "rice", ing: [ing("Nouilles de riz", 300, "g", "epicerie")] },
  ];
  for (const pr of shuffle(proteins)) {
    for (const s of shuffle(wokSauces)) {
      for (const b of shuffle(asianBases)) {
        const prot = pr.make();
        const v = pick(VEG);
        const name = `Wok de ${pr.label} ${s.name}, ${b.label}`;
        add("asian", prot.p, b.base, "pan", name, [prot.ing, b.ing, s.extra, [v.ing]], {
          featured: v.f,
          theme: s.theme,
        });
      }
    }
  }

  // Curries
  const curries = [
    ["curry vert thaï", [ing("Pâte de curry vert", 2, "c. à soupe", "epicerie"), ing("Lait de coco", 40, "cl", "epicerie")], "épicé"],
    ["curry rouge thaï", [ing("Pâte de curry rouge", 2, "c. à soupe", "epicerie"), ing("Lait de coco", 40, "cl", "epicerie")], "épicé"],
    ["curry jaune", [ing("Pâte de curry jaune", 2, "c. à soupe", "epicerie"), ing("Lait de coco", 30, "cl", "epicerie"), ing("Pomme de terre", 2, "pièces", "legumes")], null],
    ["curry japonais", [ing("Roux de curry japonais", 100, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes")], null],
    ["korma", [ing("Crème de coco", 20, "cl", "epicerie"), ing("Amandes en poudre", 50, "g", "epicerie")], null],
    ["madras", [ing("Curry madras", 2, "c. à soupe", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie")], "épicé"],
    ["butter chicken", [ing("Tomates concassées", 400, "g", "epicerie"), ing("Crème", 20, "cl", "frais", true), ing("Garam masala", 2, "c. à café", "epicerie")], null],
  ];
  const curryProt = [
    { label: "poulet", make: P.poulet, p: "poultry" },
    { label: "crevettes", make: P.crevettes, p: "fish" },
    { label: "légumes", make: () => ({ p: "veggie", ing: [ing("Légumes variés", 600, "g", "legumes", true)] }), p: "veggie" },
    { label: "pois chiches", make: P.poisChiches, p: "legumes" },
  ];
  for (const [cname, extra, theme] of shuffle(curries)) {
    for (const cp of shuffle(curryProt).slice(0, 2)) {
      const prot = cp.make();
      const name = `${cap(cname)} ${cp.label === "légumes" ? "de légumes" : cp.label === "pois chiches" ? "de pois chiches" : `au ${cp.label}`}, riz`;
      add("asian", prot.p, "rice", "simmer", name, [prot.ing, BASES.basmati.ing, extra], {
        featured: cname,
        theme,
      });
    }
  }

  // Soupes asiatiques
  const soups = [
    ["Pho au bœuf", "red_meat", [ing("Bœuf", 300, "g", "viande", true), ing("Nouilles de riz", 250, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true), ing("Gingembre", 1, "morceau", "legumes")], "coriandre"],
    ["Pho au poulet", "poultry", [ing("Blancs de poulet", 400, "g", "viande", true), ing("Nouilles de riz", 250, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true)], "coriandre"],
    ["Ramen au porc", "red_meat", [ing("Porc", 300, "g", "viande", true), ing("Nouilles ramen", 300, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true)], "œuf"],
    ["Ramen aux légumes", "eggs", [ing("Nouilles ramen", 300, "g", "epicerie"), ing("Champignons shiitaké", 200, "g", "legumes", true), ing("Œufs", 4, "pièces", "frais", true), ing("Pak choï", 2, "pièces", "legumes", true)], "shiitaké"],
    ["Soupe miso et tofu", "veggie", [ing("Miso", 4, "c. à soupe", "epicerie"), ing("Tofu", 200, "g", "frais", true), ing("Algues wakamé", 10, "g", "epicerie")], "tofu"],
    ["Tom yum aux crevettes", "fish", [ing("Crevettes", 300, "g", "poisson", true), ing("Citronnelle", 2, "tiges", "legumes", true), ing("Champignons", 150, "g", "legumes", true)], "citronnelle"],
  ];
  for (const [name, p, extra, f] of soups) {
    add("asian", p, "none", "soup", name, [extra], { featured: f, theme: "soupe" });
  }

  // Bols / riz sautés / autres
  const bowls = [
    { name: "Riz cantonais", p: "eggs", base: "rice", method: "pan", f: "petits pois", extra: [ing("Riz", 300, "g", "epicerie"), ing("Œufs", 3, "pièces", "frais", true), ing("Petits pois", 150, "g", "surgele"), ing("Jambon", 150, "g", "viande", true)] },
    { name: "Poke bowl au saumon", p: "fish", base: "rice", method: "raw", f: "avocat", extra: [ing("Saumon cru", 300, "g", "poisson", true), ing("Riz", 250, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true), ing("Edamame", 150, "g", "surgele")] },
    { name: "Donburi de poulet", p: "poultry", base: "rice", method: "pan", f: "oignon", extra: [ing("Poulet", 400, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Sauce soja", 4, "c. à soupe", "epicerie"), ing("Oignon", 1, "pièce", "legumes")] },
    { name: "Bibimbap végétarien", p: "eggs", base: "rice", method: "pan", f: "carotte", extra: [ing("Riz", 300, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Épinards", 150, "g", "legumes", true), ing("Œufs", 4, "pièces", "frais", true)] },
    { name: "Pad thaï aux crevettes", p: "fish", base: "rice", method: "pan", f: "cacahuète", extra: [ing("Nouilles de riz", 300, "g", "epicerie"), ing("Crevettes", 300, "g", "poisson", true), ing("Cacahuètes", 60, "g", "epicerie"), ing("Pousses de soja", 150, "g", "legumes", true)] },
    { name: "Bo bun au bœuf", p: "red_meat", base: "rice", method: "raw", f: "menthe", extra: [ing("Vermicelles de riz", 250, "g", "epicerie"), ing("Bœuf", 400, "g", "viande", true), ing("Carottes", 2, "pièces", "legumes"), ing("Menthe", 1, "bouquet", "legumes", true)] },
    { name: "Nouilles sautées aux légumes", p: "veggie", base: "pasta", method: "pan", f: "chou", extra: [ing("Nouilles chinoises", 300, "g", "epicerie"), ing("Chou chinois", 200, "g", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), ing("Sauce soja", 4, "c. à soupe", "epicerie")] },
  ];
  for (const b of bowls) {
    add("asian", b.p, b.base, b.method, b.name, [b.extra], { featured: b.f });
  }
}

// =============================================================================
// DU MONDE
// =============================================================================
function buildWorld() {
  const dishes = [
    // Mexique / Amériques
    { name: "Chili con carne", p: "red_meat", base: "none", method: "simmer", f: "haricot rouge", extra: [ing("Bœuf haché", 400, "g", "viande", true), ing("Haricots rouges", 400, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Poivron", 1, "pièce", "legumes", true)], theme: "épicé" },
    { name: "Chili sin carne", p: "legumes", base: "rice", method: "simmer", f: "haricot rouge", extra: [ing("Haricots rouges", 400, "g", "epicerie"), ing("Maïs", 150, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie")], theme: "épicé" },
    { name: "Fajitas de poulet", p: "poultry", base: "bread", method: "pan", f: "poivron", extra: [ing("Poulet", 500, "g", "viande", true), ing("Poivrons", 3, "pièces", "legumes", true), ing("Tortillas", 8, "pièces", "boulangerie", true)] },
    { name: "Burrito bowl au bœuf", p: "red_meat", base: "rice", method: "pan", f: "avocat", extra: [ing("Bœuf haché", 400, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Haricots noirs", 250, "g", "epicerie"), ing("Avocat", 2, "pièces", "fruits", true)] },
    { name: "Tacos de poisson", p: "fish", base: "bread", method: "pan", f: "chou", extra: [ing("Cabillaud", 400, "g", "poisson", true), ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Chou rouge", 150, "g", "legumes", true)] },
    { name: "Enchiladas aux haricots", p: "legumes", base: "bread", method: "oven", f: "haricot noir", extra: [ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Haricots noirs", 400, "g", "epicerie"), ing("Sauce tomate", 300, "g", "epicerie"), ing("Cheddar", 150, "g", "frais", true)] },
    { name: "Quesadillas aux légumes", p: "veggie", base: "bread", method: "pan", f: "poivron", extra: [ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Cheddar", 150, "g", "frais", true)] },
    // Maghreb
    { name: "Tajine de poulet au citron", p: "poultry", base: "grains", method: "simmer", f: "citron confit", extra: [ing("Cuisses de poulet", 4, "pièces", "viande", true), ing("Citron confit", 1, "pièce", "epicerie"), ing("Olives vertes", 100, "g", "epicerie"), ing("Semoule", 300, "g", "epicerie")] },
    { name: "Tajine d'agneau aux pruneaux", p: "red_meat", base: "grains", method: "simmer", f: "pruneau", extra: [ing("Épaule d'agneau", 700, "g", "viande", true), ing("Pruneaux", 150, "g", "epicerie"), ing("Amandes", 50, "g", "epicerie"), ing("Semoule", 300, "g", "epicerie")] },
    { name: "Couscous végétarien", p: "veggie", base: "grains", method: "simmer", f: "courgette", extra: [ing("Semoule", 300, "g", "epicerie"), ing("Pois chiches", 250, "g", "epicerie"), ing("Courgettes", 2, "pièces", "legumes", true), ing("Carottes", 3, "pièces", "legumes")] },
    { name: "Kefta de bœuf à la tomate", p: "red_meat", base: "grains", method: "simmer", f: "tomate", extra: [ing("Bœuf haché", 400, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true), ing("Semoule", 250, "g", "epicerie")] },
    // Moyen-Orient
    { name: "Falafels et houmous", p: "legumes", base: "bread", method: "pan", f: "pois chiche", extra: [ing("Pois chiches secs", 300, "g", "epicerie"), ing("Houmous", 200, "g", "frais", true), ing("Pains pita", 4, "pièces", "boulangerie", true), ing("Persil", 1, "bouquet", "legumes", true)] },
    { name: "Shakshuka", p: "eggs", base: "bread", method: "pan", f: "poivron", extra: [ing("Œufs", 6, "pièces", "frais", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Poivrons", 2, "pièces", "legumes", true)], theme: "épicé" },
    { name: "Mujaddara (riz-lentilles)", p: "legumes", base: "rice", method: "simmer", f: "oignon", extra: [ing("Lentilles", 250, "g", "epicerie"), ing("Riz", 250, "g", "epicerie"), ing("Oignons", 3, "pièces", "legumes")] },
    { name: "Boulettes d'agneau sauce yaourt", p: "red_meat", base: "grains", method: "pan", f: "menthe", extra: [ing("Agneau haché", 400, "g", "viande", true), ing("Yaourt grec", 200, "g", "frais", true), ing("Menthe", 1, "bouquet", "legumes", true), ing("Boulgour", 250, "g", "epicerie")] },
    // Inde
    { name: "Dahl de lentilles", p: "legumes", base: "rice", method: "simmer", f: "lentille", extra: [ing("Lentilles corail", 300, "g", "epicerie"), ing("Lait de coco", 20, "cl", "epicerie"), ing("Tomates", 2, "pièces", "legumes", true), ing("Riz basmati", 250, "g", "epicerie")] },
    { name: "Biryani de légumes", p: "veggie", base: "rice", method: "simmer", f: "carotte", extra: [ing("Riz basmati", 350, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Petits pois", 150, "g", "surgele"), ing("Épices biryani", 2, "c. à soupe", "epicerie")] },
    { name: "Poulet tikka masala", p: "poultry", base: "rice", method: "simmer", f: "tomate", extra: [ing("Poulet", 500, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Crème", 20, "cl", "frais", true), ing("Riz basmati", 300, "g", "epicerie")] },
    // Espagne / Méditerranée
    { name: "Paella aux fruits de mer", p: "fish", base: "rice", method: "simmer", f: "fruits de mer", extra: [ing("Riz rond", 350, "g", "epicerie"), ing("Fruits de mer", 500, "g", "poisson", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Safran", 1, "dose", "epicerie")] },
    { name: "Tortilla espagnole", p: "eggs", base: "potato", method: "pan", f: "pomme de terre", extra: [ing("Œufs", 6, "pièces", "frais", true), ing("Pommes de terre", 600, "g", "legumes"), ing("Oignon", 1, "pièce", "legumes")] },
    { name: "Gazpacho andalou", p: "veggie", base: "none", method: "raw", f: "tomate", extra: [ing("Tomates", 6, "pièces", "legumes", true), ing("Concombre", 1, "pièce", "legumes", true), ing("Poivron", 1, "pièce", "legumes", true), ing("Pain", 100, "g", "boulangerie", true)], theme: "été" },
    // Autres
    { name: "Goulash hongrois", p: "red_meat", base: "potato", method: "simmer", f: "paprika", extra: [ing("Bœuf à mijoter", 700, "g", "viande", true), ing("Paprika", 2, "c. à soupe", "epicerie"), ing("Pommes de terre", 500, "g", "legumes"), ing("Poivrons", 2, "pièces", "legumes", true)] },
    { name: "Moussaka", p: "red_meat", base: "none", method: "oven", f: "aubergine", extra: [ing("Agneau haché", 400, "g", "viande", true), ing("Aubergines", 3, "pièces", "legumes", true), ing("Béchamel", 40, "cl", "epicerie")] },
    { name: "Jambalaya", p: "poultry", base: "rice", method: "simmer", f: "poivron", extra: [ing("Poulet", 300, "g", "viande", true), ing("Saucisse fumée", 200, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Poivrons", 2, "pièces", "legumes", true)], theme: "épicé" },
    { name: "Curry de patate douce africain", p: "veggie", base: "rice", method: "simmer", f: "patate douce", extra: [ing("Patates douces", 2, "pièces", "legumes"), ing("Beurre de cacahuète", 3, "c. à soupe", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")] },
    { name: "Feijoada légère", p: "legumes", base: "rice", method: "simmer", f: "haricot noir", extra: [ing("Haricots noirs", 400, "g", "epicerie"), ing("Saucisse fumée", 150, "g", "viande", true), ing("Riz", 300, "g", "epicerie")] },
    { name: "Bobotie sud-africain", p: "red_meat", base: "rice", method: "oven", f: "curry", extra: [ing("Bœuf haché", 500, "g", "viande", true), ing("Œufs", 2, "pièces", "frais", true), ing("Curry", 1, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")] },
    { name: "Soupe de lentilles à l'orientale", p: "legumes", base: "none", method: "soup", f: "lentille", extra: [ing("Lentilles corail", 300, "g", "epicerie"), ing("Cumin", 1, "c. à café", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Citron", 1, "pièce", "fruits")], theme: "soupe" },
  ];
  for (const d of dishes) {
    add("world", d.p, d.base, d.method, d.name, [d.extra], { featured: d.f, theme: d.theme });
  }

  // Tajines paramétriques (protéine × garniture)
  const tajProt = [
    { label: "de poulet", make: P.cuisses, p: "poultry" },
    { label: "d'agneau", make: () => ({ p: "red_meat", ing: [ing("Épaule d'agneau", 700, "g", "viande", true)] }), p: "red_meat" },
    { label: "de poisson", make: P.cabillaud, p: "fish" },
    { label: "de légumes", make: () => ({ p: "veggie", ing: [ing("Légumes variés", 600, "g", "legumes", true)] }), p: "veggie" },
    { label: "de pois chiches", make: P.poisChiches, p: "legumes" },
  ];
  const tajGarn = [
    ["aux abricots", ing("Abricots secs", 150, "g", "epicerie"), "abricot"],
    ["aux olives et citron", ing("Olives vertes", 100, "g", "epicerie"), "olive"],
    ["aux pruneaux", ing("Pruneaux", 150, "g", "epicerie"), "pruneau"],
    ["aux légumes d'automne", ing("Potiron", 400, "g", "legumes", true), "potiron"],
  ];
  for (const tp of tajProt) {
    for (const [gname, gi, f] of tajGarn) {
      const prot = tp.make();
      add("world", tp.p, "grains", "simmer", `Tajine ${tp.label} ${gname}`, [
        prot.ing,
        [gi, ing("Semoule", 300, "g", "epicerie"), ing("Ras-el-hanout", 2, "c. à café", "epicerie"), ONION],
      ], { featured: f, theme: "épicé" });
    }
  }

  // Bowls / salades du monde
  const worldBowls = [
    { name: "Buddha bowl falafel", p: "legumes", base: "grains", method: "raw", f: "pois chiche", extra: [ing("Falafels", 8, "pièces", "frais", true), ing("Boulgour", 250, "g", "epicerie"), ing("Concombre", 1, "pièce", "legumes", true), ing("Houmous", 150, "g", "frais", true)] },
    { name: "Salade taboulé libanais", p: "veggie", base: "grains", method: "raw", f: "menthe", extra: [ing("Boulgour fin", 200, "g", "epicerie"), ing("Persil", 2, "bouquets", "legumes", true), ing("Menthe", 1, "bouquet", "legumes", true), ing("Tomates", 3, "pièces", "legumes", true)], theme: "été" },
    { name: "Salade mexicaine haricots-maïs", p: "legumes", base: "none", method: "raw", f: "maïs", extra: [ing("Haricots noirs", 250, "g", "epicerie"), ing("Maïs", 200, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true), ing("Coriandre", 1, "bouquet", "legumes", true)], theme: "été" },
    { name: "Poke bowl thon-mangue", p: "fish", base: "rice", method: "raw", f: "mangue", extra: [ing("Thon cru", 300, "g", "poisson", true), ing("Riz", 250, "g", "epicerie"), ing("Mangue", 1, "pièce", "fruits", true), ing("Avocat", 1, "pièce", "fruits", true)] },
    { name: "Wrap au poulet et avocat", p: "poultry", base: "bread", method: "pan", f: "avocat", extra: [ing("Poulet", 400, "g", "viande", true), ing("Tortillas", 4, "pièces", "boulangerie", true), ing("Avocat", 1, "pièce", "fruits", true), ing("Salade", 1, "pièce", "legumes", true)] },
  ];
  for (const b of worldBowls) {
    add("world", b.p, b.base, b.method, b.name, [b.extra], { featured: b.f, theme: b.theme });
  }

  // Currys & plats mijotés supplémentaires
  const moreWorld = [
    { name: "Curry de pois chiches épinards", p: "legumes", base: "rice", method: "simmer", f: "épinard", extra: [ing("Pois chiches", 400, "g", "epicerie"), ing("Épinards", 200, "g", "legumes", true), ing("Lait de coco", 20, "cl", "epicerie"), ing("Riz", 300, "g", "epicerie")] },
    { name: "Ropa vieja cubaine", p: "red_meat", base: "rice", method: "simmer", f: "poivron", extra: [ing("Bœuf effiloché", 600, "g", "viande", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")] },
    { name: "Curry massaman de bœuf", p: "red_meat", base: "rice", method: "simmer", f: "cacahuète", extra: [ing("Bœuf", 500, "g", "viande", true), ing("Pâte massaman", 3, "c. à soupe", "epicerie"), ing("Lait de coco", 40, "cl", "epicerie"), ing("Cacahuètes", 50, "g", "epicerie")], theme: "épicé" },
    { name: "Saumon à la marocaine (chermoula)", p: "fish", base: "grains", method: "oven", f: "coriandre", extra: [ing("Pavés de saumon", 4, "pièces", "poisson", true), ing("Coriandre", 1, "bouquet", "legumes", true), ing("Citron", 1, "pièce", "fruits"), ing("Semoule", 250, "g", "epicerie")] },
    { name: "Gombo créole au poulet", p: "poultry", base: "rice", method: "simmer", f: "gombo", extra: [ing("Poulet", 400, "g", "viande", true), ing("Gombos", 250, "g", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")], theme: "épicé" },
    { name: "Caponata sicilienne", p: "veggie", base: "bread", method: "simmer", f: "aubergine", extra: [ing("Aubergines", 3, "pièces", "legumes", true), ing("Céleri", 2, "branches", "legumes", true), ing("Olives", 80, "g", "epicerie"), ing("Pain", 1, "pièce", "boulangerie", true)] },
    { name: "Soupe harira", p: "legumes", base: "none", method: "soup", f: "pois chiche", extra: [ing("Pois chiches", 250, "g", "epicerie"), ing("Lentilles", 150, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true)], theme: "soupe" },
    { name: "Aloo gobi (chou-fleur & pommes de terre)", p: "veggie", base: "rice", method: "simmer", f: "chou-fleur", extra: [ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Curcuma", 1, "c. à café", "epicerie"), ing("Riz basmati", 250, "g", "epicerie")] },
  ];
  for (const d of moreWorld) {
    add("world", d.p, d.base, d.method, d.name, [d.extra], { featured: d.f, theme: d.theme });
  }
}

// ── Génération + échantillonnage vers les cibles ─────────────────────────────
buildLocal();
buildItalian();
buildAsian();
buildWorld();

const TARGET = { local: 185, italian: 115, asian: 95, world: 60 };

function sampleOrigin(origin, target) {
  const pool = shuffle(recipes.filter((r) => r.origin === origin));
  // Garantit un minimum de poisson et de végétarien dans chaque origine.
  const fish = pool.filter((r) => r.protein === "fish");
  const veg = pool.filter((r) => isVeg(r.protein));
  const others = pool.filter((r) => r.protein !== "fish" && !isVeg(r.protein));
  const out = [];
  const want = Math.min(target, pool.length);
  const minFish = Math.round(want * 0.16);
  const minVeg = Math.round(want * 0.34);
  for (const r of fish.slice(0, minFish)) out.push(r);
  for (const r of veg.slice(0, minVeg)) out.push(r);
  const rest = shuffle([...others, ...fish.slice(minFish), ...veg.slice(minVeg)]);
  for (const r of rest) {
    if (out.length >= want) break;
    out.push(r);
  }
  return out;
}

let finalRecipes = [];
for (const origin of ["local", "italian", "asian", "world"]) {
  finalRecipes.push(...sampleOrigin(origin, TARGET[origin]));
}

// Identifiants stables.
const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

const usedIds = new Set();
finalRecipes = finalRecipes.map((r, i) => {
  let id = `gen-${slug(r.name)}`;
  let n = 2;
  while (usedIds.has(id)) id = `gen-${slug(r.name)}-${n++}`;
  usedIds.add(id);
  const { extraFat, ...rest } = r;
  return { id, ...rest };
});

writeFileSync(OUT, JSON.stringify(finalRecipes, null, 2) + "\n", "utf8");

const counts = finalRecipes.reduce((acc, r) => {
  acc[r.origin] = (acc[r.origin] ?? 0) + 1;
  return acc;
}, {});
console.log(`✅ ${finalRecipes.length} recettes générées →`, counts);
console.log(
  "Protéines:",
  finalRecipes.reduce((a, r) => ((a[r.protein] = (a[r.protein] ?? 0) + 1), a), {}),
);
