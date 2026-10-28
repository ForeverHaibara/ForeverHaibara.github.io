// Run with: node node_modules/vite-node/vite-node.mjs scripts/geogebra/analysis/geogebra-relation-scoring.ts
// These are dependency-graph probes. Numerical discovery is tested separately.
import { buildDependencyGraph } from '../../../src/features/geogebra/analysis/constructionGraph';
import { buildDependencyProfile, measureDependencySeparation, scoreDependencySeparation } from '../../../src/features/geogebra/analysis/dependencyMetric';
import type { ConstructionObjectInput } from '../../../src/features/geogebra/analysis/graphTypes';

const object = (name: string, commandString = '', objectType = 'point'): ConstructionObjectInput => ({ name, commandString, objectType });
const free = (...names: string[]) => names.map((name) => object(name));
const report = (label: string, objects: ConstructionObjectInput[], names: string[]) => {
  const metric = measureDependencySeparation(buildDependencyProfile(buildDependencyGraph(objects)), names);
  console.log(`| ${label} | ${metric.constructionSpan?.toFixed(2) ?? 'disconnected'} | ${scoreDependencySeparation(metric).toFixed(2)} |`);
};

console.log('| Dependency configuration | Construction span | Value |');
console.log('| --- | --- | --- |');
report('Midpoint / arbitrary M=f(A,B): A,B,M', [...free('A', 'B'), object('M', 'F(A,B)')], ['A', 'B', 'M']);
report('Symmedian: A,K,D', [...free('A', 'B', 'C'), object('K', 'TriangleCenter(A,B,C,6)'), object('D', 'HarmonicConjugate(B,C,A)')], ['A', 'K', 'D']);
report('Three triangle centers: O,H,G', [...free('A', 'B', 'C'), object('O', 'CenterO(A,B,C)'), object('H', 'CenterH(A,B,C)'), object('G', 'CenterG(A,B,C)')], ['O', 'H', 'G']);
report('Midpoint theorem: AB parallel MN', [...free('A', 'B', 'C'), object('M', 'F(B,C)'), object('N', 'F(A,C)')], ['A', 'B', 'M', 'N']);
report('Four points on a named circle', [object('c', '', 'circle'), ...['P', 'Q', 'R', 'S'].map((name) => object(name, 'Point(c)'))], ['P', 'Q', 'R', 'S']);

const pappus = [object('l', '', 'line'), object('m', '', 'line'),
  ...['A', 'B', 'C'].map((name) => object(name, 'Point(l)')),
  ...['Ap', 'Bp', 'Cp'].map((name) => object(name, 'Point(m)')),
];
const pairs = [['A', 'Bp', 'Ap', 'B'], ['A', 'Cp', 'Ap', 'C'], ['B', 'Cp', 'Bp', 'C']];
report('Pappus: defining line ABC', pappus, ['A', 'B', 'C']);
report('Pappus: intersections with anonymous lines', [...pappus, ...pairs.map(([a, b, c, d], index) =>
  object(`X${index}`, `Intersect(Line(${a},${b}),Line(${c},${d}))`))], ['X0', 'X1', 'X2']);
report('Pappus: intersections with named lines', [...pappus, ...pairs.flatMap(([a, b, c, d], index) => [
  object(`u${index}`, `Line(${a},${b})`, 'line'), object(`v${index}`, `Line(${c},${d})`, 'line'), object(`X${index}`, `Intersect(u${index},v${index})`),
])], ['X0', 'X1', 'X2']);

const deep = [...free('A', 'B', 'C'), ...['X', 'Y', 'Z'].map((name) => object(`${name}0`, 'F(A,B,C)'))];
for (let level = 1; level <= 4; level += 1) for (const name of ['X', 'Y', 'Z']) deep.push(object(`${name}${level}`, `F(${name}${level - 1})`));
report('Three branches, four additional named steps each', deep, ['X4', 'Y4', 'Z4']);
report('Three free points (numerical observation only)', free('A', 'B', 'C'), ['A', 'B', 'C']);

const inputs = Array.from({ length: 16 }, (_, index) => `A${index}`);
report('16 inputs and their single black-box output', [...free(...inputs), object('Q', `F(${inputs.join(',')})`)], [...inputs, 'Q']);
report('Incomplete definitions', [...free('A', 'B'), { ...object('Q'), readError: 'unavailable' }], ['A', 'B', 'Q']);
