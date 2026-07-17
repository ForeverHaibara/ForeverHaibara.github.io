export type GeoGebraEngineStatus = 'loading' | 'ready' | 'error' | 'disposed';

export type GeometryEventType = 'add' | 'remove' | 'update' | 'clear' | 'dragEnd';

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

export interface ApiConsoleResult {
  input: string;
  output?: string;
  error?: string;
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
  sidePanelWidth: number;
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

// https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/
export const API_METHODS = ['evalCommand', 'evalLaTex', 'evalCommandGetLabels', 'evalCommandCAS', 'insertEmbed', 'deleteObject', 'setAuxiliary', 'setValue', 'setTextValue', 'setListValue', 'setCoords', 'setCaption', 'setColor', 'setVisible', 'setLabelVisible', 'setLabelStyle', 'setFixed', 'setTrace', 'renameObject', 'setLayer', 'setLayerVisible', 'setLineStyle', 'setLineThickness', 'setPointStyle', 'setPointSize', 'setDisplayStyle', 'setFilling', 'getPNGBase64', 'exportSVG', 'exportPDF', 'getScreenshotBase64', 'writePNGtoFile', 'isIndependent', 'isMoveable', 'showAllObjects', 'registerEmbedResolver', 'setAnimating', 'setAnimationSpeed', 'startAnimation', 'stopAnimation', 'isAnimationRunning', 'getXcoord', 'getYcoord', 'getZcoord', 'getValue', 'getListValue', 'getColor', 'getVisible', 'getValueString', 'getDefinitionString', 'getCommandString', 'getLaTeXString', 'getLaTeXBase64', 'getObjectType', 'exists', 'isDefined', 'getAllObjectNames', 'getObjectNumber', 'getCASObjectNumber', 'getObjectName', 'getLayer', 'getLineStyle', 'getLineThickness', 'getPointStyle', 'getPointSize', 'getFilling', 'getCaption', 'getLabelStyle', 'getLabelVisible', 'isInteractive', 'setMode', 'getMode', 'openFile', 'reset', 'newConstruction', 'refreshViews', 'setOnTheFlyPointCreationActive', 'setPointCapture', 'setRounding', 'hideCursorWhenDragging', 'setRepaintingActive', 'setErrorDialogsActive', 'setCoordSystem', 'setAxesVisible', 'setAxisLabels', 'setAxisSteps', 'setAxisUnits', 'setGridVisible', 'getGridVisible', 'getPerspectiveXML', 'setUndoPoint', 'undo', 'redo', 'showToolBar', 'setCustomToolBar', 'addCustomTool', 'showMenuBar', 'showAlgebraInput', 'showResetIcon', 'enableRightClick', 'enableLabelDrags', 'enableShiftDragZoom', 'enableCAS', 'enable3D', 'setPerspective', 'setWidth', 'setHeight', 'setSize', 'recalculateEnvironments', 'getEditorState', 'setEditorState', 'getGraphicsOptions', 'setGraphicsOptions', 'setAlgebraOptions', 'getViewProperties', 'registerAddListener', 'unregisterAddListener', 'registerRemoveListener', 'unregisterRemoveListener', 'registerUpdateListener', 'unregisterUpdateListener', 'registerClickListener', 'unregisterClickListener', 'registerObjectUpdateListener', 'unregisterObjectUpdateListener', 'registerObjectClickListener', 'unregisterObjectClickListener', 'registerRenameListener', 'unregisterRenameListener', 'registerClearListener', 'unregisterClearListener', 'registerStoreUndoListener', 'unregisterStoreUndoListener', 'registerClientListener', 'unregisterClientListener', 'evalXML', 'setXML', 'getXML', 'getAlgorithmXML', 'getFileJSON', 'setFileJSON', 'getBase64', 'setBase64', 'debug', 'getVersion', 'remove'] as const;

export type ApiMethodName = (typeof API_METHODS)[number];
