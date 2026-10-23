import { useEffect, useRef, useState } from 'react';
import type { DependencyGraph } from '../../analysis/graphTypes';
import type { GeoGebraEngine } from '../../types';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import { sampleConstruction } from '../sampling/sampleConstruction';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from './types';
import type { CharacterizationProposal } from './types';
import type { CharacterizationResponse } from './characterization.worker';
import { useReasoningPreferences } from '../preferences/ReasoningPreferencesContext';

export const useCharacterization = (engine: GeoGebraEngine, graph: DependencyGraph | null, fresh: boolean) => {
  const preferences = useReasoningPreferences();
  const [completed, setCompleted] = useState<{ graph: DependencyGraph; proposal: CharacterizationProposal } | null>(null);
  const [status, setStatus] = useState<'idle' | 'sampling' | 'searching'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = () => {
    generation.current += 1; controller.current?.abort(); controller.current = null;
    worker.current?.terminate(); worker.current = null; clearTimeout(timer.current); setStatus('idle');
  };
  useEffect(() => { stop(); setError(null); }, [graph, fresh]);
  useEffect(() => () => { generation.current += 1; controller.current?.abort(); worker.current?.terminate(); clearTimeout(timer.current); }, []);
  const start = async () => {
    if (!graph || !fresh) return;
    stop(); setError(null); setProgress(0);
    const ticket = generation.current; const abort = new AbortController(); controller.current = abort;
    const settings = { ...preferences };
    const validate = settings.validateSamples;
    try {
      setStatus(validate ? 'sampling' : 'searching');
      const sampling = validate ? await sampleConstruction(engine, createDiscoveryProblem(graph), abort.signal, (count) => {
        if (ticket === generation.current) setProgress(count);
      }, settings.samplingSeconds * 1000) : undefined;
      if (ticket !== generation.current || abort.signal.aborted) return;
      setStatus('searching');
      const task = new Worker(new URL('./characterization.worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      const finish = (message: CharacterizationResponse) => {
        if (ticket !== generation.current) return;
        clearTimeout(timer.current); task.terminate(); worker.current = null; controller.current = null;
        if (message.error !== undefined) setError(message.error); else setCompleted({ graph, proposal: message.proposal });
        setStatus('idle');
      };
      task.onmessage = (event: MessageEvent<CharacterizationResponse>) => finish(event.data);
      task.onerror = (event) => { event.preventDefault(); finish({ error: event.message || 'Condition search worker failed.' }); };
      timer.current = setTimeout(() => { if (ticket === generation.current) { stop(); setError('Local condition search time budget reached.'); } }, settings.searchSeconds * 1000);
      task.postMessage({ graph, options: { ...DEFAULT_CHARACTERIZATION_OPTIONS, ...settings }, sampling });
    } catch (failure) {
      if (ticket === generation.current) { stop(); setError(failure instanceof Error ? failure.message : 'Condition search failed.'); }
    }
  };
  return { proposal: completed?.graph === graph ? completed.proposal : null, status, progress, error, start, stop };
};
