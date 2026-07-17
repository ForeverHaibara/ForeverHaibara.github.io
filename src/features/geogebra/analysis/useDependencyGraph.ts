import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDependencyGraph } from './constructionGraph';
import { GeoGebraConstructionSource } from './constructionSource';
import type { DependencyGraph } from './graphTypes';
import type { GeoGebraEngine, GeometryEvent } from '../types';

export type DependencyGraphStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DependencyGraphState {
  graph: DependencyGraph | null;
  status: DependencyGraphStatus;
  error: string | null;
  refresh(): void;
}

const UPDATE_DEBOUNCE_MS = 200;

export const useDependencyGraph = (engine: GeoGebraEngine, ready: boolean): DependencyGraphState => {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [status, setStatus] = useState<DependencyGraphStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<GeoGebraConstructionSource | null>(null);
  const requestVersionRef = useRef(0);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);
  const updateTimerRef = useRef<number | null>(null);

  const runRefresh = useCallback(async () => {
    if (!ready || runningRef.current) {
      if (ready) pendingRef.current = true;
      return;
    }
    runningRef.current = true;
    setStatus('loading');
    setError(null);
    const startedVersion = requestVersionRef.current;
    try {
      const source = sourceRef.current ?? new GeoGebraConstructionSource(engine);
      sourceRef.current = source;
      const snapshot = await source.read();
      const nextGraph = buildDependencyGraph(snapshot.objects, snapshot.capturedAt);
      if (startedVersion === requestVersionRef.current) {
        setGraph(nextGraph);
        setStatus('ready');
        setError(snapshot.diagnostics.length > 0 ? snapshot.diagnostics.join(' ') : null);
      } else {
        pendingRef.current = true;
      }
    } catch (refreshError) {
      if (startedVersion === requestVersionRef.current) {
        setStatus('error');
        setError(refreshError instanceof Error ? refreshError.message : 'Unable to build the dependency graph.');
      } else {
        pendingRef.current = true;
      }
    } finally {
      runningRef.current = false;
      if (pendingRef.current && ready) {
        pendingRef.current = false;
        void runRefresh();
      }
    }
  }, [engine, ready]);

  const requestRefresh = useCallback((immediate = false) => {
    requestVersionRef.current += 1;
    pendingRef.current = true;
    if (updateTimerRef.current !== null) {
      window.clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    if (immediate) {
      pendingRef.current = false;
      void runRefresh();
    } else {
      updateTimerRef.current = window.setTimeout(() => {
        updateTimerRef.current = null;
        pendingRef.current = false;
        void runRefresh();
      }, UPDATE_DEBOUNCE_MS);
    }
  }, [runRefresh]);

  const handleEvent = useCallback((event: GeometryEvent) => {
    if (event.type === 'update') requestRefresh(false);
    else requestRefresh(true);
  }, [requestRefresh]);

  useEffect(() => {
    sourceRef.current = null;
    requestVersionRef.current += 1;
    pendingRef.current = false;
    setGraph(null);
    setError(null);
    setStatus(ready ? 'loading' : 'idle');
    if (!ready) return undefined;
    const unsubscribe = engine.subscribe(handleEvent);
    requestRefresh(true);
    return () => {
      unsubscribe();
      if (updateTimerRef.current !== null) window.clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
      pendingRef.current = false;
    };
  }, [engine, ready, handleEvent, requestRefresh]);

  const refresh = useCallback(() => requestRefresh(true), [requestRefresh]);
  return { graph, status, error, refresh };
};

