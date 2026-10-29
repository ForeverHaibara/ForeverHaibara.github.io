import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../../../types';
import { executeCommandPipeline } from '../../commandPipeline';
import { isInternalHelperName } from '../internalHelpers';

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
      if (match && (isInternalHelperName(match[1]) || createOutput)) objects.set(match[1], isInternalHelperName(match[1]) ? 'numeric' : 'conic');
    }
    return { success: true, command, labels: [...objects.keys()].filter((name) => isInternalHelperName(name) || name === 'out'), timestamp: 0 };
  });
  return { objects, callApi, executeCommand, engine: { callApi, executeCommand } as unknown as GeoGebraEngine };
};

describe('named command execution', () => {
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
});
