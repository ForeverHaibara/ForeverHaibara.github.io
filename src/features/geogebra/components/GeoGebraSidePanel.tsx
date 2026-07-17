import React, { useEffect, useRef, useState } from 'react';
import { MAX_SIDE_PANEL_WIDTH, MIN_SIDE_PANEL_WIDTH } from '../config';
import type { EngineCapabilities, GeometryEvent } from '../types';
import DependencyGraphView from './DependencyGraphView';
import type { DependencyGraph } from '../analysis/graphTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import GeometryRelationsView from './GeometryRelationsView';

interface GeoGebraSidePanelProps {
  collapsed: boolean;
  width: number;
  capabilities: EngineCapabilities;
  events: GeometryEvent[];
  graph: DependencyGraph | null;
  graphStatus: 'idle' | 'loading' | 'ready' | 'error';
  graphError: string | null;
  geometryRelations: GeometryRelationsState;
  onRefreshGraph(): void;
  onToggle(): void;
  onWidthChange(width: number): void;
}

const clampWidth = (width: number): number => Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width));

const GeoGebraSidePanel: React.FC<GeoGebraSidePanelProps> = ({ collapsed, width, capabilities, events, graph, graphStatus, graphError, geometryRelations, onRefreshGraph, onToggle, onWidthChange }) => {
  const panelRef = useRef<HTMLElement>(null);
  const onWidthChangeRef = useRef(onWidthChange);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);

  useEffect(() => {
    if (!dragging) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      onWidthChangeRef.current(clampWidth(panel.getBoundingClientRect().right - event.clientX));
    };
    const stopDragging = () => setDragging(false);

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopDragging, { once: true });
    document.addEventListener('pointercancel', stopDragging, { once: true });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', stopDragging);
      document.removeEventListener('pointercancel', stopDragging);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragging]);

  const startDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onWidthChange(clampWidth(width + (event.key === 'ArrowLeft' ? -16 : 16)));
    }
  };

  if (collapsed) {
    return <button type="button" onClick={onToggle} className="absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-sky-700 shadow-lg backdrop-blur hover:bg-white">Open analysis panel</button>;
  }

  return (
    <aside ref={panelRef} style={{ '--side-panel-width': `${width}px` } as React.CSSProperties} className="relative flex min-h-[520px] w-full min-w-0 flex-col border-l border-slate-200/80 bg-white/75 backdrop-blur-xl lg:w-[var(--side-panel-width)] lg:shrink-0" aria-label="Analysis and proof panel">
      <div
        className={`group absolute -left-2 top-0 z-10 hidden h-full w-4 cursor-col-resize items-center justify-center lg:flex ${dragging ? 'bg-sky-100/50' : 'hover:bg-sky-100/40'}`}
        onPointerDown={startDragging}
        onKeyDown={handleResizeKeyDown}
        role="separator"
        aria-label="Resize analysis panel"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDE_PANEL_WIDTH}
        aria-valuemax={MAX_SIDE_PANEL_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        title="Drag to resize analysis panel"
      >
        <span className="h-10 w-1 rounded-full bg-slate-300 transition-colors group-hover:bg-sky-400" />
      </div>
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
      <div className="border-t border-slate-100"><div className="px-4 pt-4"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dependency graph</h3><p className="mt-1 text-xs leading-5 text-slate-500">Dependencies point toward the object that uses them.</p></div><DependencyGraphView graph={graph} status={graphStatus} error={graphError} onRefresh={onRefreshGraph} /></div>
      <div className="border-t border-slate-100"><div className="px-4 pt-4"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Discovered relations</h3><p className="mt-1 text-xs leading-5 text-slate-500">Numerical point relations, ranked by construction novelty.</p></div><GeometryRelationsView state={geometryRelations} /></div>
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
