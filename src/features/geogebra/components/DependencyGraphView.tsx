import React, { useEffect, useMemo, useRef, useState } from 'react';
import { projectGraph } from '../analysis/constructionGraph';
import { objectNodeId, type DependencyGraph, type GraphNode } from '../analysis/graphTypes';
import { geometryTypeLabel } from '../geometryObjectTypes';
import type { ObjectLink } from '../interaction/useObjectLink';

interface DependencyGraphViewProps {
  graph: DependencyGraph | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onRefresh(): void;
  objectLink: ObjectLink;
}

interface GraphPoint { x: number; y: number; }

const GEOMETRY_TYPES = new Set(['point', 'line', 'segment', 'ray', 'vector', 'circle', 'conic', 'conicpart', 'polygon', 'polyline', 'angle', 'locus', 'plane', 'quadric', 'surface', 'arc', 'function', 'curvecartesian', 'implicitpoly']);
const NODE_WIDTH = 112;
const NODE_HEIGHT = 34;
const COLUMN_GAP = 24;
const ROW_GAP = 24;

const layoutGraph = (graph: DependencyGraph): { points: Map<string, GraphPoint>; width: number; height: number } => {
  const incoming = new Map<string, string[]>();
  graph.nodes.forEach((node) => incoming.set(node.id, []));
  graph.edges.forEach((edge) => incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]));
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (id: string): number => {
    const cached = levels.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const level = Math.max(0, ...parents.map(levelOf)) + (parents.length > 0 ? 1 : 0);
    visiting.delete(id);
    levels.set(id, level);
    return level;
  };
  graph.nodes.forEach((node) => levelOf(node.id));
  const rows = new Map<number, GraphNode[]>();
  graph.nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    rows.set(level, [...(rows.get(level) ?? []), node]);
  });
  const points = new Map<string, GraphPoint>();
  let width = 320;
  [...rows.entries()].sort(([left], [right]) => left - right).forEach(([level, nodes]) => {
    const rowWidth = nodes.length * NODE_WIDTH + Math.max(0, nodes.length - 1) * COLUMN_GAP;
    width = Math.max(width, rowWidth + 32);
    nodes.forEach((node, index) => points.set(node.id, {
      x: 16 + index * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2,
      y: 16 + level * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT / 2,
    }));
  });
  const maxLevel = Math.max(0, ...levels.values());
  return { points, width, height: 32 + (maxLevel + 1) * (NODE_HEIGHT + ROW_GAP) };
};

const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({ graph, status, error, onRefresh, objectLink }) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(GEOMETRY_TYPES));
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const selectedName = objectLink.selectedNames.at(-1) ?? null;
  const selectedId = selectedName ? objectNodeId(selectedName) : null;
  const activeId = objectLink.hoveredName ? objectNodeId(objectLink.hoveredName) : selectedId;
  const selectedIds = useMemo(() => new Set(objectLink.selectedNames.map(objectNodeId)), [objectLink.selectedNames]);
  const visibleNames = useMemo(() => new Set([...objectLink.selectedNames, ...(objectLink.hoveredName ? [objectLink.hoveredName] : [])]), [objectLink.selectedNames, objectLink.hoveredName]);
  const types = useMemo(() => [...new Set((graph?.nodes ?? []).filter((node) => !node.isSentinel && node.objectType).map((node) => node.objectType!))].sort(), [graph]);
  const projected = useMemo(() => graph ? projectGraph(graph, { visibleTypes: showAll ? 'all' : selectedTypes, visibleObjectNames: visibleNames, includeRoot: true, compressHidden: true }) : null, [graph, selectedTypes, showAll, visibleNames]);
  const layout = useMemo(() => projected ? layoutGraph(projected) : null, [projected]);
  const selectedNode = graph?.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedDependencies = selectedNode && graph ? graph.edges.filter((edge) => edge.target === selectedNode.id).map((edge) => graph.nodes.find((node) => node.id === edge.source)).filter((node): node is GraphNode => Boolean(node && !node.isSentinel)) : [];
  const selectedDependents = selectedNode && graph ? graph.edges.filter((edge) => edge.source === selectedNode.id).map((edge) => graph.nodes.find((node) => node.id === edge.target)).filter((node): node is GraphNode => Boolean(node && !node.isSentinel)) : [];
  const connectedIds = useMemo(() => {
    if (!activeId || !projected) return new Set<string>();
    const connected = new Set([activeId, ...selectedIds]);
    projected.edges.forEach((edge) => {
      if (edge.source === activeId) connected.add(edge.target);
      if (edge.target === activeId) connected.add(edge.source);
    });
    return connected;
  }, [projected, activeId, selectedIds]);

  useEffect(() => {
    if (objectLink.source === 'canvas' && selectedId) nodeRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId, objectLink.source]);

  const toggleType = (type: string) => setSelectedTypes((current) => {
    const next = new Set(current);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });
  const objectButton = (node: GraphNode) => <button key={node.id} type="button" className="ggb-object-chip" aria-pressed={selectedIds.has(node.id)} onClick={() => objectLink.select(node.name)} onPointerEnter={() => objectLink.hover(node.name)} onPointerLeave={() => objectLink.hover(null)} onFocus={() => objectLink.hover(node.name)} onBlur={() => objectLink.hover(null)}>{node.label}</button>;

  if (status === 'idle') return <p className="p-4 text-xs text-slate-500">Waiting for GeoGebra to become ready...</p>;
  if (status === 'loading' && !graph) return <p className="p-4 text-xs text-slate-500">Reading construction objects...</p>;
  if (!graph || status === 'error') return <div className="space-y-3 p-4 text-xs text-slate-500"><p>{error ?? 'The dependency graph is unavailable.'}</p><button type="button" onClick={onRefresh} className="ggb-apply-button">Retry analysis</button></div>;

  return <div className="space-y-3 p-3" onKeyDown={(event) => {
    if (event.key === 'Escape' && (selectedName || objectLink.hoveredName)) { event.preventDefault(); event.stopPropagation(); objectLink.hover(null); objectLink.select(null); }
  }}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-500">{projected?.nodes.length ?? 0} visible nodes · {projected?.edges.length ?? 0} edges</span><button type="button" onClick={onRefresh} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-sky-700 hover:border-sky-300">Refresh</button></div>
    <div className="ggb-link-status" aria-live="polite"><span>{objectLink.hoveredName ? `Previewing ${objectLink.hoveredName}` : selectedName ? `Selected: ${objectLink.selectedNames.join(', ')}` : 'Select in either view · Hover to preview'}</span>{selectedName && <button type="button" onClick={() => objectLink.select(null)}>Clear</button>}</div>
    {objectLink.error && <p role="status" className="text-xs text-amber-700">{objectLink.error}</p>}
    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} /> Show all object types</label>
    {!showAll && types.length > 0 && <div className="flex flex-wrap gap-1.5">{types.map((type) => <label key={type} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600"><input type="checkbox" checked={selectedTypes.has(type)} onChange={() => toggleType(type)} />{geometryTypeLabel(type)}</label>)}</div>}
    {error && <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">{error}</p>}
    {projected && layout && projected.nodes.length > 0 ? <div className="ggb-dependency-graph overflow-auto rounded-xl border border-slate-100 bg-slate-50/70" role="group" aria-label="GeoGebra dependency graph" onPointerLeave={() => objectLink.hover(null)}>
      <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="min-w-full" aria-label="GeoGebra object dependency graph">
        <defs><marker id="dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" /></marker></defs>
        <g className="text-slate-300">{projected.edges.map((edge) => {
          const source = layout.points.get(edge.source), target = layout.points.get(edge.target);
          if (!source || !target) return null;
          const linked = edge.source === activeId || edge.target === activeId;
          return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={linked ? '#38bdf8' : 'currentColor'} strokeWidth={linked ? 2 : 1.5} opacity={!activeId || linked ? 0.85 : 0.2} markerEnd="url(#dependency-arrow)" />;
        })}</g>
        {projected.nodes.map((node) => {
          const point = layout.points.get(node.id);
          if (!point) return null;
          const selected = selectedIds.has(node.id), hovered = activeId === node.id && Boolean(objectLink.hoveredName);
          const active = !activeId || connectedIds.has(node.id);
          return <g key={node.id} ref={(element) => { if (element) nodeRefs.current.set(node.id, element); else nodeRefs.current.delete(node.id); }} className={node.isSentinel ? '' : 'ggb-graph-node'} data-object-name={node.isSentinel ? undefined : node.name} data-selected={selected} data-preview={hovered} transform={`translate(${point.x - NODE_WIDTH / 2},${point.y - NODE_HEIGHT / 2})`} opacity={active ? 1 : 0.35} role={node.isSentinel ? undefined : 'button'} tabIndex={node.isSentinel ? undefined : 0} aria-label={node.isSentinel ? 'Free objects' : `Select ${node.label}`} aria-pressed={node.isSentinel ? undefined : selected}
            onClick={node.isSentinel ? undefined : () => objectLink.select(node.name)}
            onPointerEnter={node.isSentinel ? undefined : () => objectLink.hover(node.name)} onPointerLeave={node.isSentinel ? undefined : () => objectLink.hover(null)}
            onFocus={node.isSentinel ? undefined : () => objectLink.hover(node.name)} onBlur={node.isSentinel ? undefined : () => objectLink.hover(null)}
            onKeyDown={(event) => { if (!node.isSentinel && ['Enter', ' '].includes(event.key)) { event.preventDefault(); objectLink.select(node.name); } }}>
            <title>{node.label}{node.commandString ? `: ${node.commandString}` : ''}</title>
            <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="9" fill={selected ? '#e0f2fe' : hovered ? '#f0fdfa' : node.isSentinel ? '#dbeafe' : '#ffffff'} stroke={hovered ? '#0d9488' : selected ? '#0284c7' : '#cbd5e1'} strokeWidth={selected || hovered ? 2 : 1} strokeDasharray={hovered && !selected ? '4 2' : undefined} />
            <text x={NODE_WIDTH / 2} y="15" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">{node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}</text>
            <text x={NODE_WIDTH / 2} y="27" textAnchor="middle" className="fill-slate-400 text-[9px]">{node.isSentinel ? 'root' : geometryTypeLabel(node.objectType)}</text>
          </g>;
        })}
      </svg>
    </div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No objects match the current filter.</p>}
    {selectedNode && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="flex items-center justify-between gap-2"><strong className="text-slate-800">{selectedNode.label}</strong><button type="button" onClick={() => objectLink.select(null)} className="text-slate-400 hover:text-slate-700" aria-label="Clear object selection">Clear selection</button></div>
      <p className="mt-1">Type: {geometryTypeLabel(selectedNode.objectType)}</p>
      <p className="mt-3 mb-1 text-[10px] text-slate-400">Depends on</p><div className="flex flex-wrap gap-1">{selectedDependencies.length ? selectedDependencies.map(objectButton) : 'None'}</div>
      <p className="mt-3 mb-1 text-[10px] text-slate-400">Used by</p><div className="flex flex-wrap gap-1">{selectedDependents.length ? selectedDependents.map(objectButton) : 'None'}</div>
      <p className="mt-3 font-semibold text-slate-500">Command</p><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 font-mono text-[10px]">{selectedNode.commandString || 'Free object'}</pre>
      {selectedNode.dependencyStatus === 'unavailable' && <p className="mt-2 text-amber-700">Dependencies could not be read. Refresh to try again.</p>}
    </div>}
  </div>;
};

export default DependencyGraphView;
