import type { GeoGebraEngine } from '../types';
import type { GgbPreferences, ManagedStyles, ObjectStyle } from './types';
import { readPointRole } from './pointRoles';
import { describeObjectStyle, readObjectStyleValues, STYLE_KEYS, validateObjectStyle, writeObjectStyle, type ObjectStyleInfo } from './objectStyles';
import { isInternalHelperName } from '../commands/custom/internalHelpers';

const VIEW_KEYS = ['algebra', 'cas', 'spreadsheet', 'graphics2', 'graphics3d'] as const;
const VIEW_CODES = ['A', 'C', 'S', 'D', 'T'];
const OBJECT_KEYS = ['pointLabels', 'lineLabels', 'pointSize', 'pointColor', 'constrainedPointColor', 'dependentPointColor', 'pointColorMode', 'lineThickness', 'lineColor', 'stylePolicy'] as const;
const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Document defaults and per-property ownership, independent of the style UI. */
export class PreferenceController {
  private managed: ManagedStyles = Object.create(null);
  private active = false;
  private suspended = false;
  private disposed = false;
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: () => void;
  private writing = false;
  private restoringHistory = false;
  private objectKinds = new Map<string, ObjectStyleInfo>();

  constructor(private engine: GeoGebraEngine, private preferences: GgbPreferences, private onError: (message: string) => void) {
    this.unsubscribe = engine.subscribe((event) => {
      if (this.suspended || !this.active) return;
      if (event.type === 'undo' || event.type === 'redo') {
        this.restoringHistory = true;
        this.scheduleDocument();
      }
      if (event.type === 'rename' && event.previousName && event.objectName) {
        const previous = this.managed[event.previousName];
        if (previous) this.managed[event.objectName] = previous;
        delete this.managed[event.previousName];
        const kind = this.objectKinds.get(event.previousName);
        if (kind !== undefined) this.objectKinds.set(event.objectName, kind);
        this.objectKinds.delete(event.previousName);
      }
      if (event.type === 'style' && event.objectName && !this.writing && !this.timer) {
        const name = event.objectName;
        const point = this.objectKinds.get(name);
        if (point !== undefined) {
          // Read at notification time, before a synchronous reconstruction can
          // replace the native objects. Only ownership writes are queued.
          const values = this.readStyles(name, point);
          void this.enqueue(async () => this.recordEdits(name, await values));
        }
      }
      // Remove/add and clear/add also describe Attach/Detach and other native
      // reconstruction operations. Retain ownership until reconciliation, and
      // prune only objects that are still absent when the burst has settled.
      if (event.type === 'remove') this.scheduleDocument();
      if (event.type === 'clear') {
        this.scheduleDocument();
      }
      if (event.type === 'add' && event.objectName) {
        if (isInternalHelperName(event.objectName)) return;
        // A native File > Open emits clear/add. Wait until its burst has settled.
        if (this.timer) this.scheduleDocument();
        else {
          const name = event.objectName;
          this.enqueue(() => this.applyObject(name, false));
        }
      }
    });
  }

  private enqueue(work: () => Promise<void>, propagateError = false): Promise<void> {
    const generation = this.generation;
    const task = this.pending.then(async () => {
      if (this.disposed || generation !== this.generation) return;
      await work();
    });
    this.pending = task.catch((error: unknown) => { if (!this.disposed) this.onError(error instanceof Error ? error.message : 'Could not apply preferences.'); });
    return propagateError ? task : this.pending;
  }

  private scheduleDocument() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.enqueue(async () => {
        // Undo/redo restores the document's styles as well as its geometry.
        // Accept those values before reconciling ownership, rather than replaying
        // overrides from the history state we have just left.
        if (this.restoringHistory) {
          this.restoringHistory = false;
          for (const name of Object.keys(this.managed)) {
            delete this.managed[name].overrides;
            await this.captureEdits(name);
          }
        }
        await this.applyDocument(true);
      });
    }, 180);
  }

  async loadDocument(load: () => Promise<void>, snapshot?: ManagedStyles): Promise<void> {
    this.suspended = true;
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.restoringHistory = false;
    await this.pending;
    try {
      await load();
      if (this.disposed) return;
      this.managed = Object.assign(Object.create(null), snapshot ?? {});
      this.objectKinds.clear();
      this.active = true;
      await this.enqueue(() => this.applyDocument());
    } finally { this.suspended = false; }
  }

  update(next: GgbPreferences): Promise<void> {
    const previous = this.preferences;
    this.preferences = next;
    if (!this.active || this.suspended) return Promise.resolve();
    return this.enqueue(async () => {
      await this.applyView(previous);
      if (OBJECT_KEYS.some((key) => previous[key] !== next[key])) await this.applyObjects(next.stylePolicy === 'override');
    });
  }

  applyToAll(): Promise<void> {
    if (!this.active) return Promise.resolve();
    return this.enqueue(async () => {
      await this.engine.callApi('setUndoPoint', []);
      await this.applyObjects(true);
      await this.engine.callApi('setUndoPoint', []);
    });
  }

  async snapshot(): Promise<ManagedStyles> {
    await this.pending;
    // Also covers scripts/older engines which do not send updateStyle events.
    if (!this.timer && !this.suspended) {
      await this.enqueue(async () => {
        for (const name of Object.keys(this.managed)) await this.captureEdits(name);
      });
    }
    return JSON.parse(JSON.stringify(this.managed)) as ManagedStyles;
  }

  /** Explicit object edits always win, even when they match today's default. */
  editObjects(names: readonly string[], patch: ObjectStyle | null): Promise<void> {
    if (!this.active || this.suspended) return Promise.resolve();
    if (patch) validateObjectStyle(patch);
    return this.enqueue(async () => {
      await this.engine.callApi('setUndoPoint', []);
      for (const name of names) {
        const info = await this.styleMapping(name);
        if (!info) continue;
        this.objectKinds.set(name, info);
        if (patch === null) await this.applyObject(name, true);
        else {
          const baseline = this.managed[name] ??= {};
          for (const key of STYLE_KEYS) {
            if (patch[key] === undefined) continue;
            await this.writeStyle(name, key, patch[key]!);
          }
          baseline.overrides = { ...baseline.overrides, ...patch };
        }
      }
      await this.engine.callApi('setUndoPoint', []);
    }, true);
  }

  private async styleMapping(name: string) {
    return describeObjectStyle(this.engine, name);
  }

  private async captureEdits(name: string) {
    const baseline = this.managed[name];
    if (!baseline) return;
    const mapping = await this.styleMapping(name);
    if (!mapping) return;
    this.objectKinds.set(name, mapping);
    this.recordEdits(name, await this.readStyles(name, mapping));
  }

  private readStyles(name: string, info: ObjectStyleInfo): Promise<ObjectStyle> {
    return readObjectStyleValues(this.engine, name, info);
  }

  private recordEdits(name: string, values: ObjectStyle) {
    const baseline = this.managed[name];
    if (!baseline) return;
    for (const key of STYLE_KEYS) {
      if (baseline[key] === undefined || values[key] === undefined) continue;
      const current = values[key];
      if (!same(current, baseline[key])) {
        (baseline.overrides ??= {})[key] = current as never;
      } else if (baseline.overrides && !same(current, baseline.overrides[key])) {
        delete baseline.overrides[key];
      }
    }
  }

  private async writeStyle(name: string, key: keyof ObjectStyle, value: string | number | boolean) {
    const mapping = this.objectKinds.get(name) ?? await this.styleMapping(name);
    if (!mapping || this.disposed) return;
    this.writing = true;
    try { await writeObjectStyle(this.engine, name, key, value, mapping); } finally { this.writing = false; }
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    clearTimeout(this.timer);
    this.unsubscribe();
  }

  private async applyDocument(reconstructing = false) {
    await this.applyView();
    await this.applyObjects(false, reconstructing);
    await this.engine.callApi('refreshViews', []);
  }

  private async applyView(previous?: GgbPreferences) {
    const p = this.preferences;
    const changed = (key: keyof GgbPreferences) => !previous || previous[key] !== p[key];
    if (!previous) {
      const perspective = `${p.algebra ? 'A' : ''}${p.cas ? 'C' : ''}G${p.spreadsheet ? 'S' : ''}${p.graphics2 ? 'D' : ''}${p.graphics3d ? 'T' : ''}`;
      await this.engine.callApi('setPerspective', [perspective]);
    } else {
      for (const [index, key] of VIEW_KEYS.entries()) {
        if (changed(key)) await this.engine.callApi('setPerspective', [`${p[key] ? '+' : '-'}${VIEW_CODES[index]}`]);
      }
    }
    if (changed('axes')) {
      for (const view of [1, 2, 3]) await this.engine.callApi('setAxesVisible', [view, p.axes, p.axes, p.axes]);
    }
    if (changed('grid')) {
      for (const view of [1, 2]) await this.engine.callApi('setGridVisible', [view, p.grid]);
    }
    if (changed('decimals')) await this.engine.callApi('setRounding', [`${p.decimals}d`]);
    if (changed('inputBar')) await this.engine.callApi('showAlgebraInput', [p.inputBar]);
  }

  private async applyObjects(force: boolean, reconstructing = false) {
    const names = await this.engine.callApi('getAllObjectNames', []) as string[];
    for (const name of Object.keys(this.managed)) if (!names.includes(name) || isInternalHelperName(name)) {
      delete this.managed[name]; this.objectKinds.delete(name);
    }
    if (!names.length) return;
    await this.engine.callApi('setRepaintingActive', [false]);
    try {
      for (const name of names) {
        if (this.disposed) return;
        if (isInternalHelperName(name)) continue;
        await this.applyObject(name, force, reconstructing);
      }
    } finally {
      if (!this.disposed) await this.engine.callApi('setRepaintingActive', [true]);
    }
  }

  private async applyObject(name: string, force: boolean, reconstructing = false) {
    if (isInternalHelperName(name)) return;
    const info = await this.styleMapping(name);
    if (!info) return;
    const { point, line } = info;
    this.objectKinds.set(name, info);
    const currentValues = await readObjectStyleValues(this.engine, name, info, info.xml);
    if (!currentValues.color) return;
    // Non-geometric objects get common quick edits, without inheriting line defaults.
    if (!point && !line && !this.managed[name]) {
      this.managed[name] = { ...currentValues };
      return;
    }
    const p = this.preferences;
    const role = point && p.pointColorMode === 'by-role' ? await readPointRole(this.engine, name) : 'free';
    const pointColor = role === 'constrained' ? p.constrainedPointColor : role === 'dependent' ? p.dependentPointColor : p.pointColor;
    const baseline = this.managed[name] ?? {};
    const desired: ObjectStyle = { ...currentValues };
    // Extended styles have no global preference. Their original per-object
    // appearance is the reset baseline, including styles imported from files.
    for (const key of STYLE_KEYS) if (baseline[key] !== undefined) desired[key] = baseline[key] as never;
    if (point || line) Object.assign(desired, { label: point ? p.pointLabels : p.lineLabels, size: point ? p.pointSize : p.lineThickness, color: point ? pointColor : p.lineColor });
    if (force) delete baseline.overrides;
    for (const key of STYLE_KEYS) {
      if (this.disposed) return;
      const current = currentValues[key];
      if (current === undefined || desired[key] === undefined) continue;
      if (!force && !reconstructing && baseline.overrides?.[key] === undefined && baseline[key] !== undefined && !same(current, baseline[key])) {
        (baseline.overrides ??= {})[key] = current as never;
      }
      const target = !force && baseline.overrides?.[key] !== undefined ? baseline.overrides[key]! : desired[key];
      if (!same(current, target)) await this.writeStyle(name, key, target);
      // An override does not change the last studio-owned value.
      if (force || baseline.overrides?.[key] === undefined) baseline[key] = desired[key] as never;
    }
    this.managed[name] = baseline;
  }
}
