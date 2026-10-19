import type { Ag2Export } from './exportProblem';
import type { Ag2RunResult, Ag2WorkerResponse } from './protocol';

export class Ag2WorkerClient {
  private worker: Worker | null = null;
  private generation = 0;
  private pending: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  public run(problem: Ag2Export, onPhase: (phase: 'loading' | 'solving') => void): Promise<Ag2RunResult> {
    if (this.pending) this.stop();
    const id = ++this.generation;
    return new Promise((resolve, reject) => {
      const finish = () => { clearTimeout(this.timer); this.pending = null; };
      this.pending = reject;
      const timeout = (milliseconds: number) => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.stop('Reasoning time budget reached; no conclusion was returned.'), milliseconds);
      };
      try {
        this.worker ??= new Worker(new URL('./ag2.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event: MessageEvent<Ag2WorkerResponse>) => {
          if (event.data.id !== id || id !== this.generation) return;
          if ('phase' in event.data) { onPhase(event.data.phase); timeout(event.data.phase === 'loading' ? 120000 : 30000); }
          else if ('result' in event.data) { finish(); resolve(event.data.result); }
          else { const message = event.data.error; finish(); this.stop(); reject(new Error(message)); }
        };
        this.worker.onerror = (event) => { event.preventDefault(); this.stop(event.message || 'Reasoning worker failed.'); };
        timeout(120000);
        this.worker.postMessage({ id, problem });
      } catch (error) {
        this.stop(error instanceof Error ? error.message : 'Unable to start reasoning worker.');
      }
    });
  }

  public stop(message = 'Reasoning stopped.'): void {
    this.generation += 1;
    clearTimeout(this.timer);
    this.worker?.terminate(); this.worker = null;
    const reject = this.pending; this.pending = null;
    reject?.(new Error(message));
  }
}
