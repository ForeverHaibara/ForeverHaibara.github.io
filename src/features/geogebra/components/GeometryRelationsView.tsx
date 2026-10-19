import React, { useState } from 'react';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import type { ObjectLink } from '../interaction/useObjectLink';
import { RELATION_CATALOG } from '../analysis/relations/catalog';
import { displayScore, formatLengthMember, formatRelation, scoreColors } from '../analysis/presentation/formatRelation';
import { RelationTypeControls } from './RelationTypeControls';

const GeometryRelationsView: React.FC<{ state: GeometryRelationsState; objectLink: ObjectLink }> = ({ state, objectLink }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const { preferences, setPreferences, result } = state;
  const query = search.trim().toLocaleLowerCase();
  const relations = result?.relations.filter((relation) => preferences.visibleKinds.includes(relation.kind)
    && preferences.options.enabledKinds.includes(relation.kind)
    && displayScore(relation.nonTriviality) >= preferences.minimumValue
    && (!selectedOnly || objectLink.selectedNames.length === 0 || objectLink.selectedNames.some((name) => relation.pointNames.includes(name)))
    && (!query || (formatRelation(relation) + ' ' + relation.pointNames.join(' ')).toLocaleLowerCase().includes(query))) ?? [];
  return <div className="space-y-3 p-3">
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <label className="flex items-center gap-1"><input type="checkbox" checked={preferences.automatic} onChange={(event) => setPreferences({ ...preferences, automatic: event.target.checked })} />Auto</label>
      <button className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100" type="button" onClick={state.run}>{state.status === 'calculating' ? 'Restart' : 'Run once'}</button>
      <button className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" type="button" onClick={state.stop}>Stop</button>
    </div>
    <p className="text-[10px] leading-4 text-slate-500">Numerical exploration. Value colors show construction novelty. Generator models compress observed consequences.</p>
    <details className="rounded-lg border border-slate-200 p-2 text-[11px]">
      <summary className="cursor-pointer font-semibold text-slate-600">Compute and display ({preferences.options.enabledKinds.length} enabled)</summary>
      <RelationTypeControls preferences={preferences} onChange={setPreferences} />
      <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={!preferences.options.compressConsequences} onChange={(event) => setPreferences({ ...preferences, options: { ...preferences.options, compressConsequences: !event.target.checked } })} />Expand derived observations (recompute)</label>
      <label className="mt-2 flex items-center gap-2">Budget <select aria-label="Discovery budget" className="rounded border border-slate-200 px-1" value={preferences.options.maxAngles <= 5000 ? 'light' : preferences.options.maxAngles >= 50000 ? 'deep' : 'standard'} onChange={(event) => {
        const limits = event.target.value === 'light' ? { maxTriangles: 2000, maxAngles: 5000, maxComparisons: 50000, maxModels: 3, maxRelations: 200 }
          : event.target.value === 'deep' ? { maxTriangles: 20000, maxAngles: 50000, maxComparisons: 500000, maxModels: 8, maxRelations: 1000 }
            : { maxTriangles: 8000, maxAngles: 20000, maxComparisons: 200000, maxModels: 6, maxRelations: 500 };
        setPreferences({ ...preferences, options: { ...preferences.options, ...limits } });
      }}><option value="light">Light</option><option value="standard">Standard</option><option value="deep">Deep</option></select></label>
      <p className="mt-1 text-slate-500">Shared geometric resources may still be needed by other enabled types.</p>
    </details>
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <label>Min value <input className="w-14 rounded border border-slate-200 px-1" type="number" min={0} max={100} value={preferences.minimumValue} onChange={(event) => setPreferences({ ...preferences, minimumValue: Number(event.target.value) })} /></label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />Involve selected</label>
      <input aria-label="Search relations" className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1" placeholder="Object or conclusion…" value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div role="status" aria-live="polite" className="text-[11px] text-slate-500">
      {state.status === 'calculating' ? 'Computing in background… ' : ''}{state.stale ? 'Previous snapshot/settings · ' : ''}
      {result ? `${relations.length} shown / ${result.relations.length} groups · ${result.pointCount} points` : 'Run discovery to inspect the construction.'}
    </div>
    {state.error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{state.error}</p>}
    {state.storageUnavailable && <p className="text-[10px] text-slate-500">Settings are available for this session; browser storage is unavailable.</p>}
    {result && result.diagnostics.length > 0 && <details className="rounded-lg bg-amber-50 px-2 py-2 text-[10px] text-amber-800"><summary className="cursor-pointer">Search limits / notes ({result.diagnostics.length})</summary><p className="mt-1">{result.diagnostics.join(' ')}</p></details>}
    {result && relations.length === 0 && <p className="text-xs text-slate-500">{result.relations.length ? 'Results are hidden by the current compute/display filters.' : 'No observations in the enabled search scope.'}</p>}
    <div className="max-h-[520px] space-y-2 overflow-auto pr-1">{relations.map((relation) => {
      const expanded = expandedId === relation.id;
      const linked = objectLink.selectedNames.some((name) => relation.pointNames.includes(name));
      return <article key={relation.id} className={`rounded-xl border bg-white px-3 py-2 ${linked ? 'border-sky-400' : 'border-slate-200'}`}>
        <button type="button" className="w-full text-left" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : relation.id)}>
          <p className="mb-1 text-[10px] text-slate-500">{RELATION_CATALOG.find((item) => item.kind === relation.kind)!.label}{relation.derived ? ' · generated consequence' : ''}</p>
          <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words text-xs font-semibold text-slate-700">{formatRelation(relation)}</p><span style={scoreColors(relation.nonTriviality)} className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold">Value {displayScore(relation.nonTriviality)}</span></div>
        </button>
        {expanded && <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
          <div className="flex flex-wrap gap-1">{relation.pointNames.map((name) => <button key={name} className="ggb-object-chip" aria-pressed={objectLink.selectedNames.includes(name)} onClick={() => objectLink.select(name)} onPointerEnter={() => objectLink.hover(name)} onPointerLeave={() => objectLink.hover(null)} onFocus={() => objectLink.focus(name)} onBlur={() => objectLink.focus(null)}>{name}</button>)}</div>
          <p>{relation.explanation}</p>
          {relation.derivedFrom && relation.derivedFrom.length > 0 && <p>Generated from: {relation.derivedFrom.slice(0, 3).map((id) => {
            const parent = result?.relations.find((item) => item.id === id);
            return parent ? formatRelation(parent) : 'an observation outside the retained results';
          }).join('; ')}{relation.derivedFrom.length > 3 ? ' …' : ''}</p>}
          <p>Construction span: {relation.metric.constructionSpan?.toFixed(2) ?? 'disconnected'}; readable dependencies: {(relation.metric.dependencyCoverage * 100).toFixed(0)}%</p>
          {relation.witnesses[0].triangleSymmetryOrder && relation.witnesses[0].triangleSymmetryOrder > 1 && <p>One representative correspondence; numerical triangle symmetry order {relation.witnesses[0].triangleSymmetryOrder}.</p>}
          {relation.model && <div className="space-y-1">
            <p>δ(l) = θ(l) − θ({relation.model.anchor.join('·')}); angles in radians.</p>
            <p>Generators: {relation.model.generators.map((line) => line.join('·')).join(', ')}; {relation.model.constraintRank} new constraints.</p>
            <p>Point stars covered to the seed triangle: {relation.model.pointCover.join(', ')}. Joins between covered points may lie outside this model.</p>
            {relation.model.members.slice(0, 12).map((member) => <p key={member.line.join('|')}>{member.denominator}δ({member.line.join('·')}) = {member.coefficients.map((coefficient, i) => `${coefficient}δ(${relation.model!.generators[i].join('·')})`).join(' + ') || '0'} + {member.constant}π</p>)}
            {relation.model.members.length > 12 && <p>{relation.model.members.length - 12} additional line descriptions omitted.</p>}
            <p>Bounded rational fit of this snapshot; not a theorem or a certified lattice rank.</p>
          </div>}
          {relation.lengthModel && <div className="space-y-1">
            <p>Reference length: dist({relation.lengthModel.anchor.join(', ')}). Every ratio is dimensionless.</p>
            <p>Generators: {relation.lengthModel.generators.map((segment) => `dist(${segment.join(', ')})`).join(', ') || 'small rational constants'}; {relation.lengthModel.constraintRank} new constraints.</p>
            {relation.lengthModel.members.slice(0, 12).map((member) => <p key={member.segment.join('|')}>{formatLengthMember(relation.lengthModel!, member)}</p>)}
            {relation.lengthModel.members.length > 12 && <p>{relation.lengthModel.members.length - 12} additional length descriptions omitted.</p>}
            <p>Bounded numerical fit on segments incident to the seed triangle; not a proof.</p>
          </div>}
        </div>}
      </article>;
    })}</div>
  </div>;
};

export default GeometryRelationsView;
