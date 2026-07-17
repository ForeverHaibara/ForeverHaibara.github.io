import React, { useMemo, useState } from 'react';
import { projectGraph } from '../analysis/constructionGraph';
import type { DependencyGraph, GraphNode } from '../analysis/graphTypes';

interface DependencyGraphViewProps {
  graph: DependencyGraph | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onRefresh(): void;
}

interface GraphPoint { x: number; y: number; }

const GEOMETRY_TYPES = new Set(['point', 'line', 'segment', 'ray', 'vector', 'circle', 'conic', 'polygon', 'polyline', 'angle', 'locus', 'plane', 'quadric', 'surface', 'arc']);
const NODE_WIDTH = 112;
const NODE_HEIGHT = 34;
const COLUMN_GAP = 24;
const ROW_GAP = 24;

const displayType = (objectType: string | null): string => objectType ? objectType.replace(/^geo/iu, '') : 'unknown';
const nodeKey = (node: GraphNode): string => node.isSentinel ? 'root' : node.id;

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

const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({ graph, status, error, onRefresh }) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(GEOMETRY_TYPES));
  const types = useMemo(() => [...new Set((graph?.nodes ?? []).filter((node) => !node.isSentinel && node.objectType).map((node) => node.objectType!))].sort(), [graph]);
  const projected = useMemo(() => graph ? projectGraph(graph, { visibleTypes: showAll ? 'all' : selectedTypes, includeRoot: true, compressHidden: true }) : null, [graph, selectedTypes, showAll]);
  const layout = useMemo(() => projected ? layoutGraph(projected) : null, [projected]);
  const selectedNode = projected?.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedDependencies = selectedNode && projected ? projected.edges.filter((edge) => edge.target === selectedNode.id).map((edge) => projected.nodes.find((node) => node.id === edge.source)?.label).filter((label): label is string => Boolean(label)) : [];
  const selectedDependents = selectedNode && projected ? projected.edges.filter((edge) => edge.source === selectedNode.id).map((edge) => projected.nodes.find((node) => node.id === edge.target)?.label).filter((label): label is string => Boolean(label)) : [];
  const connectedIds = useMemo(() => {
    if (!selectedId || !projected) return new Set<string>();
    const connected = new Set([selectedId]);
    projected.edges.forEach((edge) => {
      if (edge.source === selectedId) connected.add(edge.target);
      if (edge.target === selectedId) connected.add(edge.source);
    });
    return connected;
  }, [projected, selectedId]);
  const toggleType = (type: string) => setSelectedTypes((current) => {
    const next = new Set(current);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });

  if (status === 'idle') return <p className="p-4 text-xs text-slate-500">Waiting for GeoGebra to become ready...</p>;
  if (status === 'loading' && !graph) return <p className="p-4 text-xs text-slate-500">Reading construction objects...</p>;
  if (!graph || status === 'error') return <div className="space-y-3 p-4 text-xs text-slate-500"><p>{error ?? 'The dependency graph is unavailable.'}</p><button type="button" onClick={onRefresh} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-sky-700 hover:border-sky-300">Retry analysis</button></div>;

  return <div className="space-y-3 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-500">{projected?.nodes.length ?? 0} visible nodes · {projected?.edges.length ?? 0} edges</span><button type="button" onClick={onRefresh} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-sky-700 hover:border-sky-300">Refresh</button></div>
    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} /> Show all object types</label>
    {!showAll && types.length > 0 && <div className="flex flex-wrap gap-1.5">{types.map((type) => <label key={type} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600"><input type="checkbox" checked={selectedTypes.has(type)} onChange={() => toggleType(type)} />{type}</label>)}</div>}
    {error && <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">{error}</p>}
    {projected && layout && projected.nodes.length > 0 ? <div className="overflow-auto rounded-xl border border-slate-100 bg-slate-50/70" role="img" aria-label="GeoGebra dependency graph"><svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="min-w-full" aria-labelledby="dependency-graph-title"><title id="dependency-graph-title">GeoGebra object dependency graph</title><defs><marker id="dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" /></marker></defs><g className="text-slate-300">{projected.edges.map((edge) => { const source = layout.points.get(edge.source); const target = layout.points.get(edge.target); if (!source || !target) return null; const active = !selectedId || connectedIds.has(edge.source) && connectedIds.has(edge.target); return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="currentColor" strokeWidth={active ? 1.5 : 1} opacity={active ? 0.85 : 0.2} markerEnd="url(#dependency-arrow)" />; })}</g>{projected.nodes.map((node) => { const point = layout.points.get(node.id); if (!point) return null; const selected = selectedId === node.id; const active = !selectedId || connectedIds.has(node.id); return <g key={nodeKey(node)} transform={`translate(${point.x - NODE_WIDTH / 2},${point.y - NODE_HEIGHT / 2})`} opacity={active ? 1 : 0.35} onClick={() => { setSelectedId(node.id); setShowDetails(true); }} role="button" aria-label={`Select ${node.label}`}><rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="9" fill={node.isSentinel ? '#dbeafe' : '#ffffff'} stroke={selected ? '#0284c7' : '#cbd5e1'} strokeWidth={selected ? 2 : 1} /><text x={NODE_WIDTH / 2} y="15" textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">{node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}</text><text x={NODE_WIDTH / 2} y="27" textAnchor="middle" className="fill-slate-400 text-[9px]">{node.isSentinel ? 'root' : displayType(node.objectType)}</text></g>; })}</svg></div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No objects match the current filter.</p>}
    {showDetails && selectedNode && <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><div className="flex items-center justify-between gap-2"><strong className="text-slate-800">{selectedNode.label}</strong><button type="button" onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-slate-700">Close</button></div><p className="mt-1">Type: {selectedNode.isSentinel ? 'free-object root' : displayType(selectedNode.objectType)}</p><p className="mt-2">Depends on: {selectedDependencies.join(', ') || 'none'}</p><p className="mt-1">Used by: {selectedDependents.join(', ') || 'none'}</p><p className="mt-2 font-semibold text-slate-500">Command</p><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 font-mono text-[10px]">{selectedNode.commandString || 'No command: treated as a free object.'}</pre>{selectedNode.diagnostics.length > 0 && <div className="mt-2 text-amber-700"><p className="font-semibold">Diagnostics</p>{selectedNode.diagnostics.map((diagnostic, index) => <p key={`${diagnostic.message}-${index}`} className="mt-1">{diagnostic.message}</p>)}</div>}</div>}
  </div>;
};

export default DependencyGraphView;
