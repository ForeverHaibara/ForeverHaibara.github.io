import React from 'react';
import { ALL_RELATION_KINDS, RELATION_GROUPS } from '../analysis/relations/catalog';
import type { GeometryRelationKind } from '../analysis/relations/catalog';
import { changeRelationSelection } from '../analysis/preferences/relationSelection';
import type { SelectionAction } from '../analysis/preferences/relationSelection';

const ACTIONS: Array<{ action: SelectionAction; label: string }> = [{ action: 'all', label: 'All' }, { action: 'none', label: 'None' }, { action: 'invert', label: 'Invert' }];
interface Props {
  kinds: readonly GeometryRelationKind[];
  purpose: 'compute' | 'filter';
  onChange(kinds: GeometryRelationKind[]): void;
}

/** A single-purpose picker. Computation and catalog filters own separate state. */
export const RelationTypeControls: React.FC<Props> = ({ kinds, purpose, onChange }) => {
  const change = (scope: readonly GeometryRelationKind[], action: SelectionAction) => onChange(changeRelationSelection(kinds, scope, action));
  const buttons = (scope: readonly GeometryRelationKind[], label: string) => <span className="inline-flex flex-wrap gap-x-1">
    {ACTIONS.map(({ action, label: actionLabel }) => <button key={action} type="button" aria-label={`${actionLabel} ${purpose} ${label}`}
      className="rounded px-1 py-0.5 text-sky-700 hover:bg-sky-50" onClick={() => change(scope, action)}>{actionLabel}</button>)}
  </span>;
  return <div className="mt-2 space-y-2">
    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
      <span>{purpose === 'compute' ? 'Compute types' : 'Filter types'} ({kinds.length}/{ALL_RELATION_KINDS.length})</span>{buttons(ALL_RELATION_KINDS, 'types')}
    </div>
    {RELATION_GROUPS.map(({ label, items }) => {
      const scope = items.map((item) => item.kind);
      return <details key={label} className="rounded border border-slate-100 px-2 py-1">
        <summary className="cursor-pointer font-semibold text-slate-600">{label} <span className="font-normal text-slate-400">({scope.filter((kind) => kinds.includes(kind)).length}/{items.length})</span></summary>
        <div className="my-1 text-right">{buttons(scope, label)}</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">{items.map((item) => <label key={item.kind} className="flex items-start gap-1.5 py-0.5 text-slate-600">
          <input className="mt-0.5" type="checkbox" aria-label={`${purpose === 'compute' ? 'Compute' : 'Filter'} ${item.label}`} checked={kinds.includes(item.kind)} onChange={() => change([item.kind], 'invert')} />
          <span>{item.symbol} {item.label}</span>
        </label>)}</div>
      </details>;
    })}
  </div>;
};
