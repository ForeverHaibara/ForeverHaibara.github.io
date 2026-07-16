import React, { useRef } from 'react';

interface GeoGebraFileActionsProps {
  onImport(file: File): Promise<void>;
  onExport(): Promise<void>;
  onClearDraft(): Promise<void>;
  onResetInitial(): Promise<void>;
}

const GeoGebraFileActions: React.FC<GeoGebraFileActionsProps> = ({ onImport, onExport, onClearDraft, onResetInitial }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept=".ggb,application/vnd.geogebra.file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700">Open .ggb</button>
      <button type="button" onClick={() => void onExport()} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700">Export .ggb</button>
      <button type="button" onClick={() => void onClearDraft()} className="rounded-xl border border-transparent px-3 py-2 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600">Clear draft</button>
      <button type="button" onClick={() => void onResetInitial()} className="rounded-xl border border-transparent px-3 py-2 text-xs text-slate-400 hover:bg-amber-50 hover:text-amber-700">Reset initial</button>
    </div>
  );
};

export default GeoGebraFileActions;
