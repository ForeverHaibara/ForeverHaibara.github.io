import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { barycentricVariables, bind, triangleSideSquares } from '../../../src/features/geogebra/commands/custom/algebra/homogeneous';
import { compileStudioCommand } from '../../../src/features/geogebra/commands/custom/commandCompiler';
import type { CommandEnvironment, ToolDefinition } from '../../../src/features/geogebra/commands/custom/types';

// Planning experiment, not a generated database or a production builder.
// Q012: Gibert, Simmons conics, Forum Geom. 6 (2006), p.219.
// Q039: https://www.bernard-gibert.fr/curves/q039.html
const params = new URLSearchParams(location.search);
const q = params.get('q') === '39' ? 39 : 12;
const variant = params.get('variant') ?? 'direct';
const engine = new GeoGebraEmbeddingAdapter();
const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
const output = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const button = document.querySelector<HTMLButtonElement>('#run')!;
const report = (message: string) => { output.textContent += `${message}\n`; status.textContent = message; };
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2; };
const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * .95) - 1];
const requireValue = (test: unknown, message: string) => { if (!test) throw new Error(message); };
const run = async (command: string) => { const result = await engine.executeCommand(command); requireValue(result.success, `${command.slice(0, 120)}: ${result.error}`); };

const polynomial = (xyz: string[], sides: string[]) => {
  const at = (xs: string[], i: number) => `(${xs[i % 3]})`;
  if (q === 12) return sides.map((_, i) => {
    const [u, v, w] = [0, 1, 2].map((j) => at(xyz, i + j));
    return `${at(sides, i)}*(${v}-${w})*(${u}^2-${v}*${w})*${v}*${w}`;
  }).map((term) => `(${term})`).join('+');
  const sa = sides.map((_, i) => `((${at(sides, i + 1)}+${at(sides, i + 2)}-${at(sides, i)})/2)`);
  const differences = sides.map((_, i) => `(${at(sides, i + 2)}*${at(xyz, i + 1)}^2-${at(sides, i + 1)}*${at(xyz, i + 2)}^2)`);
  const cubic = sides.map((_, i) => `((${at(sides, i)}*${at(sa, i)}-${at(sa, i + 1)}*${at(sa, i + 2)})*${at(xyz, i)}*${differences[i]})`).join('+');
  return `4*${xyz.map((x) => `(${x})`).join('*')}*(${cubic})+${differences.join('*')}`;
};

const source = () => {
  if (variant === 'triangle') return `aa=Distance(B,C)^2\nbb=Distance(C,A)^2\ncc=Distance(A,B)^2\nout=TriangleCurve(A,B,C,${polynomial(['A', 'B', 'C'], ['aa', 'bb', 'cc'])}=0)`;
  const xyz = barycentricVariables(['A', 'B', 'C']);
  const sides = triangleSideSquares(['A', 'B', 'C']);
  let serial = 0;
  const equation = variant === 'bound' ? bind(sides, () => `probe${++serial}`, (cs) => polynomial(xyz, cs), 'number') : polynomial(xyz, sides);
  return `out=ImplicitCurve(${equation})`;
};

let initialized = false;
button.onclick = async () => {
  button.disabled = true;
  output.textContent = '';
  const raw: Record<string, unknown> = { date: '2026-10-29', q, variant, userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], runs: [] };
  try {
    if (!initialized) { status.textContent = 'Initializing engine'; await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!); initialized = true; }
    raw.engine = engine.getCapabilities();
    const command = source(); raw.expressionLength = command.length;
    const samples: Array<{create: number; createPaint: number; updates: number[]; updatePaint: number[]}> = [];
    for (let trial = 0; trial < 4; trial++) {
      await api('newConstruction'); await api('setCoordSystem', -2, 8, -2, 6);
      await run('A=(0,0)\nB=(6,0)\nC=(1,4)'); await nextPaint();
      const begin = performance.now(); await run(command); const create = performance.now() - begin;
      requireValue(await api('isDefined', 'out'), 'curve undefined');
      await nextPaint(); const createPaint = performance.now() - begin;
      requireValue(/<element\b[^>]*\btype="implicit/u.test(String(await api('getXML', 'out'))), 'wrong native output type');
      const before = String(await api('getValueString', 'out'));
      const updates: number[] = []; const updatePaint: number[] = [];
      for (const [x, y] of [[1.2,3.8],[.8,4.2],[1.4,4.1],[1,4],[1.2,3.8],[.8,4.2],[1.4,4.1],[1,4]]) {
        const start = performance.now(); await api('setCoords', 'C', x, y); updates.push(performance.now() - start);
        await nextPaint(); updatePaint.push(performance.now() - start);
        requireValue(await api('isDefined', 'out'), 'curve undefined during update');
        if (x !== 1) requireValue(String(await api('getValueString', 'out')) !== before, 'curve did not follow C');
      }
      if (trial) samples.push({ create, createPaint, updates, updatePaint });
      report(`${trial ? 'RUN' : 'WARM'} Q${q}/${variant}: create ${create.toFixed(1)} ms (${createPaint.toFixed(1)} incl. paint); update median ${median(updates).toFixed(1)} ms (${median(updatePaint).toFixed(1)} incl. paint)`);
    }
    raw.runs = samples;
    raw.summary = { createMedian: median(samples.map((s) => s.create)), createPaintMedian: median(samples.map((s) => s.createPaint)), updateMedian: median(samples.flatMap((s) => s.updates)), updateP95: p95(samples.flatMap((s) => s.updates)), updatePaintMedian: median(samples.flatMap((s) => s.updatePaint)), updatePaintP95: p95(samples.flatMap((s) => s.updatePaint)) };
    raw.objectNames = await api('getAllObjectNames');
    await run('probeFunction(x,y)=LeftSide(out)-RightSide(out)');
    const centerIds = q === 12 ? [2,6,13,14] : [1,13,14,15,16];
    const checks: Array<Record<string,unknown>> = [];
    // Normalize against evaluations on a fixed grid: raw equation scale depends on triangle area.
    const grid = [[-1,1],[2,1],[4,3],[7,5],[0,-1]];
    const scale = Math.max(1, ...await Promise.all(grid.map(async ([x,y]) => Math.abs(Number(await api('getValue', `probeFunction(${x},${y})`))))));
    for (const id of centerIds) {
      await run(`T=TriangleCenter(A,B,C,${id})`);
      requireValue(await api('isDefined', 'T'), `X${id} unavailable`);
      const residual = Number(await api('getValue', 'probeFunction(x(T),y(T))'));
      requireValue(Number.isFinite(residual) && Math.abs(residual)/scale < 1e-8, `X${id} residual ${residual}/scale ${scale}`);
      checks.push({ id, residual, normalized: Math.abs(residual)/scale });
    }
    raw.incidence = { gridScale: scale, checks };
    requireValue(scale > 1, 'missing off-curve negative control');
    const beforeExport = String(await api('getValueString', 'out'));
    const file = await engine.exportGgb(); raw.ggbBytes = file.size;
    await engine.importGgb(new File([file], 'related-curves-probe.ggb'));
    requireValue(await api('isDefined', 'out'), 'curve lost after reopen');
    await api('setCoords', 'C', 1.3, 3.9);
    requireValue(String(await api('getValueString', 'out')) !== beforeExport, 'reopened curve lost dynamic dependency');
    raw.reopenDynamic = true;
    // A synthetic local overload checks compiler resolution; no catalog mutation.
    const env: CommandEnvironment = { objects: new Map([['A','point'],['B','point'],['C','point'],['n','number']]), macros: new Set() };
    const fake: ToolDefinition = { name: 'TriangleCurve', description: 'probe only', overloads: [{params: [{name:'A',type:'point'},{name:'B',type:'point'},{name:'C',type:'point'},{name:'id',type:'number'}],returns:'implicitCurve',expression:'ImplicitCurve(x^4+y^4-1)'}] };
    const toolMap = new Map([['trianglecurve', fake]]);
    raw.dispatchProbe = ['TriangleCurve(A,B,C,12)','TriangleCurve(A,B,C,n)','TriangleCurve(A,B,C,(A-B)*(B-C)*(C-A)=0)'].map((input) => ({ input, expanded: compileStudioCommand(input, env, toolMap) }));
    raw.centerAvailability = [];
    for (const id of [3053,3054,3585,5456,73048]) {
      const result = await engine.executeCommand(`centerProbe${id}=TriangleCenter(A,B,C,${id})`);
      (raw.centerAvailability as unknown[]).push({ id, accepted: result.success, defined: Boolean(await api('isDefined', `centerProbe${id}`)) });
    }
    raw.success = true;
    report(`PASS known centers, nonzero controls, native implicit type, dynamic updates, export/reopen. ${JSON.stringify(raw.summary)}`);
    report('COMPLETE');
  } catch (error) { raw.success = false; raw.error = String(error); report(`FAIL ${String(error)}`); }
  finally { document.querySelector<HTMLPreElement>('#json')!.textContent = JSON.stringify(raw, null, 2); button.disabled = false; }
};
