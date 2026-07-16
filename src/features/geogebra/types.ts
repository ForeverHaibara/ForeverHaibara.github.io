export type GeoGebraEngineStatus = 'loading' | 'ready' | 'error' | 'disposed';

export type GeometryEventType = 'add' | 'remove' | 'update' | 'clear';

export interface GeometryEvent {
  type: GeometryEventType;
  objectName?: string;
  timestamp: number;
}

export interface CommandResult {
  success: boolean;
  command: string;
  labels: string[];
  rawResult?: unknown;
  error?: string;
  timestamp: number;
}

export interface EngineCapabilities {
  version: string | null;
  supportsBase64: boolean;
  supportsXml: boolean;
  supportsEventListeners: boolean;
}

export interface EngineEventListener {
  (event: GeometryEvent): void;
}

export interface GeoGebraEngine {
  initialize(container: HTMLElement): Promise<void>;
  executeCommand(command: string): Promise<CommandResult>;
  callApi(method: string, args: unknown[]): Promise<unknown>;
  importGgb(file: File): Promise<void>;
  exportGgb(): Promise<Blob>;
  getCapabilities(): EngineCapabilities;
  subscribe(listener: EngineEventListener): () => void;
  dispose(): void;
}

export interface ApiCall {
  method: string;
  args: unknown[];
}

export interface ApiConsoleEntry {
  id: number;
  input: string;
  output?: string;
  error?: string;
  durationMs: number;
  timestamp: number;
}

export interface StudioSettings {
  sidePanelCollapsed: boolean;
  consoleExpanded: boolean;
}

export interface GeometryProjectRecord {
  id: string;
  title: string;
  ggbBase64: string;
  settings: StudioSettings;
  updatedAt: number;
}

export interface GeoGebraDebugApi {
  engine: GeoGebraEngine | null;
  call(method: string, ...args: unknown[]): Promise<unknown>;
  command(command: string): Promise<CommandResult>;
  status(): { ready: boolean; capabilities: EngineCapabilities | null };
}

export const API_METHODS = [
  'getVersion',
  'evalCommand',
  'evalCommandGetLabels',
  'evalCommandCAS',
  'getValue',
  'getValueString',
  'getObjectType',
  'getAllObjectNames',
  'getXML',
  'getPerspectiveXML',
  'setValue',
  'setCaption',
  'setVisible',
  'reset',
] as const;

export type ApiMethodName = (typeof API_METHODS)[number];
