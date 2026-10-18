import type { GeoGebraEngine } from '../types';
import type { GgbPreferences, ManagedStyles } from './types';
import { readPointRole } from './pointRoles';

const LINE_TYPES = /^(line|segment|ray|vector|polyline|polygon|conic|conicpart|circle|ellipse|hyperbola|parabola|function|functionnvar|curve|curvecartesian|implicitpoly|implicitcurve|locus|penstroke|turtle)$/i;
const VIEW_KEYS = ['algebra', 'cas', 'spreadsheet', 'graphics2', 'graphics3d'] as const;
const VIEW_CODES = ['A', 'C', 'S', 'D', 'T'];
const OBJECT_KEYS = ['pointLabels', 'lineLabels', 'pointSize', 'pointColor', 'constrainedPointColor', 'dependentPointColor', 'pointColorMode', 'lineThickness', 'lineColor', 'stylePolicy'] as const;
const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Owns preference application, never watches object updates or fights user edits. */
export class PreferenceController {
  private managed: ManagedStyles = Object.create(null);
  private active = false;
  private suspended = false;
  private disposed = false;
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: () => void;

  constructor(private engine: GeoGebraEngine, private preferences: GgbPreferences, private onError: (message: string) => void) {
    this.unsubscribe = engine.subscribe((event) => {
      if (this.suspended || !this.active) return;
      if (event.type === 'rename' && event.previousName && event.objectName) {
        const previous = this.managed[event.previousName];
        if (previous) this.managed[event.objectName] = previous;
        delete this.managed[event.previousName];
      }
      if (event.type === 'remove' && event.objectName) delete this.managed[event.objectName];
      if (event.type === 'clear') {
        this.managed = Object.create(null);
        this.scheduleDocument();
      }
      if (event.type === 'add' && event.objectName) {
        // A native File > Open emits clear/add. Wait until its burst has settled.
        if (this.timer) this.scheduleDocument();
        else {
          const name = event.objectName;
          this.enqueue(() => this.applyObject(name, true));
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
    this.timer = setTimeout(() => { this.timer = undefined; void this.enqueue(() => this.applyDocument()); }, 180);
  }

  async loadDocument(load: () => Promise<void>, snapshot?: ManagedStyles): Promise<void> {
    this.suspended = true;
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.pending;
    try {
      await load();
      if (this.disposed) return;
      this.managed = Object.assign(Object.create(null), snapshot ?? {});
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
      if (OBJECT_KEYS.some((key) => previous[key] !== next[key])) await this.applyObjects(false);
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
    return JSON.parse(JSON.stringify(this.managed)) as ManagedStyles;
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    clearTimeout(this.timer);
    this.unsubscribe();
  }

  private async applyDocument() {
    await this.applyView();
    await this.applyObjects(false);
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

  private async applyObjects(force: boolean) {
    const names = await this.engine.callApi('getAllObjectNames', []) as string[];
    if (!names.length) return;
    await this.engine.callApi('setRepaintingActive', [false]);
    try {
      for (const name of names) {
        if (this.disposed) return;
        await this.applyObject(name, force);
      }
    } finally {
      if (!this.disposed) await this.engine.callApi('setRepaintingActive', [true]);
    }
  }

  private async applyObject(name: string, force: boolean) {
    const type = String(await this.engine.callApi('getObjectType', [name]));
    const point = /^point/i.test(type);
    if (!point && !LINE_TYPES.test(type)) return;
    const p = this.preferences;
    const role = point && p.pointColorMode === 'by-role' ? await readPointRole(this.engine, name) : 'free';
    const pointColor = role === 'constrained' ? p.constrainedPointColor : role === 'dependent' ? p.dependentPointColor : p.pointColor;
    const desired = {
      label: point ? p.pointLabels : p.lineLabels,
      size: point ? p.pointSize : p.lineThickness,
      color: point ? pointColor : p.lineColor,
    };
    const getters = { label: 'getLabelVisible', size: point ? 'getPointSize' : 'getLineThickness', color: 'getColor' };
    const setters = { label: 'setLabelVisible', size: point ? 'setPointSize' : 'setLineThickness', color: 'setColor' };
    const baseline = this.managed[name] ?? {};
    for (const key of ['label', 'size', 'color'] as const) {
      if (this.disposed) return;
      const current = await this.engine.callApi(getters[key], [name]);
      // A differing value belongs to the user. Keep the old baseline so it stays
      // protected across subsequent global changes and persisted draft reloads.
      if (!force && p.stylePolicy === 'preserve' && baseline[key] !== undefined && !same(current, baseline[key])) continue;
      if (!same(current, desired[key])) {
        const args = key === 'color'
          ? [name, ...[1, 3, 5].map((start) => parseInt(desired.color.slice(start, start + 2), 16))]
          : [name, desired[key]];
        await this.engine.callApi(setters[key], args);
      }
      baseline[key] = desired[key];
    }
    this.managed[name] = baseline;
  }
}
