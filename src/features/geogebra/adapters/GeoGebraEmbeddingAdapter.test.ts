import { describe, expect, it, vi } from 'vitest';
import { GeoGebraEmbeddingAdapter } from './GeoGebraEmbeddingAdapter';

const engineWith = (applet: Record<string, unknown>) => {
  const engine = new GeoGebraEmbeddingAdapter();
  Object.assign(engine, { applet });
  return engine;
};

describe('GeoGebra command module loading', () => {
  it('waits for the async evaluator instead of prematurely rejecting an advanced command', async () => {
    const sync = vi.fn();
    const asyncEvalCommandGetLabels = vi.fn().mockResolvedValue('I');
    const result = await engineWith({ asyncEvalCommandGetLabels, evalCommandGetLabels: sync }).executeCommand('I=TriangleCenter(A,B,C,1)');
    expect(result.success).toBe(true);
    expect(result.labels).toEqual(['I']);
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not retry a rejected construction', async () => {
    const asyncEvalCommandGetLabels = vi.fn().mockRejectedValue(new Error('Invalid arguments'));
    const sync = vi.fn();
    const result = await engineWith({ asyncEvalCommandGetLabels, evalCommandGetLabels: sync }).executeCommand('Broken(A)');
    expect(result.error).toBe('Invalid arguments');
    expect(asyncEvalCommandGetLabels).toHaveBeenCalledOnce();
    expect(sync).not.toHaveBeenCalled();
  });

  it('retains synchronous evaluation on older engines', async () => {
    const evalCommandGetLabels = vi.fn().mockReturnValue('A,B');
    const result = await engineWith({ evalCommandGetLabels }).executeCommand('Intersect(l,c)');
    expect(result.labels).toEqual(['A', 'B']);
  });
});
