import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { advancedCommands } from '../../../src/features/geogebra/commands/advancedCommands';
import { loadTriangleCenterCatalogue } from '../../../src/features/geogebra/commands/custom/builders/triangleCenters';
import { createCenterEvaluator, type Point } from '../../../src/features/geogebra/commands/advanced/triangleCenterNumerics';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
const button = document.querySelector<HTMLButtonElement>('#run')!;
const log = document.querySelector<HTMLElement>('#results')!;
const status = document.querySelector<HTMLElement>('#status')!;
const engine = new GeoGebraEmbeddingAdapter();
let initialized = false;
const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
const check = (value: unknown, message: string) => { if (!value)
  throw new Error(message); };
button.onclick = async () => {
  button.disabled = true;
  log.textContent = '';
  const report = (s: string) => { log.textContent += s + '\n'; status.textContent = s; };
  try {
    if (!initialized) {
      await engine.initialize(document.querySelector<HTMLElement>('#canvas')!);
      initialized = true;
    }
    await api('newConstruction');
    await api('evalCommand', 'A=(0,0)\nB=(6,0)\nC=(1,4)\nP=(2.333333333333333,1.333333333333333)');
    const before = JSON.stringify(await api('getAllObjectNames'));
    report('Searching full catalogue');
    const start = performance.now();
    const result = await advancedCommands.execute(engine, '!nearestTriangleCenter(A,B,C,P)') as {
      id: number;
      distance: number;
      evaluated: number;
    };
    report(JSON.stringify(result));
    check(result.id === 2 && result.distance < 1e-12, 'Centroid not found');
    check(result.evaluated > 60000, 'Too many centers were skipped');
    check(JSON.stringify(await api('getAllObjectNames')) === before, 'Search added objects');
    report(`Search passed in ${((performance.now() - start) / 1000).toFixed(2)} seconds; object names unchanged`);
    const catalogue = await loadTriangleCenterCatalogue();
    const native = new Map<number, Point>();
    // Independent native labeled references, in the disposable verification construction.
    for (let id = 1; id <= 3053; id++) {
      if (catalogue.recipes.has(id) || catalogue.nativeDirections.has(id))
        continue;
      await api('evalCommand', `reference=TriangleCenter(A,B,C,${id})`);
      if (await api('isDefined', 'reference'))
        native.set(id, [Number(await api('getXcoord', 'reference')), Number(await api('getYcoord', 'reference'))]);
      await api('deleteObject', 'reference');
    }
    const numeric = createCenterEvaluator([[0, 0], [6, 0], [1, 4]], catalogue, native);
    for (const id of [369, 1071, 3054, 3056, 3060, 3061, 3067, 3070, 3071, 3078, 3081, 3100, 5600, 5959, 6004, 7742, 8037, 24658, 25969, 29919, 72483, 73001]) {
      const execution = await executeCommandPipeline(engine, `testCenter=TriangleCenter(A,B,C,${id})`);
      check(execution.success, `X(${id}) construction failed`);
      const point = numeric(id), defined = await api('isDefined', 'testCenter');
      check(Boolean(point) === Boolean(defined), `X(${id}) definedness differs`);
      if (point) {
        const x = Number(await api('getXcoord', 'testCenter')), y = Number(await api('getYcoord', 'testCenter'));
        check(Math.hypot(x - point[0], y - point[1]) < 1e-7 * Math.max(1, Math.hypot(x, y)), `X(${id}) coordinate mismatch: ${JSON.stringify(point)} versus ${x},${y}`);
      }
      await api('deleteObject', 'testCenter');
      report(`X(${id}) matches GeoGebra`);
    }
    report('PASS');
  }
  catch (error) {
    report(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  }
  finally {
    button.disabled = false;
  }
};
