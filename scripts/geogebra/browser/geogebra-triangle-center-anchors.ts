/** Offline domain screen of shared native dependencies, not per-recipe tests. */
import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';

const inputs = import.meta.glob<string>('../../../src/features/geogebra/commands/custom/data/triangle-centers/chunks/*.txt',
  { query: '?raw', import: 'default' });
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
    const sources = await Promise.all(Object.values(inputs).map((load) => load()));
    const nativeIds = [...new Set(sources.flatMap((source) => source.trim().split(/\r?\n/u)
      .flatMap((row) => row.split(/\s+/u).slice(2).map(Number).filter((id) => id >= 1 && id <= 3053))))].sort((a, b) => a - b);
    report(`Loaded ${nativeIds.length} native references`);
    await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!);
    const failures: Record<string, Array<{ id: number; reason: string }>> = {};
    for (const [name, c] of [['acute', '(1,4)'], ['obtuse', '(-1,2)']] as const) {
      await api('newConstruction');
      const setup = await engine.executeCommand(`A=(0,0)\nB=(6,0)\nC=${c}`);
      if (!setup.success) throw new Error(`Triangle setup failed: ${setup.error}`);
      const failed: Array<{ id: number; reason: string }> = [];
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
        }
        if (reason) failed.push({ id, reason });
        if ((index + 1) % 50 === 0) status.textContent = `${name}: ${index + 1}/${nativeIds.length}`;
      }
      failures[name] = failed;
      report(`${name}: ${failed.length} failures among ${nativeIds.length} native references`);
      for (const item of failed) report(`  X(${item.id}): ${item.reason}`);
    }
    output.nativeIds = nativeIds;
    output.failures = failures;
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
