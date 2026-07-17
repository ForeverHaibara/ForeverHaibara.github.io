import React, { useState } from 'react';
import type { GeometryRelation, GeometryRelationKind, RelationWitness } from '../analysis/geometryTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';

const labels: Record<GeometryRelationKind, string> = {
  parallel: 'Parallel',
  perpendicular: 'Perpendicular',
  collinear: 'Collinear',
  concyclic: 'Concyclic',
};

const colors: Record<GeometryRelationKind, string> = {
  parallel: 'bg-sky-50 text-sky-700',
  perpendicular: 'bg-violet-50 text-violet-700',
  collinear: 'bg-amber-50 text-amber-700',
  concyclic: 'bg-emerald-50 text-emerald-700',
};

const formatLine = (line: string[]): string => line.join('');
const formatLineFamily = (family: string[][]): string => family.map(formatLine).join('//');

const formatConclusion = (relation: GeometryRelation, witness: RelationWitness): string => {
  if (relation.kind === 'perpendicular' && witness.lineFamilies?.length === 2) {
    return `(${formatLineFamily(witness.lineFamilies[0])}) \u22A5 (${formatLineFamily(witness.lineFamilies[1])})`;
  }
  if (relation.kind === 'parallel' && witness.lineFamilies?.length === 1) return formatLineFamily(witness.lineFamilies[0]);
  if (relation.kind === 'collinear' && witness.lineFamilies?.[0]?.[0]) return `${formatLine(witness.lineFamilies[0][0])} collinear`;
  if (relation.kind === 'concyclic') return `${witness.points.join('')} concyclic`;
  return labels[relation.kind];
};

const GeometryRelationsView: React.FC<{ state: GeometryRelationsState }> = ({ state }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (state.status === 'idle') return <p className="p-4 text-xs text-slate-500">Waiting for point coordinates...</p>;
  if (state.status === 'calculating') return <p className="p-4 text-xs text-slate-500">Discovering geometric relations...</p>;
  if (state.status === 'error') return <p className="p-4 text-xs text-rose-600">{state.error ?? 'Relation discovery is unavailable.'}</p>;
  const result = state.result;
  if (!result) return <p className="p-4 text-xs text-slate-500">No relation result is available.</p>;
  return <div className="space-y-2 p-3">
    <div className="flex items-center justify-between text-[11px] text-slate-500"><span>{result.pointCount} points analyzed</span><span>{result.relations.length} relation groups</span></div>
    {result.diagnostics.length > 0 && <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">{result.diagnostics.join(' ')}</div>}
    {result.relations.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No significant geometric relations found.</p> : <div className="max-h-[420px] space-y-2 overflow-auto pr-1">{result.relations.map((relation) => {
      const expanded = expandedId === relation.id;
      return <article key={relation.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <button type="button" className="w-full text-left" onClick={() => setExpandedId(expanded ? null : relation.id)} aria-expanded={expanded}>
          <div className="flex min-h-6 items-center justify-between gap-3"><p className="min-w-0 break-words text-xs font-semibold text-slate-700">{formatConclusion(relation, relation.witnesses[0])}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${colors[relation.kind]}`}>{relation.nonTriviality.toFixed(0)}</span></div>
        </button>
        {expanded && <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500"><p>Type: {labels[relation.kind]}</p><p className="mt-1">Confidence: {(relation.confidence * 100).toFixed(0)}%</p><p className="mt-1">Witnesses: {relation.witnesses.map((witness) => formatConclusion(relation, witness)).join('; ')}</p><p className="mt-1">{relation.explanation}</p><p className="mt-1">Depth factor: {relation.metric.depthFactor.toFixed(2)}; branch separation: {relation.metric.branchDiversity.toFixed(2)}</p></div>}
      </article>;
    })}</div>}
  </div>;
};

export default GeometryRelationsView;
