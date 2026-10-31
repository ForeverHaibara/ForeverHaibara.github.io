/** Offline domain screen of all native IDs, not per-recipe tests. */
import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';

const engine = new GeoGebraEmbeddingAdapter();
const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
const button = document.querySelector<HTMLButtonElement>('#run')!;
const log = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLElement>('#status')!;
const report = (message: string) => { log.textContent += `${message}\n`; status.textContent = message; };

button.onclick = async () => {
  button.disabled = true;
  log.textContent = '';
  const output: Record<string, unknown> = {};
  try {
    const nativeIds = Array.from({ length: 3053 }, (_, index) => index + 1);
    report(`Loaded ${nativeIds.length} native references`);
    await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!);
    const failures: Record<string, Array<{ id: number; reason: string }>> = {};
    const coordinates: Record<string, Record<number, [number, number]>> = {};
    for (const [name, c] of [['acute', '(1,4)'], ['obtuse', '(-1,2)']] as const) {
      await api('newConstruction');
      const setup = await engine.executeCommand(`A=(0,0)\nB=(6,0)\nC=${c}`);
      if (!setup.success) throw new Error(`Triangle setup failed: ${setup.error}`);
      const failed: Array<{ id: number; reason: string }> = [];
      const finite: Record<number, [number, number]> = {};
      for (let index = 0; index < nativeIds.length; index++) {
        const id = nativeIds[index];
        const label = `Anchor${id}`;
        const result = await engine.executeCommand(`${label}=TriangleCenter(A,B,C,${id})`);
        let reason = result.success ? '' : result.error ?? 'command failure';
        if (!reason && !await api('isDefined', label)) reason = 'undefined';
        if (!reason && await api('getObjectType', label) !== 'point') reason = 'not a point';
        if (!reason) {
          const x = Number(await api('getXcoord', label));
          const y = Number(await api('getYcoord', label));
          if (!Number.isFinite(x) || !Number.isFinite(y)) reason = 'nonfinite coordinates';
          else finite[id] = [x, y];
        }
        if (reason) failed.push({ id, reason });
        if ((index + 1) % 50 === 0) status.textContent = `${name}: ${index + 1}/${nativeIds.length}`;
      }
      failures[name] = failed;
      coordinates[name] = finite;
      report(`${name}: ${failed.length} failures among ${nativeIds.length} native references`);
      for (const item of failed) report(`  X(${item.id}): ${item.reason}`);
    }
    output.nativeIds = nativeIds;
    output.failures = failures;
    const sample = { triangles: { acute: [[0, 0], [6, 0], [1, 4]],
      obtuse: [[0, 0], [6, 0], [-1, 2]] }, coordinates };
    const link = document.querySelector<HTMLAnchorElement>('#download')!;
    link.href = URL.createObjectURL(new Blob([JSON.stringify(sample)], { type: 'application/json' }));
    link.download = 'triangle-center-native-atlas.json';
    link.hidden = false;
    output.success = true;
    report('COMPLETE native-reference domain screen');
  } catch (error) {
    output.success = false;
    output.error = String(error);
    report(`FAIL ${String(error)}`);
  } finally {
    document.querySelector<HTMLPreElement>('#json')!.textContent = JSON.stringify(output);
    button.disabled = false;
  }
};
