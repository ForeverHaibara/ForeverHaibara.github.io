import { circularDistance, DisjointSet } from './equivalence';
import { buildDependencyProfile, explainDependencySeparation, measureDependencySeparation, scoreDependencySeparation } from './dependencyMetric';
import type { DependencyGraph } from './graphTypes';
import type { GeometryRelation, GeometryRelationKind, GeometryRelationResult, RelationWitness } from './geometryTypes';
import { buildGeometryScene, buildTolerance, createCircle, linePointNames, lineFamilyNames } from './scene/geometryScene';
import type { CircleCandidate } from './scene/geometryScene';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget, LEGACY_RELATION_KINDS } from './relations/catalog';
import type { DiscoveryOptions } from './relations/catalog';
import { detectMetricRelations } from './relations/metricRelations';
import type { RelationSeed } from './relations/relationSeed';
import { compressRefinements } from './relations/refinements';

const RELATION_ORDER: GeometryRelationKind[] = ['direction-space', 'length-space', 'congruent-triangles', 'similar-triangles', 'concyclic', 'perpendicular', 'parallel', 'midpoint', 'angle-multiple', 'complementary-angles', 'supplementary-angles', 'equal-angles', 'length-multiple', 'equal-lengths', 'coincident-points', 'collinear'];
const MAX_WITNESSES = 8;
const MAX_CIRCLE_CANDIDATES = 8000;

export const detectGeometryRelations = (graph: DependencyGraph, computedAt = Date.now(), options: DiscoveryOptions = { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: LEGACY_RELATION_KINDS }): GeometryRelationResult => {
  const diagnostics: string[] = [];
  const enabled = new Set(options.enabledKinds);
  if (enabled.size === 0) return { relations: [], pointCount: graph.nodes.filter((node) => node.coordinates).length, tolerance: buildTolerance(), diagnostics, computedAt };
  const scene = buildGeometryScene(graph, diagnostics);
  const { points, scale, tolerance, lineGroups, directionFamilies, directionFrames } = scene;
  const budget = new DiscoveryBudget(diagnostics);
  const relationSeeds: RelationSeed[] = [];

  lineGroups.forEach((line) => {
    const names = linePointNames(line, points);
    if (enabled.has('collinear') && line.points.size >= 3) relationSeeds.push({ key: `collinear:${names.join('|')}`, kind: 'collinear', witness: { points: names.slice(0, MAX_WITNESSES), lineFamilies: [[names]] }, points: line.points, confidence: Math.min(1, 0.75 + (line.points.size - 3) * 0.05) });
  });

  directionFamilies.forEach(({ root: directionRoot, lines: family }) => {
    if (!enabled.has('parallel') || family.length < 2) return;
    const pointsInFamily = new Set(family.flatMap((line) => [...line.points]));
    relationSeeds.push({ key: `parallel:${directionRoot}`, kind: 'parallel', witness: { points: [...pointsInFamily].map((index) => points[index].name), lineFamilies: [lineFamilyNames(family, points)] }, points: pointsInFamily, confidence: 0.98 });
  });

  directionFrames.forEach((frame) => frame.forEach((leftId, leftIndex) => {
    if (!enabled.has('perpendicular')) return;
    const left = directionFamilies[leftId];
    frame.slice(leftIndex + 1).forEach((rightId) => {
      const right = directionFamilies[rightId];
      if (circularDistance(left.angle - right.angle, Math.PI / 2, Math.PI) > tolerance.angular) return;
      const leftLines = left.lines;
      const rightLines = right.lines;
      if (leftLines.length === 0 || rightLines.length === 0) return;
      const pointsInFamily = new Set([...leftLines, ...rightLines].flatMap((line) => [...line.points]));
      relationSeeds.push({ key: `perpendicular:${Math.min(left.root, right.root)}:${Math.max(left.root, right.root)}`, kind: 'perpendicular', witness: { points: [...pointsInFamily].map((index) => points[index].name), lineFamilies: [lineFamilyNames(leftLines, points), lineFamilyNames(rightLines, points)] }, points: pointsInFamily, confidence: 0.98 });
    });
  }));

  const circles: CircleCandidate[] = [];
  let stopped = false;
  for (let a = 0; enabled.has('concyclic') && a < points.length && !stopped; a += 1) {
    for (let b = a + 1; b < points.length && !stopped; b += 1) {
      for (let c = b + 1; c < points.length; c += 1) {
        if (!budget.take('Circle triples', options.maxTriangles)) { stopped = true; break; }
        if (circles.length >= MAX_CIRCLE_CANDIDATES) { stopped = true; break; }
        const circle = createCircle(points[a].coordinates, points[b].coordinates, points[c].coordinates);
        if (circle) circles.push({ ...circle, points: [a, b, c] });
      }
    }
  }
  if (stopped && circles.length >= MAX_CIRCLE_CANDIDATES) diagnostics.push(`Circle candidate limit (${MAX_CIRCLE_CANDIDATES}) reached; further candidates were skipped.`);
  const circleSet = new DisjointSet(circles.length);
  const buckets = new Map<string, number[]>();
  const MAX_BUCKET_REPRESENTATIVES = 8;
  const bucketSize = Math.max(tolerance.circleCenter, tolerance.circleRadius);
  circles.forEach((circle, index) => {
    const base = [Math.floor(circle.centerX / bucketSize), Math.floor(circle.centerY / bucketSize), Math.floor(circle.radius / bucketSize)];
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dr = -1; dr <= 1; dr += 1) {
      const key = `${base[0] + dx}:${base[1] + dy}:${base[2] + dr}`;
      (buckets.get(key) ?? []).slice(0, MAX_BUCKET_REPRESENTATIVES).forEach((candidateIndex) => {
        const candidate = circles[candidateIndex];
        if (Math.hypot(circle.centerX - candidate.centerX, circle.centerY - candidate.centerY) <= tolerance.circleCenter && Math.abs(circle.radius - candidate.radius) <= tolerance.circleRadius) circleSet.union(index, candidateIndex);
      });
    }
    const ownKey = `${base[0]}:${base[1]}:${base[2]}`;
    const representatives = buckets.get(ownKey) ?? [];
    if (representatives.length < MAX_BUCKET_REPRESENTATIVES) buckets.set(ownKey, [...representatives, index]);
  });
  [...circleSet.groups().values()].forEach((indexes) => {
    const pointSet = new Set(indexes.flatMap((index) => circles[index].points));
    const circle = circles[indexes[0]];
    // Bucket clustering is only a candidate search, not an incidence proof.
    if (![...pointSet].every((index) => Math.abs(Math.hypot(points[index].coordinates.x - circle.centerX, points[index].coordinates.y - circle.centerY) - circle.radius) <= tolerance.circleRadius)) return;
    if (pointSet.size >= 4) {
      const names = [...pointSet].map((index) => points[index].name);
      relationSeeds.push({ key: `concyclic:${[...names].sort().join('|')}`, kind: 'concyclic', witness: { points: names.slice(0, MAX_WITNESSES) }, points: pointSet, confidence: Math.min(1, 0.85 + (pointSet.size - 4) * 0.03) });
    }
  });

  relationSeeds.push(...detectMetricRelations(scene, relationSeeds, options, budget));
  const profile = buildDependencyProfile(graph);
  const relations = new Map<string, GeometryRelation>();
  const aliases = new Map(points.map((point) => [point.name, point.aliases]));
  const expandNames = (names: readonly string[]): string[] => names.flatMap((name) => aliases.get(name) ?? [name]);
  compressRefinements(relationSeeds, options.compressConsequences).forEach((seed) => {
    const pointNames = seed.expandAliases === false ? [...seed.scoringNames!].sort() : [...seed.points].flatMap((index) => points[index].aliases).sort();
    const id = seed.key;
    const representativeNames = [...new Set(seed.witness.points)].sort();
    // Display limits must not hide a distant dependency from the value metric.
    const scoringNames = seed.scoringNames ?? [...seed.points].map((index) => points[index].name);
    const metric = measureDependencySeparation(profile, scoringNames);
    const witness: RelationWitness = {
      ...seed.witness,
      points: seed.expandAliases === false ? representativeNames : expandNames(representativeNames).sort(),
      lineFamilies: seed.witness.lineFamilies?.map((family) => family.map(expandNames)),
    };
    const baseNonTriviality = scoreDependencySeparation(metric);
    const relation: GeometryRelation = { id, kind: seed.kind, pointNames, witnesses: [witness], confidence: seed.confidence,
      nonTriviality: seed.derived ? baseNonTriviality * 0.25 : baseNonTriviality, baseNonTriviality,
      explanation: explainDependencySeparation(metric) + (seed.derived ? '; generated by computed observations (novelty × 0.25)' : ''),
      metric, model: seed.model, lengthModel: seed.lengthModel, derived: seed.derived, derivedFrom: seed.sourceIds };
    const existing = relations.get(id);
    if (existing) {
      existing.witnesses = [...existing.witnesses, witness].slice(0, MAX_WITNESSES);
      existing.confidence = Math.max(existing.confidence, relation.confidence);
    } else relations.set(id, relation);
  });

  const sortedRelations = [...relations.values()].sort((left, right) => right.nonTriviality - left.nonTriviality || right.confidence - left.confidence || RELATION_ORDER.indexOf(left.kind) - RELATION_ORDER.indexOf(right.kind) || left.id.localeCompare(right.id));
  if (sortedRelations.length > options.maxRelations) diagnostics.push(`Relation display budget (${options.maxRelations}) reached; lower ranked groups omitted.`);
  // Do not hide the generator summaries that explain compressed consequences
  // just because many independent scalar observations have a larger raw score.
  const retained = new Set(sortedRelations.filter((relation) => relation.model || relation.lengthModel).slice(0, options.maxRelations));
  for (const relation of sortedRelations) { if (retained.size >= options.maxRelations) break; retained.add(relation); }
  return { relations: sortedRelations.filter((relation) => retained.has(relation)), pointCount: points.reduce((count, point) => count + point.aliases.length, 0), tolerance: buildTolerance(scale), diagnostics, computedAt };
};
