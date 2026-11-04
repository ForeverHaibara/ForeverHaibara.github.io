import type { ManagedStyles } from '../settings/types';
import type { GeometryProjectRecord } from '../types';

export interface WorkspaceDocument {
  id: string;
  title: string;
  ggbBase64: string | null;
  managedStyles?: ManagedStyles;
}
export interface WorkspaceSnapshot {
  version: 1;
  activeId: string;
  documents: WorkspaceDocument[];
}

export function newDocument(title = 'Untitled'): WorkspaceDocument {
  return { id: crypto.randomUUID(), title, ggbBase64: null };
}

export function uniqueTitle(documents: WorkspaceDocument[], base: string): string {
  const names = new Set(documents.map((doc) => doc.title));
  if (!names.has(base)) return base;
  let number = 2;
  while (names.has(`${base} ${number}`)) number += 1;
  return `${base} ${number}`;
}

export function restoreWorkspace(value: WorkspaceSnapshot | null, legacy: GeometryProjectRecord | null): WorkspaceSnapshot {
  if (value?.version === 1 && Array.isArray(value.documents)) {
    const documents = value.documents.filter((doc) => doc && typeof doc.id === 'string' && typeof doc.title === 'string' && (doc.ggbBase64 === null || typeof doc.ggbBase64 === 'string'));
    if (documents.length && new Set(documents.map((doc) => doc.id)).size === documents.length) {
      return { version: 1, documents, activeId: documents.some((doc) => doc.id === value.activeId) ? value.activeId : documents[0].id };
    }
  }
  const doc = legacy?.ggbBase64 ? { id: newDocument().id, title: 'Previous draft', ggbBase64: legacy.ggbBase64, managedStyles: legacy.managedStyles } : newDocument();
  return { version: 1, activeId: doc.id, documents: [doc] };
}

export type CloseScope = 'one' | 'others' | 'right' | 'left' | 'all';

/** Compute a single atomic close operation, retaining the active document when possible. */
export function closeDocuments(current: WorkspaceSnapshot, anchorId: string, scope: CloseScope): { next: WorkspaceSnapshot; target?: WorkspaceDocument } {
  const index = current.documents.findIndex((doc) => doc.id === anchorId);
  if (index < 0) return { next: current };
  const documents = current.documents.filter((doc, i) => {
    switch (scope) {
      case 'one': return doc.id !== anchorId;
      case 'others': return doc.id === anchorId;
      case 'right': return i <= index;
      case 'left': return i >= index;
      case 'all': return false;
    }
  });
  if (documents.length === current.documents.length) return { next: current };
  if (!documents.length) documents.push(newDocument());
  const activeIndex = current.documents.findIndex((doc) => doc.id === current.activeId);
  const target = documents.some((doc) => doc.id === current.activeId) ? undefined : documents[Math.min(activeIndex, documents.length - 1)];
  return { next: { ...current, documents, activeId: target?.id ?? current.activeId }, target };
}

/** Safe across common desktop filesystems while preserving Unicode titles. */
export function constructionFilename(title: string): string {
  let name = title.replace(/\.ggb$/i, '').replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, '_').replace(/[. ]+$/g, '').trim();
  if (!name || /^\.+$/.test(name)) name = 'Untitled';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  const encoder = new TextEncoder();
  let shortened = '';
  for (const character of name) {
    if (encoder.encode(shortened + character).length > 200) break;
    shortened += character;
  }
  name = shortened.replace(/[. ]+$/g, '') || 'Untitled';
  return `${name}.ggb`;
}

export function reorderDocuments(current: WorkspaceSnapshot, draggedId: string, targetId: string, side: 'before' | 'after'): WorkspaceSnapshot {
  const dragged = current.documents.find((doc) => doc.id === draggedId);
  if (!dragged || draggedId === targetId || !current.documents.some((doc) => doc.id === targetId)) return current;
  const documents = current.documents.filter((doc) => doc.id !== draggedId);
  const targetIndex = documents.findIndex((doc) => doc.id === targetId);
  documents.splice(targetIndex + (side === 'after' ? 1 : 0), 0, dragged);
  return documents.every((doc, i) => doc === current.documents[i]) ? current : { ...current, documents };
}
