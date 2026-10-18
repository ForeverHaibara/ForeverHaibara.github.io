import { fitRationalCombination, RationalRelationSpace } from '../algebra/rationalSpace';
import { orientedDoubleArea } from '../quantities/vector';
import type { DirectionModel } from '../geometryTypes';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';
import { segmentId } from './triangles';

export const wrapDirection = (value: number): number => ((value % Math.PI) + Math.PI) % Math.PI;

export const buildDirectionSpaces = (scene: GeometryScene, existing: RelationSeed[], options: DiscoveryOptions, budget: DiscoveryBudget) => {
  const space = new RationalRelationSpace();
  const incidenceSources = new Map(existing.filter((seed) => seed.kind === 'collinear').map((seed) => [[...seed.points].sort((a, b) => a - b).join(','), seed.key]));
  const carriers = scene.lineGroups.map((line) => {
    const endpoints = [...line.points].sort((a, b) => scene.points[a].name.localeCompare(scene.points[b].name)).slice(0, 2) as [number, number];
    return { id: `l:${endpoints.join(':')}`, endpoints, angle: line.pairs[0].angle, pairs: line.pairs, points: line.points,
      incidenceSource: incidenceSources.get([...line.points].sort((a, b) => a - b).join(',')) };
  });
  const bySegment = new Map<string, typeof carriers[number]>();
  carriers.forEach((line) => line.pairs.forEach((pair) => bySegment.set(segmentId(pair.left, pair.right), line)));
  const byName = new Map(scene.points.map((point, index) => [point.name, index]));
  const rowFor = (terms: Array<[string, number]>, constant: number) => {
    const row: Record<string, number> = { '@pi': constant };
    terms.forEach(([id, value]) => { row[id] = (row[id] ?? 0) + value; });
    return row;
  };
  const insertObserved = (terms: Array<[typeof carriers[number], number]>, source: string, halfTurns = false) => {
    const factor = halfTurns ? 2 : 1;
    const value = terms.reduce((sum, [line, coefficient]) => sum + factor * coefficient * line.angle, 0);
    const lift = Math.round(value / Math.PI);
    const residual = Math.abs(value - lift * Math.PI);
    if (residual <= 8e-7) space.insert(rowFor(terms.map(([line, coefficient]) => [line.id, coefficient * factor]), -lift), source, residual + 1e-12);
  };
  const namedLine = (names: string[]) => bySegment.get(segmentId(byName.get(names[0])!, byName.get(names[1])!));
  for (const seed of existing) {
    if (seed.kind === 'parallel' || seed.kind === 'perpendicular') {
      const families = seed.witness.lineFamilies ?? [];
      const anchor = families[0]?.[0] ? namedLine(families[0][0]) : undefined;
      if (!anchor) continue;
      families.forEach((family, index) => family.forEach((names) => {
        const line = namedLine(names);
        if (line) insertObserved([[line, 1], [anchor, -1]], seed.key, index > 0);
      }));
    }
    const triangles = seed.witness.triangles;
    if (triangles && triangles.length > 1) {
      const base = triangles[0].map((name) => byName.get(name)!);
      for (const triangle of triangles.slice(1)) {
        const other = triangle.map((name) => byName.get(name)!);
        const orientation = Math.sign(orientedDoubleArea(scene.points[base[0]].coordinates, scene.points[base[1]].coordinates, scene.points[base[2]].coordinates))
          * Math.sign(orientedDoubleArea(scene.points[other[0]].coordinates, scene.points[other[1]].coordinates, scene.points[other[2]].coordinates));
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const j = (vertex + 1) % 3; const k = (vertex + 2) % 3;
          const lines = [[base[vertex], base[j]], [base[vertex], base[k]], [other[vertex], other[j]], [other[vertex], other[k]]].map(([a, b]) => bySegment.get(segmentId(a, b)));
          if (lines.every((line) => line)) insertObserved([[lines[0]!, -orientation], [lines[1]!, orientation], [lines[2]!, 1], [lines[3]!, -1]], seed.key);
        }
      }
    }
  }
  // Each cyclic n-point group contributes O(n²) sparse constraints, not all
  // equal inscribed-angle pairs. Lifts retain the integer pi branch.
  for (const seed of existing.filter((item) => item.kind === 'concyclic')) {
    const indexes = [...seed.points];
    const [a, b, c] = indexes;
    const add = (edges: Array<[number, number, number]>) => {
      const lines = edges.map(([x, y]) => bySegment.get(segmentId(x, y)));
      if (lines.some((line) => !line)) return;
      const value = edges.reduce((sum, edge, i) => sum + edge[2] * lines[i]!.angle, 0);
      const lift = Math.round(value / Math.PI);
      if (Math.abs(value - lift * Math.PI) > 8e-7) return;
      space.insert(rowFor(edges.map((edge, i) => [lines[i]!.id, edge[2]]), -lift), seed.key, Math.abs(value - lift * Math.PI) + 1e-12);
    };
    for (const d of indexes.slice(3)) {
      add([[a, d, 1], [a, b, -1], [c, d, -1], [b, c, 1]]);
      add([[b, d, 1], [a, b, -1], [c, d, -1], [a, c, 1]]);
      for (const e of indexes.slice(3).filter((i) => i < d)) add([[d, e, 1], [a, d, -1], [b, e, -1], [a, b, 1]]);
    }
  }

  const seeds: RelationSeed[] = [];
  if (!options.enabledKinds.includes('direction-space')) return { seeds, space, bySegment };
  const order = scene.points.map((_, i) => i).sort((a, b) => scene.points[a].name.localeCompare(scene.points[b].name));
  const seen = new Set<string>();
  let attempts = 0;
  outer: for (let ai = 0; ai < order.length; ai += 1) for (let bi = ai + 1; bi < order.length; bi += 1) for (let ci = bi + 1; ci < order.length; ci += 1) {
    if (seeds.length >= options.maxModels) { budget.note(`Direction model limit (${options.maxModels}) reached; models are partial.`); break outer; }
    if (attempts >= 12) { budget.note('Direction seed limit (12) reached; models are partial.'); break outer; }
    const [a, b, c] = [order[ai], order[bi], order[ci]];
    if (Math.abs(orientedDoubleArea(scene.points[a].coordinates, scene.points[b].coordinates, scene.points[c].coordinates)) <= 2e-7) continue;
    const anchor = bySegment.get(segmentId(a, b));
    const first = bySegment.get(segmentId(a, c)); const second = bySegment.get(segmentId(b, c));
    if (!anchor || !first || !second) continue;
    attempts += 1;
    const bases: typeof carriers = [];
    for (const candidate of [first, second]) if (!fitRationalCombination(wrapDirection(candidate.angle - anchor.angle), bases.map((base) => wrapDirection(base.angle - anchor.angle)), Math.PI)) bases.push(candidate);
    const members: DirectionModel['members'] = [];
    const fits = new Map<string, ReturnType<typeof fitRationalCombination>>();
    // Fit point stars first: only O(n) carriers incident to the seed triangle.
    // Joins between covered centers are deliberately not assumed to belong.
    const candidates = carriers.filter((line) => [a, b, c].some((vertex) => line.points.has(vertex)));
    for (const line of candidates) {
      if (!budget.take('Direction model fits', options.maxComparisons)) break outer;
      const fit = fitRationalCombination(wrapDirection(line.angle - anchor.angle), bases.map((base) => wrapDirection(base.angle - anchor.angle)), Math.PI);
      if (!fit) continue;
      // Store equations in the original [0,pi) lifts rather than silently
      // dividing a modular equation. Re-evaluate after a snapshot changes.
      const lift = Math.round((fit.denominator * (line.angle - anchor.angle)
        - fit.coefficients.reduce((sum, coefficient, i) => sum + coefficient * (bases[i].angle - anchor.angle), 0)) / Math.PI);
      members.push({ line: line.endpoints.map((i) => scene.points[i].name) as [string, string], ...fit, constant: lift });
      fits.set(line.id, { ...fit, constant: lift });
    }
    if (members.length < bases.length + 3) continue;
    const signature = members.map((member) => member.line.join('|')).sort().join(';');
    if (seen.has(signature)) continue;
    seen.add(signature);
    const key = `direction-space:${scene.points[a].name}|${scene.points[b].name}|${scene.points[c].name}`;
    let rank = 0;
    for (const line of carriers) {
      const fit = fits.get(line.id);
      if (!fit) continue;
      const terms: Array<[string, number]> = [[line.id, fit.denominator], [anchor.id, -fit.denominator + fit.coefficients.reduce((sum, value) => sum + value, 0)]];
      bases.forEach((base, i) => terms.push([base.id, -fit.coefficients[i]]));
      if (space.insert(rowFor(terms, -fit.constant), key, fit.denominator * fit.residual) === 'independent') rank += 1;
    }
    if (rank === 0) continue; // A different coordinate frame is not a new discovery.
    const pointCover = order.filter((p) => [a, b, c].every((v) => p === v || fits.has(bySegment.get(segmentId(p, v))?.id ?? ''))).map((p) => scene.points[p].name);
    const model: DirectionModel = { anchor: anchor.endpoints.map((i) => scene.points[i].name) as [string, string],
      generators: bases.map((base) => base.endpoints.map((i) => scene.points[i].name) as [string, string]), members, pointCover, constraintRank: rank };
    const points = new Set(members.flatMap((member) => member.line.map((name) => byName.get(name)!)));
    seeds.push({ key, kind: 'direction-space', points, confidence: 0.95, model, witness: { points: [...points].map((i) => scene.points[i].name) } });
  }
  return { seeds, space, bySegment };
};
