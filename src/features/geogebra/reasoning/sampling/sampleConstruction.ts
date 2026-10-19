import type { GeoGebraEngine } from '../../types';
import type { ReasoningProblem } from '../ir/types';
import { createSamplePlan, SAMPLING_SEED } from './samplePlan';
import type { CoordinateSample, SamplingResult } from './types';

/** Only read the live engine. All setCoords calls occur inside a disposable iframe. */
export const sampleConstruction = async (engine: GeoGebraEngine, problem: ReasoningProblem, signal: AbortSignal,
  onProgress: (count: number) => void): Promise<SamplingResult> => {
  const points = problem.objects.filter((object) => object.coordinates);
  if (points.length > 160) throw new Error('Replica sampling is limited to 160 finite points. Disable copy checking to inspect provisional suggestions.');
  const independent = await Promise.all(points.map(async (point) => {
    try { return await engine.callApi('isIndependent', [point.name]) === true && await engine.callApi('isMoveable', [point.name]) === true; }
    catch { return false; }
  }));
  const free = points.filter((_, i) => independent[i]); const plan = createSamplePlan(free);
  if (free.length > 24) throw new Error('Replica sampling is limited to 24 movable free points. Disable copy checking to inspect provisional suggestions.');
  if (!plan.length) return { seed: SAMPLING_SEED, samples: [], variedPointIds: [], diagnostics: ['No separated movable free points were available for replica sampling.'] };
  if (signal.aborted) throw new Error('Condition search stopped.');
  const file = await engine.exportGgb();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = window.btoa(binary);
  if (signal.aborted) throw new Error('Condition search stopped.');
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = new URL('geometry-reasoning/sampling.html', new URL(import.meta.env.BASE_URL, window.location.origin)).href;
    frame.title = 'Independent geometry sampling'; frame.tabIndex = -1; frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '640px', height: '480px', visibility: 'hidden' });
    const token = window.crypto.randomUUID();
    const diagnostics = free.length < 3 ? ['Fewer than three movable free points: shape variation may be limited.'] : [];
    const finish = (error?: Error, samples?: CoordinateSample[]) => {
      clearTimeout(timer); window.removeEventListener('message', receive); signal.removeEventListener('abort', abort); frame.remove();
      if (error) reject(error); else resolve({ seed: SAMPLING_SEED, samples: samples!, variedPointIds: free.map((point) => point.id), diagnostics });
    };
    const abort = () => finish(new Error('Condition search stopped.'));
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== window.location.origin || event.data?.channel !== 'geometry-sampling-v1') return;
      if (event.data.ready) { frame.contentWindow!.postMessage({ channel: 'geometry-sampling-v1', token, base64, points: points.map(({ id, name }) => ({ id, name })), plan }, window.location.origin); return; }
      if (event.data.token !== token) return;
      if (event.data.baseline) {
        const origin = points[0].coordinates!;
        const scale = Math.max(1e-10, ...points.map((point) => Math.hypot(point.coordinates!.x - origin.x, point.coordinates!.y - origin.y)));
        if (points.some((point) => { const value = event.data.baseline[point.id]; return !value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.hypot(value.x - point.coordinates!.x, value.y - point.coordinates!.y) / scale > 2e-7; })) {
          finish(new Error('Replica did not reproduce the coordinate snapshot.'));
        }
      } else if (typeof event.data.progress === 'number') onProgress(event.data.progress);
      else if (Array.isArray(event.data.samples)) finish(undefined, event.data.samples);
      else if (event.data.error) finish(new Error(String(event.data.error)));
    };
    const timer = setTimeout(() => finish(new Error('Replica sampling time budget reached.')), 45000);
    signal.addEventListener('abort', abort, { once: true }); window.addEventListener('message', receive); document.body.append(frame);
  });
};
