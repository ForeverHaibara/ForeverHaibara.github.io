/** Never read the kernel inside a native listener, or retry in a Promise loop. */
export class ConstructionRefreshScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private version = 0;
  private running = false;
  private pending = false;
  private disposed = false;

  constructor(private readonly refresh: (isCurrent: () => boolean) => Promise<void>) {}

  request(delay = 200): void {
    if (this.disposed) return;
    this.version += 1;
    this.pending = true;
    this.arm(delay);
  }

  private arm(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.run();
    }, delay);
  }

  private async run(): Promise<void> {
    if (this.disposed || this.running) return;
    this.running = true;
    this.pending = false;
    const version = this.version;
    try {
      await this.refresh(() => !this.disposed && version === this.version);
    } finally {
      this.running = false;
      if (!this.disposed && this.pending && this.timer === undefined) this.arm(200);
    }
  }

  cancel(): void {
    this.version += 1;
    this.pending = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}
