import React from 'react';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import { RelationTypeControls } from './RelationTypeControls';

const GeometryDiscoveryControls: React.FC<{ state: GeometryRelationsState }> = ({ state }) => {
  const { preferences, setPreferences } = state;
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <label className="flex items-center gap-1"><input type="checkbox" checked={preferences.automatic} onChange={(event) => setPreferences({ ...preferences, automatic: event.target.checked })} />Auto</label>
      <button className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700 hover:bg-sky-100" type="button" onClick={state.run}>{state.status === 'calculating' ? 'Restart discovery' : 'Discover relations'}</button>
      <button className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" type="button" onClick={state.stop}>Stop</button>
    </div>
    <p className="text-[10px] leading-4 text-slate-500">Uses full floating-point coordinates, independently of GeoGebra display rounding. Observations are evidence, not proofs.</p>
    <details className="rounded-lg border border-slate-200 p-2 text-[11px]">
      <summary className="cursor-pointer font-semibold text-slate-600">Discovery settings ({preferences.options.enabledKinds.length} types)</summary>
      <p className="mt-2 text-slate-500">These settings control the next discovery run. Auto recomputes after changes. Accepted conditions and the goal are kept on this construction. Use the catalog filters below to change what you see.</p>
      <RelationTypeControls kinds={preferences.options.enabledKinds} purpose="compute" onChange={(enabledKinds) => setPreferences({ ...preferences, options: { ...preferences.options, enabledKinds } })} />
      <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={!preferences.options.compressConsequences} onChange={(event) => setPreferences({ ...preferences, options: { ...preferences.options, compressConsequences: !event.target.checked } })} />Expand derived observations (recompute)</label>
      <label className="mt-2 flex items-center gap-2">Budget <select aria-label="Discovery budget" className="rounded border border-slate-200 px-1" value={preferences.options.maxAngles <= 5000 ? 'light' : preferences.options.maxAngles >= 50000 ? 'deep' : 'standard'} onChange={(event) => {
        const limits = event.target.value === 'light' ? { maxTriangles: 2000, maxAngles: 5000, maxComparisons: 50000, maxModels: 3, maxRelations: 200 }
          : event.target.value === 'deep' ? { maxTriangles: 20000, maxAngles: 50000, maxComparisons: 500000, maxModels: 8, maxRelations: 1000 }
            : { maxTriangles: 8000, maxAngles: 20000, maxComparisons: 200000, maxModels: 6, maxRelations: 500 };
        setPreferences({ ...preferences, options: { ...preferences.options, ...limits } });
      }}><option value="light">Light</option><option value="standard">Standard</option><option value="deep">Deep</option></select></label>
      <p className="mt-1 text-slate-500">Shared geometric resources may still be needed by other enabled types.</p>
    </details>
    {state.error && <p role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-700">{state.error}</p>}
    {state.storageUnavailable && <p className="text-[10px] text-slate-500">Settings are available for this session; browser storage is unavailable.</p>}
    {state.result && state.result.diagnostics.length > 0 && <details className="rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800"><summary className="cursor-pointer">Search limits / notes ({state.result.diagnostics.length})</summary><p className="mt-1">{state.result.diagnostics.join(' ')}</p></details>}
  </div>;
};

export default GeometryDiscoveryControls;
