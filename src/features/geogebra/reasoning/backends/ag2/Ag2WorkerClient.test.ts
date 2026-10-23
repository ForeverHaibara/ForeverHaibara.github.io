import { afterEach, describe, expect, it, vi } from 'vitest';
import { midpointProblem } from '../../__fixtures__/problems';
import { exportAg2Problem } from './exportProblem';
import { Ag2WorkerClient } from './Ag2WorkerClient';
import { proofComputationLimits, reasoningPreset } from '../../preferences/reasoningPreferences';

const problem = () => exportAg2Problem(midpointProblem(), { acceptedIds: ['m-midpoint', 'n-midpoint'], goalId: 'midsegment' }).value!;
const answer = { status: 'derived', checks: [true], elapsedMs: 1, points: 5, assumptions: 4, certificate: null };
class TestWorker {
  public static instances: TestWorker[] = [];
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public request = { id: 0 };
  public terminated = false;
  public constructor() { TestWorker.instances.push(this); }
  public postMessage(request: { id: number }) { this.request = request; }
  public terminate() { this.terminated = true; }
  public reply(data: object) { this.onmessage?.({ data: { id: this.request.id, ...data } }); }
}
const setup = () => { TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker); return new Ag2WorkerClient(); };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('AG2 worker lifecycle', () => {
  it('uses a snapshot of custom deadlines and forwards computation limits to Python', async () => {
    vi.useFakeTimers(); const client = setup();
    const settings = { ...reasoningPreset(), loadingSeconds: 15, solvingSeconds: 2, maxProofNodes: 300, maxVectorRounds: 3, maxVectorQueries: 200 };
    const first = client.run(problem(), () => undefined, settings);
    const rejected = expect(first).rejects.toThrow('time budget');
    expect(TestWorker.instances[0].request).toMatchObject({ problem: { computationLimits: proofComputationLimits(settings) } });
    settings.solvingSeconds = 90;
    await vi.advanceTimersByTimeAsync(14000);
    expect(TestWorker.instances[0].terminated).toBe(false);
    TestWorker.instances[0].reply({ phase: 'solving' });
    await vi.advanceTimersByTimeAsync(1999); expect(TestWorker.instances[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await rejected;
    expect(TestWorker.instances[0].terminated).toBe(true);
  });
  it('enforces a custom loading deadline before any solving phase', async () => {
    vi.useFakeTimers(); const client = setup();
    const rejected = expect(client.run(problem(), () => undefined, { ...reasoningPreset(), loadingSeconds: 10 })).rejects.toThrow('time budget');
    await vi.advanceTimersByTimeAsync(10000); await rejected;
    expect(TestWorker.instances[0].terminated).toBe(true);
  });
  it('keeps the loaded runtime for another independent problem', async () => {
    const client = setup();
    const first = client.run(problem(), () => undefined);
    TestWorker.instances[0].reply({ result: answer });
    expect(await first).toEqual(answer);
    const second = client.run(problem(), () => undefined);
    expect(TestWorker.instances).toHaveLength(1);
    TestWorker.instances[0].reply({ result: answer });
    await second;
    client.stop();
  });

  it('terminates cancelled work and ignores its late completion', async () => {
    const client = setup(); const phase = vi.fn();
    const first = client.run(problem(), phase);
    const rejected = expect(first).rejects.toThrow('stopped');
    const old = TestWorker.instances[0];
    client.stop(); await rejected;
    expect(old.terminated).toBe(true);
    const second = client.run(problem(), phase);
    old.reply({ phase: 'solving' }); old.reply({ result: answer });
    expect(phase).not.toHaveBeenCalled();
    TestWorker.instances[1].reply({ result: answer });
    expect(await second).toEqual(answer);
    client.stop();
  });

  it('enforces a solving deadline and allows a fresh worker afterwards', async () => {
    vi.useFakeTimers(); const client = setup();
    const first = client.run(problem(), () => undefined);
    const rejected = expect(first).rejects.toThrow('time budget');
    TestWorker.instances[0].reply({ phase: 'solving' });
    await vi.advanceTimersByTimeAsync(30000); await rejected;
    expect(TestWorker.instances[0].terminated).toBe(true);
    const second = client.run(problem(), () => undefined);
    TestWorker.instances[1].reply({ result: answer }); await second;
    client.stop();
  });
});
