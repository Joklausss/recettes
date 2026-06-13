import type { Origin, OriginTargets } from "./types";

export const ORIGINS: Origin[] = ["local", "italian", "asian", "world"];

/**
 * Répartit `total` repas entre les origines via la méthode du plus fort reste,
 * de sorte que la somme tombe exactement à `total` (±0).
 */
export function largestRemainder(
  weights: Record<Origin, number>,
  total: number,
): Record<Origin, number> {
  const sum = ORIGINS.reduce((s, o) => s + Math.max(0, weights[o]), 0) || 1;
  const exact = ORIGINS.map((o) => ({
    origin: o,
    value: (Math.max(0, weights[o]) / sum) * total,
  }));

  const counts: Record<Origin, number> = {
    local: 0,
    italian: 0,
    asian: 0,
    world: 0,
  };
  let assigned = 0;
  for (const e of exact) {
    counts[e.origin] = Math.floor(e.value);
    assigned += counts[e.origin];
  }

  // Distribue les unités restantes aux plus forts restes.
  const remainders = exact
    .map((e) => ({ origin: e.origin, frac: e.value - Math.floor(e.value) }))
    .sort((a, b) => b.frac - a.frac);

  let i = 0;
  while (assigned < total) {
    counts[remainders[i % remainders.length].origin]++;
    assigned++;
    i++;
  }
  return counts;
}

/**
 * Calcule la répartition par origine pour la semaine courante.
 *
 * Si un historique est fourni (nombre de repas par origine sur les semaines
 * précédentes), on compense les arrondis passés afin que les moyennes
 * convergent vers les pourcentages cibles sur plusieurs semaines.
 */
export function computeOriginCounts(
  targets: OriginTargets,
  total: number,
  history: { weeks: number; counts: Record<Origin, number> } = {
    weeks: 0,
    counts: { local: 0, italian: 0, asian: 0, world: 0 },
  },
): Record<Origin, number> {
  if (history.weeks <= 0) {
    return largestRemainder({ ...targets }, total);
  }

  // Cible cumulée sur (semaines passées + semaine courante).
  const periods = history.weeks + 1;
  const desired: Record<Origin, number> = {
    local: 0,
    italian: 0,
    asian: 0,
    world: 0,
  };
  for (const o of ORIGINS) {
    const cumulativeTarget = targets[o] * total * periods;
    desired[o] = Math.max(0, cumulativeTarget - history.counts[o]);
  }
  return largestRemainder(desired, total);
}
