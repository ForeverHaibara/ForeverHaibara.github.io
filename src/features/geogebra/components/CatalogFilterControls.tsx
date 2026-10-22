import React from 'react';
import { ALL_RELATION_KINDS } from '../analysis/relations/catalog';
import { defaultCatalogFilter } from '../reasoning/selection/relationCatalog';
import type { CatalogFilter } from '../reasoning/selection/relationCatalog';
import { RelationTypeControls } from './RelationTypeControls';

interface Props {
  filter: CatalogFilter;
  selectedNames: readonly string[];
  onChange(filter: CatalogFilter): void;
}

const CatalogFilterControls: React.FC<Props> = ({ filter, selectedNames, onChange }) => {
  const active = Boolean(filter.search || filter.minimumValue || filter.selectedOnly || !filter.includeUnscored || filter.kinds.length !== ALL_RELATION_KINDS.length);
  return <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
    <div className="flex items-center gap-2">
      <input aria-label="Search relations" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs" placeholder="AO CO · ∠ABC ∠DEF · midpoint M"
        value={filter.search} onChange={(event) => onChange({ ...filter, search: event.target.value })} />
      <button type="button" disabled={!active} className="shrink-0 rounded px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-50 disabled:opacity-40" onClick={() => onChange(defaultCatalogFilter())}>Reset filters</button>
    </div>
    <details className="text-[10px] leading-4 text-slate-500"><summary className="cursor-pointer">Search notation and scope</summary>
      <p className="mt-1">AO CO, OA=OC and (A, O)=(C, O) find the same quantities. Endpoint order, case, punctuation and spacing are flexible. For angles the middle point is the vertex: ABC and CBA match. Separate point names with spaces to search by objects alone.</p>
      <p className="mt-1">Search includes all stored group members and generator equations, even when their titles are shortened. Results contain the requested quantities; they do not certify the equation you typed. Words such as parallel, midpoint, 有向角 and 共圆 also work.</p>
    </details>
    <details className="text-[11px]">
      <summary className="cursor-pointer font-semibold text-slate-600">List filters · {filter.kinds.length === ALL_RELATION_KINDS.length ? 'all types' : `${filter.kinds.length} types`} · value ≥ {filter.minimumValue}{filter.includeUnscored ? ' + unscored' : ''}{filter.selectedOnly ? ` · selected objects (${selectedNames.length})` : ''}</summary>
      <RelationTypeControls kinds={filter.kinds} purpose="filter" onChange={(kinds) => onChange({ ...filter, kinds })} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
        <label>Min value <input aria-label="Minimum relation value" className="w-12 rounded border border-slate-200 px-1" type="number" min={0} max={100} value={filter.minimumValue}
          onChange={(event) => onChange({ ...filter, minimumValue: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={filter.includeUnscored} onChange={(event) => onChange({ ...filter, includeUnscored: event.target.checked })} />Include unscored conditions</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={filter.selectedOnly} onChange={(event) => onChange({ ...filter, selectedOnly: event.target.checked })} />Involve selected objects ({selectedNames.length})</label>
      </div>
      {filter.selectedOnly && !selectedNames.length && <p className="mt-1 text-[10px] text-amber-800">Select objects on the canvas or turn off the object filter.</p>}
    </details>
    <p className="text-[10px] leading-4 text-slate-500">Each view remembers its own filters. Filters only change this list; accepting or removing a condition happens on its card.</p>
  </div>;
};

export default CatalogFilterControls;
