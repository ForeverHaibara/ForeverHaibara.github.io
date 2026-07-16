import React from 'react';
import type { EngineCapabilities, GeometryEvent } from '../types';

interface GeoGebraSidePanelProps {
  collapsed: boolean;
  capabilities: EngineCapabilities;
  events: GeometryEvent[];
  onToggle(): void;
}

const GeoGebraSidePanel: React.FC<GeoGebraSidePanelProps> = ({ collapsed, capabilities, events, onToggle }) => {
  if (collapsed) {
    return <button type="button" onClick={onToggle} className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-sky-700 shadow-lg backdrop-blur hover:bg-white">Open analysis panel</button>;
  }

  return (
    <aside className="flex min-h-[520px] min-w-0 flex-col border-l border-slate-200/80 bg-white/75 backdrop-blur-xl lg:w-[350px]" aria-label="Analysis and proof panel">
      <div className="flex items-start justify-between border-b border-slate-200/80 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Future workspace</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-800">Analysis & Proof</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">This panel is ready for geometry discovery and proof providers.</p>
        </div>
        <button type="button" onClick={onToggle} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-sky-700">Hide</button>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 text-xs">
        <div className="rounded-xl bg-sky-50 p-3"><span className="block text-slate-500">Version</span><strong className="text-sky-800">{capabilities.version ?? 'Loading'}</strong></div>
        <div className="rounded-xl bg-emerald-50 p-3"><span className="block text-slate-500">Events</span><strong className="text-emerald-800">{events.length}</strong></div>
      </div>
      <div className="border-t border-slate-100 px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Planned analyzers</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div className="rounded-xl border border-dashed border-slate-200 p-3">Conjectured relations <span className="float-right text-xs text-slate-400">Soon</span></div>
          <div className="rounded-xl border border-dashed border-slate-200 p-3">Exact verification <span className="float-right text-xs text-slate-400">Soon</span></div>
          <div className="rounded-xl border border-dashed border-slate-200 p-3">Proof steps <span className="float-right text-xs text-slate-400">Soon</span></div>
        </div>
      </div>
      <div className="min-h-0 flex-1 border-t border-slate-100 px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Construction events</h3>
        <div className="mt-3 max-h-52 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-500">
          {events.length === 0 ? 'Waiting for construction events...' : events.slice(-30).map((event, index) => <p key={`${event.timestamp}-${index}`}>{event.type}{event.objectName ? `: ${event.objectName}` : ''}</p>)}
        </div>
      </div>
    </aside>
  );
};

export default GeoGebraSidePanel;
