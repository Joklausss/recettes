# 🍽️ Menus de la semaine

Générateur de **menus hebdomadaires** mobile-first : chaque semaine, l'app
propose **14 repas** (déjeuner + dîner sur 7 jours) à partir d'un catalogue de
recettes simples et équilibrées, en optimisant le compromis entre **variété** et
**efficacité de préparation**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Joklausss/recettes)

- 📅 Planning 7 jours × (midi / soir), badges d'origine, temps, tag « restes »
- 🗓️ Multi-semaines : naviguez entre semaines (‹ ›), un plan par semaine,
  l'historique no-repeat / la convergence des origines se calculent tout seuls
- 🔍 Catalogue : recherche plein texte (nom, ingrédient) + filtres (origine,
  protéine, végé/poisson, ≤ 30 min, favoris)
- 🔄 Régénération de la semaine entière ou d'un seul repas
- 🔒 Verrouillage des repas qu'on aime avant de régénérer
- 🛒 Liste de courses consolidée par rayon, quantités agrégées, cochable
- 📊 Récap semaine : répartition par origine (vs cible) + résumé nutritionnel
- ⭐ Favoris, 🚫 exclusions (ingrédients/allergies, recettes refusées)
- ➕ Ajout de recettes perso
- 💾 Persistance locale (plan, favoris, exclusions, historique)

## Stack technique

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, mobile-first
- **Recettes** : 1100+ recettes. 54 curées (`src/data/curated.ts`) + ~1080
  générées (`public/recipes.generated.json` via `scripts/generate-recipes.mjs`).
  Le gros catalogue est servi en **asset statique** et chargé via `fetch` côté
  client (hors bundle initial) pour rester léger sur mobile.
- **Logique de génération** : module pur et isolé (`src/lib/`), couvert par des
  tests **Vitest**
- **Persistance** : `localStorage`

### Pourquoi localStorage (et pas une base de données) ?

L'app est **mono-utilisateur et personnelle** (plan, favoris, exclusions,
historique). Toute la logique de génération est pure et tourne côté client.
`localStorage` permet donc un **déploiement Vercel en une commande, sans serveur
ni base à provisionner**. La persistance est isolée dans `src/lib/store.tsx` :
pour passer à un backend (p. ex. Prisma + SQLite/Postgres) plus tard, il suffit
de réimplémenter ce module sans toucher à l'UI ni à l'algorithme.

## Installation & lancement

Prérequis : Node.js ≥ 18.

```bash
npm install        # installe les dépendances
npm run dev        # démarre en local sur http://localhost:3000
npm run build      # build de production
npm run start      # sert le build de production
npm test           # lance les tests de la logique de génération
```

## Déploiement (Vercel)

Le projet est prêt pour Vercel sans configuration particulière.

```bash
npm i -g vercel
vercel             # déploiement de preview
vercel --prod      # déploiement en production
```

Ou via l'UI : importez le dépôt Git dans Vercel, le framework **Next.js** est
détecté automatiquement (build `next build`, aucune variable d'environnement
requise).

## Personnalisation

Tout est centralisé dans **`src/lib/config.ts`** :

| Pour modifier… | Où |
| --- | --- |
| **Les pourcentages d'origine** (Locale 40 % / Italienne 25 % / Asiatique 20 % / Du monde 15 %) | `DEFAULT_ORIGIN_TARGETS` — modifiables aussi en direct dans l'écran **Réglages** |
| **Le nombre de portions** par défaut | `DEFAULT_SERVINGS` — ajustable dans **Réglages** |
| **L'activation du batch cooking** | `DEFAULT_BATCH_COOKING` — activable/désactivable dans **Réglages** |
| **La fenêtre de non-répétition** des recettes | `NO_REPEAT_WEEKS` (4 semaines par défaut) |
| **Les cibles nutritionnelles** (poisson, végétarien, viande rouge) | `NUTRITION_TARGETS` |

### Changer la région « locale »

La cuisine « locale » correspond aux recettes `origin: "local"`. Pour adapter la
région :

1. Recettes écrites à la main : modifiez **`src/data/curated.ts`**.
2. Recettes générées (le gros du catalogue) : adaptez la section `buildLocal()`
   de **`scripts/generate-recipes.mjs`**, puis régénérez :
   `node scripts/generate-recipes.mjs`.
3. Veillez à conserver une **variété suffisante** (protéines, féculents, modes
   de cuisson) pour ne pas répéter une recette sur ~4 semaines.
4. Au besoin, ajustez les pourcentages dans `DEFAULT_ORIGIN_TARGETS`.

## Règles métier (résumé)

- **Répartition par origine** sur 14 repas, arrondie pour tomber exactement à 14
  (p. ex. 6/3/3/2). Sur plusieurs semaines, les moyennes **convergent** vers les
  cibles en compensant les arrondis (l'historique récent est mémorisé).
- **Variété** (maximisée) : pénalise la répétition de protéine, base/féculent,
  mode de cuisson et ingrédient vedette ; pas de recette répétée sur les ~4
  dernières semaines.
- **Efficacité** (maximisée) : bonus d'ingrédients partagés sur la semaine,
  **batch cooking** « cuisiner une fois, manger deux fois » (un dîner couvre le
  déjeuner du lendemain, marqué « restes »), périssables placés en début de
  semaine.
- **Nutrition** : cibles hebdomadaires vérifiées — poisson ≥ 2, végétarien ≥ 3,
  viande rouge ≤ 3.

## Architecture

```
src/
├── app/                     # Pages (App Router)
│   ├── page.tsx             # Planning de la semaine
│   ├── courses/             # Liste de courses
│   ├── recap/               # Récap origine + nutrition
│   ├── reglages/            # Réglages, exclusions, favoris
│   ├── ajouter/             # Ajout de recette perso
│   └── recette/[id]/        # Détail recette
├── components/              # Composants UI réutilisables
├── data/
│   ├── curated.ts           # 54 recettes écrites à la main
│   └── recipes.ts           # Catalogue complet (tests uniquement)
└── lib/
    ├── types.ts             # Modèle de données
    ├── config.ts            # ⚙️ Paramètres (origines, portions, batch…)
    ├── generator.ts         # 🧠 Algorithme de génération (pur, testé)
    ├── origin.ts            # Répartition par origine (+ convergence)
    ├── shoppingList.ts      # Agrégation de la liste de courses
    ├── export.ts            # Fiches texte (partage / WhatsApp / Notes)
    ├── store.tsx            # État global + persistance localStorage + fetch recettes
    ├── rng.ts / date.ts     # Utilitaires
    └── *.test.ts            # Tests unitaires (Vitest)

public/recipes.generated.json   # Catalogue généré (asset statique, chargé via fetch)
scripts/generate-recipes.mjs     # Générateur du catalogue (déterministe)
```

## Tests

```bash
npm test
```

Couvre notamment : respect exact de la répartition par origine (±1 d'arrondi),
absence de doublon dans la semaine et sur les semaines récentes, équilibre
nutritionnel (poisson / végétarien / viande rouge), exclusions, verrouillage,
batch cooking et agrégation de la liste de courses.
