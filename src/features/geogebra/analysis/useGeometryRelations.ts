import { useCallback, useEffect, useRef, useState } from 'react';
import { detectGeometryRelations } from './geometryRelations';
import type { DependencyGraph } from './graphTypes';
import type { GeometryRelationResult } from './geometryTypes';
import type { DiscoveryResponse } from './discovery.worker';
import { normalizeDiscoveryPreferences, readDiscoveryPreferences, saveDiscoveryPreferences } from './preferences/discoveryPreferences';
import type { DiscoveryPreferences } from './preferences/discoveryPreferences';

export type GeometryRelationsStatus = 'idle' | 'calculating' | 'ready' | 'error';
export interface GeometryRelationsState {
  result: GeometryRelationResult | null;
  status: GeometryRelationsStatus;
  error: string | null;
  preferences: DiscoveryPreferences;
  setPreferences(preferences: DiscoveryPreferences): void;
  run(): void;
  stop(): void;
  stale: boolean;
  storageUnavailable: boolean;
}

export const useGeometryRelations = (graph: DependencyGraph | null, graphStatus: 'idle' | 'loading' | 'ready' | 'error'): GeometryRelationsState => {
  const [result, setResult] = useState<GeometryRelationResult | null>(null);
  const [status, setStatus] = useState<GeometryRelationsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preferences, updatePreferences] = useState(readDiscoveryPreferences);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [request, setRequest] = useState(0);
  const consumed = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const generation = useRef(0);
  const completedGraph = useRef<DependencyGraph | null>(null);
  const completedOptions = useRef('');
  const optionsRef = useRef(preferences.options);
  optionsRef.current = preferences.options;
  const computeKey = JSON.stringify(preferences.options);

  const setPreferences = useCallback((next: DiscoveryPreferences) => {
    const normalized = normalizeDiscoveryPreferences(next);
    updatePreferences(normalized);
    setStorageUnavailable(!saveDiscoveryPreferences(normalized));
  }, []);

  useEffect(() => {
    if (!graph || graphStatus === 'error') {
      setResult(null); setStatus(graphStatus === 'error' ? 'error' : 'idle');
      setError(graphStatus === 'error' ? 'Construction snapshot unavailable.' : null);
      return;
    }
    if (graphStatus !== 'ready') return;
    const manual = consumed.current !== request;
    if (!preferences.automatic && !manual) { setStatus(result ? 'ready' : 'idle'); return; }
    consumed.current = request;
    const ticket = ++generation.current;
    setStatus('calculating'); setError(null);
    let timer: number | undefined;
    const finish = (message: DiscoveryResponse) => {
      if (ticket !== generation.current) return;
      if (message.error !== undefined) { setError(message.error); setStatus('error'); }
      else { completedGraph.current = graph; completedOptions.current = computeKey; setResult(message.result!); setStatus('ready'); }
      workerRef.current?.terminate(); workerRef.current = null;
    };
    try {
      const worker = new Worker(new URL('./discovery.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<DiscoveryResponse>) => finish(event.data);
      worker.onerror = (event) => { event.preventDefault(); finish({ error: event.message || 'Discovery worker failed.' }); };
      worker.postMessage({ graph, options: optionsRef.current });
    } catch {
      // Restricted environments retain bounded synchronous discovery.
      timer = window.setTimeout(() => {
        if (ticket !== generation.current) return;
        try { finish({ result: detectGeometryRelations(graph, graph.generatedAt, optionsRef.current) }); }
        catch (failure) { finish({ error: failure instanceof Error ? failure.message : 'Discovery failed.' }); }
      }, 0);
    }
    return () => {
      generation.current += 1;
      if (timer !== undefined) window.clearTimeout(timer);
      workerRef.current?.terminate(); workerRef.current = null;
    };
  }, [graph, graphStatus, computeKey, preferences.automatic, request]);

  const run = useCallback(() => setRequest((value) => value + 1), []);
  const stop = useCallback(() => {
    consumed.current = request;
    generation.current += 1;
    workerRef.current?.terminate(); workerRef.current = null;
    setPreferences({ ...preferences, automatic: false });
    setStatus(result ? 'ready' : 'idle');
  }, [preferences, request, result, setPreferences]);

  return { result, status, error, preferences, setPreferences, run, stop,
    stale: Boolean(result && (completedGraph.current !== graph || completedOptions.current !== computeKey || graphStatus !== 'ready' || status === 'calculating')),
    storageUnavailable };
};
