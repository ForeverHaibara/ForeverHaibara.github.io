import { useEffect, useId, useRef, useState } from 'react';
import type { GeoGebraEngine } from '../../types';
import type { ObjectStyle } from '../../settings/types';
import { readObjectStyles, type SelectedObjectStyle } from '../../settings/objectStyles';
import StudioIcon from '../studio/StudioIcon';
import { QUICK_STYLE_COLORS } from '../../settings/quickStylePalette';
import QuickStyleAppearance, { commonStyle as common } from './QuickStyleAppearance';


interface Props {
  engine: GeoGebraEngine;
  names: readonly string[];
  disabled: boolean;
  onOpen(): void;
  onEdit(names: readonly string[], patch: ObjectStyle | null): Promise<void>;
}

/** A nonmodal inspector: selection stays on the canvas, pointer and keyboard both work. */
export default function GeoGebraQuickStyle({ engine, names, disabled, onOpen, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [objects, setObjects] = useState<SelectedObjectStyle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const selection = JSON.stringify(names);
  const visible = open && !disabled;

  useEffect(() => { setObjects([]); setError(null); }, [selection, engine]);

  useEffect(() => {
    if (!visible) return;
    const measure = () => root.current?.style.setProperty('--ggb-style-top', `${(trigger.current?.getBoundingClientRect().bottom ?? 130) + 10}px`);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let readVersion = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const version = ++readVersion;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void readObjectStyles(engine, JSON.parse(selection)).then((styles) => { if (active && version === readVersion) { setObjects(styles); setError(null); } }, (cause: unknown) => { if (active && version === readVersion) setError(cause instanceof Error ? cause.message : 'Could not read selection.'); });
      }, 30);
    };
    refresh();
    const unsubscribe = engine.subscribe(refresh);
    return () => { active = false; clearTimeout(timer); unsubscribe(); };
  }, [engine, selection, visible, revision]);

  useEffect(() => {
    if (!visible) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [visible]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const show = () => { clearTimeout(closeTimer.current); if (!disabled) { setOpen(true); onOpen(); } };
  const leave = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { if (!root.current?.contains(document.activeElement)) setOpen(false); }, 180);
  };
  const edit = async (patch: ObjectStyle | null, targets = objects) => {
    if (!targets.length) return;
    setBusy(true); setError(null);
    try { await onEdit(targets.map((object) => object.name), patch); setRevision((value) => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change styles.'); }
    finally { setBusy(false); }
  };
  const points = objects.filter((object) => object.point && object.size !== undefined);
  const lines = objects.filter((object) => object.line && object.size !== undefined);
  const color = common(objects, 'color');
  const label = common(objects, 'label');
  const typeLabel = [...new Set(objects.map((object) => object.typeLabel))].join(', ');

  return <div ref={root} className="ggb-quick-style" onPointerEnter={(event) => { if (event.pointerType !== 'touch') show(); }} onPointerLeave={leave} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { clearTimeout(closeTimer.current); setOpen(false); } }} onKeyDown={(event) => { if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="ggb-icon-button" title="Quick style" aria-label="Quick style" aria-expanded={visible} aria-controls={id} disabled={disabled} onClick={() => { if (visible) setOpen(false); else show(); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); show(); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('.ggb-color-swatch')?.focus()); } }}><StudioIcon name="palette" /></button>
    {visible && <section id={id} className="ggb-style-popover" aria-label="Quick style" aria-busy={busy}>
      <div className="ggb-style-heading"><span className="ggb-style-glyph"><StudioIcon name="palette" size={20} /></span><div><strong>Quick style</strong><p title={`${names.join(', ')}${typeLabel ? ` · ${typeLabel}` : ''}`}>{objects.length ? <>{objects.length === 1 ? objects[0].name : `${objects.length} objects`}<span className="ggb-style-object-type"> · {typeLabel}</span></> : 'Select objects on the canvas or in Analysis'}</p></div></div>
      <fieldset disabled={!objects.length}>
        <div className="ggb-style-section-label"><span>Color</span><span>{objects.length && !color ? 'Mixed' : color?.toUpperCase()}</span></div>
        <div className="ggb-color-swatches">{QUICK_STYLE_COLORS.map((swatch) => <button key={swatch} type="button" className="ggb-color-swatch" style={{ '--swatch': swatch } as React.CSSProperties} aria-label={`Set color ${swatch}`} title={swatch.toUpperCase()} aria-pressed={color === swatch} onClick={() => void edit({ color: swatch })}>{color === swatch && <span style={{ color: parseInt(swatch.slice(1, 3), 16) * .299 + parseInt(swatch.slice(3, 5), 16) * .587 + parseInt(swatch.slice(5, 7), 16) * .114 > 150 ? '#334155' : '#ffffff' }}>✓</span>}</button>)}</div>
        <label className="ggb-custom-color"><span>Custom color</span><input type="color" aria-label="Custom object color" value={color && /^#[\da-f]{6}$/i.test(color) ? color : '#2563eb'} onChange={(event) => void edit({ color: event.target.value })} /></label>
        {[{ group: points, text: 'Point size', max: 9 }, { group: lines, text: 'Line weight', max: 13 }].filter(({ group }) => group.length).map(({ group, text, max }) => <label className="ggb-style-control" key={text}><span>{text}</span><select aria-label={text} value={common(group, 'size') ?? ''} onChange={(event) => void edit({ size: Number(event.target.value) }, group)}><option value="" disabled>Mixed</option>{Array.from({ length: max }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>)}
        <QuickStyleAppearance objects={objects} onEdit={(patch, targets) => void edit(patch, targets)} />
        <div className="ggb-style-control"><span>Labels</span><div className="ggb-style-segmented">{[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={label === value} onClick={() => void edit({ label: value })}>{value ? 'Show' : 'Hide'}</button>)}</div></div>
        <button type="button" className="ggb-style-reset" onClick={() => void edit(null)}><StudioIcon name="reset" size={14} />Use studio defaults</button>
      </fieldset>
      <p className="ggb-style-footnote">Individual edits stay with these objects.</p>
      {error && <p role="alert" className="ggb-style-error">{error}</p>}
    </section>}
  </div>;
}
