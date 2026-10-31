import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';

const engine = new GeoGebraEmbeddingAdapter();
const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
const button = document.querySelector<HTMLButtonElement>('#run')!;
const log = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLElement>('#status')!;
const report = (message: string) => { log.textContent += `${message}\n`; status.textContent = message; };
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const run = async (source: string) => {
  const result = await executeCommandPipeline(engine, source, { helperMode: 'low' });
  check(result.success, `${source}: ${result.error}`);
  return result;
};
const position = async (name: string): Promise<[number, number]> => [Number(await api('getXcoord', name)), Number(await api('getYcoord', name))];
const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let initialized = false;
button.onclick = async () => {
  button.disabled = true;
  log.textContent = '';
  const data: Record<string, unknown> = {};
  try {
    if (!initialized) { report('Initializing'); await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!); initialized = true; }
    data.engine = engine.getCapabilities();
    await api('newConstruction');
    await run('A=(0,0)\nB=(6,0)\nC=(1,4)');
    const native = await run('Native=TriangleCenter(A,B,C,2)');
    check(!native.expandedCommand || native.expandedCommand === 'Native=TriangleCenter(A,B,C,2)', 'native selector was changed');
    await run('n=2');
    const dynamic = await run('Dynamic=TriangleCenter(A,B,C,n)');
    check(!dynamic.expandedCommand || dynamic.expandedCommand === 'Dynamic=TriangleCenter(A,B,C,n)', 'dynamic selector was changed');
    const ids = [3054, 3056, 3057, 3059, 3060, 3061];
    const initial = new Map<number, [number, number]>();
    for (const id of ids) {
      const result = await run(`X${id}=TriangleCenter(A,B,C,${id})`);
      check(!result.expandedCommand?.includes(`,${id})`), `X(${id}) was not expanded`);
      check(await api('isDefined', `X${id}`), `X(${id}) is undefined`);
      check(await api('getObjectType', `X${id}`) === 'point', `X(${id}) is not a point`);
      const coords = await position(`X${id}`);
      check(coords.every(Number.isFinite), `X(${id}) has nonfinite coordinates`);
      initial.set(id, coords);
      report(`PASS X(${id}) = (${coords.map((n) => n.toFixed(5)).join(', ')})`);
    }
    await api('setCoords', 'C', 1.3, 3.9);
    const moved = new Map<number, [number, number]>();
    for (const id of ids) {
      const coords = await position(`X${id}`);
      check(distance(initial.get(id)!, coords) > 1e-6, `X(${id}) did not follow C`);
      moved.set(id, coords);
    }
    const file = await engine.exportGgb();
    data.ggbBytes = file.size;
    await engine.importGgb(new File([file], 'triangle-centers-smoke.ggb'));
    for (const id of ids) check(await api('isDefined', `X${id}`), `X(${id}) lost after reopen`);
    await api('setCoords', 'C', 0.8, 4.1);
    for (const id of ids) check(distance(moved.get(id)!, await position(`X${id}`)) > 1e-6,
      `X(${id}) lost its dependency after reopen`);
    data.ids = ids;
    data.success = true;
    report('COMPLETE: native passthrough, six points, drag and reopen');
  } catch (error) { data.success = false; data.error = String(error); report(`FAIL ${String(error)}`); }
  finally { document.querySelector<HTMLPreElement>('#json')!.textContent = JSON.stringify(data, null, 2); button.disabled = false; }
};
