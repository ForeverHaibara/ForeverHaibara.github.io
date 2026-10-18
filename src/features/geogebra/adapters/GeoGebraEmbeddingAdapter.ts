import { GEOGEBRA_MIN_VERSION } from '../config';
import type {
  CommandResult,
  EngineCapabilities,
  EngineEventListener,
  GeoGebraEngine,
  GeometryEvent,
  GeometryInteractionEvent,
} from '../types';
import { API_METHODS } from '../types';
import { loadGeoGebraScript } from './GeoGebraScriptLoader';

type ClientEvent = string | { type?: string; target?: string | null };
type GeoGebraApi = Record<string, (...args: any[]) => any> & {
  registerAddListener?: (listener: (name: string) => void) => void;
  registerRemoveListener?: (listener: (name: string) => void) => void;
  registerRenameListener?: (listener: (oldName: string, newName: string) => void) => void;
  registerUpdateListener?: (listener: (name: string) => void) => void;
  registerClearListener?: (listener: () => void) => void;
  registerClientListener?: (listener: (event: ClientEvent) => void) => void;
  registerStoreUndoListener?: (listener: () => void) => void;
  unregisterAddListener?: (listener: (name: string) => void) => void;
  unregisterRemoveListener?: (listener: (name: string) => void) => void;
  unregisterRenameListener?: (listener: (oldName: string, newName: string) => void) => void;
  unregisterUpdateListener?: (listener: (name: string) => void) => void;
  unregisterClearListener?: (listener: () => void) => void;
  unregisterClientListener?: (listener: (event: ClientEvent) => void) => void;
  unregisterStoreUndoListener?: (listener: () => void) => void;
  getBase64?: (callback: (base64: string) => void) => void;
  setBase64?: (base64: string, callback?: () => void) => void;
  setSize?: (width: number, height: number) => void;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read the GeoGebra file.'));
    reader.readAsDataURL(file);
  });

const base64ToBlob = (base64: string): Blob => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'application/vnd.geogebra.file' });
};

export class GeoGebraEmbeddingAdapter implements GeoGebraEngine {
  private lifecycle = 0;
  private applet: GeoGebraApi | null = null;
  private container: HTMLElement | null = null;
  private listeners = new Set<EngineEventListener>();
  private interactionListeners = new Set<(event: GeometryInteractionEvent) => void>();
  private selectionWriteDepth = 0;
  private registeredListeners: Array<() => void> = [];
  private resizeObserver: ResizeObserver | null = null;
  private observedLayoutElements: HTMLElement[] = [];
  private capabilities: EngineCapabilities = {
    version: null,
    supportsBase64: false,
    supportsXml: false,
    supportsEventListeners: false,
  };

  async initialize(container: HTMLElement): Promise<void> {
    const lifecycle = ++this.lifecycle;
    await loadGeoGebraScript();
    // React Strict Mode can dispose an initialization before the script loads.
    if (lifecycle !== this.lifecycle) return;
    const Applet = window.GGBApplet;
    if (!Applet) {
      throw new Error('GeoGebra embedding API is unavailable.');
    }

    this.container = container;
    container.style.width = '100%';
    container.style.height = '100%';

    const initialRect = this.getLayoutRect();
    const appletWidth = Math.max(1, Math.floor(initialRect.width || container.clientWidth || 800));
    const appletHeight = Math.max(1, Math.floor(initialRect.height || container.clientHeight || 600));
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('GeoGebra took too long to initialize.'));
        }
      }, 30000);

      const applet = new Applet(
        {
          appName: 'classic',
          appVersion: GEOGEBRA_MIN_VERSION,
          // The embedding API expects pixel dimensions here; percentage strings
          // fall back to a narrow default applet instead of filling the host.
          width: appletWidth,
          height: appletHeight,
          showToolBar: true,
          showAlgebraInput: false,
          showMenuBar: true,
          showResetIcon: false,
          perspective: 'G',
          enableRightClick: true,
          enableLabelDrags: true,
          allowStyleBar: true,
          useBrowserForJS: true,
          language: 'en',
          errorDialogsActive: false,
          appletOnLoad: (api: GeoGebraApi) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            if (lifecycle !== this.lifecycle) {
              api.remove?.();
              resolve();
              return;
            }
            this.applet = api;
            this.refreshCapabilities();
            this.registerListeners();
            this.observeContainerSize();
            resolve();
          },
        },
        true,
      );

      container.replaceChildren();
      applet.inject(container);
    });
  }

  async executeCommand(command: string): Promise<CommandResult> {
    const normalizedCommand = command.trim();
    const timestamp = Date.now();
    if (!normalizedCommand) {
      return { success: false, command: normalizedCommand, labels: [], error: 'Command is empty.', timestamp };
    }

    try {
      // GeoGebra loads advanced command modules on demand. Its exported async
      // evaluator waits for them; retrying a failed synchronous command could
      // duplicate partially constructed objects. Older engines retain the fallback.
      // source/web/web-common/.../main/DefaultExportedApi.java
      const asyncEvaluator = this.applet?.asyncEvalCommandGetLabels;
      const rawResult = typeof asyncEvaluator === 'function'
        ? await asyncEvaluator.call(this.applet, normalizedCommand)
        : await this.callApi('evalCommandGetLabels', [normalizedCommand]);
      const labels = typeof rawResult === 'string' && rawResult.length > 0 ? rawResult.split(',').filter(Boolean) : [];
      const success = rawResult !== null && rawResult !== undefined && rawResult !== false;
      return { success, command: normalizedCommand, labels, rawResult, timestamp, ...(!success ? { error: 'GeoGebra rejected this command. Check its name and arguments.' } : {}) };
    } catch (error) {
      return {
        success: false,
        command: normalizedCommand,
        labels: [],
        error: error instanceof Error ? error.message : 'GeoGebra rejected the command.',
        timestamp,
      };
    }
  }

  async callApi(method: string, args: unknown[]): Promise<unknown> {
    const applet = this.applet;
    if (!applet) {
      throw new Error('GeoGebra is not ready yet.');
    }
    if (!API_METHODS.includes(method as (typeof API_METHODS)[number])) {
      throw new Error(`API method is not allow-listed: ${method}`);
    }

    const fn = applet[method];
    if (typeof fn !== 'function') {
      throw new Error(`GeoGebra does not expose API method: ${method}`);
    }
    return fn.apply(applet, args);
  }

  async importGgb(file: File): Promise<void> {
    const applet = this.applet;
    if (!applet?.setBase64) {
      throw new Error('This GeoGebra version does not support .ggb import.');
    }
    const base64 = await fileToBase64(file);
    await new Promise<void>((resolve) => applet.setBase64?.(base64, resolve));
  }

  async exportGgb(): Promise<Blob> {
    const applet = this.applet;
    if (!applet?.getBase64) {
      throw new Error('This GeoGebra version does not support .ggb export.');
    }
    const base64 = await new Promise<string>((resolve) => applet.getBase64?.(resolve));
    return base64ToBlob(base64);
  }

  getCapabilities(): EngineCapabilities {
    return { ...this.capabilities };
  }

  subscribe(listener: EngineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeInteraction(listener: (event: GeometryInteractionEvent) => void): () => void {
    this.interactionListeners.add(listener);
    return () => { this.interactionListeners.delete(listener); };
  }

  async selectObjects(names: readonly string[]): Promise<void> {
    // Labels are references, never arbitrary command fragments. This accepts
    // ordinary, Unicode, indexed and primed GeoGebra labels.
    if (names.some((name) => !/^[\p{L}_][\p{L}\p{N}_{}'′]*$/u.test(name))) {
      throw new Error('This object label cannot be selected from Analysis.');
    }
    const existing = await this.callApi('getAllObjectNames', []) as string[];
    const safeNames = names.filter((name) => existing.includes(name));
    const focused = typeof document !== 'undefined' ? document.activeElement : null;
    this.selectionWriteDepth += 1;
    try {
      // Action-only commands can return false despite successfully changing
      // selection (they create no output objects). Only thrown errors fail.
      await this.callApi('evalCommand', [`SelectObjects(${safeNames.join(',')})`]);
    } finally {
      // SelectObjects focuses GeoGebra. Keep keyboard users in the Analysis
      // control they activated, including focusable SVG graph nodes.
      try {
        if (focused?.isConnected && 'focus' in focused && focused !== document.activeElement) {
          (focused as HTMLElement | SVGElement).focus({ preventScroll: true });
        }
      } finally { this.selectionWriteDepth -= 1; }
    }
  }

  dispose(): void {
    this.lifecycle += 1;
    for (const unregister of this.registeredListeners.splice(0)) {
      unregister();
    }
    this.listeners.clear();
    this.interactionListeners.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.observedLayoutElements = [];
    this.applet?.remove?.();
    this.applet = null;
    this.container?.replaceChildren();
    this.container = null;
  }

  private observeContainerSize(): void {
    if (!this.container || !this.applet?.setSize || typeof ResizeObserver === 'undefined') return;

    const resize = () => {
      if (!this.container || !this.applet?.setSize) return;
      const rect = this.getLayoutRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width > 0 && height > 0) {
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.applet.setSize(width, height);
      }
    };

    this.resizeObserver = new ResizeObserver(resize);
    this.observedLayoutElements = [this.container, this.container.parentElement].filter(
      (element): element is HTMLElement => Boolean(element),
    );
    this.observedLayoutElements.forEach((element) => this.resizeObserver?.observe(element));
    window.addEventListener('resize', resize);
    this.registeredListeners.push(() => window.removeEventListener('resize', resize));
    resize();
  }

  private getLayoutRect(): DOMRect {
    const layoutElement = this.container?.parentElement ?? this.container;
    return layoutElement?.getBoundingClientRect() ?? new DOMRect(0, 0, 800, 600);
  }

  private refreshCapabilities(): void {
    const applet = this.applet;
    this.capabilities = {
      version: typeof applet?.getVersion === 'function' ? String(applet.getVersion()) : null,
      supportsBase64: typeof applet?.getBase64 === 'function' && typeof applet?.setBase64 === 'function',
      supportsXml: typeof applet?.getXML === 'function',
      supportsEventListeners:
        typeof applet?.registerAddListener === 'function' &&
        typeof applet?.registerRemoveListener === 'function' &&
        typeof applet?.registerUpdateListener === 'function',
    };
  }

  private registerListeners(): void {
    const applet = this.applet;
    if (!applet) return;

    const emit = (type: GeometryEvent['type'], objectName?: string, previousName?: string) => {
      const event: GeometryEvent = { type, objectName, previousName, timestamp: Date.now() };
      this.listeners.forEach((listener) => listener(event));
    };
    const onAdd = (name: string) => emit('add', name);
    const onRemove = (name: string) => emit('remove', name);
    const onRename = (oldName: string, newName: string) => emit('rename', newName, oldName);
    const onUpdate = (name: string) => emit('update', name);
    const onClear = () => emit('clear');
    // Native style edits may not emit an object update. Undo records cover these
    // user actions too, so draft persistence sees the final construction state.
    const onStoreUndo = () => { if (this.selectionWriteDepth === 0) emit('update'); };
    const onClientEvent = (event: ClientEvent) => {
      const eventName = typeof event === 'string' ? event : event.type ?? '';
      if ((eventName === 'select' || eventName === 'deselect') && this.selectionWriteDepth === 0) {
        const objectName = typeof event !== 'string' && typeof event.target === 'string' ? event.target : undefined;
        this.interactionListeners.forEach((listener) => listener({ type: eventName, objectName }));
      }
      if (/dragstart|drag_start|dragStart/u.test(eventName)) emit('dragStart');
      if (/dragend|drag_end|dragEnd/u.test(eventName)) emit('dragEnd');
      if (['addMacro', 'removeMacro', 'renameMacro'].includes(eventName)) emit('toolsChanged');
    };

    if (applet.registerAddListener) {
      applet.registerAddListener(onAdd);
      this.registeredListeners.push(() => applet.unregisterAddListener?.(onAdd));
    }
    if (applet.registerRemoveListener) {
      applet.registerRemoveListener(onRemove);
      this.registeredListeners.push(() => applet.unregisterRemoveListener?.(onRemove));
    }
    if (applet.registerRenameListener) {
      applet.registerRenameListener(onRename);
      this.registeredListeners.push(() => applet.unregisterRenameListener?.(onRename));
    }
    if (applet.registerUpdateListener) {
      applet.registerUpdateListener(onUpdate);
      this.registeredListeners.push(() => applet.unregisterUpdateListener?.(onUpdate));
    }
    if (applet.registerClearListener) {
      applet.registerClearListener(onClear);
      this.registeredListeners.push(() => applet.unregisterClearListener?.(onClear));
    }
    if (applet.registerClientListener) {
      applet.registerClientListener(onClientEvent);
      this.registeredListeners.push(() => applet.unregisterClientListener?.(onClientEvent));
    }
    if (applet.registerStoreUndoListener) {
      applet.registerStoreUndoListener(onStoreUndo);
      this.registeredListeners.push(() => applet.unregisterStoreUndoListener?.(onStoreUndo));
    }
  }
}
