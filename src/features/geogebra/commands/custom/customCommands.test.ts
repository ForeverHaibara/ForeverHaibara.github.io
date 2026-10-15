import { describe, expect, it, vi } from 'vitest';
import type { EngineEventListener, GeoGebraEngine } from '../../types';
import { executeCommandPipeline } from '../commandPipeline';
import { getCompletionContext } from '../completion/completionContext';
import { studioCompletionRegistry } from '../completion/studioCompletionRegistry';
import { compileStudioCommand, containsStudioCall } from './commandCompiler';
import { normalizeGeometryType, readFileTools } from './commandEnvironment';
import { outerCalls, splitTopLevel } from './commandSyntax';
import { selectOverload, studioToolLibrary, studioTools, validateToolLibrary } from './toolLibrary';
import type { CommandEnvironment, GeometryType } from './types';

const environment = (): CommandEnvironment => ({
  objects: new Map<string, GeometryType>([['A', 'point'], ['B', 'point'], ['C', 'point'], ['D', 'point'], ['E', 'point'], ['P', 'point'], ['l', 'line'], ['m', 'line'], ['n', 'line'], ['o', 'line'], ['r', 'line'], ['s', 'segment'], ['t', 'ray'], ['circle', 'circle']]),
  macros: new Set(),
});
const compile = (source: string, scope = environment()) => compileStudioCommand(source, scope);

describe('custom command syntax and dispatch', () => {
  it('preserves quoted text, comments, native bracket syntax and declarations', () => {
    expect(containsStudioCall('Text("Incenter(A,B,C)") // Incenter(A,B,C)')).toBe(false);
    expect(containsStudioCall('Incenter(x)=x^2')).toBe(false);
    expect(compile('Foo["a,b",Incenter[A,B,C]]')).toBe('Foo["a,b",TriangleCenter((A),(B),(C),1)]');
    expect(splitTopLevel('a=(1,2)\nb=Incenter(\nA,B,C\n)', '\n')).toHaveLength(2);
    expect(() => outerCalls('Incenter(A,B,C]')).toThrow('brackets');
  });

  it('supports nested typed calls, point literals, parentheses and case-insensitive names', () => {
    expect(compile('I=incenter(A,B,Midpoint(C,D))')).toBe('I=TriangleCenter((A),(B),(Midpoint(C,D)),1)');
    expect(compile('Incenter((1,2),B,((Incenter(A,B,C))))')).toBe('TriangleCenter(((1,2)),(B),(((TriangleCenter((A),(B),(C),1)))),1)');
    expect(compile('Incenter(A,(B+C)/2,2*Midpoint(A,C))')).toContain('TriangleCenter((A),((B+C)/2),(2*Midpoint(A,C)),1)');
    expect(compile('Incenter(A,((B)+(C))/2,C)')).toContain('TriangleCenter');
  });

  it('gives user macros and case-sensitive construction callables priority', () => {
    const scope = environment();
    scope.macros.add('incenter');
    expect(compile('Incenter(A,B,C)', scope)).toBe('Incenter(A,B,C)');
    scope.macros.clear();
    scope.objects.set('Incenter', 'function');
    expect(compile('Incenter(A,B,C)', scope)).toBe('Incenter(A,B,C)');
    expect(compile('incenter(A,B,C)', scope)).toContain('TriangleCenter');
  });

  it('infers local Zip types and does not mistake a numeric local for a global point', () => {
    expect(compile('Zip(Incenter(T,B,C),T,{A,P})')).toContain('TriangleCenter((T),(B),(C),1)');
    expect(() => compile('Zip(Incenter(A,B,C),A,{1,2})')).toThrow('number, point, point');
    expect(compile('Incenter(A,B,Element({C,D},1))')).toContain('TriangleCenter');
  });

  it('rejects unmatched custom overloads and retains native coefficient Conic forms', () => {
    expect(() => compile('Incenter(A,l,C)')).toThrow('No overload');
    expect(compile('Conic(1,2,3,4,5,6)')).toBe('Conic(1,2,3,4,5,6)');
    expect(compile('Conic({1,2,3,4,5,6})')).toBe('Conic({1,2,3,4,5,6})');
    expect(() => compile('SecondIntersection(Conic(A,B,C,D,E),A,B)')).toThrow('No overload');
  });

  it('selects mixed Conic overloads in every point/line order', () => {
    const tool = studioTools.get('conic')!;
    for (let mask = 0; mask < 32; mask += 1) {
      const args = Array.from({ length: 5 }, (_, i) => ({ expression: 'ABCDE'[i], type: (mask & (1 << i) ? 'point' : 'line') as GeometryType }));
      const overload = selectOverload(tool, args)!;
      expect(overload.returns).toBe(mask === 0 || mask === 31 ? 'conic' : 'list');
      const scope = environment();
      args.forEach((arg) => scope.objects.set(arg.expression, arg.type));
      const expression = compile('Conic(A,B,C,D,E)', scope);
      expect(expression.length).toBeLessThan(100_000);
      expect(expression).not.toMatch(/(?:SetValue|SetCoords|Execute|Delete|studiolocal\d+\s*=)/u);
    }
  });

  it('extends segments and rays to supporting lines without creating named objects', () => {
    const expression = compile('Conic(A,s,B,t,C)');
    expect(expression).toContain('Line(Point(s,0),Point(s,0.5))');
    expect(expression).toContain('Line(Point(t,0),Point(t,0.5))');
    expect(expression).toContain('RemoveUndefined');
  });

  it('allocates hygienic locals and retains the original point dependencies', () => {
    const source = 'IsogonalConjugate(A,B,C,studiolocal1)';
    const scope = environment();
    scope.objects.set('studiolocal1', 'point');
    const expression = compile(source, scope);
    expect(expression).toContain('x(studiolocal1)');
    expect(expression).not.toContain('studiolocal1,{');
    expect(expression).toContain('Distance(B,C)^2');
  });
});

describe('tool library and completion', () => {
  it('validates locals and rejects malformed or ambiguous libraries', () => {
    const value = structuredClone(studioToolLibrary);
    value.tools[0].overloads[0].expression = '$missing';
    expect(() => validateToolLibrary(value)).toThrow('Unknown or forward local');
    const tool = structuredClone(studioToolLibrary.tools[0]);
    tool.overloads.push(tool.overloads[0]);
    expect(() => selectOverload(tool, ['A', 'B', 'C'].map((expression) => ({ expression, type: 'point' })))).toThrow('Ambiguous');
  });

  it('registers every tool and prioritizes site Conic help over native help', async () => {
    const context = getCompletionContext('', 0, 0, true)!;
    const items = await studioCompletionRegistry.complete(context, new AbortController().signal);
    for (const tool of studioToolLibrary.tools) expect(items.find((item) => item.label === tool.name)?.kind).toBe('custom');
    expect(items.find((item) => item.label === 'Conic')?.signatures).toHaveLength(5);
  });

  it('normalizes engine types without collapsing directed line-like objects too early', () => {
    expect(normalizeGeometryType('GeoSegment')).toBe('segment');
    expect(normalizeGeometryType('ray')).toBe('ray');
    expect(normalizeGeometryType('circle')).toBe('circle');
    expect(normalizeGeometryType('point3d')).toBe('unknown');
  });

  it('caches archive metadata until a file/tool event, not until the next drag', async () => {
    let listener!: EngineEventListener;
    const callApi = vi.fn().mockResolvedValue({ archive: [] });
    const engine = { callApi, subscribe: (callback: EngineEventListener) => { listener = callback; return () => {}; } } as unknown as GeoGebraEngine;
    await readFileTools(engine);
    await readFileTools(engine);
    listener({ type: 'update', timestamp: 0 });
    await readFileTools(engine);
    expect(callApi).toHaveBeenCalledTimes(1);
    listener({ type: 'toolsChanged', timestamp: 0 });
    await readFileTools(engine);
    listener({ type: 'clear', timestamp: 0 });
    await readFileTools(engine);
    expect(callApi).toHaveBeenCalledTimes(3);
  });
});

describe('command execution boundary', () => {
  const engineMock = () => {
    const scope = environment();
    const callApi = vi.fn(async (method: string, args: unknown[]) => {
      if (method === 'getAllObjectNames') return [...scope.objects.keys()];
      if (method === 'getObjectType') return scope.objects.get(String(args[0]));
      if (method === 'getFileJSON') return { archive: [] };
      throw new Error(`Unexpected mutation or numeric sampling: ${method}`);
    });
    const executeCommand = vi.fn(async (command: string) => ({ success: true, command, labels: ['I'], timestamp: 0 }));
    return { scope, callApi, executeCommand, engine: { callApi, executeCommand } as unknown as GeoGebraEngine };
  };

  it('passes native commands through without archive or object reads', async () => {
    const { engine, callApi, executeCommand } = engineMock();
    await executeCommandPipeline(engine, 'Line(A,B)');
    expect(executeCommand).toHaveBeenCalledWith('Line(A,B)');
    expect(callApi).not.toHaveBeenCalled();
  });

  it('only reads types and tool names, and submits a dependent expression', async () => {
    const { engine, callApi, executeCommand } = engineMock();
    const result = await executeCommandPipeline(engine, 'I=Incenter(A,B,C)');
    expect(executeCommand).toHaveBeenCalledWith('I=TriangleCenter((A),(B),(C),1)');
    expect(result.command).toBe('I=Incenter(A,B,C)');
    expect(result.expandedCommand).toContain('TriangleCenter');
    expect(callApi.mock.calls.every(([name]) => ['getAllObjectNames', 'getObjectType', 'getFileJSON'].includes(name))).toBe(true);
  });

  it('resolves later batch statements after earlier construction mutations', async () => {
    const { engine, scope, executeCommand } = engineMock();
    executeCommand.mockImplementation(async (command: string) => {
      if (command === 'Z=(1,2)') scope.objects.set('Z', 'point');
      return { success: true, command, labels: [], timestamp: 0 };
    });
    await executeCommandPipeline(engine, 'Z=(1,2)\nI=Incenter(A,B,Z)');
    expect(executeCommand.mock.calls[1][0]).toContain('TriangleCenter((A),(B),(Z),1)');
  });

  it('does not risk overriding user tools when archive metadata cannot be read', async () => {
    const { engine, callApi, executeCommand } = engineMock();
    callApi.mockImplementation(async (method: string) => {
      if (method === 'getAllObjectNames') return [];
      throw new Error('Tool metadata unavailable');
    });
    const result = await executeCommandPipeline(engine, 'Incenter(A,B,C)');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool metadata unavailable');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('retains earlier labels when a later statement fails to compile', async () => {
    const { engine, executeCommand } = engineMock();
    executeCommand.mockResolvedValue({ success: true, command: 'Z=(1,2)', labels: ['Z'], timestamp: 0 });
    const result = await executeCommandPipeline(engine, 'Z=(1,2)\nIncenter(A,l,C)');
    expect(result.success).toBe(false);
    expect(result.labels).toEqual(['Z']);
    expect(result.expandedCommand).toBe('Z=(1,2)');
    expect(executeCommand).toHaveBeenCalledOnce();
  });
});
