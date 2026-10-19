import React from 'react';
import { ALL_RELATION_KINDS, RELATION_GROUPS } from '../analysis/relations/catalog';
import type { GeometryRelationKind } from '../analysis/relations/catalog';
import type { DiscoveryPreferences } from '../analysis/preferences/discoveryPreferences';
import { changeRelationSelection } from '../analysis/preferences/relationSelection';
import type { SelectionAction } from '../analysis/preferences/relationSelection';

const ACTIONS: Array<{ action: SelectionAction; label: string }> = [{ action: 'all', label: 'All' }, { action: 'none', label: 'None' }, { action: 'invert', label: 'Invert' }];
export const RelationTypeControls: React.FC<{ preferences: DiscoveryPreferences; onChange(preferences: DiscoveryPreferences): void }> = ({ preferences, onChange }) => {
  const change = (column: 'compute' | 'show', scope: readonly GeometryRelationKind[], action: SelectionAction) => {
    if (column === 'compute') onChange({ ...preferences, options: { ...preferences.options,
      enabledKinds: changeRelationSelection(preferences.options.enabledKinds, scope, action) } });
    else onChange({ ...preferences, visibleKinds: changeRelationSelection(preferences.visibleKinds,
      scope.filter((kind) => preferences.options.enabledKinds.includes(kind)), action) });
  };
  const buttons = (column: 'compute' | 'show', scope: readonly GeometryRelationKind[], label: string) => <span className="inline-flex max-w-full flex-wrap gap-x-1">
    {ACTIONS.map(({ action, label: actionLabel }) => <button key={action} type="button" aria-label={`${actionLabel} ${column} ${label}`}
      disabled={column === 'show' && !scope.some((kind) => preferences.options.enabledKinds.includes(kind))}
      className="rounded px-1 py-0.5 text-sky-700 hover:bg-sky-50 disabled:opacity-40" onClick={() => change(column, scope, action)}>{actionLabel}</button>)}
  </span>;
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 pb-2">
      <div>Compute: {buttons('compute', ALL_RELATION_KINDS, 'types')}</div>
      <div>Show: {buttons('show', ALL_RELATION_KINDS, 'types')}</div>
    </div>
    {RELATION_GROUPS.map(({ label, items }) => {
      const kinds = items.map((item) => item.kind);
      return <details key={label} className="rounded border border-slate-100 px-2 py-1">
        <summary className="cursor-pointer font-semibold text-slate-600">{label} <span className="font-normal text-slate-400">({kinds.filter((kind) => preferences.options.enabledKinds.includes(kind)).length}/{items.length})</span></summary>
        <table className="mt-1 w-full table-fixed text-left"><thead><tr><th className="w-[42%] font-normal">Type</th><th className="font-normal">Compute</th><th className="font-normal">Show</th></tr>
          <tr><th /><td>{buttons('compute', kinds, label)}</td><td>{buttons('show', kinds, label)}</td></tr></thead>
          <tbody>{items.map((item) => <tr key={item.kind}>
            <td className="py-1 pr-1 text-slate-600">{item.symbol} {item.label}</td>
            <td><input type="checkbox" aria-label={`Compute ${item.label}`} checked={preferences.options.enabledKinds.includes(item.kind)} onChange={() => change('compute', [item.kind], 'invert')} /></td>
            <td><input type="checkbox" aria-label={`Show ${item.label}`} disabled={!preferences.options.enabledKinds.includes(item.kind)} checked={preferences.visibleKinds.includes(item.kind)} onChange={() => change('show', [item.kind], 'invert')} /></td>
          </tr>)}</tbody>
        </table>
      </details>;
    })}
    <p className="text-[10px] text-slate-500">Show controls affect computed types only. Display choices do not rerun discovery.</p>
  </div>;
};
