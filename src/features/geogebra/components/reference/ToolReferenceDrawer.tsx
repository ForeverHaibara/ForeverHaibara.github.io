import { useLayoutEffect, useRef } from 'react';
import ToolReference from './ToolReference';
import type { ComponentProps } from 'react';

type DrawerProps = ComponentProps<typeof ToolReference> & {
  open: boolean;
  width: number;
  onWidthChange(width: number): void;
  onClose(): void;
};

const minWidth = 320;
const maxWidth = 720;
const clampWidth = (width: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, width)));

export default function ToolReferenceDrawer({ open, width, onWidthChange, ...reference }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const narrow = window.matchMedia('(max-width: 1023px)');
    const show = () => {
      if (dialog.open) dialog.close();
      if (narrow.matches) dialog.showModal();
      else dialog.show();
    };
    show();
    narrow.addEventListener('change', show);
    return () => {
      narrow.removeEventListener('change', show);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return <dialog ref={dialogRef} id="geogebra-tool-reference" className="ggb-reference-dialog" aria-label="Tool Reference" onCancel={(event) => {
    event.preventDefault();
    reference.onClose();
  }}>
    <ToolReference {...reference} />
    <div className="ggb-reference-resize" role="separator" aria-label="Resize tool reference"
      aria-orientation="vertical" aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={width}
      tabIndex={0} title="Drag to resize tool reference"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || !dialogRef.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: dialogRef.current.offsetWidth };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start?.pointerId === event.pointerId) {
          onWidthChange(clampWidth(start.startWidth + start.startX - event.clientX));
        }
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const currentWidth = dialogRef.current?.offsetWidth ?? width;
        onWidthChange(clampWidth(currentWidth + (event.key === 'ArrowLeft' ? 16 : -16)));
      }} />
  </dialog>;
}
