// @ts-nocheck
/**
 * Générateur de seed de recettes (≈ 1000+).
 *
 * Produit des recettes réalistes et nommées, réparties sur les 4 origines, à
 * partir de briques culinaires cohérentes (protéines, bases/féculents, légumes,
 * sauces/thèmes) ET de très nombreux plats nommés par sous-cuisine
 * (français/régional, italien, japonais/chinois/thaï/vietnamien/coréen/indien,
 * maghreb/moyen-orient/grec/ibérique/africain/latino…).
 *
 * Nutrition calculée par profils (protéine + base + légumes). Catégories de
 * rayon portées par les fragments d'ingrédients. Déterministe (RNG seedé).
 *   node scripts/generate-recipes.mjs  →  src/data/recipes.generated.json
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "recipes.generated.json");
const CURATED_NAMES = JSON.parse(
  readFileSync(join(__dirname, "curated-names.json"), "utf8"),
);

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
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Ingrédients ──────────────────────────────────────────────────────────────
const ing = (name, qty, unit, category, perishable = false) => ({
  name,
  qty,
  unit,
  category,
  perishable,
});
const ONION = ing("Oignon", 1, "pièce", "legumes");
const GARLIC = ing("Ail", 2, "gousses", "legumes");
const COCO = ing("Lait de coco", 40, "cl", "epicerie");
const SOY = ing("Sauce soja", 4, "c. à soupe", "epicerie");

// ── Profils nutritionnels (par portion) ──────────────────────────────────────
const PROTEIN_PROFILE = {
  red_meat: { p: 32, f: 20 },
  poultry: { p: 35, f: 10 },
  fish: { p: 30, f: 12 },
  legumes: { p: 18, f: 7 },
  eggs: { p: 20, f: 14 },
  veggie: { p: 11, f: 9 },
};
const BASE_CARBS = { pasta: 70, rice: 65, potato: 45, grains: 60, bread: 42, none: 14 };

function computeNutrition(protein, base, vegCount, extraFat = 0) {
  const pp = PROTEIN_PROFILE[protein];
  const protein_g = Math.round(pp.p + (rng() * 6 - 3));
  const fat_g = Math.round(pp.f + extraFat + (rng() * 6 - 3));
  const carbs_g = Math.round(BASE_CARBS[base] + vegCount * 4 + (rng() * 8 - 4));
  const fiber_g = Math.round(3 + vegCount * 2 + (base === "none" ? 0 : 1) + rng() * 3);
  const kcal = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  return {
    kcal,
    protein_g: Math.max(6, protein_g),
    carbs_g: Math.max(8, carbs_g),
    fat_g: Math.max(4, fat_g),
    fiber_g: Math.max(1, fiber_g),
  };
}

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
const batchFor = (method) => method === "simmer" || method === "soup" || method === "oven";

// ── Bases / féculents ────────────────────────────────────────────────────────
const BASES = {
  rice: { label: "riz", base: "rice", ing: [ing("Riz", 300, "g", "epicerie")] },
  basmati: { label: "riz basmati", base: "rice", ing: [ing("Riz basmati", 300, "g", "epicerie")] },
  pasta: { label: "pâtes", base: "pasta", ing: [ing("Pâtes", 400, "g", "epicerie")] },
  tagliatelles: { label: "tagliatelles", base: "pasta", ing: [ing("Tagliatelles", 400, "g", "epicerie")] },
  potato: { label: "pommes de terre", base: "potato", ing: [ing("Pommes de terre", 800, "g", "legumes")] },
  mash: { label: "purée", base: "potato", ing: [ing("Pommes de terre", 800, "g", "legumes"), ing("Lait", 15, "cl", "frais", true), ing("Beurre", 30, "g", "frais", true)] },
  fries: { label: "frites maison", base: "potato", ing: [ing("Pommes de terre", 800, "g", "legumes")] },
  gratin: { label: "gratin de pommes de terre", base: "potato", ing: [ing("Pommes de terre", 800, "g", "legumes"), ing("Crème fraîche", 20, "cl", "frais", true)] },
  semolina: { label: "semoule", base: "grains", ing: [ing("Semoule", 300, "g", "epicerie")] },
  polenta: { label: "polenta", base: "grains", ing: [ing("Polenta", 250, "g", "epicerie")] },
  bulgur: { label: "boulgour", base: "grains", ing: [ing("Boulgour", 250, "g", "epicerie")] },
  quinoa: { label: "quinoa", base: "grains", ing: [ing("Quinoa", 250, "g", "epicerie")] },
  bread: { label: "pain", base: "bread", ing: [ing("Pain de campagne", 1, "pièce", "boulangerie", true)] },
  greens: { label: "salade", base: "none", ing: [ing("Salade verte", 1, "pièce", "legumes", true)] },
  veggies: { label: "poêlée de légumes", base: "none", ing: [ing("Mélange de légumes", 500, "g", "legumes", true)] },
  lentils: { label: "lentilles", base: "none", ing: [ing("Lentilles vertes", 300, "g", "epicerie")] },
  ratatouille: { label: "ratatouille", base: "none", ing: [ing("Aubergine", 1, "pièce", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true), ing("Tomates", 3, "pièces", "legumes", true)] },
};

// ── Légumes vedettes ─────────────────────────────────────────────────────────
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
  { f: "chou-fleur", ing: ing("Chou-fleur", 1, "pièce", "legumes", true) },
  { f: "patate douce", ing: ing("Patate douce", 2, "pièces", "legumes") },
  { f: "asperge", ing: ing("Asperges", 250, "g", "legumes", true) },
  { f: "pak choï", ing: ing("Pak choï", 2, "pièces", "legumes", true) },
  { f: "chou", ing: ing("Chou", 300, "g", "legumes", true) },
  { f: "butternut", ing: ing("Butternut", 600, "g", "legumes", true) },
];

// ─────────────────────────────────────────────────────────────────────────────
const recipes = [];
const seenNames = new Set(CURATED_NAMES.map((n) => n.toLowerCase()));
const seenSigCount = new Map();

function add(origin, protein, base, method, name, frags, opts = {}) {
  const key = name.toLowerCase();
  if (seenNames.has(key)) return false;
  const sig = `${origin}|${protein}|${base}|${method}|${opts.featured ?? ""}|${opts.theme ?? ""}`;
  const sigCount = seenSigCount.get(sig) ?? 0;
  if (sigCount >= 12) return false;

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
    nutrition: computeNutrition(protein, base, vegCount, opts.extraFat ?? 0),
    instructions: opts.instructions ?? defaultInstructions(method),
  });
  seenNames.add(key);
  seenSigCount.set(sig, sigCount + 1);
  return true;
}

/** Plat nommé : ings = liste complète de fragments d'ingrédients. */
function nd(origin, name, p, base, method, f, ings, theme) {
  add(origin, p, base, method, name, [ings], { featured: f, theme });
}

function defaultInstructions(method) {
  switch (method) {
    case "oven":
      return ["Préchauffer le four à 200 °C.", "Disposer les ingrédients dans un plat et assaisonner.", "Enfourner jusqu'à belle coloration et cuisson à cœur."];
    case "simmer":
      return ["Faire revenir l'oignon et l'ail.", "Ajouter le reste des ingrédients et couvrir de liquide.", "Laisser mijoter à feu doux, rectifier l'assaisonnement."];
    case "soup":
      return ["Faire suer les légumes.", "Couvrir de bouillon et cuire jusqu'à tendreté.", "Mixer ou servir tel quel, ajuster l'assaisonnement."];
    case "raw":
      return ["Préparer et couper tous les ingrédients.", "Assembler dans un saladier ou un bol.", "Assaisonner et servir frais."];
    case "steam":
      return ["Cuire la base à la vapeur ou à l'eau.", "Cuire la garniture à la vapeur.", "Dresser et napper de sauce."];
    default:
      return ["Préparer les ingrédients.", "Saisir la protéine puis les légumes à la poêle.", "Mélanger, assaisonner et servir aussitôt."];
  }
}

// ── Fragments protéines ──────────────────────────────────────────────────────
const P = {
  poulet: () => ({ p: "poultry", ing: [ing("Filets de poulet", 500, "g", "viande", true)] }),
  cuisses: () => ({ p: "poultry", ing: [ing("Cuisses de poulet", 4, "pièces", "viande", true)] }),
  dinde: () => ({ p: "poultry", ing: [ing("Escalopes de dinde", 500, "g", "viande", true)] }),
  canard: () => ({ p: "poultry", ing: [ing("Magret de canard", 2, "pièces", "viande", true)] }),
  lapin: () => ({ p: "poultry", ing: [ing("Lapin", 1, "pièce", "viande", true)] }),
  boeuf: () => ({ p: "red_meat", ing: [ing("Bœuf", 500, "g", "viande", true)] }),
  boeufHache: () => ({ p: "red_meat", ing: [ing("Bœuf haché", 400, "g", "viande", true)] }),
  porc: () => ({ p: "red_meat", ing: [ing("Sauté de porc", 500, "g", "viande", true)] }),
  agneau: () => ({ p: "red_meat", ing: [ing("Agneau", 600, "g", "viande", true)] }),
  veau: () => ({ p: "red_meat", ing: [ing("Veau", 600, "g", "viande", true)] }),
  saucisse: () => ({ p: "red_meat", ing: [ing("Saucisses", 4, "pièces", "viande", true)] }),
  saumon: () => ({ p: "fish", ing: [ing("Pavés de saumon", 4, "pièces", "poisson", true)] }),
  cabillaud: () => ({ p: "fish", ing: [ing("Dos de cabillaud", 4, "pièces", "poisson", true)] }),
  truite: () => ({ p: "fish", ing: [ing("Filets de truite", 4, "pièces", "poisson", true)] }),
  dorade: () => ({ p: "fish", ing: [ing("Dorade", 2, "pièces", "poisson", true)] }),
  bar: () => ({ p: "fish", ing: [ing("Filets de bar", 4, "pièces", "poisson", true)] }),
  lieu: () => ({ p: "fish", ing: [ing("Filets de lieu", 4, "pièces", "poisson", true)] }),
  maquereau: () => ({ p: "fish", ing: [ing("Maquereaux", 4, "pièces", "poisson", true)] }),
  crevettes: () => ({ p: "fish", ing: [ing("Crevettes", 400, "g", "poisson", true)] }),
  thon: () => ({ p: "fish", ing: [ing("Thon", 400, "g", "poisson", true)] }),
  tofu: () => ({ p: "veggie", ing: [ing("Tofu ferme", 400, "g", "frais", true)] }),
  oeufs: () => ({ p: "eggs", ing: [ing("Œufs", 6, "pièces", "frais", true)] }),
  lentilles: () => ({ p: "legumes", ing: [ing("Lentilles", 350, "g", "epicerie")] }),
  poisChiches: () => ({ p: "legumes", ing: [ing("Pois chiches", 400, "g", "epicerie")] }),
  haricotsRouges: () => ({ p: "legumes", ing: [ing("Haricots rouges", 400, "g", "epicerie")] }),
};

// =============================================================================
// LOCALE
// =============================================================================
function buildLocal() {
  const meats = [
    { label: "Poulet", make: P.poulet },
    { label: "Émincé de dinde", make: P.dinde },
    { label: "Sauté de veau", make: P.veau },
    { label: "Sauté de porc", make: P.porc },
    { label: "Pavé de bœuf", make: P.boeuf },
    { label: "Magret de canard", make: P.canard },
    { label: "Souris d'agneau", make: P.agneau },
    { label: "Suprême de pintade", make: P.poulet },
  ];
  const sauces = [
    { name: "à la moutarde", extra: [ing("Moutarde", 2, "c. à soupe", "epicerie"), ing("Crème fraîche", 15, "cl", "frais", true)], theme: "crémeux" },
    { name: "forestier", extra: [ing("Champignons", 250, "g", "legumes", true), ing("Crème fraîche", 15, "cl", "frais", true)], featured: "champignon" },
    { name: "à la provençale", extra: [ing("Tomates", 3, "pièces", "legumes", true), ing("Herbes de Provence", 1, "c. à café", "epicerie")], featured: "tomate", theme: "été" },
    { name: "au thym et citron", extra: [ing("Citron", 1, "pièce", "fruits"), ing("Thym", 1, "c. à café", "epicerie")] },
    { name: "à la crème et au poivre", extra: [ing("Crème fraîche", 20, "cl", "frais", true), ing("Poivre", 1, "c. à café", "epicerie")], theme: "crémeux" },
    { name: "au miel et romarin", extra: [ing("Miel", 2, "c. à soupe", "epicerie"), ing("Romarin", 1, "branche", "legumes", true)] },
    { name: "aux oignons confits", extra: [ing("Oignons", 4, "pièces", "legumes")], featured: "oignon" },
    { name: "à la normande", extra: [ing("Cidre", 20, "cl", "boissons"), ing("Crème fraîche", 15, "cl", "frais", true), ing("Pommes", 2, "pièces", "fruits", true)], featured: "pomme" },
    { name: "à l'estragon", extra: [ing("Estragon", 1, "bouquet", "legumes", true), ing("Crème fraîche", 15, "cl", "frais", true)], theme: "crémeux" },
    { name: "aux poivrons", extra: [ing("Poivrons", 3, "pièces", "legumes", true), ing("Tomates", 2, "pièces", "legumes", true)], featured: "poivron" },
    { name: "au vin blanc et échalotes", extra: [ing("Vin blanc", 15, "cl", "boissons"), ing("Échalotes", 3, "pièces", "legumes")], featured: "échalote" },
    { name: "au curry doux", extra: [ing("Curry", 1, "c. à soupe", "epicerie"), ing("Lait de coco", 20, "cl", "epicerie")], featured: "curry" },
    { name: "aux champignons et lardons", extra: [ing("Champignons", 250, "g", "legumes", true), ing("Lardons", 150, "g", "viande", true)], featured: "champignon" },
    { name: "façon basquaise", extra: [ing("Poivrons", 2, "pièces", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Piment d'Espelette", 1, "c. à café", "epicerie")], featured: "poivron" },
  ];
  const accomps = ["potato", "mash", "rice", "veggies", "tagliatelles", "greens", "gratin", "fries", "lentils", "ratatouille"];
  for (const m of shuffle(meats)) {
    for (const s of shuffle(sauces)) {
      for (const a of shuffle(accomps)) {
        const prot = m.make();
        const b = BASES[a];
        const method = a === "potato" || a === "mash" || a === "gratin" || a === "ratatouille" ? (rng() > 0.5 ? "oven" : "pan") : "pan";
        const name = `${m.label} ${s.name}, ${b.label}`;
        add("local", prot.p, b.base, method, name, [prot.ing, b.ing, s.extra], { featured: s.featured ?? b.label, theme: s.theme });
      }
    }
  }

  // Poissons
  const fishes = [
    { label: "Saumon", make: P.saumon },
    { label: "Cabillaud", make: P.cabillaud },
    { label: "Truite", make: P.truite },
    { label: "Dorade", make: P.dorade },
    { label: "Bar", make: P.bar },
    { label: "Lieu jaune", make: P.lieu },
    { label: "Maquereau", make: P.maquereau },
  ];
  const fishPreps = [
    { name: "en papillote", method: "oven" },
    { name: "rôti au four", method: "oven" },
    { name: "poêlé au beurre", method: "pan", extra: [ing("Beurre", 40, "g", "frais", true)] },
    { name: "vapeur", method: "steam" },
    { name: "grillé", method: "pan" },
    { name: "sauce vierge", method: "pan", extra: [ing("Tomates", 2, "pièces", "legumes", true), ing("Citron", 1, "pièce", "fruits")] },
  ];
  const fishSides = ["rice", "potato", "veggies", "greens", "quinoa", "ratatouille"];
  for (const fsh of shuffle(fishes)) {
    for (const prep of shuffle(fishPreps)) {
      for (const v of shuffle(VEG).slice(0, 3)) {
        const side = pick(fishSides);
        const prot = fsh.make();
        const b = BASES[side];
        const name = `${fsh.label} ${prep.name}, ${v.f} et ${b.label}`;
        add("local", "fish", b.base, prep.method, name, [prot.ing, b.ing, [v.ing], prep.extra ?? []], { featured: v.f });
      }
    }
  }

  // Veloutés / soupes
  const veloutes = [
    ["potiron", "Potiron", 1, "kg"], ["courgette", "Courgettes", 800, "g"], ["poireau", "Poireaux", 4, "pièces"],
    ["champignon", "Champignons", 400, "g"], ["carotte", "Carottes", 6, "pièces"], ["tomate", "Tomates", 6, "pièces"],
    ["brocoli", "Brocoli", 2, "pièces"], ["châtaigne", "Châtaignes", 400, "g"], ["petits pois", "Petits pois", 400, "g"],
    ["panais", "Panais", 5, "pièces"], ["butternut", "Butternut", 1, "kg"], ["lentille corail", "Lentilles corail", 250, "g"],
    ["chou-fleur", "Chou-fleur", 1, "pièce"], ["topinambour", "Topinambours", 600, "g"], ["asperge", "Asperges", 500, "g"],
    ["betterave", "Betteraves", 4, "pièces"], ["céleri-rave", "Céleri-rave", 1, "pièce"], ["cresson", "Cresson", 2, "bottes"],
  ];
  for (const [f, n, q, u] of veloutes) {
    const prot = f === "lentille corail" ? "legumes" : "veggie";
    add("local", prot, "none", "soup", `Velouté de ${f}`, [
      [ing(n, q, u, f === "lentille corail" ? "epicerie" : "legumes", true)],
      [ONION, ing("Crème fraîche", 10, "cl", "frais", true), ing("Bouillon de légumes", 75, "cl", "epicerie")],
    ], { featured: f, theme: "soupe" });
  }

  // Plats végétariens nommés
  const veggieMains = [
    ["Gratin de courgettes", "oven", "courgette", [ing("Courgettes", 800, "g", "legumes", true), ing("Crème fraîche", 20, "cl", "frais", true), ing("Gruyère râpé", 80, "g", "frais", true)], "none", "veggie"],
    ["Gratin de chou-fleur", "oven", "chou-fleur", [ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Béchamel", 40, "cl", "epicerie"), ing("Gruyère râpé", 80, "g", "frais", true)], "none", "veggie"],
    ["Tarte aux légumes du soleil", "oven", "poivron", [ing("Pâte brisée", 1, "rouleau", "frais", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true)], "none", "veggie"],
    ["Quiche aux poireaux", "oven", "poireau", [ing("Pâte brisée", 1, "rouleau", "frais", true), ing("Poireaux", 3, "pièces", "legumes", true), ing("Œufs", 3, "pièces", "frais", true), ing("Crème fraîche", 20, "cl", "frais", true)], "none", "eggs"],
    ["Quiche aux épinards et chèvre", "oven", "épinard", [ing("Pâte brisée", 1, "rouleau", "frais", true), ing("Épinards", 300, "g", "legumes", true), ing("Chèvre", 120, "g", "frais", true), ing("Œufs", 3, "pièces", "frais", true)], "none", "eggs"],
    ["Tian provençal", "oven", "tomate", [ing("Tomates", 4, "pièces", "legumes", true), ing("Courgettes", 2, "pièces", "legumes", true), ing("Aubergine", 1, "pièce", "legumes", true)], "none", "veggie"],
    ["Gratin dauphinois aux épinards", "oven", "épinard", [ing("Pommes de terre", 800, "g", "legumes"), ing("Épinards", 200, "g", "legumes", true), ing("Crème fraîche", 25, "cl", "frais", true)], "potato", "veggie"],
    ["Poêlée de légumes et œufs", "pan", "courgette", [ing("Courgettes", 2, "pièces", "legumes", true), ing("Poivron", 1, "pièce", "legumes", true), ing("Œufs", 4, "pièces", "frais", true)], "none", "eggs"],
    ["Galettes de lentilles", "pan", "lentille", [ing("Lentilles", 300, "g", "epicerie"), ing("Carotte", 1, "pièce", "legumes")], "none", "legumes"],
    ["Crumble de légumes", "oven", "tomate", [ing("Tomates", 4, "pièces", "legumes", true), ing("Courgette", 1, "pièce", "legumes", true), ing("Flocons d'avoine", 100, "g", "epicerie")], "none", "veggie"],
    ["Parmentier de légumes", "oven", "patate douce", [ing("Patates douces", 600, "g", "legumes"), ing("Lentilles", 250, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes")], "none", "legumes"],
    ["Risotto de petit épeautre aux champignons", "pan", "champignon", [ing("Petit épeautre", 300, "g", "epicerie"), ing("Champignons", 300, "g", "legumes", true), ing("Parmesan", 60, "g", "frais", true)], "grains", "veggie"],
    ["Salade de quinoa, avocat et feta", "raw", "avocat", [ing("Quinoa", 250, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true), ing("Feta", 100, "g", "frais", true), ing("Concombre", 1, "pièce", "legumes", true)], "grains", "veggie"],
    ["Salade César au poulet", "raw", "salade", [ing("Poulet", 300, "g", "viande", true), ing("Salade romaine", 1, "pièce", "legumes", true), ing("Parmesan", 50, "g", "frais", true), ing("Croûtons", 100, "g", "boulangerie", true)], "none", "poultry"],
    ["Salade landaise", "raw", "salade", [ing("Gésiers", 150, "g", "viande", true), ing("Magret fumé", 100, "g", "viande", true), ing("Salade", 1, "pièce", "legumes", true), ing("Tomates", 2, "pièces", "legumes", true)], "none", "poultry"],
  ];
  for (const [name, method, f, extra, base, p] of veggieMains) {
    add("local", p, base, method, name, [extra], { featured: f });
  }

  // Œufs
  const omGarn = ["champignon", "fromage", "fines herbes", "lardon", "épinard", "courgette", "pomme de terre", "tomate", "poivron"];
  for (const g of omGarn) {
    add("local", "eggs", "none", "pan", `Omelette aux ${g}s`, [
      [ing("Œufs", 8, "pièces", "frais", true), ing(cap(g), 200, "g", g === "lardon" ? "viande" : g === "fromage" ? "frais" : "legumes", true), ing("Salade verte", 1, "pièce", "legumes", true)],
    ], { featured: g });
  }
  nd("local", "Œufs cocotte aux épinards", "eggs", "bread", "oven", "épinard", [ing("Œufs", 6, "pièces", "frais", true), ing("Épinards", 200, "g", "legumes", true), ing("Crème", 15, "cl", "frais", true), ing("Pain", 1, "pièce", "boulangerie", true)]);
  nd("local", "Frittata aux pommes de terre", "eggs", "potato", "pan", "pomme de terre", [ing("Œufs", 8, "pièces", "frais", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Oignon", 1, "pièce", "legumes")]);

  // Mijotés régionaux
  const stews = [
    ["Bœuf carottes", "red_meat", "none", "carotte", [ing("Bœuf à mijoter", 800, "g", "viande", true), ing("Carottes", 5, "pièces", "legumes")]],
    ["Poule au pot", "poultry", "none", "poireau", [ing("Poule", 1, "pièce", "viande", true), ing("Poireaux", 3, "pièces", "legumes", true), ing("Carottes", 4, "pièces", "legumes")]],
    ["Sauté de veau aux olives", "red_meat", "rice", "tomate", [ing("Veau", 700, "g", "viande", true), ing("Olives", 100, "g", "epicerie"), ing("Tomates", 4, "pièces", "legumes", true)]],
    ["Petit salé aux lentilles", "legumes", "none", "lentille", [ing("Lentilles vertes", 350, "g", "epicerie"), ing("Saucisses", 4, "pièces", "viande", true), ing("Carottes", 3, "pièces", "legumes")]],
    ["Daube provençale", "red_meat", "none", "carotte", [ing("Bœuf", 800, "g", "viande", true), ing("Vin rouge", 40, "cl", "boissons"), ing("Carottes", 4, "pièces", "legumes"), ing("Olives", 80, "g", "epicerie")]],
    ["Navarin d'agneau", "red_meat", "none", "navet", [ing("Agneau", 800, "g", "viande", true), ing("Navets", 4, "pièces", "legumes"), ing("Carottes", 3, "pièces", "legumes"), ing("Petits pois", 150, "g", "surgele")]],
    ["Coq au vin", "poultry", "potato", "champignon", [ing("Coq", 1, "pièce", "viande", true), ing("Vin rouge", 50, "cl", "boissons"), ing("Champignons", 250, "g", "legumes", true), ing("Lardons", 150, "g", "viande", true)]],
    ["Cassoulet maison", "legumes", "none", "haricot", [ing("Haricots blancs", 500, "g", "epicerie"), ing("Saucisse de Toulouse", 4, "pièces", "viande", true), ing("Confit de canard", 2, "cuisses", "viande", true)]],
    ["Choucroute garnie", "red_meat", "none", "chou", [ing("Choucroute", 1, "kg", "epicerie"), ing("Saucisses", 4, "pièces", "viande", true), ing("Pommes de terre", 600, "g", "legumes")]],
    ["Blanquette de la mer", "fish", "rice", "champignon", [ing("Poisson blanc", 600, "g", "poisson", true), ing("Champignons", 200, "g", "legumes", true), ing("Crème", 20, "cl", "frais", true), ing("Riz", 300, "g", "epicerie")]],
    ["Curry de lentilles corail", "legumes", "rice", "lentille corail", [ing("Lentilles corail", 300, "g", "epicerie"), ing("Lait de coco", 20, "cl", "epicerie"), ing("Tomates", 2, "pièces", "legumes", true), ing("Riz", 300, "g", "epicerie")]],
    ["Pot-au-feu de volaille", "poultry", "none", "poireau", [ing("Poulet", 1, "pièce", "viande", true), ing("Poireaux", 3, "pièces", "legumes", true), ing("Carottes", 4, "pièces", "legumes"), ing("Navets", 2, "pièces", "legumes")]],
  ];
  for (const [name, p, base, f, extra] of stews) {
    add("local", p, base, "simmer", name, [extra, base !== "none" ? BASES[base].ing : []], { featured: f });
  }

  // Crêpes / galettes
  for (const g of [["complète", "jambon-œuf-fromage"], ["forestière", "champignons-crème"], ["chèvre-miel", "chèvre-miel"], ["saumon-épinards", "saumon-épinards"], ["végétarienne", "légumes"]]) {
    nd("local", `Galette bretonne ${g[0]}`, g[0] === "saumon-épinards" ? "fish" : "eggs", "grains", "pan", "sarrasin", [ing("Farine de sarrasin", 250, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true), ing("Garniture " + g[1], 200, "g", "frais", true)]);
  }
}

// =============================================================================
// ITALIENNE
// =============================================================================
function buildItalian() {
  const shapes = ["Spaghetti", "Penne", "Fusilli", "Tagliatelles", "Rigatoni", "Farfalle", "Linguine", "Orecchiette", "Conchiglie", "Casarecce", "Bucatini", "Mafaldine", "Trofie", "Gnocchetti"];
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
    { name: "alla norma", p: "veggie", extra: [ing("Aubergines", 2, "pièces", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Ricotta salée", 80, "g", "frais", true)], f: "aubergine" },
    { name: "cacio e pepe", p: "veggie", extra: [ing("Pecorino", 100, "g", "frais", true), ing("Poivre noir", 1, "c. à café", "epicerie")], f: "pecorino" },
    { name: "alfredo", p: "veggie", extra: [ing("Crème", 25, "cl", "frais", true), ing("Parmesan", 80, "g", "frais", true), ing("Beurre", 30, "g", "frais", true)], f: "parmesan", extraFat: 6 },
    { name: "au citron et courgettes", p: "veggie", extra: [ing("Citron", 1, "pièce", "fruits"), ing("Courgettes", 2, "pièces", "legumes", true), ing("Ricotta", 100, "g", "frais", true)], f: "courgette" },
    { name: "aux brocolis et anchois", p: "fish", extra: [ing("Brocoli", 1, "pièce", "legumes", true), ing("Anchois", 50, "g", "epicerie"), ing("Ail", 2, "gousses", "legumes")], f: "brocoli" },
    { name: "épinards-ricotta", p: "veggie", extra: [ing("Épinards", 250, "g", "legumes", true), ing("Ricotta", 200, "g", "frais", true)], f: "épinard" },
    { name: "amatriciana", p: "red_meat", extra: [ing("Guanciale", 150, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Pecorino", 60, "g", "frais", true)], f: "tomate" },
    { name: "saucisse et fenouil", p: "red_meat", extra: [ing("Chair à saucisse", 300, "g", "viande", true), ing("Fenouil", 1, "pièce", "legumes", true), ing("Crème", 15, "cl", "frais", true)], f: "fenouil" },
    { name: "au pesto rosso", p: "veggie", extra: [ing("Pesto rosso", 150, "g", "epicerie"), ing("Tomates séchées", 80, "g", "epicerie")], f: "tomate" },
    { name: "vongole", p: "fish", extra: [ing("Palourdes", 800, "g", "poisson", true), ing("Vin blanc", 15, "cl", "boissons"), ing("Persil", 1, "bouquet", "legumes", true)], f: "palourde" },
    { name: "au saumon fumé et crème", p: "fish", extra: [ing("Saumon fumé", 150, "g", "poisson", true), ing("Crème", 20, "cl", "frais", true), ing("Aneth", 1, "bouquet", "legumes", true)], f: "saumon" },
    { name: "aux poireaux et lardons", p: "red_meat", extra: [ing("Poireaux", 2, "pièces", "legumes", true), ing("Lardons", 150, "g", "viande", true), ing("Crème", 15, "cl", "frais", true)], f: "poireau" },
    { name: "au potiron et sauge", p: "veggie", extra: [ing("Potiron", 400, "g", "legumes", true), ing("Sauge", 1, "bouquet", "legumes", true), ing("Parmesan", 50, "g", "frais", true)], f: "potiron" },
    { name: "à la nduja", p: "red_meat", extra: [ing("Nduja", 100, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie")], f: "tomate", theme: "épicé" },
    { name: "aux artichauts et citron", p: "veggie", extra: [ing("Cœurs d'artichaut", 200, "g", "epicerie"), ing("Citron", 1, "pièce", "fruits"), ing("Parmesan", 50, "g", "frais", true)], f: "artichaut" },
    { name: "aux moules", p: "fish", extra: [ing("Moules", 800, "g", "poisson", true), ing("Vin blanc", 15, "cl", "boissons"), ing("Persil", 1, "bouquet", "legumes", true)], f: "moule" },
  ];
  for (const sh of shuffle(shapes)) {
    for (const s of shuffle(pastaSauces)) {
      const method = ["bolognaise", "arrabbiata", "puttanesca", "amatriciana", "alla norma"].includes(s.name) ? "simmer" : "pan";
      add("italian", s.p, "pasta", method, `${sh} ${s.name}`, [BASES.pasta.ing, s.extra], { featured: s.f, theme: s.theme, extraFat: s.extraFat });
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
    ["aux épinards", "veggie", [ing("Épinards", 250, "g", "legumes", true)], "épinard"],
    ["radicchio et taleggio", "veggie", [ing("Radicchio", 1, "pièce", "legumes", true), ing("Taleggio", 100, "g", "frais", true)], "radicchio"],
    ["aux scampis", "fish", [ing("Scampis", 300, "g", "poisson", true)], "scampi"],
    ["au speck et noix", "red_meat", [ing("Speck", 120, "g", "viande", true), ing("Noix", 50, "g", "epicerie")], "speck"],
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
    ["Tonno e cipolla", [ing("Thon", 2, "boîtes", "epicerie"), ing("Oignon rouge", 1, "pièce", "legumes"), ing("Mozzarella", 200, "g", "frais", true)], "thon", "fish"],
    ["Diavola", [ing("Salami piquant", 150, "g", "viande", true), ing("Mozzarella", 200, "g", "frais", true), ing("Piment", 1, "pièce", "legumes")], "salami", "red_meat"],
    ["Capricciosa", [ing("Jambon", 100, "g", "viande", true), ing("Artichauts", 100, "g", "epicerie"), ing("Champignons", 150, "g", "legumes", true), ing("Mozzarella", 200, "g", "frais", true)], "artichaut", "red_meat"],
    ["Funghi", [ing("Champignons", 300, "g", "legumes", true), ing("Mozzarella", 200, "g", "frais", true)], "champignon", "veggie"],
    ["Prosciutto e rucola", [ing("Jambon cru", 120, "g", "viande", true), ing("Roquette", 80, "g", "legumes", true), ing("Mozzarella", 200, "g", "frais", true)], "roquette", "red_meat"],
    ["Calzone", [ing("Jambon", 120, "g", "viande", true), ing("Ricotta", 150, "g", "frais", true), ing("Mozzarella", 150, "g", "frais", true)], "ricotta", "red_meat"],
  ];
  for (const [name, extra, f, p] of pizzas) {
    add("italian", p, "bread", "oven", `Pizza ${name}`, [[ing("Pâte à pizza", 2, "pâtons", "frais", true), ing("Sauce tomate", 250, "g", "epicerie")], extra], { featured: f });
  }
  nd("italian", "Focaccia aux tomates et romarin", "veggie", "bread", "oven", "tomate", [ing("Pâte à focaccia", 1, "pièce", "frais", true), ing("Tomates cerises", 200, "g", "legumes", true), ing("Romarin", 1, "branche", "legumes", true)]);

  // Plats au four / poêle
  const italMains = [
    ["Escalope milanaise et spaghetti", "poultry", "pasta", "pan", "chapelure", [ing("Escalopes de poulet", 4, "pièces", "viande", true), ing("Chapelure", 150, "g", "epicerie"), ing("Œufs", 2, "pièces", "frais", true), ing("Spaghetti", 400, "g", "epicerie")]],
    ["Aubergines parmigiana", "veggie", "none", "oven", "aubergine", [ing("Aubergines", 3, "pièces", "legumes", true), ing("Sauce tomate", 400, "g", "epicerie"), ing("Mozzarella", 200, "g", "frais", true)]],
    ["Saltimbocca de veau", "red_meat", "grains", "pan", "sauge", [ing("Veau", 600, "g", "viande", true), ing("Jambon cru", 4, "tranches", "viande", true), ing("Sauge", 1, "bouquet", "legumes", true), ing("Polenta", 250, "g", "epicerie")]],
    ["Gnocchi à la sorrentina", "veggie", "potato", "oven", "mozzarella", [ing("Gnocchi", 600, "g", "frais", true), ing("Sauce tomate", 400, "g", "epicerie"), ing("Mozzarella", 200, "g", "frais", true)]],
    ["Gnocchi au pesto", "veggie", "potato", "pan", "basilic", [ing("Gnocchi", 600, "g", "frais", true), ing("Pesto", 150, "g", "epicerie"), ing("Tomates cerises", 150, "g", "legumes", true)]],
    ["Osso buco à la milanaise", "red_meat", "rice", "simmer", "tomate", [ing("Jarret de veau", 800, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Riz", 300, "g", "epicerie")]],
    ["Poulet alla cacciatora", "poultry", "rice", "simmer", "tomate", [ing("Cuisses de poulet", 4, "pièces", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Olives", 100, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Polpette à la tomate", "red_meat", "pasta", "simmer", "tomate", [ing("Bœuf haché", 400, "g", "viande", true), ing("Sauce tomate", 400, "g", "epicerie"), ing("Spaghetti", 400, "g", "epicerie")]],
    ["Lasagnes aux légumes", "veggie", "pasta", "oven", "courgette", [ing("Feuilles de lasagne", 12, "pièces", "epicerie"), ing("Courgettes", 2, "pièces", "legumes", true), ing("Aubergine", 1, "pièce", "legumes", true), ing("Béchamel", 50, "cl", "epicerie")]],
    ["Lasagnes épinards-ricotta", "veggie", "pasta", "oven", "épinard", [ing("Feuilles de lasagne", 12, "pièces", "epicerie"), ing("Épinards", 400, "g", "legumes", true), ing("Ricotta", 250, "g", "frais", true)]],
    ["Cannelloni ricotta-épinards", "veggie", "pasta", "oven", "épinard", [ing("Cannelloni", 16, "pièces", "epicerie"), ing("Ricotta", 250, "g", "frais", true), ing("Épinards", 300, "g", "legumes", true), ing("Sauce tomate", 300, "g", "epicerie")]],
    ["Scaloppine au citron", "poultry", "tagliatelles", "pan", "citron", [ing("Escalopes de veau", 4, "pièces", "viande", true), ing("Citron", 2, "pièces", "fruits"), ing("Tagliatelles", 400, "g", "epicerie")]],
    ["Polenta crémeuse aux champignons", "veggie", "grains", "pan", "champignon", [ing("Polenta", 300, "g", "epicerie"), ing("Champignons", 300, "g", "legumes", true), ing("Parmesan", 60, "g", "frais", true)]],
    ["Saltimbocca de poulet à la polenta", "poultry", "grains", "pan", "sauge", [ing("Escalopes de poulet", 4, "pièces", "viande", true), ing("Jambon cru", 4, "tranches", "viande", true), ing("Sauge", 1, "bouquet", "legumes", true), ing("Polenta", 250, "g", "epicerie")]],
  ];
  for (const [name, p, base, method, f, extra] of italMains) {
    add("italian", p, base, method, name, [extra], { featured: f });
  }

  // Soupes & salades
  const itSoups = [
    ["Minestrone d'hiver", "veggie", [ing("Haricots blancs", 250, "g", "epicerie"), ing("Chou", 200, "g", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), ing("Petites pâtes", 100, "g", "epicerie")], "chou"],
    ["Pasta e fagioli aux borlotti", "legumes", [ing("Haricots borlotti", 400, "g", "epicerie"), ing("Petites pâtes", 200, "g", "epicerie"), ing("Tomates concassées", 200, "g", "epicerie")], "haricot"],
    ["Ribollita toscane", "veggie", [ing("Chou kale", 200, "g", "legumes", true), ing("Haricots blancs", 250, "g", "epicerie"), ing("Pain rassis", 150, "g", "boulangerie", true)], "chou"],
    ["Stracciatella romaine", "eggs", [ing("Œufs", 4, "pièces", "frais", true), ing("Parmesan", 60, "g", "frais", true), ing("Épinards", 150, "g", "legumes", true), ing("Bouillon de volaille", 1, "L", "epicerie")], "œuf"],
    ["Zuppa di ceci", "legumes", [ing("Pois chiches", 400, "g", "epicerie"), ing("Romarin", 1, "branche", "legumes", true), ing("Tomates", 2, "pièces", "legumes", true)], "pois chiche"],
  ];
  for (const [name, p, extra, f] of itSoups) {
    add("italian", p, "none", "soup", name, [extra, [ONION, GARLIC]], { featured: f, theme: "soupe" });
  }
  nd("italian", "Panzanella toscane", "veggie", "bread", "raw", "tomate", [ing("Pain rassis", 200, "g", "boulangerie", true), ing("Tomates", 4, "pièces", "legumes", true), ing("Concombre", 1, "pièce", "legumes", true), ing("Basilic", 1, "bouquet", "legumes", true)], "été");
  nd("italian", "Salade caprese et roquette", "veggie", "none", "raw", "mozzarella", [ing("Mozzarella di bufala", 250, "g", "frais", true), ing("Tomates", 4, "pièces", "legumes", true), ing("Roquette", 80, "g", "legumes", true)], "été");
  nd("italian", "Vitello tonnato", "red_meat", "none", "raw", "veau", [ing("Veau rôti", 400, "g", "viande", true), ing("Thon", 1, "boîte", "epicerie"), ing("Câpres", 30, "g", "epicerie")]);
}

// =============================================================================
// ASIATIQUE (multi sous-cuisines)
// =============================================================================
function buildAsian() {
  // Woks combinatoires
  const proteins = [
    { label: "poulet", make: P.poulet },
    { label: "bœuf", make: P.boeuf },
    { label: "crevettes", make: P.crevettes },
    { label: "tofu", make: P.tofu },
    { label: "porc", make: P.porc },
    { label: "canard", make: P.canard },
  ];
  const wokSauces = [
    { name: "teriyaki", extra: [ing("Sauce teriyaki", 6, "c. à soupe", "epicerie")], theme: "rapide" },
    { name: "aigre-douce", extra: [ing("Sauce aigre-douce", 6, "c. à soupe", "epicerie"), ing("Ananas", 150, "g", "fruits")] },
    { name: "au gingembre et soja", extra: [SOY, ing("Gingembre", 1, "morceau", "legumes")] },
    { name: "sauce cacahuète", extra: [ing("Beurre de cacahuète", 3, "c. à soupe", "epicerie"), ing("Lait de coco", 15, "cl", "epicerie")], theme: "épicé" },
    { name: "au sésame", extra: [ing("Graines de sésame", 3, "c. à soupe", "epicerie"), SOY] },
    { name: "sauce d'huître", extra: [ing("Sauce d'huître", 4, "c. à soupe", "epicerie")] },
    { name: "au basilic thaï", extra: [ing("Basilic thaï", 1, "bouquet", "legumes", true), SOY], theme: "épicé" },
    { name: "kung pao", extra: [ing("Cacahuètes", 60, "g", "epicerie"), ing("Piment séché", 4, "pièces", "epicerie"), SOY], theme: "épicé" },
    { name: "char siu", extra: [ing("Sauce hoisin", 4, "c. à soupe", "epicerie"), ing("Miel", 2, "c. à soupe", "epicerie")] },
    { name: "satay", extra: [ing("Sauce satay", 5, "c. à soupe", "epicerie"), ing("Lait de coco", 15, "cl", "epicerie")], theme: "épicé" },
  ];
  const asianBases = [
    { label: "riz", base: "rice", ing: BASES.rice.ing },
    { label: "nouilles sautées", base: "pasta", ing: [ing("Nouilles chinoises", 300, "g", "epicerie")] },
    { label: "nouilles de riz", base: "rice", ing: [ing("Nouilles de riz", 300, "g", "epicerie")] },
    { label: "nouilles udon", base: "pasta", ing: [ing("Nouilles udon", 300, "g", "epicerie")] },
  ];
  for (const pr of shuffle(proteins)) {
    for (const s of shuffle(wokSauces)) {
      for (const b of shuffle(asianBases)) {
        const prot = pr.make();
        const v = pick(VEG);
        add("asian", prot.p, b.base, "pan", `Wok de ${pr.label} ${s.name}, ${b.label}`, [prot.ing, b.ing, s.extra, [v.ing]], { featured: v.f, theme: s.theme });
      }
    }
  }

  // Curries combinatoires
  const curries = [
    ["curry vert thaï", [ing("Pâte de curry vert", 2, "c. à soupe", "epicerie"), COCO], "épicé"],
    ["curry rouge thaï", [ing("Pâte de curry rouge", 2, "c. à soupe", "epicerie"), COCO], "épicé"],
    ["curry jaune", [ing("Pâte de curry jaune", 2, "c. à soupe", "epicerie"), ing("Lait de coco", 30, "cl", "epicerie"), ing("Pomme de terre", 2, "pièces", "legumes")], null],
    ["curry panang", [ing("Pâte panang", 2, "c. à soupe", "epicerie"), COCO, ing("Cacahuètes", 40, "g", "epicerie")], "épicé"],
    ["curry japonais", [ing("Roux de curry japonais", 100, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes")], null],
    ["korma", [ing("Crème de coco", 20, "cl", "epicerie"), ing("Amandes en poudre", 50, "g", "epicerie")], null],
    ["madras", [ing("Curry madras", 2, "c. à soupe", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie")], "épicé"],
    ["butter masala", [ing("Tomates concassées", 400, "g", "epicerie"), ing("Crème", 20, "cl", "frais", true), ing("Garam masala", 2, "c. à café", "epicerie")], null],
    ["curry de Madras coco", [ing("Curry", 2, "c. à soupe", "epicerie"), COCO, ing("Épinards", 150, "g", "legumes", true)], "épicé"],
  ];
  const curryProt = [
    { label: "poulet", make: P.poulet, p: "poultry" },
    { label: "crevettes", make: P.crevettes, p: "fish" },
    { label: "légumes", make: () => ({ p: "veggie", ing: [ing("Légumes variés", 600, "g", "legumes", true)] }), p: "veggie" },
    { label: "pois chiches", make: P.poisChiches, p: "legumes" },
    { label: "bœuf", make: P.boeuf, p: "red_meat" },
    { label: "tofu", make: P.tofu, p: "veggie" },
  ];
  for (const [cname, extra, theme] of shuffle(curries)) {
    for (const cp of shuffle(curryProt).slice(0, 3)) {
      const prot = cp.make();
      const suffix = cp.label === "légumes" ? "de légumes" : cp.label === "pois chiches" ? "de pois chiches" : `au ${cp.label}`;
      add("asian", prot.p, "rice", "simmer", `${cap(cname)} ${suffix}, riz`, [prot.ing, BASES.basmati.ing, extra], { featured: cname, theme });
    }
  }

  // Soupes
  const soups = [
    ["Pho au bœuf", "red_meat", [ing("Bœuf", 300, "g", "viande", true), ing("Nouilles de riz", 250, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true), ing("Gingembre", 1, "morceau", "legumes")], "coriandre"],
    ["Pho au poulet épicé", "poultry", [ing("Blancs de poulet", 400, "g", "viande", true), ing("Nouilles de riz", 250, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true)], "coriandre"],
    ["Ramen tonkotsu au porc", "red_meat", [ing("Porc", 300, "g", "viande", true), ing("Nouilles ramen", 300, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true)], "œuf"],
    ["Ramen miso aux légumes", "eggs", [ing("Nouilles ramen", 300, "g", "epicerie"), ing("Champignons shiitaké", 200, "g", "legumes", true), ing("Œufs", 4, "pièces", "frais", true), ing("Pak choï", 2, "pièces", "legumes", true)], "shiitaké"],
    ["Soupe miso et tofu", "veggie", [ing("Miso", 4, "c. à soupe", "epicerie"), ing("Tofu", 200, "g", "frais", true), ing("Algues wakamé", 10, "g", "epicerie")], "tofu"],
    ["Tom yum aux crevettes", "fish", [ing("Crevettes", 300, "g", "poisson", true), ing("Citronnelle", 2, "tiges", "legumes", true), ing("Champignons", 150, "g", "legumes", true)], "citronnelle"],
    ["Tom kha gai (coco-poulet)", "poultry", [ing("Poulet", 300, "g", "viande", true), COCO, ing("Citronnelle", 2, "tiges", "legumes", true), ing("Champignons", 150, "g", "legumes", true)], "citronnelle"],
    ["Soupe wonton", "red_meat", [ing("Raviolis wonton", 16, "pièces", "frais", true), ing("Bouillon de volaille", 1, "L", "epicerie"), ing("Pak choï", 2, "pièces", "legumes", true)], "pak choï"],
    ["Laksa aux crevettes", "fish", [ing("Crevettes", 300, "g", "poisson", true), ing("Nouilles de riz", 250, "g", "epicerie"), COCO, ing("Pâte de curry", 2, "c. à soupe", "epicerie")], "coco"],
    ["Soupe aigre-piquante", "eggs", [ing("Tofu", 200, "g", "frais", true), ing("Champignons noirs", 30, "g", "epicerie"), ing("Œufs", 2, "pièces", "frais", true), ing("Vinaigre de riz", 3, "c. à soupe", "epicerie")], "tofu", "épicé"],
  ];
  for (const [name, p, extra, f, theme] of soups) {
    add("asian", p, "none", "soup", name, [extra], { featured: f, theme: theme ?? "soupe" });
  }

  // Plats nommés par sous-cuisine
  const named = [
    // Japon
    ["Poulet katsu curry", "poultry", "rice", "pan", "chapelure", [ing("Escalopes de poulet", 4, "pièces", "viande", true), ing("Chapelure panko", 150, "g", "epicerie"), ing("Roux de curry japonais", 100, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Gyudon (bœuf-oignon)", "red_meat", "rice", "pan", "oignon", [ing("Bœuf émincé", 400, "g", "viande", true), ing("Oignons", 2, "pièces", "legumes"), SOY, ing("Riz", 300, "g", "epicerie")]],
    ["Oyakodon (poulet-œuf)", "poultry", "rice", "pan", "œuf", [ing("Poulet", 400, "g", "viande", true), ing("Œufs", 4, "pièces", "frais", true), ing("Oignon", 1, "pièce", "legumes"), ing("Riz", 300, "g", "epicerie")]],
    ["Yakisoba aux légumes", "veggie", "pasta", "pan", "chou", [ing("Nouilles yakisoba", 300, "g", "epicerie"), ing("Chou", 200, "g", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), ing("Sauce yakisoba", 5, "c. à soupe", "epicerie")]],
    ["Saumon teriyaki et edamame", "fish", "rice", "pan", "edamame", [ing("Pavés de saumon", 4, "pièces", "poisson", true), ing("Sauce teriyaki", 6, "c. à soupe", "epicerie"), ing("Edamame", 150, "g", "surgele"), ing("Riz", 300, "g", "epicerie")]],
    ["Poke bowl saumon-avocat", "fish", "rice", "raw", "avocat", [ing("Saumon cru", 300, "g", "poisson", true), ing("Riz", 250, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true), ing("Edamame", 150, "g", "surgele")]],
    ["Tempura de légumes", "veggie", "rice", "pan", "légumes", [ing("Légumes variés", 500, "g", "legumes", true), ing("Farine à tempura", 150, "g", "epicerie"), ing("Riz", 250, "g", "epicerie")]],
    ["Donburi de poulet teriyaki", "poultry", "rice", "pan", "oignon", [ing("Poulet", 400, "g", "viande", true), ing("Sauce teriyaki", 5, "c. à soupe", "epicerie"), ing("Oignon", 1, "pièce", "legumes"), ing("Riz", 300, "g", "epicerie")]],
    // Chine
    ["Mapo tofu", "veggie", "rice", "simmer", "tofu", [ing("Tofu soyeux", 400, "g", "frais", true), ing("Pâte de soja piquante", 2, "c. à soupe", "epicerie"), ing("Oignon nouveau", 3, "tiges", "legumes", true), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Poulet aigre-doux", "poultry", "rice", "pan", "ananas", [ing("Poulet", 400, "g", "viande", true), ing("Ananas", 150, "g", "fruits"), ing("Poivron", 1, "pièce", "legumes", true), ing("Sauce aigre-douce", 6, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Bœuf aux brocolis", "red_meat", "rice", "pan", "brocoli", [ing("Bœuf émincé", 400, "g", "viande", true), ing("Brocoli", 1, "pièce", "legumes", true), ing("Sauce d'huître", 4, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Poulet du général Tao", "poultry", "rice", "pan", "sésame", [ing("Poulet", 400, "g", "viande", true), ing("Sauce aigre piquante", 6, "c. à soupe", "epicerie"), ing("Graines de sésame", 2, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Chow mein aux légumes", "veggie", "pasta", "pan", "chou", [ing("Nouilles chinoises", 300, "g", "epicerie"), ing("Chou chinois", 200, "g", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), SOY]],
    ["Riz sauté aux crevettes", "fish", "rice", "pan", "petits pois", [ing("Riz", 300, "g", "epicerie"), ing("Crevettes", 300, "g", "poisson", true), ing("Petits pois", 150, "g", "surgele"), ing("Œufs", 2, "pièces", "frais", true)]],
    ["Porc caramel à la vietnamienne", "red_meat", "rice", "simmer", "oignon", [ing("Poitrine de porc", 500, "g", "viande", true), ing("Sauce nuoc-mâm", 3, "c. à soupe", "epicerie"), ing("Sucre", 2, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    // Vietnam
    ["Bo bun au bœuf", "red_meat", "rice", "raw", "menthe", [ing("Vermicelles de riz", 250, "g", "epicerie"), ing("Bœuf", 400, "g", "viande", true), ing("Carottes", 2, "pièces", "legumes"), ing("Menthe", 1, "bouquet", "legumes", true)]],
    ["Bo bun au poulet citronnelle", "poultry", "rice", "raw", "menthe", [ing("Vermicelles de riz", 250, "g", "epicerie"), ing("Poulet", 400, "g", "viande", true), ing("Citronnelle", 2, "tiges", "legumes", true), ing("Cacahuètes", 50, "g", "epicerie")]],
    ["Rouleaux de printemps", "fish", "rice", "raw", "menthe", [ing("Galettes de riz", 12, "pièces", "epicerie"), ing("Crevettes", 250, "g", "poisson", true), ing("Vermicelles de riz", 150, "g", "epicerie"), ing("Menthe", 1, "bouquet", "legumes", true)]],
    // Corée
    ["Bibimbap au bœuf", "red_meat", "rice", "pan", "carotte", [ing("Bœuf émincé", 300, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Épinards", 150, "g", "legumes", true), ing("Œufs", 4, "pièces", "frais", true)]],
    ["Bulgogi de bœuf", "red_meat", "rice", "pan", "oignon", [ing("Bœuf mariné", 500, "g", "viande", true), ing("Sauce soja", 4, "c. à soupe", "epicerie"), ing("Poire", 1, "pièce", "fruits", true), ing("Riz", 300, "g", "epicerie")]],
    ["Japchae (vermicelles coréens)", "veggie", "pasta", "pan", "épinard", [ing("Vermicelles de patate douce", 300, "g", "epicerie"), ing("Épinards", 200, "g", "legumes", true), ing("Carottes", 2, "pièces", "legumes"), SOY]],
    ["Riz frit au kimchi", "eggs", "rice", "pan", "kimchi", [ing("Riz", 300, "g", "epicerie"), ing("Kimchi", 200, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true), ing("Oignon nouveau", 3, "tiges", "legumes", true)], "épicé"],
    ["Ragoût de tofu (sundubu)", "veggie", "rice", "simmer", "tofu", [ing("Tofu soyeux", 400, "g", "frais", true), ing("Kimchi", 150, "g", "epicerie"), ing("Courgette", 1, "pièce", "legumes", true), ing("Riz", 300, "g", "epicerie")], "épicé"],
    // Inde
    ["Poulet tikka masala", "poultry", "rice", "simmer", "tomate", [ing("Poulet", 500, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Crème", 20, "cl", "frais", true), ing("Riz basmati", 300, "g", "epicerie")]],
    ["Butter chicken", "poultry", "rice", "simmer", "tomate", [ing("Poulet", 500, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Beurre", 40, "g", "frais", true), ing("Crème", 20, "cl", "frais", true), ing("Riz basmati", 300, "g", "epicerie")]],
    ["Dahl de lentilles corail", "legumes", "rice", "simmer", "lentille", [ing("Lentilles corail", 300, "g", "epicerie"), ing("Lait de coco", 20, "cl", "epicerie"), ing("Épinards", 150, "g", "legumes", true), ing("Riz basmati", 250, "g", "epicerie")]],
    ["Palak paneer", "veggie", "rice", "simmer", "épinard", [ing("Paneer", 250, "g", "frais", true), ing("Épinards", 400, "g", "legumes", true), ing("Crème", 15, "cl", "frais", true), ing("Riz basmati", 300, "g", "epicerie")]],
    ["Biryani de poulet", "poultry", "rice", "simmer", "riz", [ing("Poulet", 500, "g", "viande", true), ing("Riz basmati", 350, "g", "epicerie"), ing("Yaourt", 150, "g", "frais", true), ing("Épices biryani", 2, "c. à soupe", "epicerie")]],
    ["Aloo gobi", "veggie", "rice", "simmer", "chou-fleur", [ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Curcuma", 1, "c. à café", "epicerie"), ing("Riz basmati", 250, "g", "epicerie")]],
    ["Chana masala épinards", "legumes", "rice", "simmer", "pois chiche", [ing("Pois chiches", 400, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Épinards", 150, "g", "legumes", true), ing("Riz basmati", 250, "g", "epicerie")]],
    // Thaï
    ["Pad thaï aux crevettes", "fish", "rice", "pan", "cacahuète", [ing("Nouilles de riz", 300, "g", "epicerie"), ing("Crevettes", 300, "g", "poisson", true), ing("Cacahuètes", 60, "g", "epicerie"), ing("Pousses de soja", 150, "g", "legumes", true)]],
    ["Pad see ew au poulet", "poultry", "pasta", "pan", "brocoli", [ing("Nouilles plates", 300, "g", "epicerie"), ing("Poulet", 400, "g", "viande", true), ing("Brocoli chinois", 200, "g", "legumes", true), ing("Sauce soja", 4, "c. à soupe", "epicerie")]],
    ["Poulet basilic thaï (pad krapow)", "poultry", "rice", "pan", "basilic", [ing("Poulet haché", 400, "g", "viande", true), ing("Basilic thaï", 1, "bouquet", "legumes", true), ing("Piment", 2, "pièces", "legumes"), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Salade de bœuf thaï (larb)", "red_meat", "none", "raw", "menthe", [ing("Bœuf haché", 400, "g", "viande", true), ing("Menthe", 1, "bouquet", "legumes", true), ing("Citron vert", 2, "pièces", "fruits"), ing("Échalotes", 2, "pièces", "legumes")], "été"],
  ];
  for (const [name, p, base, method, f, extra, theme] of named) {
    add("asian", p, base, method, name, [extra], { featured: f, theme });
  }
}

// =============================================================================
// DU MONDE
// =============================================================================
function buildWorld() {
  const dishes = [
    // Mexique / Amériques
    ["Chili con carne", "red_meat", "none", "simmer", "haricot rouge", [ing("Bœuf haché", 400, "g", "viande", true), ing("Haricots rouges", 400, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Poivron", 1, "pièce", "legumes", true)], "épicé"],
    ["Chili sin carne", "legumes", "rice", "simmer", "haricot rouge", [ing("Haricots rouges", 400, "g", "epicerie"), ing("Maïs", 150, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Fajitas de poulet", "poultry", "bread", "pan", "poivron", [ing("Poulet", 500, "g", "viande", true), ing("Poivrons", 3, "pièces", "legumes", true), ing("Tortillas", 8, "pièces", "boulangerie", true)]],
    ["Burrito bowl au bœuf", "red_meat", "rice", "pan", "avocat", [ing("Bœuf haché", 400, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Haricots noirs", 250, "g", "epicerie"), ing("Avocat", 2, "pièces", "fruits", true)]],
    ["Tacos de poisson", "fish", "bread", "pan", "chou", [ing("Cabillaud", 400, "g", "poisson", true), ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Chou rouge", 150, "g", "legumes", true)]],
    ["Enchiladas aux haricots", "legumes", "bread", "oven", "haricot noir", [ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Haricots noirs", 400, "g", "epicerie"), ing("Sauce tomate", 300, "g", "epicerie"), ing("Cheddar", 150, "g", "frais", true)]],
    ["Quesadillas aux légumes", "veggie", "bread", "pan", "poivron", [ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Cheddar", 150, "g", "frais", true)]],
    ["Tacos al pastor", "red_meat", "bread", "pan", "ananas", [ing("Porc mariné", 500, "g", "viande", true), ing("Ananas", 150, "g", "fruits"), ing("Tortillas", 8, "pièces", "boulangerie", true), ing("Coriandre", 1, "bouquet", "legumes", true)]],
    ["Huevos rancheros", "eggs", "bread", "pan", "tomate", [ing("Œufs", 6, "pièces", "frais", true), ing("Tortillas", 4, "pièces", "boulangerie", true), ing("Haricots rouges", 250, "g", "epicerie"), ing("Sauce tomate épicée", 250, "g", "epicerie")], "épicé"],
    ["Chilaquiles verts", "eggs", "bread", "pan", "tomatillo", [ing("Tortillas", 6, "pièces", "boulangerie", true), ing("Sauce verte tomatillo", 300, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true)], "épicé"],
    ["Arroz con pollo", "poultry", "rice", "simmer", "poivron", [ing("Poulet", 500, "g", "viande", true), ing("Riz", 350, "g", "epicerie"), ing("Poivrons", 2, "pièces", "legumes", true), ing("Petits pois", 150, "g", "surgele")]],
    ["Ropa vieja cubaine", "red_meat", "rice", "simmer", "poivron", [ing("Bœuf effiloché", 600, "g", "viande", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Feijoada légère", "legumes", "rice", "simmer", "haricot noir", [ing("Haricots noirs", 400, "g", "epicerie"), ing("Saucisse fumée", 150, "g", "viande", true), ing("Riz", 300, "g", "epicerie")]],
    ["Bobotie sud-africain", "red_meat", "rice", "oven", "curry", [ing("Bœuf haché", 500, "g", "viande", true), ing("Œufs", 2, "pièces", "frais", true), ing("Curry", 1, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    // Maghreb
    ["Couscous végétarien", "veggie", "grains", "simmer", "courgette", [ing("Semoule", 300, "g", "epicerie"), ing("Pois chiches", 250, "g", "epicerie"), ing("Courgettes", 2, "pièces", "legumes", true), ing("Carottes", 3, "pièces", "legumes")]],
    ["Couscous royal", "poultry", "grains", "simmer", "carotte", [ing("Poulet", 400, "g", "viande", true), ing("Merguez", 4, "pièces", "viande", true), ing("Semoule", 300, "g", "epicerie"), ing("Carottes", 3, "pièces", "legumes")]],
    ["Kefta de bœuf à la tomate", "red_meat", "grains", "simmer", "tomate", [ing("Bœuf haché", 400, "g", "viande", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Œufs", 4, "pièces", "frais", true), ing("Semoule", 250, "g", "epicerie")]],
    ["Chakchouka", "eggs", "bread", "pan", "poivron", [ing("Œufs", 6, "pièces", "frais", true), ing("Poivrons", 3, "pièces", "legumes", true), ing("Tomates concassées", 400, "g", "epicerie"), ing("Pain", 1, "pièce", "boulangerie", true)], "épicé"],
    // Moyen-Orient
    ["Falafels et houmous", "legumes", "bread", "pan", "pois chiche", [ing("Pois chiches secs", 300, "g", "epicerie"), ing("Houmous", 200, "g", "frais", true), ing("Pains pita", 4, "pièces", "boulangerie", true), ing("Persil", 1, "bouquet", "legumes", true)]],
    ["Shawarma de poulet", "poultry", "bread", "pan", "oignon", [ing("Poulet mariné", 500, "g", "viande", true), ing("Pains pita", 4, "pièces", "boulangerie", true), ing("Oignon rouge", 1, "pièce", "legumes"), ing("Sauce yaourt", 150, "g", "frais", true)]],
    ["Mujaddara (riz-lentilles)", "legumes", "rice", "simmer", "oignon", [ing("Lentilles", 250, "g", "epicerie"), ing("Riz", 250, "g", "epicerie"), ing("Oignons", 3, "pièces", "legumes")]],
    ["Koshari égyptien", "legumes", "rice", "simmer", "lentille", [ing("Riz", 200, "g", "epicerie"), ing("Lentilles", 200, "g", "epicerie"), ing("Macaronis", 150, "g", "epicerie"), ing("Oignons frits", 2, "pièces", "legumes")]],
    ["Boulettes d'agneau sauce yaourt", "red_meat", "grains", "pan", "menthe", [ing("Agneau haché", 400, "g", "viande", true), ing("Yaourt grec", 200, "g", "frais", true), ing("Menthe", 1, "bouquet", "legumes", true), ing("Boulgour", 250, "g", "epicerie")]],
    ["Maqluba aux légumes", "veggie", "rice", "simmer", "aubergine", [ing("Riz", 350, "g", "epicerie"), ing("Aubergines", 2, "pièces", "legumes", true), ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Épices", 2, "c. à café", "epicerie")]],
    // Grèce
    ["Moussaka", "red_meat", "none", "oven", "aubergine", [ing("Agneau haché", 400, "g", "viande", true), ing("Aubergines", 3, "pièces", "legumes", true), ing("Béchamel", 40, "cl", "epicerie")]],
    ["Souvlaki de porc", "red_meat", "bread", "pan", "oignon", [ing("Porc", 500, "g", "viande", true), ing("Pains pita", 4, "pièces", "boulangerie", true), ing("Tzatziki", 150, "g", "frais", true), ing("Tomates", 2, "pièces", "legumes", true)]],
    ["Gemista (légumes farcis)", "veggie", "rice", "oven", "poivron", [ing("Poivrons", 3, "pièces", "legumes", true), ing("Tomates", 3, "pièces", "legumes", true), ing("Riz", 200, "g", "epicerie"), ing("Herbes", 1, "bouquet", "legumes", true)]],
    ["Briam (légumes au four)", "veggie", "none", "oven", "courgette", [ing("Courgettes", 2, "pièces", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Tomates", 4, "pièces", "legumes", true), ing("Huile d'olive", 4, "c. à soupe", "epicerie")]],
    ["Salade grecque et féta", "veggie", "none", "raw", "concombre", [ing("Concombre", 1, "pièce", "legumes", true), ing("Tomates", 4, "pièces", "legumes", true), ing("Féta", 150, "g", "frais", true), ing("Olives", 80, "g", "epicerie")], "été"],
    ["Spanakopita", "veggie", "bread", "oven", "épinard", [ing("Pâte filo", 1, "paquet", "frais", true), ing("Épinards", 400, "g", "legumes", true), ing("Féta", 150, "g", "frais", true), ing("Œufs", 2, "pièces", "frais", true)]],
    // Inde (du monde)
    ["Biryani de légumes", "veggie", "rice", "simmer", "carotte", [ing("Riz basmati", 350, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Petits pois", 150, "g", "surgele"), ing("Épices biryani", 2, "c. à soupe", "epicerie")]],
    ["Saag aloo", "veggie", "rice", "simmer", "épinard", [ing("Épinards", 400, "g", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Curcuma", 1, "c. à café", "epicerie"), ing("Riz basmati", 250, "g", "epicerie")]],
    // Espagne / Portugal
    ["Paella aux fruits de mer", "fish", "rice", "simmer", "fruits de mer", [ing("Riz rond", 350, "g", "epicerie"), ing("Fruits de mer", 500, "g", "poisson", true), ing("Poivrons", 2, "pièces", "legumes", true), ing("Safran", 1, "dose", "epicerie")]],
    ["Paella mixte", "poultry", "rice", "simmer", "poivron", [ing("Riz rond", 350, "g", "epicerie"), ing("Poulet", 300, "g", "viande", true), ing("Chorizo", 150, "g", "viande", true), ing("Poivrons", 2, "pièces", "legumes", true)]],
    ["Fideuà aux fruits de mer", "fish", "pasta", "simmer", "fruits de mer", [ing("Vermicelles", 350, "g", "epicerie"), ing("Fruits de mer", 400, "g", "poisson", true), ing("Tomates", 2, "pièces", "legumes", true), ing("Safran", 1, "dose", "epicerie")]],
    ["Tortilla espagnole", "eggs", "potato", "pan", "pomme de terre", [ing("Œufs", 6, "pièces", "frais", true), ing("Pommes de terre", 600, "g", "legumes"), ing("Oignon", 1, "pièce", "legumes")]],
    ["Gazpacho andalou", "veggie", "none", "raw", "tomate", [ing("Tomates", 6, "pièces", "legumes", true), ing("Concombre", 1, "pièce", "legumes", true), ing("Poivron", 1, "pièce", "legumes", true), ing("Pain", 100, "g", "boulangerie", true)], "été"],
    ["Bacalhau à brás", "fish", "potato", "pan", "pomme de terre", [ing("Morue dessalée", 400, "g", "poisson", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Œufs", 4, "pièces", "frais", true), ing("Oignon", 1, "pièce", "legumes")]],
    ["Caldo verde", "veggie", "potato", "soup", "chou", [ing("Chou kale", 200, "g", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Chorizo", 100, "g", "viande", true)], "soupe"],
    // Europe de l'Est
    ["Goulash hongrois", "red_meat", "potato", "simmer", "paprika", [ing("Bœuf à mijoter", 700, "g", "viande", true), ing("Paprika", 2, "c. à soupe", "epicerie"), ing("Pommes de terre", 500, "g", "legumes"), ing("Poivrons", 2, "pièces", "legumes", true)]],
    ["Bortsch", "veggie", "none", "soup", "betterave", [ing("Betteraves", 4, "pièces", "legumes"), ing("Chou", 200, "g", "legumes", true), ing("Pommes de terre", 300, "g", "legumes"), ing("Crème", 15, "cl", "frais", true)], "soupe"],
    ["Chou farci", "red_meat", "rice", "oven", "chou", [ing("Chou", 1, "pièce", "legumes", true), ing("Bœuf haché", 400, "g", "viande", true), ing("Riz", 150, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie")]],
    // Afrique
    ["Mafé (sauce arachide)", "poultry", "rice", "simmer", "cacahuète", [ing("Poulet", 500, "g", "viande", true), ing("Beurre de cacahuète", 4, "c. à soupe", "epicerie"), ing("Patate douce", 1, "pièce", "legumes"), ing("Riz", 300, "g", "epicerie")]],
    ["Yassa au poulet", "poultry", "rice", "simmer", "oignon", [ing("Poulet", 500, "g", "viande", true), ing("Oignons", 4, "pièces", "legumes"), ing("Citron", 2, "pièces", "fruits"), ing("Riz", 300, "g", "epicerie")]],
    ["Jollof rice", "veggie", "rice", "simmer", "tomate", [ing("Riz", 350, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Poivron", 1, "pièce", "legumes", true), ing("Piment", 1, "pièce", "legumes")], "épicé"],
    ["Curry de patate douce africain", "veggie", "rice", "simmer", "patate douce", [ing("Patates douces", 2, "pièces", "legumes"), ing("Beurre de cacahuète", 3, "c. à soupe", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    // USA / Caraïbes
    ["Jambalaya", "poultry", "rice", "simmer", "poivron", [ing("Poulet", 300, "g", "viande", true), ing("Saucisse fumée", 200, "g", "viande", true), ing("Riz", 300, "g", "epicerie"), ing("Poivrons", 2, "pièces", "legumes", true)], "épicé"],
    ["Gumbo créole", "fish", "rice", "simmer", "gombo", [ing("Crevettes", 300, "g", "poisson", true), ing("Gombos", 200, "g", "legumes", true), ing("Saucisse fumée", 150, "g", "viande", true), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Mac and cheese", "veggie", "pasta", "oven", "fromage", [ing("Macaronis", 400, "g", "epicerie"), ing("Cheddar", 200, "g", "frais", true), ing("Lait", 30, "cl", "frais", true), ing("Beurre", 30, "g", "frais", true)]],
    ["Pulled pork BBQ", "red_meat", "bread", "simmer", "oignon", [ing("Épaule de porc", 700, "g", "viande", true), ing("Sauce barbecue", 15, "cl", "epicerie"), ing("Pains burger", 4, "pièces", "boulangerie", true), ing("Chou", 150, "g", "legumes", true)]],
    ["Cobb salad", "poultry", "none", "raw", "avocat", [ing("Poulet", 300, "g", "viande", true), ing("Œufs", 3, "pièces", "frais", true), ing("Avocat", 1, "pièce", "fruits", true), ing("Salade", 1, "pièce", "legumes", true), ing("Tomates", 2, "pièces", "legumes", true)], "été"],
    ["Bol burger maison", "red_meat", "potato", "pan", "salade", [ing("Steak haché", 4, "pièces", "viande", true), ing("Pommes de terre", 600, "g", "legumes"), ing("Cheddar", 100, "g", "frais", true), ing("Salade", 1, "pièce", "legumes", true)]],
  ];
  for (const [name, p, base, method, f, extra, theme] of dishes) {
    add("world", p, base, method, name, [extra], { featured: f, theme });
  }

  // Tajines paramétriques
  const tajProt = [
    { label: "de poulet", make: P.cuisses, p: "poultry" },
    { label: "d'agneau", make: P.agneau, p: "red_meat" },
    { label: "de poisson", make: P.cabillaud, p: "fish" },
    { label: "de légumes", make: () => ({ p: "veggie", ing: [ing("Légumes variés", 600, "g", "legumes", true)] }), p: "veggie" },
    { label: "de pois chiches", make: P.poisChiches, p: "legumes" },
  ];
  const tajGarn = [
    ["aux abricots", ing("Abricots secs", 150, "g", "epicerie"), "abricot"],
    ["aux olives et citron", ing("Olives vertes", 100, "g", "epicerie"), "olive"],
    ["aux pruneaux", ing("Pruneaux", 150, "g", "epicerie"), "pruneau"],
    ["aux légumes d'automne", ing("Potiron", 400, "g", "legumes", true), "potiron"],
    ["aux figues", ing("Figues sèches", 120, "g", "epicerie"), "figue"],
  ];
  for (const tp of tajProt) {
    for (const [gname, gi, f] of tajGarn) {
      const prot = tp.make();
      add("world", tp.p, "grains", "simmer", `Tajine ${tp.label} ${gname}`, [prot.ing, [gi, ing("Semoule", 300, "g", "epicerie"), ing("Ras-el-hanout", 2, "c. à café", "epicerie"), ONION]], { featured: f, theme: "épicé" });
    }
  }

  // Bowls / salades du monde
  const worldBowls = [
    ["Buddha bowl falafel", "legumes", "grains", "raw", "pois chiche", [ing("Falafels", 8, "pièces", "frais", true), ing("Boulgour", 250, "g", "epicerie"), ing("Concombre", 1, "pièce", "legumes", true), ing("Houmous", 150, "g", "frais", true)]],
    ["Salade taboulé libanais", "veggie", "grains", "raw", "menthe", [ing("Boulgour fin", 200, "g", "epicerie"), ing("Persil", 2, "bouquets", "legumes", true), ing("Menthe", 1, "bouquet", "legumes", true), ing("Tomates", 3, "pièces", "legumes", true)], "été"],
    ["Salade mexicaine haricots-maïs", "legumes", "none", "raw", "maïs", [ing("Haricots noirs", 250, "g", "epicerie"), ing("Maïs", 200, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true), ing("Coriandre", 1, "bouquet", "legumes", true)], "été"],
    ["Poke bowl thon-mangue", "fish", "rice", "raw", "mangue", [ing("Thon cru", 300, "g", "poisson", true), ing("Riz", 250, "g", "epicerie"), ing("Mangue", 1, "pièce", "fruits", true), ing("Avocat", 1, "pièce", "fruits", true)]],
    ["Wrap au poulet et avocat", "poultry", "bread", "pan", "avocat", [ing("Poulet", 400, "g", "viande", true), ing("Tortillas", 4, "pièces", "boulangerie", true), ing("Avocat", 1, "pièce", "fruits", true), ing("Salade", 1, "pièce", "legumes", true)]],
    ["Fattoush", "veggie", "bread", "raw", "concombre", [ing("Pain pita grillé", 2, "pièces", "boulangerie", true), ing("Concombre", 1, "pièce", "legumes", true), ing("Tomates", 3, "pièces", "legumes", true), ing("Sumac", 1, "c. à café", "epicerie")], "été"],
    ["Salade de quinoa, grenade et feta", "veggie", "grains", "raw", "grenade", [ing("Quinoa", 250, "g", "epicerie"), ing("Grenade", 1, "pièce", "fruits", true), ing("Feta", 100, "g", "frais", true), ing("Menthe", 1, "bouquet", "legumes", true)], "été"],
  ];
  for (const [name, p, base, method, f, extra, theme] of worldBowls) {
    add("world", p, base, method, name, [extra], { featured: f, theme });
  }

  // Currys & mijotés supplémentaires
  const moreWorld = [
    ["Curry de pois chiches épinards", "legumes", "rice", "simmer", "épinard", [ing("Pois chiches", 400, "g", "epicerie"), ing("Épinards", 200, "g", "legumes", true), ing("Lait de coco", 20, "cl", "epicerie"), ing("Riz", 300, "g", "epicerie")]],
    ["Curry massaman de bœuf", "red_meat", "rice", "simmer", "cacahuète", [ing("Bœuf", 500, "g", "viande", true), ing("Pâte massaman", 3, "c. à soupe", "epicerie"), ing("Lait de coco", 40, "cl", "epicerie"), ing("Cacahuètes", 50, "g", "epicerie")], "épicé"],
    ["Saumon à la marocaine (chermoula)", "fish", "grains", "oven", "coriandre", [ing("Pavés de saumon", 4, "pièces", "poisson", true), ing("Coriandre", 1, "bouquet", "legumes", true), ing("Citron", 1, "pièce", "fruits"), ing("Semoule", 250, "g", "epicerie")]],
    ["Caponata sicilienne", "veggie", "bread", "simmer", "aubergine", [ing("Aubergines", 3, "pièces", "legumes", true), ing("Céleri", 2, "branches", "legumes", true), ing("Olives", 80, "g", "epicerie"), ing("Pain", 1, "pièce", "boulangerie", true)]],
    ["Soupe harira", "legumes", "none", "soup", "pois chiche", [ing("Pois chiches", 250, "g", "epicerie"), ing("Lentilles", 150, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Coriandre", 1, "bouquet", "legumes", true)], "soupe"],
    ["Soupe de lentilles à l'orientale", "legumes", "none", "soup", "lentille", [ing("Lentilles corail", 300, "g", "epicerie"), ing("Cumin", 1, "c. à café", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Citron", 1, "pièce", "fruits")], "soupe"],
    ["Aloo gobi épicé", "veggie", "rice", "simmer", "chou-fleur", [ing("Chou-fleur", 1, "pièce", "legumes", true), ing("Pommes de terre", 500, "g", "legumes"), ing("Curcuma", 1, "c. à café", "epicerie"), ing("Riz basmati", 250, "g", "epicerie")], "épicé"],
    ["Curry de poisson sri-lankais", "fish", "rice", "simmer", "coco", [ing("Cabillaud", 500, "g", "poisson", true), ing("Lait de coco", 40, "cl", "epicerie"), ing("Curry", 2, "c. à soupe", "epicerie"), ing("Riz", 300, "g", "epicerie")], "épicé"],
    ["Ratatouille marocaine (loubia)", "legumes", "bread", "simmer", "haricot", [ing("Haricots blancs", 400, "g", "epicerie"), ing("Tomates concassées", 400, "g", "epicerie"), ing("Cumin", 1, "c. à café", "epicerie"), ing("Pain", 1, "pièce", "boulangerie", true)]],
  ];
  for (const [name, p, base, method, f, extra, theme] of moreWorld) {
    add("world", p, base, method, name, [extra], { featured: f, theme });
  }

  // Couscous paramétriques
  const cousProt = [
    { label: "de poulet", make: P.cuisses, p: "poultry" },
    { label: "d'agneau", make: P.agneau, p: "red_meat" },
    { label: "aux merguez", make: P.saucisse, p: "red_meat" },
    { label: "de légumes", make: () => ({ p: "veggie", ing: [ing("Légumes variés", 600, "g", "legumes", true)] }), p: "veggie" },
    { label: "aux boulettes", make: P.boeufHache, p: "red_meat" },
  ];
  const cousGarn = [
    ["aux sept légumes", ing("Navets", 2, "pièces", "legumes"), "navet"],
    ["aux raisins et pois chiches", ing("Raisins secs", 80, "g", "epicerie"), "raisin"],
    ["aux courgettes et carottes", ing("Courgettes", 2, "pièces", "legumes", true), "courgette"],
    ["au potiron", ing("Potiron", 400, "g", "legumes", true), "potiron"],
  ];
  for (const cp of cousProt) {
    for (const [gname, gi, f] of cousGarn) {
      const prot = cp.make();
      add("world", cp.p, "grains", "simmer", `Couscous ${cp.label} ${gname}`, [prot.ing, [gi, ing("Semoule", 300, "g", "epicerie"), ing("Pois chiches", 200, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes")]], { featured: f, theme: "épicé" });
    }
  }

  // Brochettes / grillades paramétriques
  const brochProt = [
    { label: "de poulet", make: P.poulet, p: "poultry" },
    { label: "de bœuf", make: P.boeuf, p: "red_meat" },
    { label: "d'agneau", make: P.agneau, p: "red_meat" },
    { label: "de crevettes", make: P.crevettes, p: "fish" },
    { label: "de halloumi", make: () => ({ p: "veggie", ing: [ing("Halloumi", 400, "g", "frais", true)] }), p: "veggie" },
  ];
  const marinades = [
    ["marinade harissa", ing("Harissa", 2, "c. à soupe", "epicerie"), "harissa", "épicé"],
    ["marinade yaourt-menthe", ing("Yaourt", 150, "g", "frais", true), "menthe", null],
    ["marinade citron-herbes", ing("Citron", 1, "pièce", "fruits"), "citron", null],
    ["marinade paprika fumé", ing("Paprika fumé", 1, "c. à soupe", "epicerie"), "paprika", null],
  ];
  const brochBases = [
    { label: "semoule", base: "grains", ing: [ing("Semoule", 300, "g", "epicerie")] },
    { label: "boulgour", base: "grains", ing: [ing("Boulgour", 250, "g", "epicerie")] },
    { label: "salade", base: "none", ing: [ing("Salade", 1, "pièce", "legumes", true)] },
    { label: "riz", base: "rice", ing: [ing("Riz", 300, "g", "epicerie")] },
  ];
  for (const bp of shuffle(brochProt)) {
    for (const [mname, mi, f, theme] of shuffle(marinades)) {
      for (const b of shuffle(brochBases).slice(0, 3)) {
        const prot = bp.make();
        add("world", bp.p, b.base, "pan", `Brochettes ${bp.label} ${mname}, ${b.label}`, [prot.ing, b.ing, [mi, ing("Poivrons", 2, "pièces", "legumes", true)]], { featured: f, theme });
      }
    }
  }

  // Bowls protéinés du monde
  const bowlProt = [
    { label: "poulet", make: P.poulet, p: "poultry" },
    { label: "bœuf", make: P.boeuf, p: "red_meat" },
    { label: "falafel", make: () => ({ p: "legumes", ing: [ing("Falafels", 8, "pièces", "frais", true)] }), p: "legumes" },
    { label: "saumon", make: P.saumon, p: "fish" },
    { label: "tofu mariné", make: P.tofu, p: "veggie" },
  ];
  const bowlStyle = [
    ["tex-mex", [ing("Haricots noirs", 200, "g", "epicerie"), ing("Maïs", 150, "g", "epicerie"), ing("Avocat", 1, "pièce", "fruits", true)], "avocat"],
    ["méditerranéen", [ing("Houmous", 150, "g", "frais", true), ing("Tomates", 2, "pièces", "legumes", true), ing("Concombre", 1, "pièce", "legumes", true)], "concombre"],
    ["coréen", [ing("Kimchi", 100, "g", "epicerie"), ing("Carottes", 2, "pièces", "legumes"), ing("Œuf", 2, "pièces", "frais", true)], "kimchi"],
  ];
  for (const bp of bowlProt) {
    for (const [style, extra, f] of bowlStyle) {
      const prot = bp.make();
      add("world", bp.p, "grains", "raw", `Bowl ${style} au ${bp.label}`, [prot.ing, [ing("Quinoa", 250, "g", "epicerie"), ...extra]], { featured: f, theme: "été" });
    }
  }
}

// ── Génération + échantillonnage ─────────────────────────────────────────────
buildLocal();
buildItalian();
buildAsian();
buildWorld();

const TARGET = { local: 430, italian: 250, asian: 250, world: 150 };

function sampleOrigin(origin, target) {
  const pool = shuffle(recipes.filter((r) => r.origin === origin));
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

const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

const usedIds = new Set();
finalRecipes = finalRecipes.map((r) => {
  let id = `gen-${slug(r.name)}`;
  let n = 2;
  while (usedIds.has(id)) id = `gen-${slug(r.name)}-${n++}`;
  usedIds.add(id);
  const { extraFat, ...rest } = r;
  return { id, ...rest };
});

writeFileSync(OUT, JSON.stringify(finalRecipes, null, 2) + "\n", "utf8");

const counts = finalRecipes.reduce((acc, r) => ((acc[r.origin] = (acc[r.origin] ?? 0) + 1), acc), {});
console.log(`✅ ${finalRecipes.length} recettes générées →`, counts);
console.log("Protéines:", finalRecipes.reduce((a, r) => ((a[r.protein] = (a[r.protein] ?? 0) + 1), a), {}));
console.log("Dispo (avant échantillon):", recipes.reduce((a, r) => ((a[r.origin] = (a[r.origin] ?? 0) + 1), a), {}));
