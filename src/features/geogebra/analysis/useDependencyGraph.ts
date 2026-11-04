import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDependencyGraph, collapseInternalHelpers } from './constructionGraph';
import { isInternalHelperName } from '../commands/custom/internalHelpers';
import { GeoGebraConstructionSource } from './constructionSource';
import { ConstructionRefreshScheduler } from './constructionRefreshScheduler';
import type { DependencyGraph } from './graphTypes';
import type { GeoGebraEngine, GeometryEvent } from '../types';

export type DependencyGraphStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DependencyGraphState {
  graph: DependencyGraph | null;
  status: DependencyGraphStatus;
  error: string | null;
  refresh(): void;
}

export const useDependencyGraph = (engine: GeoGebraEngine, ready: boolean): DependencyGraphState => {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [status, setStatus] = useState<DependencyGraphStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const schedulerRef = useRef<ConstructionRefreshScheduler | null>(null);

  useEffect(() => {
    setGraph(null);
    setError(null);
    setStatus(ready ? 'loading' : 'idle');
    if (!ready) return undefined;
    const source = new GeoGebraConstructionSource(engine);
    const scheduler = new ConstructionRefreshScheduler(async (isCurrent) => {
      setStatus('loading');
      setError(null);
      try {
        const snapshot = await source.read();
        if (!isCurrent()) return;
        const nextGraph = collapseInternalHelpers(buildDependencyGraph(snapshot.objects, snapshot.capturedAt));
        setGraph(nextGraph);
        setStatus('ready');
        setError(snapshot.diagnostics.length > 0 ? snapshot.diagnostics.join(' ') : null);
      } catch (refreshError) {
        if (!isCurrent()) return;
        setStatus('error');
        setError(refreshError instanceof Error ? refreshError.message : 'Unable to build the dependency graph.');
      }
    });
    schedulerRef.current = scheduler;
    let dragging = false;
    const unsubscribe = engine.subscribe((event: GeometryEvent) => {
      if ((event.objectName && isInternalHelperName(event.objectName)) || event.type === 'style') return;
      if (event.type === 'dragStart') {
        dragging = true;
        scheduler.cancel();
      } else if (event.type === 'dragEnd') {
        dragging = false;
        scheduler.request(0);
      } else if (!dragging) {
        // Inversion and other native algorithms expose scratch objects before
        // the enclosing construction is complete. Coalesce the entire burst.
        scheduler.request();
      }
    });
    scheduler.request(0);
    return () => {
      unsubscribe();
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, [engine, ready]);

  const refresh = useCallback(() => schedulerRef.current?.request(0), []);
  return { graph, status, error, refresh };
};
