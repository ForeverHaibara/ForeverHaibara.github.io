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
