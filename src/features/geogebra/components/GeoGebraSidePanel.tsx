import React, { useEffect, useRef, useState } from 'react';
import { MAX_SIDE_PANEL_WIDTH, MIN_SIDE_PANEL_WIDTH } from '../config';
import type { EngineCapabilities, GeoGebraEngine, GeometryEvent } from '../types';
import DependencyGraphView from './DependencyGraphView';
import type { DependencyGraph } from '../analysis/graphTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import GeometryReasoningView from './GeometryReasoningView';
import type { ObjectLink } from '../interaction/useObjectLink';

interface GeoGebraSidePanelProps {
  engine: GeoGebraEngine;
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
  objectLink: ObjectLink;
}

const clampWidth = (width: number): number => Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width));

const GeoGebraSidePanel: React.FC<GeoGebraSidePanelProps> = ({ engine, collapsed, width, capabilities, events, graph, graphStatus, graphError, geometryRelations, onRefreshGraph, onToggle, onWidthChange, objectLink }) => {
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

  return (
    <aside id="geogebra-analysis-panel" ref={panelRef} hidden={collapsed} style={{ '--side-panel-width': `${width}px` } as React.CSSProperties} className={`geogebra-analysis-panel relative min-h-[520px] w-full min-w-0 flex-col border-l border-slate-200/80 bg-white/95 backdrop-blur-xl lg:w-[var(--side-panel-width)] lg:shrink-0 ${collapsed ? 'hidden' : 'flex'}`} aria-label="Analysis and proof panel">
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Geometry workspace</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-800">Analysis & Proof</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Explore observations and reason from selected conditions.</p>
        </div>
        <button type="button" onClick={onToggle} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-sky-700">Hide</button>
      </div>
      <div className="flex items-center justify-between px-4 py-2 text-[10px] text-slate-500"><span>GeoGebra {capabilities.version ?? 'loading'}</span><span>{events.length} events</span></div>
      <details className="border-t border-slate-100"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-500">Dependency graph</summary><DependencyGraphView objectLink={objectLink} graph={graph} status={graphStatus} error={graphError} onRefresh={onRefreshGraph} /></details>
      <div className="border-t border-slate-100"><div className="px-4 pt-4"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Relations & proof</h3><p className="mt-1 text-xs leading-5 text-slate-500">Discover, choose conditions and read the derivation.</p></div><GeometryReasoningView engine={engine} graph={graph} graphStatus={graphStatus} lastEventTime={[...events].reverse().find((event) => event.type !== 'style')?.timestamp ?? 0} discovery={geometryRelations} objectLink={objectLink} /></div>
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
