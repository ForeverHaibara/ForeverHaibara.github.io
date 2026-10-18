import type { GeoGebraEngine, GeometryInteractionEvent } from '../types';

export interface ObjectLinkState {
  selectedNames: readonly string[];
  hoveredName: string | null;
  source: 'canvas' | 'analysis';
  error: string | null;
}

/** Shared transient selection. Never writes an object's persisted style. */
export class ObjectLinkController {
  private state: ObjectLinkState = { selectedNames: [], hoveredName: null, source: 'canvas', error: null };
  private listeners = new Set<() => void>();
  private unsubscribe: Array<() => void> = [];
  private revision = 0;
  private pending = Promise.resolve();
  private disposed = false;
  private connected = false;

  constructor(private engine: GeoGebraEngine) {}

  connect() {
    this.connected = true;
    this.disposed = false;
    this.unsubscribe = [
      this.engine.subscribeInteraction?.((event) => this.onNativeSelection(event)) ?? (() => undefined),
      this.engine.subscribe((event) => {
        if (event.type === 'clear') { this.revision += 1; this.publish({ selectedNames: [], hoveredName: null }); }
        if (event.type === 'remove' && event.objectName) this.forget(event.objectName);
        if (event.type === 'rename' && event.objectName && event.previousName) {
          const { objectName, previousName } = event;
          this.publish({ selectedNames: this.state.selectedNames.map((name) => name === previousName ? objectName : name), hoveredName: this.state.hoveredName === previousName ? objectName : this.state.hoveredName });
        }
      }),
    ];
    return () => this.disconnect();
  }

  getSnapshot = (): ObjectLinkState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  select = (name: string | null) => {
    const selectedNames = name && !(this.state.selectedNames.length === 1 && this.state.selectedNames[0] === name) ? [name] : [];
    this.publish({ selectedNames, hoveredName: null, source: 'analysis', error: null });
    this.syncNative();
  };

  hover = (name: string | null) => {
    if (name && this.state.selectedNames.length === 1 && this.state.selectedNames[0] === name) name = null;
    if (this.state.hoveredName === name) return;
    this.publish({ hoveredName: name, error: null });
    this.syncNative();
  };

  private publish(next: Partial<ObjectLinkState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private onNativeSelection(event: GeometryInteractionEvent) {
    this.revision += 1;
    const names = new Set(this.state.hoveredName ? [this.state.hoveredName] : this.state.selectedNames);
    if (event.type === 'select' && event.objectName) names.add(event.objectName);
    if (event.type === 'deselect') {
      if (event.objectName) names.delete(event.objectName);
      else names.clear();
    }
    this.publish({ selectedNames: [...names], hoveredName: null, source: 'canvas', error: null });
  }

  private forget(name: string) {
    const wasPreviewed = this.state.hoveredName === name;
    this.revision += 1;
    this.publish({ selectedNames: this.state.selectedNames.filter((selected) => selected !== name), hoveredName: this.state.hoveredName === name ? null : this.state.hoveredName });
    if (wasPreviewed) this.syncNative();
  }

  private syncNative() {
    const revision = ++this.revision;
    this.pending = this.pending.then(async () => {
      if (this.disposed || !this.connected || revision !== this.revision) return;
      const names = this.state.hoveredName ? [this.state.hoveredName] : this.state.selectedNames;
      try { await this.engine.selectObjects?.(names); }
      catch (error) { if (!this.disposed) this.publish({ error: error instanceof Error ? error.message : 'Linked selection is unavailable.' }); }
    });
  }

  /** Useful when exporting/testing: selection writes settle without touching styles. */
  settle = () => this.pending;

  private disconnect() {
    this.connected = false;
    this.disposed = true;
    this.revision += 1;
    this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe());
    // If the panel unmounts during a preview, restore its persistent selection.
    if (this.state.hoveredName) void this.engine.selectObjects?.(this.state.selectedNames).catch(() => undefined);
    this.state = { ...this.state, hoveredName: null };
  }
}
