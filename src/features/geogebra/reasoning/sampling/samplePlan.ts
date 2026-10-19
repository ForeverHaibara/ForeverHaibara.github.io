import type { ReasoningObject } from '../ir/types';

export const SAMPLING_SEED = 294731;
export interface SampleStep { index: number; phase: 'discovery' | 'holdout'; points: Array<{ name: string; x: number; y: number }> }

export const createSamplePlan = (points: readonly ReasoningObject[], seed = SAMPLING_SEED): SampleStep[] => {
  if (!points.length || points.some((point) => !point.coordinates)) return [];
  const origin = points[0].coordinates!;
  const scale = Math.max(...points.map((point) => Math.hypot(point.coordinates!.x - origin.x, point.coordinates!.y - origin.y)));
  if (!Number.isFinite(scale) || scale < 1e-10) return [];
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  return [0.12, 0.35, 0.7, 0.2, 0.5, 0.85].map((amplitude, index) => ({ index, phase: index < 4 ? 'discovery' : 'holdout',
    points: points.map((point) => ({ name: point.name, x: point.coordinates!.x + (2 * random() - 1) * amplitude * scale,
      y: point.coordinates!.y + (2 * random() - 1) * amplitude * scale })) }));
};
