import { describe, expect, it } from 'vitest';
import { closeDocuments, restoreWorkspace } from './workspace';
import { DEFAULT_STUDIO_SETTINGS } from '../config';

describe('workspace restoration', () => {
  it('migrates the previous single draft and preserves its style ownership', () => {
    const result = restoreWorkspace(null, { id: 'latest', title: 'old', ggbBase64: 'Z2di', settings: DEFAULT_STUDIO_SETTINGS, updatedAt: 1, managedStyles: { A: { color: '#123456', overrides: { label: false } } } });
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({ title: 'Previous draft', ggbBase64: 'Z2di', managedStyles: { A: { overrides: { label: false } } } });
    expect(result.activeId).toBe(result.documents[0].id);
  });
  it('restores multiple documents and repairs a missing active id', () => {
    const documents = [{ id: 'a', title: 'A', ggbBase64: 'YQ==' }, { id: 'b', title: 'B', ggbBase64: null }];
    expect(restoreWorkspace({ version: 1, activeId: 'b', documents }, null)).toEqual({ version: 1, activeId: 'b', documents });
    expect(restoreWorkspace({ version: 1, activeId: 'missing', documents }, null).activeId).toBe('a');
  });
  it('starts a fresh workspace when no draft exists', () => {
    const result = restoreWorkspace(null, null);
    expect(result.documents[0]).toMatchObject({ title: 'Untitled', ggbBase64: null });
    expect(result.activeId).toBe(result.documents[0].id);
  });
});

describe('closing workspace tabs', () => {
  const documents = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, ggbBase64: id }));
  const workspace = { version: 1 as const, activeId: 'c', documents };
  it('closes the requested range in one operation and retains the active tab when possible', () => {
    expect(closeDocuments(workspace, 'b', 'left').next.documents.map((doc) => doc.id)).toEqual(['b', 'c', 'd']);
    expect(closeDocuments(workspace, 'b', 'right').next).toMatchObject({ activeId: 'b', documents: documents.slice(0, 2) });
    expect(closeDocuments(workspace, 'b', 'others').next).toMatchObject({ activeId: 'b', documents: [documents[1]] });
    expect(closeDocuments(workspace, 'b', 'one').next.activeId).toBe('c');
  });
  it('replaces the last tab with a new blank document', () => {
    const result = closeDocuments(workspace, 'b', 'all');
    expect(result.next.documents).toHaveLength(1);
    expect(result.target).toMatchObject({ title: 'Untitled', ggbBase64: null });
    expect(result.next.activeId).toBe(result.target?.id);
  });
});
