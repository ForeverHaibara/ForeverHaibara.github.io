import React from 'react';
import type { CharacterizationProposal, CoverageResult } from '../reasoning/selection/types';
import type { ReasoningProblem } from '../reasoning/ir/types';

interface Props {
  proposal: CharacterizationProposal | null;
  problem: ReasoningProblem | null;
  coverage: CoverageResult | null;
  fresh: boolean;
  busy: boolean;
  validating: boolean;
  earlierContext: boolean;
  status: string;
  error: string | null;
  onValidate(value: boolean): void;
  onContext(value: boolean): void;
  onStart(): void;
  onStop(): void;
  onApply(): void;
  onEvaluate(): void;
}

const ConditionSuggestions: React.FC<Props> = ({ proposal, problem, coverage, fresh, busy, validating, earlierContext, status, error,
  onValidate, onContext, onStart, onStop, onApply, onEvaluate }) => {
  const name = (id: string) => proposal?.problem.objects.find((object) => object.id === id)?.name ?? id;
  return <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/30 p-2">
    <p className="font-semibold text-slate-700">Suggested conditions</p>
    <p className="text-[10px] leading-4 text-slate-500">Describe dependent points from local observations. Suggestions are generated without using the selected goal.</p>
    <label className="flex items-center gap-1"><input type="checkbox" checked={validating} disabled={busy} onChange={(event) => onValidate(event.target.checked)} />Check on an independent construction copy</label>
    <details className="text-[10px] text-slate-500"><summary className="cursor-pointer">Search scope</summary><label className="mt-1 flex items-center gap-1"><input type="checkbox" checked={earlierContext} disabled={busy} onChange={(event) => onContext(event.target.checked)} />Use earlier related objects when upstream inputs are insufficient</label><p className="mt-1">Local rank estimates constraints at this configuration; it does not certify a unique global characterization.</p></details>
    <div className="flex flex-wrap gap-1">
      <button type="button" className="rounded bg-sky-100 px-2 py-1 font-semibold text-sky-800 disabled:opacity-40" disabled={!fresh || busy} onClick={onStart}>Suggest conditions</button>
      {busy && <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={onStop}>Stop suggestions</button>}
      {proposal && <><button type="button" className="rounded px-2 py-1 text-sky-700 hover:bg-sky-100 disabled:opacity-40" disabled={!fresh || busy || !proposal.coreIds.length} onClick={onApply}>Accept suggested conditions</button>
        <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={!fresh || busy || !proposal.coreIds.length} onClick={onEvaluate}>Evaluate coverage</button></>}
    </div>
    <p role="status" aria-live="polite" className="text-[10px] leading-4 text-slate-600">{status}</p>
    {error && <p role="alert" className="break-words text-rose-700">{error}</p>}
    {proposal && <>
      <p className="text-[10px] leading-4 text-slate-500">Accepting suggestions replaces the accepted set and clears the goal. Review the description below, then choose a goal.</p>
      {proposal.objects.filter((object) => object.status !== 'free').map((object) => <details key={object.objectId} className="rounded border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer">{name(object.objectId)} · {object.coreIds.length} conditions · local rank {object.rank}/2</summary>
        {object.coreIds.map((id) => <p key={id} className="mt-1 break-words text-[10px]">{proposal.problem.candidates.find((candidate) => candidate.id === id)?.label}</p>)}
        {object.contextIds.length > 0 && <p className="mt-1 text-[10px] text-slate-500">Earlier context searched: {object.contextIds.map(name).join(', ')}</p>}
        <p className="mt-1 text-[10px] text-slate-500">{object.candidateIds.length} local candidates · {object.rejectedCandidates} failed or insufficient discovery checks{object.conditioning !== null ? ` · conditioning ${object.conditioning.toFixed(1)}` : ''}</p>
        {object.diagnostics.map((note, i) => <p key={i} className="mt-1 text-[10px] text-amber-800">{note}</p>)}
        {object.counterexamples.length > 0 && <details className="mt-1 text-[10px] text-slate-500"><summary className="cursor-pointer">Counterexamples ({object.counterexamples.length} retained)</summary>{object.counterexamples.map((example, i) => <p key={i} className="mt-1 break-words">{example.label} · {example.phase} configuration {example.index + 1}</p>)}</details>}
      </details>)}
      {coverage && <p className="text-[10px] leading-4 text-slate-600">DDAR derives {coverage.coveredIds.length}/{coverage.checkedIds.length} checked additional conditions from the proposal ({coverage.elapsedMs.toFixed(0)} ms). Uncovered conditions may require more assumptions or rules.</p>}
      {coverage && coverage.uncoveredIds.length > 0 && <details className="text-[10px] text-slate-600"><summary className="cursor-pointer">Uncovered conditions ({coverage.uncoveredIds.length})</summary>{coverage.uncoveredIds.map((id) => <p key={id} className="mt-1 break-words">{problem?.candidates.find((candidate) => candidate.id === id)?.label ?? id}</p>)}</details>}
      {[...proposal.diagnostics, ...(coverage?.diagnostics ?? [])].map((note, i) => <p key={i} className="text-[10px] leading-4 text-amber-800">{note}</p>)}
    </>}
  </div>;
};

export default ConditionSuggestions;
