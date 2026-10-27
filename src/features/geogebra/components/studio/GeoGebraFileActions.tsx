import React, { useRef, useState } from 'react';
import StudioIcon from './StudioIcon';

interface GeoGebraFileActionsProps {
  onImport(file: File): Promise<void>;
  onExport(): Promise<void>;
  onClearDraft(): Promise<void>;
  onResetInitial(): Promise<void>;
  onAction(): void;
}

const GeoGebraFileActions: React.FC<GeoGebraFileActionsProps> = ({ onImport, onExport, onClearDraft, onResetInitial, onAction }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setError(null);
    try { await action(); onAction(); }
    catch (e) { setError(e instanceof Error ? e.message : 'File operation failed.'); }
  };
  return <div className="ggb-file-actions">
    <input ref={inputRef} type="file" accept=".ggb,application/vnd.geogebra.file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => onImport(file)); event.target.value = ''; }} />
    <button type="button" aria-label="Open construction" onClick={() => inputRef.current?.click()}><StudioIcon name="open" /><span>Open construction<small>Import a .ggb file</small></span><span className="ggb-file-extension">.ggb</span></button>
    <button type="button" aria-label="Export construction" onClick={() => void run(onExport)}><StudioIcon name="download" /><span>Export construction<small>Save a copy to your device</small></span></button>
    <hr />
    <button type="button" aria-label="Clear saved draft" onClick={() => void run(onClearDraft)}><StudioIcon name="trash" /><span>Clear saved draft<small>Remove the browser backup</small></span></button>
    <button type="button" aria-label="Reset initial" className="ggb-file-reset" onClick={() => void run(onResetInitial)}><StudioIcon name="reset" /><span>Reset initial<small>Fresh file · Keep your preferences</small></span></button>
    {error && <p role="alert" className="ggb-file-error">{error}</p>}
  </div>;
};

export default GeoGebraFileActions;
