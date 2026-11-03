import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';

// Independent pre-compression coordinates, retained as real-engine regression fixtures.
const collineationReference: Record<number, number[]> = {
  24658: [2.4511589744480706, 1.3527345041919392, 1.4911424460082217, 0.7622498311246817],
  25969: [2.5728775310191425, 1.3483048456886964, 1.7037730353676086, 0.7246453677618874],
  29919: [4.9027555777565714, 1.4939222236097849, 6.8285960056441715, 8.732181258819004],
  24526: [3.5119005236942966, 1.5273962148267932, 0.2540659346790062, 1.4359100655126178],
  25449: [3.324856646051621, 1.3953035403782261, 0.9238948728280945, -0.49391426120610354],
  26159: [3.119585329379261, 1.382474083086204, 1.7214696144640766, 0.7522962726001191],
  27425: [57.861736654328865, -10.989007957388901, 5.47322099310442, -0.9694801659255368],
  27813: [5.747050763069938, 0.09199498425363449, 1.906239470023517, 0.6644026626181668],
  28794: [0.09154004654494992, 1.659563638615529, 4.244231814148856, 1.1292092258242503],
  29752: [-9.848261953389386, 0.5719836279131651, -63.12306385179855, -100.56728726843532],
  29897: [3.8975893345275017, 1.4310993334079674, 0.13245795729300894, -1.730534441729677],
  31183: [2.877473554046309, 1.1966454871900856, 5.4441599906606335, 0.327525547348126],
};

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
    if (new URLSearchParams(location.search).get('suite') === 'collineations') {
      const params = new URLSearchParams(location.search);
      const mode = params.get('mode') === 'high' ? 'high' : params.get('mode') === 'medium' ? 'medium' : 'low';
      const ids = (params.get('ids') ?? '24658,25969,29919,24526,25449,26159,27425,27813,28794,29752,29897,31183').split(',').map(Number);
      const timings = [];
      const compare = async (id: number, offset: number) => {
        const expected = collineationReference[id]?.slice(offset, offset + 2) as [number, number] | undefined;
        if (expected) check(distance(expected, await position(`X${id}`)) < 1e-7 * Math.max(1, Math.hypot(...expected)), `X(${id}) coordinate mismatch`);
      };
      for (const id of ids) {
        report(`Creating X(${id}), mode=${mode}`);
        const start = performance.now();
        const result = await executeCommandPipeline(engine, `X${id}=TriangleCenter(A,B,C,${id})`, { helperMode: mode });
        check(result.success, result.error ?? `X(${id}) failed`);
        check(await api('isDefined', `X${id}`), `X(${id}) undefined`);
        timings.push({ id, ms: performance.now() - start, position: await position(`X${id}`) });
        await compare(id, 0);
        report(`PASS X(${id}) ${timings.at(-1)!.ms.toFixed(1)} ms`);
      }
      report('Checking obtuse coordinates and moving C');
      const updates = [];
      for (const [x, y] of [[-1, 2], [1.3, 3.9], [1, 4]]) {
        const start = performance.now();
        await api('setCoords', 'C', x, y);
        for (const id of ids) {
          check(await api('isDefined', `X${id}`), `X(${id}) undefined after moving C`);
          if (x === -1 || x === 1) await compare(id, x === -1 ? 2 : 0);
        }
        updates.push(performance.now() - start);
      }
      report('Checking save/reopen and live dependencies');
      const file = await engine.exportGgb();
      await engine.importGgb(new File([file], 'collineation-regression.ggb'));
      await api('setCoords', 'C', -1, 2);
      for (const id of ids) await compare(id, 2);
      data.timings = timings;
      data.updates = updates;
      data.ggbBytes = file.size;
      data.helperObjects = (await api('getAllObjectNames') as string[]).filter((name) => name.startsWith('ggbaux')).length;
      check(mode !== 'high' || Number(data.helperObjects) > 0, 'High mode did not use the production named plan');
      if (ids.includes(25969)) {
        await api('setCoords', 'C', 0, 4);
        check(await api('isDefined', 'X25969'), 'Gemini37 lost its cleared right-angle chart');
      }
      await api('setCoords', 'C', 1, 0);
      for (const id of ids) check(!await api('isDefined', `X${id}`), `X(${id}) accepted a flat input triangle`);
      await api('setCoords', 'C', -1, 2);
      for (const id of ids) await compare(id, 2);
      data.success = true;
      report('COMPLETE: collineations, coordinate references, obtuse/right/flat triangles, drag and reopen');
      return;
    }
    const native = await run('Native=TriangleCenter(A,B,C,2)');
    check(!native.expandedCommand || native.expandedCommand === 'Native=TriangleCenter(A,B,C,2)', 'native selector was changed');
    const boundary = await run('NativeBoundary=TriangleCenter(A,B,C,3053)');
    check(!boundary.expandedCommand || boundary.expandedCommand === 'NativeBoundary=TriangleCenter(A,B,C,3053)', 'native boundary selector was changed');
    await run('n=2');
    const dynamic = await run('Dynamic=TriangleCenter(A,B,C,n)');
    check(!dynamic.expandedCommand || dynamic.expandedCommand === 'Dynamic=TriangleCenter(A,B,C,n)', 'dynamic selector was changed');
    // Stratified sample across ETC parts, operation types, and dependency depth.
    const ids = [3054, 3055, 3057, 3064, 3070, 3072, 3076, 3109, 3114, 3154, 3252,
      3559, 3641, 3670, 3933, 4116, 4590, 5091, 5111, 5305, 6061, 7160,
      7561, 9144, 9208, 9215, 9966, 72008, 72185, 72458, 72478, 72965, 73001,
      73007, 73212];
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
    await api('setCoords', 'C', -1, 2);
    for (const id of ids) {
      check(await api('isDefined', `X${id}`), `X(${id}) is undefined for an obtuse triangle`);
      check((await position(`X${id}`)).every(Number.isFinite), `X(${id}) is nonfinite for an obtuse triangle`);
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
    report(`COMPLETE: native passthrough, ${ids.length} sampled points, obtuse triangle, drag and reopen`);
  } catch (error) { data.success = false; data.error = String(error); report(`FAIL ${String(error)}`); }
  finally { document.querySelector<HTMLPreElement>('#json')!.textContent = JSON.stringify(data, null, 2); button.disabled = false; }
};
