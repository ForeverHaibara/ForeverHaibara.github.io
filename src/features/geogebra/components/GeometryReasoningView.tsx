import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DependencyGraph } from '../analysis/graphTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import type { ObjectLink } from '../interaction/useObjectLink';
import { blobToDownload } from '../persistence/ggbFileCodec';
import { createDiscoveryProblem } from '../reasoning/sources/discoveryProblem';
import { exportAg2Problem, exportAg2Proof } from '../reasoning/backends/ag2/exportProblem';
import type { Ag2Export } from '../reasoning/backends/ag2/exportProblem';
import { Ag2WorkerClient } from '../reasoning/backends/ag2/Ag2WorkerClient';
import type { Ag2RunResult } from '../reasoning/backends/ag2/protocol';
import type { ConditionSelection, ReasoningProblem } from '../reasoning/ir/types';
import { acceptSuggestedConditions, mergeRelationCatalog, preserveSelectedCandidates, resolveCatalogIds, retainCatalogSelection } from '../reasoning/selection/relationCatalog';
import GeometryRelationsView from './GeometryRelationsView';
import GeometryDiscoveryControls from './GeometryDiscoveryControls';
import type { GeoGebraEngine } from '../types';
import { useCharacterization } from '../reasoning/selection/useCharacterization';
import { evaluateCoverage } from '../reasoning/selection/evaluateCoverage';
import type { CharacterizationProposal, CoverageResult } from '../reasoning/selection/types';
import ConditionSuggestions from './ConditionSuggestions';
import ReadableProofView from './ReadableProofView';
import type { GeometryRelation } from '../analysis/geometryTypes';
import ReasoningActions from './ReasoningActions';
import { proofOutcome } from '../reasoning/proof/proofOutcome';
import { useReasoningPreferences } from '../reasoning/preferences/ReasoningPreferencesContext';

interface Props {
  engine: GeoGebraEngine;
  graph: DependencyGraph | null;
  graphStatus: 'idle' | 'loading' | 'ready' | 'error';
  lastEventTime: number;
  discovery: GeometryRelationsState;
  objectLink: ObjectLink;
}
const emptySelection: ConditionSelection = { acceptedIds: [], goalId: null };

const GeometryReasoningView: React.FC<Props> = ({ engine, graph, graphStatus, lastEventTime, discovery, objectLink }) => {
  const reasoningPreferences = useReasoningPreferences();
  const baseProblem = useMemo(() => graph && discovery.result?.computedAt === graph.generatedAt
    ? createDiscoveryProblem(graph, discovery.result) : null, [graph, discovery.result]);
  const constructionFresh = Boolean(graph && graphStatus === 'ready' && lastEventTime <= graph.generatedAt);
  const suggestions = useCharacterization(engine, graph, constructionFresh);
  const proposal = suggestions.proposal;
  const [selectionState, setSelection] = useState<{ graph: DependencyGraph | null; problem: ReasoningProblem | null; value: ConditionSelection; relations: readonly GeometryRelation[] }>({ graph: null, problem: null, value: emptySelection, relations: [] });
  const catalog = useMemo(() => {
    const current = mergeRelationCatalog(baseProblem, proposal?.problem ?? null);
    const retained = preserveSelectedCandidates(current.problem, selectionState.graph === graph ? selectionState.problem : null, selectionState.value);
    for (const [id, target] of current.aliases) retained.aliases.set(id, retained.aliases.get(target) ?? target);
    return retained;
  }, [baseProblem, proposal, selectionState, graph]);
  const { problem, aliases } = catalog;
  const catalogRelations = useMemo(() => {
    const relations = new Map((discovery.result?.computedAt === graph?.generatedAt ? discovery.result?.relations ?? [] : []).map((relation) => [relation.id, relation]));
    const ids = new Set(problem?.candidates.map((candidate) => candidate.source.relationId));
    if (selectionState.graph === graph) for (const relation of selectionState.relations) if (!relations.has(relation.id) && ids.has(relation.id)) relations.set(relation.id, relation);
    return [...relations.values()];
  }, [discovery.result, problem, selectionState, graph]);
  const selection = useMemo(() => {
    if (selectionState.graph !== graph || !problem) return emptySelection;
    return retainCatalogSelection(selectionState.value, selectionState.problem, problem, aliases);
  }, [selectionState, graph, problem, aliases]);
  // Compute options do not invalidate observations from this construction.
  // Snapshot identity above, rather than pending search settings, gates input.
  const fresh = Boolean(problem && constructionFresh);
  const exported = useMemo(() => problem ? exportAg2Problem(problem, selection) : null, [problem, selection]);
  const proofRequest = useMemo(() => problem && selection.acceptedIds.length ? exportAg2Proof(problem, selection, reasoningPreferences) : null, [problem, selection, reasoningPreferences]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'solving'>('idle');
  const [result, setResult] = useState<Ag2RunResult | null>(null);
  const [proofExported, setProofExported] = useState<Ag2Export | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coveragePhase, setCoveragePhase] = useState<'idle' | 'loading' | 'solving'>('idle');
  const [coverageState, setCoverage] = useState<{ proposal: CharacterizationProposal; result: CoverageResult } | null>(null);
  const coverage = coverageState?.proposal === proposal ? coverageState.result : null;
  const client = useRef<Ag2WorkerClient | null>(null);
  const generation = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLElement>(null);
  const readResults = () => {
    const target = resultsRef.current;
    if (!target) return;
    target.style.scrollMarginTop = `${(actionsRef.current?.offsetHeight ?? 0) + 12}px`;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const running = phase !== 'idle' || coveragePhase !== 'idle';
  const appliedProposal = useRef<CharacterizationProposal | null>(null);
  const invalidate = () => { generation.current += 1; if (running) client.current?.stop(); setPhase('idle'); setCoveragePhase('idle'); setResult(null); setProofExported(null); setError(null); };

  useEffect(() => { invalidate(); }, [problem, fresh]);
  useEffect(() => () => { generation.current += 1; client.current?.stop(); }, []);
  const changeSelection = (value: ConditionSelection) => { invalidate(); setSelection({ graph, problem, value, relations: catalogRelations }); };
  // A proposal is applied once, only on the construction that produced it.
  // Catalog changes and individual removals must never re-accept it implicitly.
  useEffect(() => {
    if (!fresh || !proposal || !problem || suggestions.status !== 'idle' || appliedProposal.current === proposal) return;
    appliedProposal.current = proposal;
    changeSelection(acceptSuggestedConditions(selection, proposal.coreIds, problem, aliases));
  }, [fresh, proposal, problem, suggestions.status, selection, aliases]);
  const checkCoverage = async () => {
    if (!fresh || !proposal || !problem) return;
    invalidate(); const ticket = generation.current; setCoveragePhase('loading');
    client.current ??= new Ag2WorkerClient();
    try {
      const answer = await evaluateCoverage({ ...proposal, problem, coreIds: resolveCatalogIds(proposal.coreIds, aliases) }, client.current, (next) => { if (ticket === generation.current) setCoveragePhase(next); }, reasoningPreferences);
      if (ticket === generation.current) { setCoverage({ proposal, result: answer }); setCoveragePhase('idle'); }
    } catch (failure) { if (ticket === generation.current) { setError(failure instanceof Error ? failure.message : 'Coverage evaluation failed.'); setCoveragePhase('idle'); } }
  };
  const run = async () => {
    if (!fresh || !exported?.value || !selection.goalId) return;
    invalidate();
    const ticket = generation.current;
    setPhase('loading');
    client.current ??= new Ag2WorkerClient();
    try {
      const answer = await client.current.run(exported.value, (next) => { if (ticket === generation.current) setPhase(next); }, reasoningPreferences);
      if (ticket === generation.current) { setResult(answer); setPhase('idle'); }
    } catch (failure) {
      if (ticket === generation.current) { setError(failure instanceof Error ? failure.message : 'Reasoning failed.'); setPhase('idle'); }
    }
  };
  const generateProof = async () => {
    if (!fresh || !proofRequest?.value || !selection.acceptedIds.length) return;
    invalidate(); const ticket = generation.current; const payload = proofRequest.value;
    setPhase('loading'); client.current ??= new Ag2WorkerClient();
    try {
      const answer = await client.current.run(payload, (next) => { if (ticket === generation.current) setPhase(next); }, reasoningPreferences);
      if (ticket === generation.current) { setResult(answer); setProofExported(payload); setPhase('idle'); }
    } catch (failure) { if (ticket === generation.current) { setError(failure instanceof Error ? failure.message : 'Proof generation failed.'); setPhase('idle'); } }
  };
  const download = (project: boolean) => {
    if (!fresh || !problem || !project && (!exported?.value || exported.value.ag2Compatible === false)) return;
    const content = project ? JSON.stringify({ version: 1, problem, selection, reasoningPreferences, candidateAliases: Object.fromEntries(aliases), export: exported?.value ?? null, exportErrors: exported?.errors, proofExport: proofExported, result, characterization: proposal, coverage }, null, 2) : exported!.value!.text;
    blobToDownload(new Blob([content], { type: project ? 'application/json' : 'text/plain;charset=utf-8' }), project ? 'geometry-conditions.json' : 'geometry-problems.ag2.txt');
  };
  const hasSelection = Boolean(selection.acceptedIds.length || selection.goalId);
  const value = exported?.value;
  const outcome = fresh ? proofOutcome(result, Boolean(selection.goalId), error) : null;
  return <div className="space-y-3 p-3 text-[11px]">
    <ReasoningActions elementRef={actionsRef} acceptedCount={selection.acceptedIds.length} goal={selection.goalId ? problem?.candidates.find((candidate) => candidate.id === selection.goalId)?.label ?? 'Selected goal' : null}
      hypothetical={selection.assumptionMode === 'hypothetical'} hasSelection={hasSelection}
      canSuggest={constructionFresh && !running && suggestions.status === 'idle'}
      canGenerate={fresh && Boolean(proofRequest?.value) && Boolean(selection.acceptedIds.length) && !running && suggestions.status === 'idle'}
      canCheck={fresh && Boolean(value) && Boolean(selection.goalId) && selection.assumptionMode !== 'hypothetical' && !running && suggestions.status === 'idle'}
      canExportAg2={fresh && Boolean(value) && value?.ag2Compatible !== false} canExportProject={fresh && Boolean(problem) && hasSelection}
      progress={suggestions.status === 'sampling' ? `Checking construction copy · ${suggestions.progress}/6 configurations` : suggestions.status === 'searching' ? 'Searching local conditions…'
        : running ? phase === 'loading' || coveragePhase === 'loading' ? 'Preparing the reasoning engine…' : coveragePhase !== 'idle' ? 'Evaluating coverage…' : 'Deriving consequences…' : null}
      outcome={outcome}
      onSuggest={() => { invalidate(); void suggestions.start(); }} onGenerate={() => void generateProof()} onCheck={() => void run()} onExport={download}
      onStop={() => { suggestions.stop(); invalidate(); }} onClear={() => changeSelection(emptySelection)} onRead={readResults} />
    {!fresh && <p role="status" className="rounded-lg bg-amber-50 p-2 text-amber-800">Discover relations or suggest conditions on the current construction to begin. Conditions and goals stay available until the construction changes.</p>}
    <ConditionSuggestions proposal={proposal} problem={problem} coverage={coverage} fresh={constructionFresh} busy={running || suggestions.status !== 'idle'}
      status={`${proposal ? resolveCatalogIds(proposal.coreIds, aliases).length : 0} proposed conditions · ${proposal?.sampling?.samples.length ?? 0} sampled configurations`}
      error={suggestions.error} onApply={() => proposal && problem && changeSelection(acceptSuggestedConditions(selection, proposal.coreIds, problem, aliases))} onEvaluate={() => void checkCoverage()} />
    <details className="ggb-reasoning-options">
      <summary>Reasoning options{selection.assumptionMode === 'hypothetical' ? ' · Hypotheses on' : ''}</summary>
      <div className="mt-2 space-y-2">
        <p className="text-slate-500">Search depth, copy checks and computation budgets are in Proof settings in the top toolbar.</p>
        <label className="flex items-start gap-2 text-amber-800"><input type="checkbox" className="mt-0.5" checked={selection.assumptionMode === 'hypothetical'} disabled={!fresh || running || suggestions.status !== 'idle'} onChange={(event) => changeSelection({ ...selection, assumptionMode: event.target.checked ? 'hypothetical' : 'validated' })} /><span>Explore hypotheses (allow failed numeric checks)</span></label>
        {selection.assumptionMode === 'hypothetical' && <p className="text-[10px] leading-4 text-amber-800">Rejected evidence can be assumed explicitly. Symbolic conclusions depend on those hypotheses; coordinate disagreements remain visible.</p>}
        <p className="text-[10px] leading-4 text-slate-500">∡ uses directed angles modulo π. Local rank does not certify a unique global characterization.</p>
      </div>
    </details>
    <GeometryDiscoveryControls state={discovery} />
    <GeometryRelationsView state={discovery} objectLink={objectLink} problem={problem} selection={selection} aliases={aliases} relations={catalogRelations}
      fresh={fresh} busy={running || suggestions.status !== 'idle'} onSelection={changeSelection} />
    {fresh && (result || error) && <section ref={resultsRef} tabIndex={-1} aria-label="Proof results" className="space-y-2 border-t border-slate-200 pt-3 outline-none">
      <h4 className="font-semibold text-slate-700">Proof results</h4>
      {result && !result.proof && <p className="leading-5 text-slate-600">{outcome?.label}. {outcome?.detail} {result.elapsedMs.toFixed(0)} ms · {result.points} points</p>}
      {result?.proof && proofExported && <ReadableProofView proof={result.proof} exported={proofExported} elapsedMs={result.elapsedMs} />}
      {error && <p role="alert" className="break-words rounded-lg bg-rose-50 p-2 text-rose-700">{error}</p>}
    </section>}
    {hasSelection && exported?.errors.map((message) => <p key={message} className="rounded bg-amber-50 p-2 text-amber-800">{message}</p>)}
    {value && <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-slate-600">Accepted conditions and backend input</summary>
      {selection.acceptedIds.map((id) => <p key={id} className="mt-1 break-words">{problem?.candidates.find((candidate) => candidate.id === id)?.label}</p>)}
      <div className="mt-2 flex flex-wrap gap-1">{value.names.map((entry) => <button key={entry.id} type="button" className="ggb-object-chip" onClick={() => objectLink.select(entry.name)}>{entry.symbol} = {entry.name}</button>)}</div>
      {value.ag2Compatible === false && <p className="mt-2 text-amber-800">Vector conditions require the project JSON export. Pure AG2 text cannot represent the complete problem.</p>}
      {value.branches.length > 0 && <p className="mt-2 text-amber-800">{value.branches.length} ordinary-angle ray/lift branch conditions are included in the exported problem.</p>}
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px]">{value.text || value.premise}</pre>
    </details>}
    {problem && <details className="text-[10px] text-slate-500"><summary className="cursor-pointer">Candidate scope and notes</summary>{problem.diagnostics.map((message, i) => <p key={i} className="mt-1">{message}</p>)}</details>}
  </div>;
};

export default GeometryReasoningView;
