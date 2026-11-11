import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../../../../types';
import { executeCommandPipeline } from '../../../commandPipeline';
import { isInternalHelperName } from '../../internalHelpers';
import { verifiedHelpers } from '../../helperLifecycle';

const makeEngine = (createOutput: boolean) => {
  const objects = new Map<string, string>(['f', 'g', 'h', 'j', 'k'].map((name) => [name, 'line']));
  const callApi = vi.fn(async (method: string, args: unknown[]) => {
    const name = String(args[0]);
    if (method === 'getAllObjectNames') return [...objects.keys()];
    if (method === 'getObjectType') return objects.get(name);
    if (method === 'getXML') return `<element type="${objects.get(name)}" label="${name}"/>`;
    if (method === 'getFileJSON') return { archive: [] };
    if (method === 'setUndoPoint' || method === 'setAuxiliary' || method === 'setVisible' || method === 'setLabelVisible') return undefined;
    if (method === 'deleteObject') { objects.delete(name); return undefined; }
    throw new Error(`Unexpected call ${method}`);
  });
  const executeCommand = vi.fn(async (command: string) => {
    for (const line of command.split('\n')) {
      const match = /^([\w]+)=/u.exec(line);
      if (match && (isInternalHelperName(match[1]) || createOutput)) {
        const type = isInternalHelperName(match[1]) ? line.includes('=TriangleCenter(') ? 'point' : 'numeric' : 'conic';
        objects.set(match[1], type);
      }
    }
    return { success: true, command, labels: [...objects.keys()].filter((name) => isInternalHelperName(name) || name === 'out'), timestamp: 0 };
  });
  return { objects, callApi, executeCommand, engine: { callApi, executeCommand } as unknown as GeoGebraEngine };
};

describe('named command execution', () => {
  it('recognizes only marked geometric helpers after a file reload', () => {
    const marked = 'ggbaux0123456789abcdefnv1';
    const unmarked = 'ggbaux0123456789abcdefnv2';
    const xml = `<element type="point" label="${marked}"><auxiliary val="true" /></element><element type="point" label="${unmarked}"><auxiliary val="false" /></element>`;
    expect(verifiedHelpers(xml, [marked, unmarked])).toEqual([marked]);
  });
  it('hides internal labels and commits one undo step', async () => {
    const { engine, objects, callApi } = makeEngine(true);
    const result = await executeCommandPipeline(engine, 'out=Conic(f,g,h,j,k)', { allowNonGeometricHelpers: true });
    expect(result.success).toBe(true);
    expect(result.labels).toContain('out');
    expect(result.labels.every((name) => !isInternalHelperName(name))).toBe(true);
    expect([...objects.keys()].filter(isInternalHelperName)).toHaveLength(36);
    expect(callApi.mock.calls.filter(([method]) => method === 'setUndoPoint')).toHaveLength(2);
    expect(callApi.mock.calls.filter(([method]) => method === 'setAuxiliary')).toHaveLength(36);
  });

  it('rolls back helpers when native GeoGebra reports success without an output', async () => {
    const { engine, objects, executeCommand } = makeEngine(false);
    const execute = executeCommand.getMockImplementation()!;
    executeCommand.mockImplementation(async (command) => {
      const result = await execute(command);
      objects.set('unrelated', 'point');
      return result;
    });
    const result = await executeCommandPipeline(engine, 'out=Conic(f,g,h,j,k)', { allowNonGeometricHelpers: true });
    expect(result.success).toBe(false);
    expect([...objects.keys()].filter(isInternalHelperName)).toHaveLength(0);
    expect(objects.has('out')).toBe(false);
    expect(objects.has('unrelated')).toBe(true);
  });

  it.each(['low', 'high'] as const)('commits all unpacked labels in one %s execution', async (helperMode) => {
    const { engine, objects, callApi, executeCommand } = makeEngine(true);
    for (const label of ['A', 'B', 'C']) objects.set(label, 'point');
    const result = await executeCommandPipeline(engine, '(D,E,F)=IntouchTriangle(A,B,C)', { helperMode });
    expect(result.success).toBe(true);
    expect(result.labels).toEqual(['D', 'E', 'F']);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(callApi.mock.calls.filter(([method]) => method === 'setUndoPoint')).toHaveLength(2);
    expect([...objects.keys()].filter(isInternalHelperName)).toHaveLength(helperMode === 'high' ? 1 : 0);
  });

  it('rolls back a partially created unpack without deleting unrelated objects', async () => {
    const { engine, objects, executeCommand } = makeEngine(true);
    for (const label of ['A', 'B', 'C']) objects.set(label, 'point');
    const execute = executeCommand.getMockImplementation()!;
    executeCommand.mockImplementation(async (command) => {
      const result = await execute(command);
      objects.delete('E');
      objects.set('unrelated', 'point');
      return result;
    });
    const result = await executeCommandPipeline(engine, '(D,E,F)=IntouchTriangle(A,B,C)', { helperMode: 'high' });
    expect(result.success).toBe(false);
    expect(result.labels).toEqual([]);
    expect([...objects.keys()].filter(isInternalHelperName)).toHaveLength(0);
    expect(objects.has('D') || objects.has('F')).toBe(false);
    expect(objects.has('unrelated')).toBe(true);
  });
});
