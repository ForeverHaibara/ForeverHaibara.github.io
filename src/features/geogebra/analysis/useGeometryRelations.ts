import { useEffect, useState } from 'react';
import { detectGeometryRelations } from './geometryRelations';
import type { DependencyGraph } from './graphTypes';
import type { GeometryRelationResult } from './geometryTypes';

export type GeometryRelationsStatus = 'idle' | 'calculating' | 'ready' | 'error';

export interface GeometryRelationsState {
  result: GeometryRelationResult | null;
  status: GeometryRelationsStatus;
  error: string | null;
}

export const useGeometryRelations = (graph: DependencyGraph | null, graphStatus: 'idle' | 'loading' | 'ready' | 'error'): GeometryRelationsState => {
  const [result, setResult] = useState<GeometryRelationResult | null>(null);
  const [status, setStatus] = useState<GeometryRelationsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!graph || graphStatus === 'error') {
      setResult(null);
      setStatus(graphStatus === 'error' ? 'error' : 'idle');
      return;
    }
    let active = true;
    setStatus('calculating');
    setError(null);
    window.setTimeout(() => {
      if (!active) return;
      try {
        const nextResult = detectGeometryRelations(graph, Date.now());
        if (!active) return;
        setResult(nextResult);
        setStatus('ready');
      } catch (calculationError) {
        if (!active) return;
        setStatus('error');
        setError(calculationError instanceof Error ? calculationError.message : 'Unable to discover geometric relations.');
      }
    }, 0);
    return () => {
      active = false;
    };
  }, [graph, graphStatus]);

  return { result, status, error };
};
