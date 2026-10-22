import type { GeoGebraEngine } from '../types';
import type { GgbPreferences, ManagedStyles, ObjectStyle } from './types';
import { readPointRole } from './pointRoles';
import { LINE_TYPES } from './objectStyles';

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
  private pointKinds = new Map<string, boolean>();

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
        const kind = this.pointKinds.get(event.previousName);
        if (kind !== undefined) this.pointKinds.set(event.objectName, kind);
        this.pointKinds.delete(event.previousName);
      }
      if (event.type === 'style' && event.objectName && !this.writing && !this.timer) {
        const name = event.objectName;
        const point = this.pointKinds.get(name);
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
        // A native File > Open emits clear/add. Wait until its burst has settled.
        if (this.timer) this.scheduleDocument();
        else {
          const name = event.objectName;
          this.enqueue(() => this.applyObject(name, false));
        }
      }
    });
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const generation = this.generation;
    this.pending = this.pending.then(async () => {
      if (this.disposed || generation !== this.generation) return;
      await work();
    }).catch((error: unknown) => { if (!this.disposed) this.onError(error instanceof Error ? error.message : 'Could not apply preferences.'); });
    return this.pending;
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
      this.pointKinds.clear();
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
    if (patch?.color !== undefined && !/^#[\da-f]{6}$/i.test(patch.color)) return Promise.reject(new Error('Use a six-digit hex color.'));
    return this.enqueue(async () => {
      await this.engine.callApi('setUndoPoint', []);
      for (const name of names) {
        if (!await this.styleMapping(name)) continue;
        if (patch === null) await this.applyObject(name, true);
        else {
          const baseline = this.managed[name] ??= {};
          for (const key of ['color', 'size', 'label'] as const) {
            if (patch[key] === undefined) continue;
            await this.writeStyle(name, key, patch[key]!);
          }
          baseline.overrides = { ...baseline.overrides, ...patch };
        }
      }
      await this.engine.callApi('setUndoPoint', []);
    });
  }

  private async styleMapping(name: string) {
    const type = String(await this.engine.callApi('getObjectType', [name]));
    const point = /^point/i.test(type);
    if (!point && !LINE_TYPES.test(type)) return null;
    return { point, getters: { label: 'getLabelVisible', size: point ? 'getPointSize' : 'getLineThickness', color: 'getColor' } };
  }

  private async captureEdits(name: string) {
    const baseline = this.managed[name];
    if (!baseline) return;
    const mapping = await this.styleMapping(name);
    if (!mapping) return;
    this.recordEdits(name, await this.readStyles(name, mapping.point));
  }

  private async readStyles(name: string, point: boolean): Promise<ObjectStyle> {
    const [label, size, color] = await Promise.all([
      this.engine.callApi('getLabelVisible', [name]),
      this.engine.callApi(point ? 'getPointSize' : 'getLineThickness', [name]),
      this.engine.callApi('getColor', [name]),
    ]);
    return { label: Boolean(label), size: Number(size), color: String(color) };
  }

  private recordEdits(name: string, values: ObjectStyle) {
    const baseline = this.managed[name];
    if (!baseline) return;
    for (const key of ['label', 'size', 'color'] as const) {
      if (baseline[key] === undefined) continue;
      const current = values[key];
      if (!same(current, baseline[key])) {
        (baseline.overrides ??= {})[key] = current as never;
      } else if (baseline.overrides && !same(current, baseline.overrides[key])) {
        delete baseline.overrides[key];
      }
    }
  }

  private async writeStyle(name: string, key: keyof ObjectStyle, value: string | number | boolean) {
    const mapping = await this.styleMapping(name);
    if (!mapping || this.disposed) return;
    const method = key === 'label' ? 'setLabelVisible' : key === 'color' ? 'setColor' : mapping.point ? 'setPointSize' : 'setLineThickness';
    const args = key === 'color' ? [name, ...[1, 3, 5].map((start) => parseInt(String(value).slice(start, start + 2), 16))] : [name, value];
    this.writing = true;
    try { await this.engine.callApi(method, args); } finally { this.writing = false; }
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
    for (const name of Object.keys(this.managed)) if (!names.includes(name)) { delete this.managed[name]; this.pointKinds.delete(name); }
    if (!names.length) return;
    await this.engine.callApi('setRepaintingActive', [false]);
    try {
      for (const name of names) {
        if (this.disposed) return;
        await this.applyObject(name, force, reconstructing);
      }
    } finally {
      if (!this.disposed) await this.engine.callApi('setRepaintingActive', [true]);
    }
  }

  private async applyObject(name: string, force: boolean, reconstructing = false) {
    const type = String(await this.engine.callApi('getObjectType', [name]));
    const point = /^point/i.test(type);
    if (!point && !LINE_TYPES.test(type)) return;
    this.pointKinds.set(name, point);
    const p = this.preferences;
    const role = point && p.pointColorMode === 'by-role' ? await readPointRole(this.engine, name) : 'free';
    const pointColor = role === 'constrained' ? p.constrainedPointColor : role === 'dependent' ? p.dependentPointColor : p.pointColor;
    const desired = {
      label: point ? p.pointLabels : p.lineLabels,
      size: point ? p.pointSize : p.lineThickness,
      color: point ? pointColor : p.lineColor,
    };
    const baseline = this.managed[name] ?? {};
    const getters = { label: 'getLabelVisible', size: point ? 'getPointSize' : 'getLineThickness', color: 'getColor' };
    if (force) delete baseline.overrides;
    for (const key of ['label', 'size', 'color'] as const) {
      if (this.disposed) return;
      const current = await this.engine.callApi(getters[key], [name]);
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
