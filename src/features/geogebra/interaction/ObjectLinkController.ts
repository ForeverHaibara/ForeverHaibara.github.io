import type { GeoGebraEngine, GeometryInteractionEvent } from '../types';

export interface ObjectLinkState {
  selectedNames: readonly string[];
  hoveredName: string | null;
  source: 'canvas' | 'analysis';
  error: string | null;
}

const sameNames = (left: readonly string[] | null, right: readonly string[]) =>
  left !== null && left.length === right.length && left.every((name, index) => name === right[index]);

/** Transient selection with one coalesced native write per browser task. */
export class ObjectLinkController {
  private state: ObjectLinkState = { selectedNames: [], hoveredName: null, source: 'canvas', error: null };
  private listeners = new Set<() => void>();
  private unsubscribe: Array<() => void> = [];
  private revision = 0;
  private nativeRevision = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writingNative = false;
  private lastNativeNames: readonly string[] | null = null;
  private idleWaiters: Array<() => void> = [];
  private disposed = false;
  private connected = false;

  constructor(private engine: GeoGebraEngine) {}

  connect() {
    this.connected = true;
    this.disposed = false;
    this.unsubscribe = [
      this.engine.subscribeInteraction?.((event) => this.onNativeSelection(event)) ?? (() => undefined),
      this.engine.subscribe((event) => {
        if (event.type === 'clear') {
          this.revision += 1;
          this.nativeRevision += 1;
          this.lastNativeNames = [];
          this.cancelScheduled();
          this.publish({ selectedNames: [], hoveredName: null });
        }
        if (event.type === 'remove' && event.objectName) this.forget(event.objectName);
        if (event.type === 'rename' && event.objectName && event.previousName) {
          const { objectName, previousName } = event;
          this.lastNativeNames = this.lastNativeNames?.map((name) => name === previousName ? objectName : name) ?? null;
          this.publish({ selectedNames: this.state.selectedNames.map((name) => name === previousName ? objectName : name), hoveredName: this.state.hoveredName === previousName ? objectName : this.state.hoveredName });
        }
      }),
    ];
    return () => this.disconnect();
  }

  getSnapshot = (): ObjectLinkState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  select = (name: string | null) => {
    if (this.disposed) return;
    const selectedNames = name && !(this.state.selectedNames.length === 1 && this.state.selectedNames[0] === name) ? [name] : [];
    this.publish({ selectedNames, hoveredName: null, source: 'analysis', error: null });
    this.syncNative();
  };

  hover = (name: string | null) => {
    if (this.disposed) return;
    if (name && this.state.selectedNames.length === 1 && this.state.selectedNames[0] === name) name = null;
    if (this.state.hoveredName === name) return;
    this.publish({ hoveredName: name, error: null });
    this.syncNative();
  };

  /** Native SelectObjects steals/restores DOM focus. Those focus/blur events
   * are effects of a write, not new user intent: never feed them back. */
  focus = (name: string | null) => {
    if (!this.writingNative) this.hover(name);
  };

  private publish(next: Partial<ObjectLinkState>) {
    const updated = { ...this.state, ...next };
    if (sameNames(this.state.selectedNames, updated.selectedNames) && this.state.hoveredName === updated.hoveredName && this.state.source === updated.source && this.state.error === updated.error) return;
    this.state = updated;
    this.listeners.forEach((listener) => listener());
  }

  private onNativeSelection(event: GeometryInteractionEvent) {
    this.revision += 1;
    this.nativeRevision += 1;
    const names = new Set(this.state.hoveredName ? [this.state.hoveredName] : this.state.selectedNames);
    if (event.type === 'select' && event.objectName) names.add(event.objectName);
    if (event.type === 'deselect') {
      if (event.objectName) names.delete(event.objectName);
      else names.clear();
    }
    this.lastNativeNames = [...names];
    this.cancelScheduled();
    this.publish({ selectedNames: [...names], hoveredName: null, source: 'canvas', error: null });
  }

  private forget(name: string) {
    const wasPreviewed = this.state.hoveredName === name;
    this.revision += 1;
    this.lastNativeNames = this.lastNativeNames?.filter((selected) => selected !== name) ?? null;
    this.publish({ selectedNames: this.state.selectedNames.filter((selected) => selected !== name), hoveredName: wasPreviewed ? null : this.state.hoveredName });
    if (wasPreviewed) this.syncNative();
  }

  private syncNative() {
    this.revision += 1;
    this.scheduleNative();
  }

  private scheduleNative() {
    if (this.disposed || !this.connected || this.writingNative || this.timer !== null) return;
    // Yield to browser input/paint. A recursive Promise chain here can starve
    // the event loop forever when a native focus change schedules another write.
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flushNative();
    }, 0);
  }

  private async flushNative() {
    if (this.disposed || !this.connected) { this.resolveIdle(); return; }
    const revision = this.revision;
    const nativeRevision = this.nativeRevision;
    const names = this.state.hoveredName ? [this.state.hoveredName] : [...this.state.selectedNames];
    if (sameNames(this.lastNativeNames, names)) { this.resolveIdle(); return; }
    this.writingNative = true;
    try {
      await this.engine.selectObjects?.(names);
      if (nativeRevision === this.nativeRevision) this.lastNativeNames = names;
    } catch (error) {
      if (!this.disposed && revision === this.revision) this.publish({ error: error instanceof Error ? error.message : 'Linked selection is unavailable.' });
    } finally {
      this.writingNative = false;
      if (!this.disposed && revision !== this.revision) this.scheduleNative();
      this.resolveIdle();
    }
  }

  settle = (): Promise<void> => !this.writingNative && this.timer === null
    ? Promise.resolve()
    : new Promise((resolve) => this.idleWaiters.push(resolve));

  private resolveIdle() {
    if (!this.writingNative && this.timer === null) this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  private cancelScheduled() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.resolveIdle();
  }

  private disconnect() {
    this.connected = false;
    this.disposed = true;
    this.revision += 1;
    this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe());
    this.cancelScheduled();
    if (this.state.hoveredName) {
      const names = [...this.state.selectedNames];
      const restore = () => { void this.engine.selectObjects?.(names).catch(() => undefined); };
      if (this.writingNative) void this.settle().then(restore);
      else restore();
    }
    this.state = { ...this.state, hoveredName: null };
  }
}
