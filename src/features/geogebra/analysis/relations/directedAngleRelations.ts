import type { QuantityEquation } from '../geometryTypes';
import type { GeometryScene } from '../scene/geometryScene';
import { canonicalDirectionEquation, directedAngleValue, positiveHalfTurns, wrapHalfTurns } from '../quantities/directedAngles';
import type { AngleTriple } from '../quantities/directedAngles';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';

const EPSILON = 2e-7; // half turns; circular distance, including the 0/pi seam
const PATTERNS = [{ scale: 1, offset: 0 }, { scale: -1, offset: 0 }, { scale: 2, offset: 0 },
  { scale: -2, offset: 0 }, { scale: 1, offset: 0.5 }, { scale: -1, offset: 0.5 }];

/** Discover ordered equations directly. Never reinterpret an ordinary-angle observation. */
export const detectDirectedAngleRelations = (scene: GeometryScene, options: DiscoveryOptions, budget: DiscoveryBudget): RelationSeed[] => {
  if (!options.enabledKinds.includes('directed-angles')) return [];
  const angles: Array<{ names: AngleTriple; value: number; indexes: number[] }> = [];
  const order = scene.points.map((_, i) => i).sort((a, b) => scene.points[a].name.localeCompare(scene.points[b].name));
  candidates: for (const vertex of order) for (let i = 0; i < order.length; i += 1) for (let j = i + 1; j < order.length; j += 1) {
    const a = order[i]; const b = order[j]; if (a === vertex || b === vertex) continue;
    if (!budget.take('Directed angle candidates', options.maxAngles)) break candidates;
    const value = directedAngleValue(scene.points[a].coordinates, scene.points[vertex].coordinates, scene.points[b].coordinates);
    // Flat directed angles remain defined; their discoveries are already incidences.
    if (value === null || Math.abs(wrapHalfTurns(value)) <= EPSILON) continue;
    angles.push({ names: [scene.points[a].name, scene.points[vertex].name, scene.points[b].name], value: positiveHalfTurns(value), indexes: [a, vertex, b] });
  }
  const cells = Math.ceil(1 / EPSILON); const cell = (value: number) => Math.floor(positiveHalfTurns(value) * cells) % cells;
  const buckets = new Map<number, number[]>();
  angles.forEach((angle, i) => { const key = cell(angle.value); const group = buckets.get(key) ?? []; group.push(i); buckets.set(key, group); });
  const found = new Map<string, RelationSeed>();
  for (const { scale, offset } of PATTERNS) for (let i = 0; i < angles.length; i += 1) {
    if (!budget.take('Directed angle lookups', options.maxComparisons)) return [...found.values()];
    const source = angles[i]; const targetValue = positiveHalfTurns(scale * source.value + offset); const key = cell(targetValue);
    for (const neighbor of [-1, 0, 1]) for (const j of buckets.get((key + neighbor + cells) % cells) ?? []) {
      if (!budget.take('Directed angle comparisons', options.maxComparisons)) return [...found.values()];
      if (i === j || Math.abs(scale) === 1 && j <= i) continue;
      const target = angles[j]; if (Math.abs(wrapHalfTurns(target.value - targetValue)) > EPSILON) continue;
      const terms = [{ angle: target.names, coefficient: 1 }, { angle: source.names, coefficient: -scale }];
      const pi = { numerator: offset ? 1 : 0, denominator: offset ? 2 : 1 };
      const canonical = canonicalDirectionEquation(terms, pi);
      if (!canonical.terms.length || found.has(canonical.key)) continue;
      if (found.size >= options.maxRelations) { budget.note(`Directed angle output limit (${options.maxRelations}) reached; results are partial.`); return [...found.values()]; }
      const points = new Set([...source.indexes, ...target.indexes]);
      const equation: QuantityEquation = { angleSemantics: 'directed-mod-pi', pi,
        terms: terms.map((term) => ({ coefficient: term.coefficient, quantity: { kind: 'angle', points: term.angle } })) };
      found.set(canonical.key, { kind: 'directed-angles', key: `directed-angles:${canonical.key}`, points, confidence: 0.98,
        witness: { points: [...points].map((index) => scene.points[index].name), equation } });
    }
  }
  return [...found.values()];
};
