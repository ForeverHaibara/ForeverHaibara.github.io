import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CloseScope, WorkspaceSnapshot } from '../../persistence/workspace';
import StudioIcon from './StudioIcon';

interface Props {
  workspace: WorkspaceSnapshot | null;
  disabled: boolean;
  onSwitch(id: string): Promise<void>;
  onNew(): Promise<void>;
  onClose(id: string, scope: CloseScope): Promise<void>;
}

const actions: Array<{ scope: CloseScope; label: string }> = [
  { scope: 'one', label: 'Close' }, { scope: 'others', label: 'Close Others' },
  { scope: 'right', label: 'Close to the Right' }, { scope: 'left', label: 'Close to the Left' },
  { scope: 'all', label: 'Close All' },
];

export default function DocumentTabs({ workspace, disabled, onSwitch, onNew, onClose }: Props) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const index = workspace?.documents.findIndex((doc) => doc.id === menu?.id) ?? -1;
  const count = workspace?.documents.length ?? 0;
  const available = (scope: CloseScope) => scope === 'others' ? count > 1 : scope === 'left' ? index > 0 : scope === 'right' ? index >= 0 && index < count - 1 : index >= 0;
  const dismiss = (restore = false) => { setMenu(null); if (restore) triggerRef.current?.focus(); };
  useLayoutEffect(() => { if (menu) menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const resize = () => setMenu(null);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', resize, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); window.removeEventListener('scroll', resize, true); };
  }, [menu]);
  useEffect(() => { if (disabled) setMenu(null); }, [disabled]);
  const run = (action: Promise<void>) => void action.catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Could not update constructions.'));
  const close = (id: string, scope: CloseScope) => {
    dismiss();
    const label = actions.find((action) => action.scope === scope)!.label;
    if (window.confirm(`${label}? Closed tabs and their browser drafts will be removed.`)) run(onClose(id, scope));
  };
  const openMenu = (id: string, x: number, y: number, trigger: HTMLElement) => {
    if (disabled) return;
    triggerRef.current = trigger;
    setMenu({ id, x: Math.max(8, Math.min(x, window.innerWidth - 200)), y: Math.max(8, Math.min(y, window.innerHeight - 210)) });
  };
  return <div className="ggb-document-bar" aria-label="Open constructions">
    <div className="ggb-document-tabs">{workspace?.documents.map((doc) => <div className="ggb-document-tab" data-active={doc.id === workspace.activeId} key={doc.id} onContextMenu={(event) => { event.preventDefault(); openMenu(doc.id, event.clientX, event.clientY, event.currentTarget.querySelector('button')!); }}>
      <button type="button" className="ggb-document-select" disabled={disabled} aria-current={doc.id === workspace.activeId ? 'page' : undefined} title={`${doc.title} · Right-click for tab actions`} onClick={() => run(onSwitch(doc.id))} onKeyDown={(event) => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(doc.id, rect.left, rect.bottom, event.currentTarget); } }}><StudioIcon name="geometry" size={15} /><span>{doc.title}</span></button>
      <button type="button" className="ggb-document-close" disabled={disabled} aria-label={`Close ${doc.title}`} title={`Close ${doc.title}`} onClick={() => close(doc.id, 'one')}>×</button>
    </div>)}</div>
    <button type="button" className="ggb-document-add" disabled={disabled} aria-label="New construction" title="New construction" onClick={() => run(onNew())}>+</button>
    {menu && createPortal(<div ref={menuRef} className="ggb-document-menu" role="menu" aria-label="Construction tab actions" style={{ left: menu.x, top: menu.y }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(true); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>{actions.map(({ scope, label }) => <button type="button" role="menuitem" key={scope} disabled={!available(scope)} onClick={() => close(menu.id, scope)}>{label}</button>)}</div>, document.body)}
  </div>;
}
