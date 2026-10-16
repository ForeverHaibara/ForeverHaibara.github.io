import { GeoGebraEmbeddingAdapter } from '../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { compileStudioCommand } from '../src/features/geogebra/commands/custom/commandCompiler';
import { createQLCu1Equation } from './geogebra-qlcu1-equation';

const engine = new GeoGebraEmbeddingAdapter();
const button = document.querySelector<HTMLButtonElement>('#run')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const raw = document.querySelector<HTMLElement>('#raw')!;
const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const paint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const variants = {
  existing: compileStudioCommand('QLCu1(A,B,C,D)', { objects: new Map(['A', 'B', 'C', 'D'].map((p) => [p, 'point'])), macros: new Set() }),
  direct: createQLCu1Equation().expression,
};
type Variant = keyof typeof variants;
type Case = { round: number; variant: Variant; repaint: boolean; creationMs: number; creationWithPaintMs: number; updateMs: number[]; frameMs: number[] };
const data: { environment: Record<string, unknown>; checks: unknown[]; cases: Case[] } = { environment: {}, checks: [], cases: [] };
const log = (message: string) => { results.textContent += `${message}\n`; raw.textContent = JSON.stringify(data, null, 2); };
const checkedCommand = async (command: string) => {
  const result = await engine.executeCommand(command);
  if (!result.success) throw new Error(`Native command failed: ${command.slice(0, 100)}: ${result.error}`);
};
const coordinates = (i: number, steps: number) => {
  const angle = 2 * Math.PI * i / steps;
  return [3 + 0.4 * Math.sin(angle), 3 + 0.3 * Math.cos(angle)];
};
const setup = async () => {
  await api('setRepaintingActive', false);
  await api('newConstruction');
  await checkedCommand('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2)');
  await api('setPerspective', 'G');
  await api('setCoordSystem', -5, 8, -4, 6);
};
const verify = async () => {
  await setup();
  await checkedCommand(`OldCurve=${variants.existing}\nDirectCurve=${variants.direct}\noldF=LeftSide(OldCurve)-RightSide(OldCurve)\ndirectF=LeftSide(DirectCurve)-RightSide(DirectCurve)`);
  for (const [x, y] of [[3, 3], [3.4, 3.1], [2.7, 2.8]]) {
    await api('setCoords', 'C', x, y);
    const reference = Number(await api('getValue', 'oldF(0.7,1.1)'));
    const candidate = Number(await api('getValue', 'directF(0.7,1.1)'));
    const ratio = candidate / reference;
    let maxError = 0;
    // A triangular grid of ten probes determines every coefficient through degree three.
    for (const [px, py] of Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 - i }, (_, j) => [i - 1.3, j - 0.8])).flat()) {
      const oldValue = Number(await api('getValue', `oldF(${px},${py})`));
      const directValue = Number(await api('getValue', `directF(${px},${py})`));
      const error = Math.abs(directValue - ratio * oldValue) / Math.max(1, Math.abs(directValue), Math.abs(ratio * oldValue));
      if (!Number.isFinite(error)) throw new Error('Undefined polynomial during equivalence check.');
      maxError = Math.max(maxError, error);
    }
    if (maxError > 1e-8) throw new Error(`Curve mismatch: ${maxError}`);
    data.checks.push({ C: [x, y], ratio, maxError });
  }
  // Translation-sensitive regression for the corrected three-parameter overload.
  await setup();
  await checkedCommand(`M=(1,1)\nS=(2,1)\nn:x=0\nBugCurve=${compileStudioCommand('QLCu1(M,S,n)', { objects: new Map([['M', 'point'], ['S', 'point'], ['n', 'line']]), macros: new Set() })}\nbugF=LeftSide(BugCurve)-RightSide(BugCurve)`);
  const bugResidual = Number(await api('getValue', 'bugF(0,1)'));
  if (!Number.isFinite(bugResidual) || Math.abs(bugResidual) > 1e-10) throw new Error(`Bracket regression: ${bugResidual}`);
  data.checks.push({ bracketRegressionResidual: bugResidual });
  log('PASS native polynomial equivalence at 3 configurations / 10 cubic probes, plus bracket regression.');
};
const runCase = async (variant: Variant, repaint: boolean, round: number, steps: number, record = true) => {
  status.textContent = `Round ${round}: ${variant}, ${repaint ? 'visible' : 'repainting disabled'}`;
  await setup();
  await api('setRepaintingActive', repaint);
  if (repaint) await paint();
  await yieldTask();
  const start = performance.now();
  await checkedCommand(`Q=${variants[variant]}`);
  const creationMs = performance.now() - start;
  if (repaint) await paint();
  const creationWithPaintMs = performance.now() - start;
  if (!await api('isDefined', 'Q')) throw new Error(`Undefined ${variant} curve.`);
  const entry: Case = { round, variant, repaint, creationMs, creationWithPaintMs, updateMs: [], frameMs: [] };
  if (record) data.cases.push(entry);
  for (let i = 0; i < steps; i++) {
    const [x, y] = coordinates(i, steps);
    const begin = performance.now();
    await api('setCoords', 'C', x, y);
    entry.updateMs.push(performance.now() - begin);
    if (repaint) await paint();
    entry.frameMs.push(performance.now() - begin);
    await yieldTask();
    status.textContent = `Round ${round}: ${variant}, ${repaint ? 'visible' : 'repainting disabled'}, ${i + 1}/${steps}`;
  }
  if (!await api('isDefined', 'Q')) throw new Error('Curve became undefined on drag path.');
  if (record) log(`${variant} ${repaint ? 'visible' : 'no repaint'}: create ${creationMs.toFixed(1)} ms; update median ${median(entry.updateMs).toFixed(1)} ms; two-rAF median ${median(entry.frameMs).toFixed(1)} ms.`);
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
let initialized = false;
button.onclick = async () => {
  button.disabled = true; results.textContent = ''; data.cases = []; data.checks = [];
  try {
    if (!initialized) { status.textContent = 'Loading GeoGebra'; await engine.initialize(document.querySelector<HTMLElement>('#canvas')!); initialized = true; }
    data.environment = { version: await api('getVersion'), userAgent: navigator.userAgent, devicePixelRatio, appletSize: [800, 480], browserViewport: [innerWidth, innerHeight], visibility: document.visibilityState, rounds: Number(document.querySelector<HTMLInputElement>('#rounds')!.value), steps: Number(document.querySelector<HTMLInputElement>('#steps')!.value), lengths: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.length])), date: new Date().toISOString() };
    log(JSON.stringify(data.environment));
    status.textContent = 'Checking curve equivalence'; await verify();
    log('Warming up both native command paths (excluded from results).');
    await runCase('direct', true, 0, 2, false); await runCase('existing', true, 0, 2, false);
    const rounds = Math.min(8, Math.max(1, Number(document.querySelector<HTMLInputElement>('#rounds')!.value)));
    const steps = Math.min(120, Math.max(2, Number(document.querySelector<HTMLInputElement>('#steps')!.value)));
    for (let round = 1; round <= rounds; round++) {
      const order: Variant[] = round % 2 ? ['existing', 'direct'] : ['direct', 'existing'];
      for (const repaint of [false, true]) for (const variant of order) await runCase(variant, repaint, round, steps);
    }
    status.textContent = 'COMPLETE'; log('COMPLETE');
  } catch (error) { status.textContent = 'FAILED'; log(String(error)); }
  finally { await api('setRepaintingActive', true).catch(() => {}); button.disabled = false; }
};
