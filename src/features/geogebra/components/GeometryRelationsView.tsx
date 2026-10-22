import React, { useState } from 'react';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import type { ObjectLink } from '../interaction/useObjectLink';
import { relationLabel } from '../analysis/relations/catalog';
import { displayScore, scoreColors } from '../analysis/presentation/formatRelation';
import type { ConditionSelection, ReasoningProblem } from '../reasoning/ir/types';
import { formatPredicate } from '../reasoning/ir/formatPredicate';
import { buildCatalogEntries, filterCatalogEntries } from '../reasoning/selection/relationCatalog';
import type { CatalogView } from '../reasoning/selection/relationCatalog';
import { RelationDetails } from './RelationDetails';

interface Props {
  state: GeometryRelationsState;
  objectLink: ObjectLink;
  problem: ReasoningProblem | null;
  selection: ConditionSelection;
  aliases: ReadonlyMap<string, string>;
  fresh: boolean;
  busy: boolean;
  onSelection(value: ConditionSelection): void;
}

const GeometryRelationsView: React.FC<Props> = ({ state, objectLink, problem, selection, aliases, fresh, busy, onSelection }) => {
  const [view, setView] = useState<CatalogView>('all');
  const [search, setSearch] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [limit, setLimit] = useState(100);
  const { preferences, setPreferences, result } = state;
  const entries = buildCatalogEntries(problem, result?.relations ?? [], aliases);
  const matching = filterCatalogEntries(entries, problem, selection, { view, search, selectedOnly, selectedNames: objectLink.selectedNames,
    minimumValue: preferences.minimumValue, visibleKinds: preferences.visibleKinds, computedKinds: preferences.options.enabledKinds });
  const shown = matching.slice(0, limit);
  const modes: Array<[CatalogView, string, number]> = [['all', 'All', entries.length], ['accepted', 'Accepted', selection.acceptedIds.length],
    ['goal', 'Goal', selection.goalId ? 1 : 0], ['rejected', 'Rejected', entries.filter(({ candidate }) => candidate.hypothesisEligible).length]];
  return <section aria-label="Relations catalog" className="space-y-2">
    <div className="flex flex-wrap gap-1" role="group" aria-label="Relation views">{modes.map(([mode, label, count]) => <button key={mode} type="button"
      aria-pressed={view === mode} onClick={() => { setView(mode); setLimit(100); }}
      className={`rounded-full px-2.5 py-1 text-[11px] ${view === mode ? 'bg-sky-700 font-semibold text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label} ({count})</button>)}</div>
    {view === 'rejected' && selection.assumptionMode !== 'hypothetical' && <p className="text-[10px] leading-4 text-amber-800">To use a rejected observation, enable Explore hypotheses in “Hypotheses, checks and export” above.</p>}
    <input aria-label="Search relations" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Find a relation, point or diagnostic…"
      value={search} onChange={(event) => { setSearch(event.target.value); setLimit(100); }} />
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
      <label>Min value <input aria-label="Minimum relation value" className="w-12 rounded border border-slate-200 px-1" type="number" min={0} max={100} value={preferences.minimumValue}
        onChange={(event) => setPreferences({ ...preferences, minimumValue: Number(event.target.value) })} /></label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />Involve selected</label>
    </div>
    <p role="status" aria-live="polite" className="text-[10px] leading-4 text-slate-500">
      {state.status === 'calculating' ? 'Computing observations… ' : ''}{state.stale ? 'Discovery is updating · ' : ''}
      {shown.length} shown / {matching.length} matching · {result?.pointCount ?? problem?.objects.filter((object) => object.coordinates).length ?? 0} points
    </p>
    {!shown.length && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{problem ? 'No relations match this view. Display filters do not clear your conditions or goal.' : 'Discover relations or suggest conditions to begin.'}</p>}
    <div className="max-h-[32rem] space-y-2 overflow-auto pr-1">{shown.map(({ candidate, relation }) => {
      const accepted = selection.acceptedIds.includes(candidate.id); const goal = selection.goalId === candidate.id;
      const unsupported = !candidate.predicates.length;
      const disabled = !fresh || busy || !accepted && (unsupported || candidate.diagnostics.length > 0 && !(selection.assumptionMode === 'hypothetical' && candidate.hypothesisEligible));
      return <article key={candidate.id} className={`rounded-xl border p-2.5 ${accepted || goal ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="text-[10px] text-slate-500">{relation ? relationLabel(relation.kind) : 'Local condition'}{relation?.derived ? ' · generated consequence' : ''}</p>
            <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-700">{candidate.label}</p></div>
          {relation && <span style={scoreColors(relation.nonTriviality)} className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold">Value {displayScore(relation.nonTriviality)}</span>}
        </div>
        <p className={`mt-1 text-[10px] ${candidate.hypothesisEligible ? 'text-amber-700' : 'text-slate-500'}`}>{candidate.evidence.kind === 'sampled'
          ? `${candidate.evidence.discoverySamples} discovery + ${candidate.evidence.holdoutSamples} held-out checks${candidate.evidence.skippedSamples ? ` · ${candidate.evidence.skippedSamples} undefined` : ''}` : 'Observed in this snapshot'}{candidate.hypothesisEligible ? ' · failed or insufficient checks' : ''}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <label className={`flex items-center gap-1.5 rounded px-1 py-1 ${accepted ? 'font-semibold text-sky-800' : 'text-slate-600'}`}>
            <input type="checkbox" aria-label={`Accept condition: ${candidate.label}`} checked={accepted} disabled={disabled}
              onChange={() => onSelection({ ...selection, acceptedIds: accepted ? selection.acceptedIds.filter((id) => id !== candidate.id) : [...selection.acceptedIds, candidate.id] })} />
            {candidate.hypothesisEligible ? 'Assume despite checks' : 'Accept condition'}</label>
          <button type="button" aria-pressed={goal} disabled={!fresh || busy || unsupported} onClick={() => onSelection({ ...selection, goalId: goal ? null : candidate.id })}
            className={`rounded px-2 py-1 disabled:opacity-40 ${goal ? 'bg-sky-100 font-semibold text-sky-800' : 'text-slate-500 hover:bg-slate-100'}`}>{goal ? 'Goal selected' : 'Use as goal'}</button>
        </div>
        <details className="mt-1 border-t border-slate-100 pt-1 text-[10px] text-slate-500"><summary className="cursor-pointer">Details · {candidate.predicates.length} relations</summary>
          {candidate.predicates.map((predicate, index) => <p key={index} className="mt-1 break-words leading-4">{formatPredicate(predicate, problem!.objects)}</p>)}
          <div className="mt-2">{relation ? <RelationDetails relation={relation} relations={result?.relations ?? []} objectLink={objectLink} />
            : <p>Local numerical condition. It has no global discovery value score.</p>}</div>
        </details>
        {candidate.diagnostics.map((message) => <p key={message} className="mt-1 text-[10px] leading-4 text-amber-700">{message}</p>)}
      </article>;
    })}</div>
    {shown.length < matching.length && <button type="button" className="w-full rounded-lg bg-slate-100 p-2 text-[11px] text-sky-700" onClick={() => setLimit(limit + 100)}>Show more ({matching.length - shown.length} remaining)</button>}
    <p className="text-[10px] leading-4 text-slate-500">One catalog for observations, conditions and goals. Value measures construction novelty. Sample checks are evidence, not proof. Local suggestions have no global value score.</p>
  </section>;
};

export default GeometryRelationsView;
