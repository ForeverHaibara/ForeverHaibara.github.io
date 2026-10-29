import { useEffect, useId, useRef, useState } from 'react';
import { GGB_PALETTES } from '../../settings/defaults';
import type { GgbPreferences } from '../../settings/types';
import { StudioIconButton } from '../studio/StudioIcon';

interface Props {
  preferences: GgbPreferences;
  allowNonGeometricHelpers: boolean;
  onAllowNonGeometricHelpersChange(value: boolean): void;
  ready: boolean;
  error: string | null;
  onChange(value: GgbPreferences): void;
  onApplyToAll(): Promise<void>;
  onClose(): void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(): void }) {
  return <label className="ggb-settings-row"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={onChange} /><span className="ggb-switch" aria-hidden="true" /></label>;
}

export default function GeoGebraSettingsPanel({ preferences: p, allowNonGeometricHelpers, onAllowNonGeometricHelpersChange, ready, error, onChange, onApplyToAll, onClose }: Props) {
  const [tab, setTab] = useState('views');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const change = <K extends keyof GgbPreferences>(key: K, value: GgbPreferences[K]) => { setApplied(false); onChange({ ...p, [key]: value }); };
  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  const toggle = (key: keyof GgbPreferences, label: string) => <Toggle key={key} label={label} checked={Boolean(p[key])} onChange={() => change(key, !p[key])} />;
  return <div ref={panelRef} className="ggb-settings-panel" id="geogebra-settings-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="ggb-settings-heading"><div><span className="ggb-eyebrow">MAKE IT YOURS</span><h2 id={`${id}-title`}>Workspace settings</h2></div><StudioIconButton icon="close" label="Close settings" onClick={onClose} /></div>
    <div className="ggb-settings-tabs" role="tablist" aria-label="Settings categories">{[['views', 'Views'], ['objects', 'Objects'], ['behavior', 'Behavior']].map(([key, name], index, tabs) => <button key={key} id={`${id}-${key}`} role="tab" type="button" aria-selected={tab === key} aria-controls={`${id}-content`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      setTab(tabs[next][0]);
      document.getElementById(`${id}-${tabs[next][0]}`)?.focus();
    }}>{name}</button>)}</div>
    <div className="ggb-settings-content" id={`${id}-content`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
      {tab === 'views' && <>
        <section><h3>Drawing canvas</h3>{toggle('axes', 'Coordinate axes')}{toggle('grid', 'Grid')}<label className="ggb-settings-row"><span>Decimal places</span><select value={p.decimals} onChange={(e) => change('decimals', Number(e.target.value))}>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label></section>
        <section><h3>GeoGebra views</h3><p>The primary drawing canvas is always available.</p>{toggle('algebra', 'Algebra')}{toggle('cas', 'CAS')}{toggle('spreadsheet', 'Spreadsheet')}{toggle('graphics2', 'Graphics 2')}{toggle('graphics3d', '3D Graphics')}{toggle('inputBar', 'Native input bar')}</section>
      </>}
      {tab === 'objects' && <>
        <section><h3>Color palette</h3><p>Point swatches: free · constrained · dependent.</p><div className="ggb-palette-grid">{GGB_PALETTES.map((palette) => <button key={palette.id} type="button" aria-pressed={p.palette === palette.id} onClick={() => onChange({ ...p, palette: palette.id, pointColor: palette.point, constrainedPointColor: palette.constrained, dependentPointColor: palette.dependent, pointColorMode: palette.mode, lineColor: palette.line })}><span className="ggb-palette-sample" aria-hidden="true"><i style={{ background: palette.point }} /><i style={{ background: palette.constrained }} /><i style={{ background: palette.dependent }} /><i style={{ background: palette.line }} /></span>{palette.name}</button>)}</div></section>
        <section><h3>Points</h3>{toggle('pointLabels', 'Show point labels')}<label className="ggb-settings-row"><span>Point size</span><span className="ggb-range-control"><input type="range" min="1" max="9" value={p.pointSize} onChange={(e) => change('pointSize', Number(e.target.value))} /><output>{p.pointSize}</output></span></label>
          <label className="ggb-settings-row"><span>Color mode</span><select className="ggb-point-color-mode" value={p.pointColorMode} onChange={(e) => onChange({ ...p, pointColorMode: e.target.value as GgbPreferences['pointColorMode'], palette: 'custom' })}><option value="by-role">By point role</option><option value="uniform">Uniform</option></select></label>
          <label className="ggb-settings-row"><span>{p.pointColorMode === 'by-role' ? 'Free points' : 'All points'}</span><input aria-label={p.pointColorMode === 'by-role' ? 'Free point color' : 'All point colors'} type="color" value={p.pointColor} onChange={(e) => onChange({ ...p, pointColor: e.target.value, palette: 'custom' })} /></label>
          {p.pointColorMode === 'by-role' && <>
            <label className="ggb-settings-row"><span>Constrained points</span><input aria-label="Constrained point color" type="color" value={p.constrainedPointColor} onChange={(e) => onChange({ ...p, constrainedPointColor: e.target.value, palette: 'custom' })} /></label>
            <label className="ggb-settings-row"><span>Dependent points</span><input aria-label="Dependent point color" type="color" value={p.dependentPointColor} onChange={(e) => onChange({ ...p, dependentPointColor: e.target.value, palette: 'custom' })} /></label>
            <p className="ggb-point-role-help">Free: independent points. Constrained: points on paths or in regions. Dependent: intersections, midpoints and other constructed points.</p>
          </>}
        </section>
        <section><h3>Lines & curves</h3><p>Includes segments, circles, conics and other curves.</p>{toggle('lineLabels', 'Show line & curve labels')}<label className="ggb-settings-row"><span>Line thickness</span><span className="ggb-range-control"><input type="range" min="1" max="13" value={p.lineThickness} onChange={(e) => change('lineThickness', Number(e.target.value))} /><output>{p.lineThickness}</output></span></label><label className="ggb-settings-row"><span>Line color</span><input aria-label="Line color" type="color" value={p.lineColor} onChange={(e) => onChange({ ...p, lineColor: e.target.value, palette: 'custom' })} /></label></section>
      </>}
      {tab === 'behavior' && <>
        <section><h3>Custom tool performance</h3><p>Supported complex tools can keep numeric values, numeric lists and numeric functions as hidden auxiliary objects. This applies to new commands only.</p><Toggle label="Allow non-geometric intermediate objects" checked={allowNonGeometricHelpers} onChange={() => onAllowNonGeometricHelpersChange(!allowNonGeometricHelpers)} /></section>
        <section><h3>Object style priority</h3><p>New objects and newly opened files receive your studio defaults. Choose how later preference changes affect individual edits.</p><label className="ggb-policy-option"><input type="radio" name={`${id}-policy`} checked={p.stylePolicy === 'preserve'} onChange={() => change('stylePolicy', 'preserve')} /><span><strong>Preserve individual edits</strong><small>Keep properties you changed in GeoGebra. These overrides also survive draft reloads.</small></span></label><label className="ggb-policy-option"><input type="radio" name={`${id}-policy`} checked={p.stylePolicy === 'override'} onChange={() => change('stylePolicy', 'override')} /><span><strong>Prefer studio defaults</strong><small>Changing a preference reapplies the studio style to existing objects.</small></span></label></section>
        <section><h3>Unify this construction</h3><p>Apply all object defaults now, including to customized objects. This action can be undone in GeoGebra.</p><button type="button" className="ggb-apply-button" disabled={!ready || applying} onClick={async () => { setApplying(true); setApplied(false); try { await onApplyToAll(); setApplied(true); } finally { setApplying(false); } }}>{applying ? 'Applying…' : applied ? 'Applied to all objects' : 'Apply to all objects'}</button></section>
        <section className="ggb-settings-note"><h3>Always your workspace</h3><p>Preferences are saved in this browser, separately from .ggb files. Opening a file, resetting the construction and reloading the page keep them intact.</p></section>
      </>}
    </div>
    <div className="ggb-settings-footer" role="status"><span className={error ? 'ggb-status-dot error' : 'ggb-status-dot'} />{error ?? (ready ? 'Preferences saved locally · Changes apply immediately' : 'Preferences saved locally · Applies when ready')}</div>
  </div>;
}
