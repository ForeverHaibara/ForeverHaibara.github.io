import { useEffect, useRef, useState } from 'react';
import { LINE_STYLES, POINT_STYLES, type SelectedObjectStyle } from '../../settings/objectStyles';
import type { ObjectStyle } from '../../settings/types';

export const commonStyle = <K extends keyof ObjectStyle>(objects: SelectedObjectStyle[], key: K) =>
  objects.length > 0 && objects.every((object) => object[key] === objects[0][key]) ? objects[0][key] : undefined;

interface Props { objects: SelectedObjectStyle[]; onEdit(patch: ObjectStyle, objects: SelectedObjectStyle[]): void }

function OpacityControl({ objects, property, label, onEdit }: Props & { property: 'opacity' | 'strokeOpacity'; label: string }) {
  const current = commonStyle(objects, property);
  const percent = current === undefined ? undefined : Math.round(current * 100);
  const [draft, setDraft] = useState(percent ?? 100);
  const editing = useRef(false);
  const dirty = useRef(false);
  const committed = useRef(percent);
  const requested = useRef<number | undefined>(undefined);
  const selection = objects.map(({ name }) => name).join('\0');
  useEffect(() => { requested.current = undefined; dirty.current = false; editing.current = false; setDraft(percent ?? 100); committed.current = percent; }, [selection]);
  useEffect(() => {
    // Reads can lag a rapid sequence of key presses. Do not let an older
    // native value move the thumb backwards while the latest write settles.
    if (!editing.current && (requested.current === undefined || requested.current === percent)) {
      requested.current = undefined; setDraft(percent ?? 100); committed.current = percent;
    }
  }, [percent]);
  const commit = (value: number) => {
    editing.current = false;
    if (!dirty.current) return;
    dirty.current = false;
    if (value !== committed.current) { committed.current = value; requested.current = value; onEdit({ [property]: value / 100 }, objects); }
  };
  return <label className="ggb-opacity-control"><span>{label}<output>{percent === undefined && !editing.current && draft === 100 ? 'Mixed' : `${draft}%`}</output></span><input type="range" aria-label={label} min="0" max="100" step="1" value={draft} onPointerDown={() => { editing.current = true; }} onChange={(event) => { editing.current = true; dirty.current = true; setDraft(Number(event.target.value)); }} onPointerUp={(event) => commit(Number(event.currentTarget.value))} onPointerCancel={() => { editing.current = false; dirty.current = false; setDraft(percent ?? 100); }} onKeyUp={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit(Number(event.currentTarget.value)); }} onBlur={(event) => commit(Number(event.currentTarget.value))} /></label>;
}

export default function QuickStyleAppearance({ objects, onEdit }: Props) {
  const points = objects.filter((object) => object.point && object.pointStyle !== undefined);
  const lines = objects.filter((object) => object.line && object.lineStyle !== undefined);
  const fill = objects.filter((object) => object.opacity !== undefined);
  const stroke = objects.filter((object) => object.strokeOpacity !== undefined);
  const lineStyle = commonStyle(lines, 'lineStyle');
  const pointStyle = commonStyle(points, 'pointStyle');
  return <>
    {fill.length > 0 && <OpacityControl objects={fill} property="opacity" label={stroke.length ? 'Fill opacity' : 'Opacity'} onEdit={onEdit} />}
    {stroke.length > 0 && <OpacityControl objects={stroke} property="strokeOpacity" label={fill.length ? 'Stroke opacity' : 'Opacity'} onEdit={onEdit} />}
    {lines.length > 0 && <div className="ggb-appearance-group"><div className="ggb-style-section-label"><span>Line style</span><span>{LINE_STYLES.find(({ value }) => value === lineStyle)?.label ?? 'Mixed'}</span></div><div className="ggb-line-styles" role="group" aria-label="Line style">{LINE_STYLES.map(({ value, label, dash }) => <button key={value} type="button" title={label} aria-label={`Set line style: ${label}`} aria-pressed={lineStyle === value} onClick={() => onEdit({ lineStyle: value }, lines)}><svg viewBox="0 0 36 16" aria-hidden="true"><line x1="2" y1="8" x2="34" y2="8" stroke="currentColor" strokeWidth="1.8" strokeDasharray={dash || undefined} strokeLinecap={value === 3 ? 'round' : 'butt'} /></svg></button>)}</div></div>}
    {points.length > 0 && <div className="ggb-appearance-group"><div className="ggb-style-section-label"><span>Point style</span><span>{POINT_STYLES.find(({ value }) => value === pointStyle)?.label ?? 'Mixed'}</span></div><div className="ggb-point-styles" role="group" aria-label="Point style">{POINT_STYLES.map(({ value, label, glyph }) => <button key={value} type="button" title={label} aria-label={`Set point style: ${label}`} aria-pressed={pointStyle === value} onClick={() => onEdit({ pointStyle: value }, points)}>{glyph}</button>)}</div></div>}
  </>;
}
