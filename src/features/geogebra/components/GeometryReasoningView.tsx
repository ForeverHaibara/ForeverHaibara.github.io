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
import { formatPredicate } from '../reasoning/ir/formatPredicate';
import type { GeoGebraEngine } from '../types';
import { useCharacterization } from '../reasoning/selection/useCharacterization';
import { evaluateCoverage } from '../reasoning/selection/evaluateCoverage';
import type { CharacterizationProposal, CoverageResult } from '../reasoning/selection/types';
import ConditionSuggestions from './ConditionSuggestions';
import ReadableProofView from './ReadableProofView';

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
  const baseProblem = useMemo(() => graph && discovery.result?.computedAt === graph.generatedAt
    ? createDiscoveryProblem(graph, discovery.result) : null, [graph, discovery.result]);
  const constructionFresh = Boolean(graph && graphStatus === 'ready' && lastEventTime <= graph.generatedAt);
  const suggestions = useCharacterization(engine, graph, constructionFresh);
  const proposal = suggestions.proposal;
  const problem = useMemo(() => proposal ? { ...proposal.problem, candidates: [...(baseProblem?.candidates ?? []), ...proposal.problem.candidates] } : baseProblem, [proposal, baseProblem]);
  const [selectionState, setSelection] = useState<{ graph: DependencyGraph | null; problem: ReasoningProblem | null; value: ConditionSelection }>({ graph: null, problem: null, value: emptySelection });
  const selection = useMemo(() => {
    if (selectionState.graph !== graph || !problem) return emptySelection;
    const unchanged = (id: string) => {
      const before = selectionState.problem?.candidates.find((candidate) => candidate.id === id);
      const after = problem.candidates.find((candidate) => candidate.id === id);
      return before && after && JSON.stringify(before.predicates) === JSON.stringify(after.predicates);
    };
    return { ...selectionState.value, acceptedIds: selectionState.value.acceptedIds.filter(unchanged), goalId: selectionState.value.goalId && unchanged(selectionState.value.goalId) ? selectionState.value.goalId : null };
  }, [selectionState, graph, problem]);
  const fresh = Boolean(problem && constructionFresh && (proposal || !discovery.stale));
  const exported = useMemo(() => problem ? exportAg2Problem(problem, selection) : null, [problem, selection]);
  const proofRequest = useMemo(() => problem && selection.acceptedIds.length ? exportAg2Proof(problem, selection) : null, [problem, selection]);
  const [search, setSearch] = useState('');
  const [rejectedOnly, setRejectedOnly] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'solving'>('idle');
  const [result, setResult] = useState<Ag2RunResult | null>(null);
  const [proofExported, setProofExported] = useState<Ag2Export | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validateSamples, setValidateSamples] = useState(true);
  const [earlierContext, setEarlierContext] = useState(true);
  const [coveragePhase, setCoveragePhase] = useState<'idle' | 'loading' | 'solving'>('idle');
  const [coverageState, setCoverage] = useState<{ proposal: CharacterizationProposal; result: CoverageResult } | null>(null);
  const coverage = coverageState?.proposal === proposal ? coverageState.result : null;
  const client = useRef<Ag2WorkerClient | null>(null);
  const generation = useRef(0);
  const running = phase !== 'idle' || coveragePhase !== 'idle';
  const invalidate = () => { generation.current += 1; if (running) client.current?.stop(); setPhase('idle'); setCoveragePhase('idle'); setResult(null); setProofExported(null); setError(null); };

  useEffect(() => { invalidate(); }, [problem, fresh]);
  useEffect(() => () => { generation.current += 1; client.current?.stop(); }, []);
  const changeSelection = (value: ConditionSelection) => { invalidate(); setSelection({ graph, problem, value }); };
  const checkCoverage = async () => {
    if (!fresh || !proposal || !problem) return;
    invalidate(); const ticket = generation.current; setCoveragePhase('loading');
    client.current ??= new Ag2WorkerClient();
    try {
      const answer = await evaluateCoverage({ ...proposal, problem }, client.current, (next) => { if (ticket === generation.current) setCoveragePhase(next); });
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
      const answer = await client.current.run(exported.value, (next) => { if (ticket === generation.current) setPhase(next); });
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
      const answer = await client.current.run(payload, (next) => { if (ticket === generation.current) setPhase(next); });
      if (ticket === generation.current) { setResult(answer); setProofExported(payload); setPhase('idle'); }
    } catch (failure) { if (ticket === generation.current) { setError(failure instanceof Error ? failure.message : 'Proof generation failed.'); setPhase('idle'); } }
  };
  const download = (project: boolean) => {
    if (!fresh || !problem || !project && !exported?.value) return;
    const content = project ? JSON.stringify({ version: 1, problem, selection, export: exported?.value ?? null, exportErrors: exported?.errors, proofExport: proofExported, result, characterization: proposal, coverage }, null, 2) : exported!.value!.text;
    blobToDownload(new Blob([content], { type: project ? 'application/json' : 'text/plain;charset=utf-8' }), project ? 'geometry-conditions.json' : 'geometry-problems.ag2.txt');
  };
  const query = search.trim().toLocaleLowerCase();
  const matching = problem?.candidates.filter((candidate) => (!rejectedOnly || candidate.hypothesisEligible)
    && (!query || `${candidate.label} ${candidate.diagnostics.join(' ')}`.toLocaleLowerCase().includes(query))) ?? [];
  const candidates = matching.slice(0, 100);
  const hasSelection = Boolean(selection.acceptedIds.length || selection.goalId);
  const value = exported?.value;
  return <div className="space-y-3 p-3 text-[11px]">
    <p className="leading-5 text-slate-500">Accept conditions, then generate a readable derivation. A selected goal is optional. ∡ denotes a directed angle modulo π; ordinary ∠ goals require a separate ray/inequality proof.</p>
    <ConditionSuggestions proposal={proposal} problem={problem} coverage={coverage} fresh={constructionFresh} busy={running || suggestions.status !== 'idle'} validating={validateSamples} earlierContext={earlierContext}
      stopLabel={suggestions.status === 'idle' ? 'Stop reasoning' : 'Stop suggestions'}
      status={suggestions.status === 'sampling' ? `Checking construction copy · ${suggestions.progress}/6 configurations` : suggestions.status === 'searching' ? 'Searching local conditions…'
        : coveragePhase !== 'idle' ? 'Evaluating additional consequences in DDAR…' : proposal ? `${proposal.coreIds.length} proposed conditions · ${proposal.sampling?.samples.length ?? 0} sampled configurations` : 'No conditions are accepted automatically.'}
      error={suggestions.error} onValidate={setValidateSamples} onContext={setEarlierContext} onStart={() => { invalidate(); void suggestions.start(validateSamples, earlierContext); }}
      onStop={() => { suggestions.stop(); invalidate(); }} onApply={() => proposal && changeSelection({ acceptedIds: proposal.coreIds, goalId: null })} onEvaluate={() => void checkCoverage()} />
    {!fresh && <p role="status" className="rounded-lg bg-amber-50 p-2 text-amber-800">Run discovery or suggest conditions on the current construction before selecting or exporting.</p>}
    <label className="flex items-center gap-1 text-amber-800"><input type="checkbox" checked={selection.assumptionMode === 'hypothetical'} disabled={!fresh || running} onChange={(event) => changeSelection({ ...selection, assumptionMode: event.target.checked ? 'hypothetical' : 'validated' })} />Explore hypotheses (allow failed numeric checks)</label>
    {selection.assumptionMode === 'hypothetical' && <p className="text-[10px] leading-4 text-amber-800">Rejected evidence can be assumed explicitly. Proof generation uses symbolic equations; DDAR coordinate checks remain separate. This does not assert that the hypotheses are consistent.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded bg-sky-100 px-2 py-1 font-semibold text-sky-800 disabled:opacity-40" disabled={!fresh || !proofRequest?.value || !selection.acceptedIds.length || running || suggestions.status !== 'idle'} onClick={() => void generateProof()}>Generate readable proof</button>
      <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!fresh || !value || !selection.goalId || selection.assumptionMode === 'hypothetical' || running || suggestions.status !== 'idle'} onClick={() => void run()}>Check goal</button>
      <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!running} onClick={invalidate}>Stop</button>
      <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!fresh || !value} onClick={() => download(false)}>Export AG2</button>
      <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!fresh || !problem || !hasSelection} onClick={() => download(true)}>Export project</button>
    </div>
    <div role="status" aria-live="polite" className="leading-5 text-slate-600">
      {selection.acceptedIds.length} accepted groups · {selection.goalId ? '1 goal' : 'no goal'}
      {selection.goalId && <p className="break-words">Goal: {problem?.candidates.find((candidate) => candidate.id === selection.goalId)?.label}</p>}
      {running && <p>{phase === 'loading' ? 'Preparing the reasoning engine (first run downloads Python and NumPy)…' : 'Checking consequences of the selected conditions…'}</p>}
      {fresh && result && !result.proof && <p className="font-semibold">{result.status === 'already-assumed' ? 'Goal is already accepted or a direct identity.' : result.status === 'derived' ? 'Goal follows in DDAR under the selected conditions.' : 'Goal was not derived; this does not disprove it.'} <span className="font-normal">{result.elapsedMs.toFixed(0)} ms · {result.points} points</span></p>}
    </div>
    {fresh && result?.proof && proofExported && <ReadableProofView proof={result.proof} exported={proofExported} elapsedMs={result.elapsedMs} />}
    {fresh && error && <p role="alert" className="break-words rounded-lg bg-rose-50 p-2 text-rose-700">{error}</p>}
    {hasSelection && exported?.errors.map((message) => <p key={message} className="rounded bg-amber-50 p-2 text-amber-800">{message}</p>)}
    {value && value.branches.length > 0 && <details className="rounded-lg border border-amber-200 p-2 text-amber-900">
      <summary className="cursor-pointer">Angle branch conditions ({value.branches.length})</summary>
      <p className="mt-1 leading-5">Ordinary angles use the orientation and ray branches of this snapshot. The conclusion assumes these branches as well.</p>
      {[...new Set(value.branches.map((branch) => `${branch.role}: ∠(${branch.angle.map((id) => problem?.objects.find((object) => object.id === id)?.name ?? id).join(', ')})`))].map((label) => <p key={label}>{label}</p>)}
    </details>}
    <div className="flex gap-2">
      <input aria-label="Search condition candidates" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1" placeholder="Find a condition, goal or diagnostic…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => changeSelection(emptySelection)}>Clear</button>
    </div>
    {problem?.candidates.some((candidate) => candidate.hypothesisEligible) && <label className="flex items-center gap-1 text-amber-800"><input type="checkbox" checked={rejectedOnly} onChange={(event) => setRejectedOnly(event.target.checked)} />Rejected candidates only</label>}
    <p className="text-[10px] leading-4 text-slate-500">Unmarked observations use one snapshot. Sample checks are evidence, not proof. Accepting a group accepts its listed relations. Search filters do not change conditions.</p>
    <div className="max-h-80 space-y-2 overflow-auto pr-1">{candidates.map((candidate) => {
      const accepted = selection.acceptedIds.includes(candidate.id);
      const goal = selection.goalId === candidate.id;
      const goalDisabled = !fresh || !candidate.predicates.length;
      const disabled = goalDisabled || candidate.diagnostics.length > 0 && !(selection.assumptionMode === 'hypothetical' && candidate.hypothesisEligible);
      return <article key={candidate.id} className={`rounded-lg border p-2 ${accepted || goal ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200'}`}>
        <p className="break-words leading-5 text-slate-700">{candidate.label}</p>
        {candidate.evidence.kind === 'sampled' && <p className="mt-1 text-[10px] text-sky-700">Checked on {candidate.evidence.discoverySamples} discovery + {candidate.evidence.holdoutSamples} held-out configurations{candidate.evidence.skippedSamples ? ` · ${candidate.evidence.skippedSamples} undefined` : ''}</p>}
        <details className="mt-1 text-[10px] text-slate-500"><summary className="cursor-pointer">Relations in this group ({candidate.predicates.length})</summary>{candidate.predicates.map((predicate, i) => <p key={i} className="mt-1 break-words">{formatPredicate(predicate, problem!.objects)}</p>)}</details>
        <div className="mt-1 flex items-center gap-3 text-slate-600">
          <label className="flex items-center gap-1"><input type="checkbox" aria-label={`Accept condition: ${candidate.label}`} disabled={disabled} checked={accepted} onChange={() => changeSelection({ ...selection, acceptedIds: accepted ? selection.acceptedIds.filter((id) => id !== candidate.id) : [...selection.acceptedIds, candidate.id] })} />{candidate.hypothesisEligible ? 'Assume despite failed checks' : 'Accept condition'}</label>
          <button type="button" className={`rounded px-2 py-1 disabled:opacity-40 ${goal ? 'bg-sky-100 text-sky-800' : 'hover:bg-slate-100'}`} aria-pressed={goal} disabled={goalDisabled} onClick={() => changeSelection({ ...selection, goalId: goal ? null : candidate.id })}>{goal ? 'Goal selected' : 'Use as goal'}</button>
        </div>
        {candidate.diagnostics.map((message) => <p key={message} className="mt-1 text-amber-700">{message}</p>)}
      </article>;
    })}</div>
    {matching.length > candidates.length && <p className="text-[10px] text-slate-500">Showing the first {candidates.length}/{matching.length} candidates. Search to inspect more; accepted conditions remain included.</p>}
    {value && <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-slate-600">Accepted conditions and export</summary>
      {selection.acceptedIds.map((id) => <p key={id} className="mt-1 break-words">{problem?.candidates.find((candidate) => candidate.id === id)?.label}</p>)}
      <div className="mt-2 flex flex-wrap gap-1">{value.names.map((entry) => <button key={entry.id} type="button" className="ggb-object-chip" onClick={() => objectLink.select(entry.name)}>{entry.symbol} = {entry.name}</button>)}</div>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px]">{value.text}</pre>
    </details>}
    {problem && <details className="text-[10px] text-slate-500"><summary className="cursor-pointer">Candidate scope and notes</summary>{problem.diagnostics.map((message, i) => <p key={i} className="mt-1">{message}</p>)}</details>}
  </div>;
};

export default GeometryReasoningView;
