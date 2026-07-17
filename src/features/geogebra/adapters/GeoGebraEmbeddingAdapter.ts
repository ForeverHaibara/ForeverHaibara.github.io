import { GEOGEBRA_MIN_VERSION } from '../config';
import type {
  CommandResult,
  EngineCapabilities,
  EngineEventListener,
  GeoGebraEngine,
  GeometryEvent,
} from '../types';
import { API_METHODS } from '../types';
import { loadGeoGebraScript } from './GeoGebraScriptLoader';

type GeoGebraApi = Record<string, (...args: any[]) => any> & {
  registerAddListener?: (listener: (name: string) => void) => void;
  registerRemoveListener?: (listener: (name: string) => void) => void;
  registerUpdateListener?: (listener: (name: string) => void) => void;
  registerClearListener?: (listener: () => void) => void;
  registerClientListener?: (listener: (event: string | { type?: string }) => void) => void;
  unregisterAddListener?: (listener: (name: string) => void) => void;
  unregisterRemoveListener?: (listener: (name: string) => void) => void;
  unregisterUpdateListener?: (listener: (name: string) => void) => void;
  unregisterClearListener?: (listener: () => void) => void;
  unregisterClientListener?: (listener: (event: string | { type?: string }) => void) => void;
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
  private applet: GeoGebraApi | null = null;
  private container: HTMLElement | null = null;
  private listeners = new Set<EngineEventListener>();
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
    await loadGeoGebraScript();
    const Applet = window.GGBApplet;
    if (!Applet) {
      throw new Error('GeoGebra embedding API is unavailable.');
    }

    this.container = container;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '520px';

    const initialRect = this.getLayoutRect();
    const appletWidth = Math.max(320, Math.floor(initialRect.width || container.clientWidth || 800));
    const appletHeight = Math.max(420, Math.floor(initialRect.height || container.clientHeight || 600));
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
          showAlgebraInput: true,
          showMenuBar: true,
          showResetIcon: true,
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
      const rawResult = await this.callApi('evalCommandGetLabels', [normalizedCommand]);
      const labels = typeof rawResult === 'string' && rawResult.length > 0 ? rawResult.split(',').filter(Boolean) : [];
      return { success: rawResult !== null && rawResult !== undefined, command: normalizedCommand, labels, rawResult, timestamp };
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

  dispose(): void {
    for (const unregister of this.registeredListeners.splice(0)) {
      unregister();
    }
    this.listeners.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.observedLayoutElements = [];
    this.applet = null;
    this.container?.replaceChildren();
    this.container = null;
  }

  private observeContainerSize(): void {
    if (!this.container || !this.applet?.setSize || typeof ResizeObserver === 'undefined') return;

    const resize = () => {
      if (!this.container || !this.applet?.setSize) return;
      const rect = this.getLayoutRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(420, Math.floor(rect.height));
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

    const emit = (type: GeometryEvent['type'], objectName?: string) => {
      const event: GeometryEvent = { type, objectName, timestamp: Date.now() };
      this.listeners.forEach((listener) => listener(event));
    };
    const onAdd = (name: string) => emit('add', name);
    const onRemove = (name: string) => emit('remove', name);
    const onUpdate = (name: string) => emit('update', name);
    const onClear = () => emit('clear');
    const onClientEvent = (event: string | { type?: string }) => {
      const eventName = typeof event === 'string' ? event : event.type ?? '';
      if (/dragstart|drag_start|dragStart/u.test(eventName)) emit('dragStart');
      if (/dragend|drag_end|dragEnd/u.test(eventName)) emit('dragEnd');
    };

    if (applet.registerAddListener) {
      applet.registerAddListener(onAdd);
      this.registeredListeners.push(() => applet.unregisterAddListener?.(onAdd));
    }
    if (applet.registerRemoveListener) {
      applet.registerRemoveListener(onRemove);
      this.registeredListeners.push(() => applet.unregisterRemoveListener?.(onRemove));
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
  }
}
