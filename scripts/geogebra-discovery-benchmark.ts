import { triangleCenterFixture } from '../src/features/geogebra/analysis/__fixtures__/triangleCenters';
import { buildDependencyGraph } from '../src/features/geogebra/analysis/constructionGraph';
import { detectGeometryRelations } from '../src/features/geogebra/analysis/geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS } from '../src/features/geogebra/analysis/relations/catalog';
import type { ConstructionObjectInput } from '../src/features/geogebra/analysis/graphTypes';

const graph = buildDependencyGraph(triangleCenterFixture());
for (const compressConsequences of [false, true]) {
  const started = performance.now();
  const result = detectGeometryRelations(graph, 0, { ...DEFAULT_DISCOVERY_OPTIONS, compressConsequences });
  const counts = Object.fromEntries([...new Set(result.relations.map((r) => r.kind))].map((kind) => [kind, result.relations.filter((r) => r.kind === kind).length]));
  console.log(JSON.stringify({ compressConsequences, elapsedMs: Math.round(performance.now() - started), counts, diagnostics: result.diagnostics }));
  const model = result.relations.find((r) => r.id === 'direction-space:A|B|C')?.model;
  console.log(JSON.stringify({ seed: 'ABC', generators: model?.generators, pointCover: model?.pointCover, members: model?.members.length }));
}

if (process.argv.includes('--scale')) {
  for (const count of [20, 40, 80]) for (const kind of ['scattered', 'circle', 'grid']) {
    const points: ConstructionObjectInput[] = Array.from({ length: count }, (_, i) => {
      const coordinates = kind === 'circle' ? { x: Math.cos(2 * Math.PI * i / count), y: Math.sin(2 * Math.PI * i / count) }
        : kind === 'grid' ? { x: i % Math.ceil(Math.sqrt(count)), y: Math.floor(i / Math.ceil(Math.sqrt(count))) }
          : { x: Math.sin(i * 12.317) * 10 + i / count, y: Math.cos(i * 7.933) * 10 };
      return { name: `P${String(i).padStart(3, '0')}`, objectType: 'point', commandString: '', coordinates };
    });
    const started = performance.now();
    const result = detectGeometryRelations(buildDependencyGraph(points), 0, DEFAULT_DISCOVERY_OPTIONS);
    console.log(JSON.stringify({ kind, count, elapsedMs: Math.round(performance.now() - started), groups: result.relations.length, diagnostics: result.diagnostics }));
  }
}
