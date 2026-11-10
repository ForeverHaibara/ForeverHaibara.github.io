import React from 'react';
import { DEFAULT_RELATION_KINDS, RELATION_GROUPS } from '../../analysis/relations/catalog';
import type { GeometryRelationsState } from '../../analysis/useGeometryRelations';

const GeometryDiscoveryControls: React.FC<{ state: GeometryRelationsState }> = ({ state }) => {
  const { preferences, setPreferences } = state;
  const { options } = preferences;
  const missingDefaults = DEFAULT_RELATION_KINDS.filter((kind) => !options.enabledKinds.includes(kind));
  const disabledGroups = RELATION_GROUPS.filter(({ items }) => items.every(({ kind }) => !options.enabledKinds.includes(kind)));
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <label className="flex items-center gap-1"><input type="checkbox" checked={preferences.automatic} onChange={(event) => setPreferences({ ...preferences, automatic: event.target.checked })} />Auto</label>
      <button className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100" type="button" onClick={state.run}>{state.status === 'calculating' ? 'Restart discovery' : 'Discover relations'}</button>
      <button className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" type="button" onClick={state.stop}>Stop</button>
    </div>
    <p className="text-[10px] leading-4 text-slate-500">Uses full floating-point coordinates, independently of GeoGebra display rounding. Observations are evidence, not proofs.</p>
    <p className="text-[10px] leading-4 text-slate-500">Discovery settings ({preferences.options.enabledKinds.length} types) are in Proof settings in the top toolbar. Accepted conditions and the goal stay on this construction.</p>
    {missingDefaults.length > 0 && <div className="flex flex-wrap items-center gap-x-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800">
      <span>{disabledGroups.length ? `Discovery skips ${disabledGroups.map(({ label }) => label).join(', ')} under the current settings.` : 'Some default discovery types are disabled.'}</span>
      <button type="button" className="font-semibold underline" onClick={() => {
        setPreferences({ ...preferences, options: { ...options, enabledKinds: [...options.enabledKinds, ...missingDefaults] } });
        state.run();
      }}>Enable default types and rerun</button>
    </div>}
    {state.error && <p role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-700">{state.error}</p>}
    {state.storageUnavailable && <p className="text-[10px] text-slate-500">Settings are available for this session; browser storage is unavailable.</p>}
    {state.result && state.result.diagnostics.length > 0 && <details className="rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800"><summary className="cursor-pointer">Search limits / notes ({state.result.diagnostics.length})</summary><p className="mt-1">{state.result.diagnostics.join(' ')}</p></details>}
  </div>;
};

export default GeometryDiscoveryControls;
