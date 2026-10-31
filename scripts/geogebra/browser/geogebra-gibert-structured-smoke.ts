import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import records from '../../../src/features/geogebra/commands/custom/data/related-curves/curves.json';
import fixtures from './fixtures/gibert-pedal.json';
import { enableExperimentalGibertCurve } from './gibert-experimental';
import { compareGibertResidual } from './gibert-residual';

// Independent exact-primary-equation reference values, rounded once offline.
const params = new URLSearchParams(location.search);
const id = params.get('id') ?? '18';
enableExperimentalGibertCurve(`Q${id.padStart(3,'0')}`,params.has('experimental'));
const record = records.find(r => r.id === `Q${id.padStart(3, '0')}`)!;
const engine = new GeoGebraEmbeddingAdapter();
const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
const log = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const button = document.querySelector<HTMLButtonElement>('#run')!;
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const run = async (command: string) => {
  const result = await executeCommandPipeline(engine, command, { helperMode: 'medium' });
  check(result.success, `${command}: ${result.error}`);
};
const shapes = record ? fixtures[record.id as keyof typeof fixtures] : undefined;

button.onclick = async () => {
  button.disabled = true; log.textContent = '';
  const data: Record<string, unknown> = { id: `Q${id.padStart(3,'0')}`, engine: undefined, cases: [] };
  const cases: unknown[] = [];
  const report = (message: string) => { log.textContent += `${message}\n`; status.textContent = message; };
  try {
    if (!record || !shapes) throw new Error('Curve not enabled; deferred candidates require experimental=1.');
    report('Initializing');
    await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!);
    data.engine = engine.getCapabilities();
    await api('newConstruction');
    await api('setCoordSystem', -2, 8, -5, 6);
    await run('A=(0,0)\nB=(6,0)\nC=(1,4)');
    await run(`out=GibertCurve(A,B,C,${id})`);
    await run('diagnostic(x,y)=LeftSide(out)-RightSide(out)');
    for (const { name, vertices, points, expected, vertexExpected } of shapes) {
      for (let i = 0; i < 3; i++) await api('setCoords', 'ABC'[i], ...vertices[i]);
      check(await api('isDefined', 'out'), `${name}: undefined curve`);
      const actual = await Promise.all(points.map(async ([x, y]) => Number(await api('getValue', `diagnostic(${x},${y})`))));
      const anchor = expected.slice(0, 4).reduce((best, value, i) => Math.abs(value) > Math.abs(expected[best]) ? i : best, 0);
      const ratio = actual[anchor] / expected[anchor];
      const scale = Math.max(...actual.slice(0, 4).map(Math.abs));
      check(Number.isFinite(scale) && scale > 0 && Number.isFinite(ratio) && ratio !== 0, `${name}: zero/nonfinite polynomial`);
      const comparisons = actual.map((value,i) => compareGibertResidual(value,expected[i]*ratio,scale));
      const error = Math.max(...comparisons.map(result=>result.normalizedError));
      if (comparisons.some(result=>!result.accepted)) data.failedSamples = { name, actual, expected, ratio };
      check(comparisons.every(result=>result.accepted), `${name}: source residual ${error}`);
      const vertexComparisons = await Promise.all(vertices.map(async ([x, y], i) =>
        compareGibertResidual(Number(await api('getValue', `diagnostic(${x},${y})`)),vertexExpected[i]*ratio,scale)));
      const vertexResiduals = vertexComparisons.map(result=>result.normalizedError);
      if (vertexComparisons.some(result=>!result.accepted))
        data.failedVertices = { name, error, vertexResiduals };
      check(vertexComparisons.every(result=>result.accepted), `${name}: vertex residual exceeds tolerance`);
      cases.push({ name, vertices, error, vertexResiduals, samples: points.length,
        strictVertexDiagnosticPassed: vertexComparisons.every(result=>result.strictDiagnosticPassed) });
      report(`PASS ${name}: source ${error.toExponential(2)}, vertices and side/circle neighbourhoods`);
    }
    if (record.id === 'Q020') {
      for (let i = 0; i < 3; i++) await api('setCoords', 'ABC'[i], ...[[0, 0], [6, 0], [1, 4]][i]);
      const residuals: number[] = [];
      for (const [a, b, c] of [['A', 'B', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B']]) {
        const sa = `Distance(${b},${c})`, sb = `Distance(${c},${a})`, sc = `Distance(${a},${b})`;
        await run(`T=((-(${sa}))*${a}+(${sb})*${b}+(${sc})*${c})/(-(${sa})+(${sb})+(${sc}))`);
        const value = Number(await api('getValue', 'diagnostic(x(T),y(T))'));
        const scale = Math.abs(Number(await api('getValue', 'diagnostic(7,5)')));
        check(Number.isFinite(value) && Math.abs(value / scale) < 1e-8, 'excenter lost');
        residuals.push(value / scale);
      }
      data.excenters = residuals; report('PASS three excenters');
    }
    data.success = true; report('COMPLETE');
  } catch (error) {
    data.success = false; data.error = String(error); report(`FAIL ${error}`);
  } finally {
    data.cases = cases;
    document.querySelector('#json')!.textContent = JSON.stringify(data, null, 2);
    button.disabled = false;
    if (window.parent !== window) window.parent.postMessage({type:'gibert-structured-result',data},location.origin);
  }
};
if(params.has('autorun')) button.click();
