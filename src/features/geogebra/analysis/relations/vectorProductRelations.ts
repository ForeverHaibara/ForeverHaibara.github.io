import { SCALAR_EPSILON } from '../numericPrecision';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { groupScalarClasses } from '../algebra/scalarClasses';
import { evaluateProductEquation, productEquationKey, productPoints, productRow } from '../../geometry/vectorProducts';
import type { VectorProductEquation, VectorProductTerm } from '../../geometry/vectorProducts';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';

/** Bounded scalar search over semantic products; position atoms are only an exact representation. */
export const detectVectorProductRelations = (scene: GeometryScene, existing: RelationSeed[], options: DiscoveryOptions,
  budget: DiscoveryBudget): RelationSeed[] => {
  const coordinates = new Map(scene.points.map((point) => [point.name, point.coordinates]));
  const indexes = new Map(scene.points.map((point, index) => [point.name, index]));
  const seeds: RelationSeed[] = [];
  for (const operation of ['dot', 'cross'] as const) {
    const kind = operation === 'dot' ? 'dot-products' : 'cross-products';
    if (!options.enabledKinds.includes(kind)) continue;
    const outputLimit = Math.min(64, options.maxRelations); let outputCount = 0;
    const seen = new Set<string>(); const space = new RationalRelationSpace(new Set(), 192);
    let backgroundStopped = false;
    const register = (equation: VectorProductEquation, source: string) => {
      if (backgroundStopped) return;
      if (space.limited || !budget.take(`${kind} background constraints`, Math.min(4096, options.maxComparisons))) { backgroundStopped = true; return; }
      const check = evaluateProductEquation(equation, coordinates);
      if (check) space.insert(productRow(equation), source, Math.abs(check.value));
    };
    for (const seed of existing) {
      if (backgroundStopped) break;
      const witness = seed.witness;
      if (witness.midpoint) {
        const { point: m, segment: [a, b] } = witness.midpoint;
        for (const point of scene.points) register({ operation, terms: [[m, 2], [a, -1], [b, -1]].map(([name, coefficient]) => ({
          coefficient: coefficient as number, left: [null, name as string], right: [null, point.name] })) }, seed.key);
      }
      if (operation === 'cross') {
        for (const family of witness.lineFamilies ?? []) for (const line of family) if (line.length >= 3) {
          for (const point of line.slice(2)) register({ operation, terms: [{ coefficient: 1, left: [line[0], line[1]], right: [line[0], point] }] }, seed.key);
        }
        if (seed.kind === 'parallel') {
          const lines = witness.lineFamilies?.[0] ?? [];
          for (const line of lines.slice(1)) if (line.length >= 2 && lines[0].length >= 2) register({ operation,
            terms: [{ coefficient: 1, left: [lines[0][0], lines[0][1]], right: [line[0], line[1]] }] }, seed.key);
        }
      } else {
        if (seed.kind === 'perpendicular') {
          const left = witness.lineFamilies?.[0]?.[0]; const right = witness.lineFamilies?.[1]?.[0];
          if (left && right) register({ operation, terms: [{ coefficient: 1, left: [left[0], left[1]], right: [right[0], right[1]] }] }, seed.key);
        }
        for (const segment of witness.segments?.slice(1) ?? []) register({ operation, terms: [
          { coefficient: 1, left: witness.segments![0], right: witness.segments![0] }, { coefficient: -1, left: segment, right: segment }] }, seed.key);
      }
    }
    const emit = (equation: VectorProductEquation) => {
      if (outputCount >= outputLimit) { budget.note(`${kind} output limit reached; results are partial.`); return; }
      const row = productRow(equation); if (!Object.keys(row).length) return;
      const key = productEquationKey(equation); if (seen.has(key)) return; seen.add(key);
      const check = evaluateProductEquation(equation, coordinates);
      if (!check || check.residual > SCALAR_EPSILON) return;
      const reduction = space.reduce(row, Math.abs(check.value));
      const derived = reduction.redundant && reduction.error <= SCALAR_EPSILON * Math.max(1, check.magnitude);
      if (derived && options.compressConsequences) return;
      space.insert(row, key, Math.abs(check.value));
      const names = productPoints(equation);
      seeds.push({ kind, key: `${kind}:${key}`, confidence: 0.98, points: new Set(names.map((name) => indexes.get(name)!)), derived,
        sourceIds: derived ? reduction.sources : [],
        witness: { points: names, productEquation: equation } });
      outputCount += 1;
    };

    // Existing triangle matches supply correspondence candidates, not proof premises.
    for (const seed of existing) {
      const triangles = seed.witness.triangles; if (!triangles?.length) continue;
      const [a, b, c] = triangles[0];
      for (const [d, e, f] of triangles.slice(1)) {
        const area = (x: string, y: string, z: string) => {
          const p = coordinates.get(x)!; const q = coordinates.get(y)!; const r = coordinates.get(z)!;
          return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        };
        if (area(a, b, c) * area(d, e, f) >= 0) continue;
        emit({ operation, terms: [{ coefficient: 1, left: [a, b], right: [d, f] },
          { coefficient: -1, left: [a, c], right: [d, e] }] });
      }
    }

    interface Observation { value: number; term: VectorProductTerm; magnitude: number; key: string; }
    const observations: Observation[] = []; const symbolic = new Set<string>();
    const observe = (left: [string, string], right: [string, string]) => {
      if (!budget.take(`${kind} candidates`, options.maxAngles)) return false;
      const equation: VectorProductEquation = { operation, terms: [{ coefficient: 1, left, right }] };
      const key = productEquationKey(equation); if (symbolic.has(key)) return true; symbolic.add(key);
      if (!Object.keys(productRow(equation)).length) return true;
      const check = evaluateProductEquation(equation, coordinates); if (!check) return true;
      if (Math.abs(check.value) <= SCALAR_EPSILON * Math.max(1, check.magnitude)) {
        if (!options.compressConsequences || !options.enabledKinds.includes(operation === 'dot' ? 'perpendicular' : 'parallel')) emit(equation);
      } else observations.push({ value: Math.abs(check.value), magnitude: check.magnitude, key,
        term: { coefficient: check.value < 0 ? -1 : 1, left, right } });
      return true;
    };
    const points = scene.points.slice().sort((a, b) => a.name.localeCompare(b.name));
    // Shared-vertex products first, then round-robin spans of all segment pairs.
    outer: for (let span = 1; span < points.length; span += 1) for (let i = 0; i < points.length; i += 1) {
      const j = (i + span) % points.length;
      for (let k = j; k < points.length; k += 1) {
        if (i === k || j === k && operation === 'cross') continue;
        if (!observe([points[i].name, points[j].name], [points[i].name, points[k].name])) break outer;
      }
    }
    const segments = scene.pairs.map((pair) => [scene.points[pair.left].name, scene.points[pair.right].name] as [string, string]);
    outer: for (let span = 0; span < segments.length; span += 1) for (let i = 0; i + span < segments.length; i += 1) {
      if (span === 0 && operation === 'cross') continue;
      if (!observe(segments[i], segments[i + span])) break outer;
    }
    const epsilon = SCALAR_EPSILON * Math.max(1, ...observations.map((q) => q.magnitude));
    const groups = groupScalarClasses(observations.map((q) => [q]), epsilon, budget, `${kind} comparisons`, options.maxComparisons);
    outer: for (const group of groups) {
      // A floating-point tie must not choose a different symbolic star after a mirror/rotation.
      const members = group.members.slice().sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      for (const member of members.slice(1)) {
        emit({ operation, terms: [members[0].term, { ...member.term, coefficient: -member.term.coefficient }] });
        if (outputCount >= outputLimit) { budget.note(`${kind} output limit reached; results are partial.`); break outer; }
      }
    }
    if (space.limited) budget.note(`${kind} relation-space budget reached; compression is partial.`);
  }
  return seeds;
};
