import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STUDIO_SETTINGS, GEOGEBRA_AUTOSAVE_DELAY, GEOGEBRA_LATEST_PROJECT_ID } from '../../features/geogebra/config';
import GeoGebraStudioShell from '../../features/geogebra/components/GeoGebraStudioShell';
import { GeoGebraEmbeddingAdapter } from '../../features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { IndexedDbProjectStore } from '../../features/geogebra/persistence/indexedDbProjectStore';
import { base64ToFile, blobToDownload } from '../../features/geogebra/persistence/ggbFileCodec';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, GeometryProjectRecord, StudioSettings } from '../../features/geogebra/types';

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
};

const readSettings = (): StudioSettings => {
  try {
    const raw = window.localStorage.getItem('geogebra-studio-settings');
    return raw ? { ...DEFAULT_STUDIO_SETTINGS, ...JSON.parse(raw) as Partial<StudioSettings> } : { ...DEFAULT_STUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
};

const GeoGebraStudioPage: React.FC = () => {
  const engine = useMemo<GeoGebraEngine>(() => new GeoGebraEmbeddingAdapter(), []);
  const store = useMemo(() => new IndexedDbProjectStore(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(readSettings);
  const [capabilities, setCapabilities] = useState<EngineCapabilities>(engine.getCapabilities());
  const [events, setEvents] = useState<GeometryEvent[]>([]);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((event) => setEvents((current) => [...current, event].slice(-100)));
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    window.__GGB_DEBUG__ = {
      engine: ready ? engine : null,
      call: (method, ...args) => engine.callApi(method, args),
      command: (command) => engine.executeCommand(command),
      status: () => ({ ready, capabilities: ready ? engine.getCapabilities() : null }),
    };
    return () => {
      delete window.__GGB_DEBUG__;
    };
  }, [engine, ready]);

  useEffect(() => {
    try {
      window.localStorage.setItem('geogebra-studio-settings', JSON.stringify(settings));
    } catch {
      // Settings are optional; the studio remains usable if storage is disabled.
    }
  }, [settings]);

  const handleReady = useCallback(() => {
    setReady(true);
    setCapabilities(engine.getCapabilities());
    if (restoredRef.current) return;
    restoredRef.current = true;
    void store.getLatest().then((project) => {
      if (project?.ggbBase64) return engine.importGgb(base64ToFile(project.ggbBase64));
      return undefined;
    }).catch(() => undefined);
  }, [engine, store]);

  const handleError = useCallback((loadError: Error) => {
    setError(loadError.message);
    setCapabilities(engine.getCapabilities());
  }, [engine]);

  const handleSettingsChange = useCallback((nextSettings: StudioSettings) => setSettings(nextSettings), []);

  const saveDraft = useCallback(async () => {
    if (!ready) return;
    try {
      const blob = await engine.exportGgb();
      const record: GeometryProjectRecord = {
        id: GEOGEBRA_LATEST_PROJECT_ID,
        title: 'GeoGebra Studio Draft',
        ggbBase64: await blobToBase64(blob),
        settings,
        updatedAt: Date.now(),
      };
      await store.save(record);
    } catch {
      // Some browser privacy modes disable IndexedDB; no user action should be blocked.
    }
  }, [engine, ready, settings, store]);

  useEffect(() => {
    if (!ready) return undefined;
    const timeout = window.setTimeout(() => void saveDraft(), GEOGEBRA_AUTOSAVE_DELAY);
    return () => window.clearTimeout(timeout);
  }, [events, lastResult, ready, saveDraft]);

  const handleCommandResult = useCallback((result: CommandResult) => {
    setLastResult(result);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    await engine.importGgb(file);
    setEvents((current) => [...current, { type: 'clear', timestamp: Date.now() }]);
    setLastResult({ success: true, command: `Imported ${file.name}`, labels: [], timestamp: Date.now() });
  }, [engine]);

  const handleExport = useCallback(async () => {
    const blob = await engine.exportGgb();
    blobToDownload(blob, 'geogebra-studio.ggb');
  }, [engine]);

  const handleClearDraft = useCallback(async () => {
    await store.clear();
    setLastResult({ success: true, command: 'Clear local draft', labels: [], timestamp: Date.now() });
  }, [store]);

  return <GeoGebraStudioShell engine={engine} ready={ready} error={error} settings={settings} capabilities={capabilities} events={events} lastResult={lastResult} onReady={handleReady} onError={handleError} onSettingsChange={handleSettingsChange} onCommandResult={handleCommandResult} onImport={handleImport} onExport={handleExport} onClearDraft={handleClearDraft} />;
};

export default GeoGebraStudioPage;
