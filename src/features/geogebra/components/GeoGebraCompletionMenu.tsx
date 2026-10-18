import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CompletionItem } from '../commands/completion/types';
import { completionItemKey } from '../commands/completion/completionRegistry';
import { geometryTypeLabel } from '../geometryObjectTypes';

interface GeoGebraCompletionMenuProps {
  anchor: HTMLTextAreaElement;
  listId: string;
  items: readonly CompletionItem[];
  prefix: string;
  activeIndex: number;
  onAccept(index: number): void;
  onActiveIndexChange(index: number): void;
  onDismiss(): void;
}

const GeoGebraCompletionMenu: React.FC<GeoGebraCompletionMenuProps> = ({ anchor, listId, items, prefix, activeIndex, onAccept, onActiveIndexChange, onDismiss }) => {
  const [position, setPosition] = useState<React.CSSProperties | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = items[activeIndex];

  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewTop = viewport?.offsetTop ?? 0;
      const viewLeft = viewport?.offsetLeft ?? 0;
      const viewWidth = viewport?.width ?? window.innerWidth;
      const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
      if (!rect.height || rect.bottom < viewTop || rect.top > viewBottom) {
        onDismiss();
        return;
      }
      const above = rect.top - viewTop - 12;
      const below = viewBottom - rect.bottom - 12;
      const placeAbove = above > below;
      const height = Math.min(320, placeAbove ? above : below);
      const width = Math.min(620, viewWidth - 16);
      setPosition({
        position: 'fixed', zIndex: 100, width, maxHeight: Math.max(80, height),
        left: Math.max(viewLeft + 8, Math.min(rect.left, viewLeft + viewWidth - width - 8)),
        ...(placeAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchor, onDismiss]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [activeIndex]);

  if (!position || !selected) return null;
  return createPortal(
    <div style={position} className="flex flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white text-slate-700 shadow-[0_16px_50px_rgba(15,23,42,0.2)]" onPointerDown={(event) => event.preventDefault()} data-testid="geogebra-completion-menu">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500"><span className="font-semibold text-sky-700">{prefix ? `Matching “${prefix}”` : 'Available commands'}</span><span>{items.length} suggestions</span></div>
      <div ref={listRef} id={listId} role="listbox" aria-label="Command suggestions" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {items.map((item, index) => {
          const matchLength = item.label.toLowerCase().startsWith(prefix.toLowerCase()) ? prefix.length : 0;
          return <div key={completionItemKey(item)} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex} onPointerMove={() => onActiveIndexChange(index)} onClick={() => onAccept(index)} className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs ${index === activeIndex ? 'bg-sky-100 text-sky-900' : 'hover:bg-slate-50'}`}><span className="min-w-0 truncate font-mono"><strong className="text-sky-700">{item.label.slice(0, matchLength)}</strong>{item.label.slice(matchLength)}{item.callable !== false && <span className="text-slate-400">()</span>}</span><span className="shrink-0 rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-500">{item.kind === 'object' ? geometryTypeLabel(item.objectType) : item.kind === 'api' ? 'API' : item.kind === 'custom' ? 'Custom' : 'GGB'}</span></div>;
        })}
      </div>
      {(selected.description || selected.signatures?.length) && <div className="max-h-24 shrink-0 overflow-auto border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{selected.description && <p className="ggb-completion-description" title={selected.description}>{selected.kind === 'object' && <span className="ggb-completion-definition-label">Definition</span>}{selected.description}</p>}{selected.signatures?.map((signature) => <p key={signature} className="mt-1 whitespace-pre-wrap break-words font-mono text-slate-700">{signature}</p>)}</div>}
      <div className="shrink-0 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">↑↓ navigate · Tab / Enter complete · Esc dismiss</div>
    </div>,
    document.body,
  );
};

export default GeoGebraCompletionMenu;
