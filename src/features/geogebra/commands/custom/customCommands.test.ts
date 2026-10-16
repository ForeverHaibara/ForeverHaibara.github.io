import { describe, expect, it, vi } from 'vitest';
import type { EngineEventListener, GeoGebraEngine } from '../../types';
import { executeCommandPipeline } from '../commandPipeline';
import { getCompletionContext } from '../completion/completionContext';
import { studioCompletionRegistry } from '../completion/studioCompletionRegistry';
import { compileStudioCommand, containsStudioCall } from './commandCompiler';
import { normalizeGeometryType, readFileTools } from './commandEnvironment';
import { outerCalls, splitTopLevel } from './commandSyntax';
import { selectOverload, studioToolLibrary, studioTools, validateToolLibrary } from './toolLibrary';
import type { CommandEnvironment, GeometryType, ToolDefinition, ToolOverload } from './types';

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
    expect(compile('SecondIntersection(Conic(A,B,C,D,E),A,B)')).toContain('ConjugateDiameter');
  });

  it('selects mixed Conic overloads in every point/line order', () => {
    const tool = studioTools.get('conic')!;
    for (let mask = 0; mask < 32; mask += 1) {
      const args = Array.from({ length: 5 }, (_, i) => ({ expression: 'ABCDE'[i], type: (mask & (1 << i) ? 'point' : 'line') as GeometryType }));
      const overload = selectOverload(tool, args)!;
      expect(overload.returns).toBe('conic');
      const scope = environment();
      args.forEach((arg) => scope.objects.set(arg.expression, arg.type));
      const expression = compile('Conic(A,B,C,D,E)', scope);
      const pointCount = args.filter((arg) => arg.type === 'point').length;
      expect(expression.split('\n')).toHaveLength(pointCount === 0 || pointCount === 5 ? 1 : pointCount === 1 || pointCount === 4 ? 2 : 4);
      expect(expression.length).toBeLessThan(100_000);
      expect(expression).not.toMatch(/(?:SetValue|SetCoords|Execute|Delete|v\d+\s*=)/u);
    }
  });

  it('emits separate top-level conics while assignments label the first output only', () => {
    const lines = compile('K=Conic(A,B,C,l,m)').split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^K=Element\(/u);
    expect(lines.slice(1).every((line) => line.startsWith('Element('))).toBe(true);
    expect(lines.every((line, i) => line.endsWith(`,${i + 2})`))).toBe(true);
    expect(lines.every((line) => line.includes('Join({Conic({1,1,0/0,0,0,0})}'))).toBe(true);
  });

  it('selects one conic in nested expressions or with an explicit 1-based index', () => {
    const nested = compile('SecondIntersection(Conic(A,B,C,l,m),A,P)');
    expect(nested).not.toContain('\n');
    expect(nested).toContain('ConjugateDiameter');
    const selected = compile('K=Conic(A,B,C,l,m,2)');
    expect(selected).not.toContain('\n');
    expect(selected).toMatch(/,\(2\)\+1\)$/u);
    expect(compile('Conic(A,B,C,D,E,1)')).toBe('Element({Conic(A,B,C,D,E)},1)');
  });

  it('uses the same conjugate-diameter construction for circles and all conics', () => {
    const scope = environment();
    scope.objects.set('ellipse', 'conic');
    expect(compile('SecondIntersection(circle,A,B)')).toBe('Reflect((A),Intersect(Line((A),(B)),ConjugateDiameter(Line((A),(B)),(circle))))');
    expect(compile('SecondIntersection(ellipse,A,B)', scope)).toContain('ConjugateDiameter(Line((A),(B)),(ellipse))');
    expect(studioTools.get('secondintersection')?.overloads).toHaveLength(2);
  });

  it('extends segments and rays to supporting lines without creating named objects', () => {
    const expression = compile('Conic(A,s,B,t,C)');
    expect(expression).toContain('Line(Point(s,0.25),Point(s,0.5))');
    expect(expression).toContain('Line(Point(t,0.25),Point(t,0.5))');
    expect(expression).toContain('RemoveUndefined');
  });

  it('allocates hygienic locals and retains the original point dependencies', () => {
    const source = 'IsogonalConjugate(A,B,C,v1)';
    const scope = environment();
    scope.objects.set('v1', 'point');
    scope.objects.set('v2', 'number');
    const expression = compile(source, scope);
    expect(expression).toContain('x(v1)');
    expect(expression).not.toMatch(/,v[12],\{/u);
    expect(expression).toContain(',v3,{');
    expect(expression).not.toContain('studiolocal');
    expect(expression).toContain('Distance(B,C)^2');
  });

  it('avoids capturing source-local names across nested symbolic constructions', () => {
    const expression = compile('Zip(IsogonalConjugate(A,B,C,IsogonalConjugate(A,B,C,v1)),v1,{P})');
    // The only v1 binding belongs to the original Zip, not to either expansion.
    expect(expression.match(/,v1,\{/gu)).toHaveLength(1);
    expect(expression).toContain('x(v1)');
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
    expect(items.find((item) => item.label === 'Conic')?.signatures).toHaveLength(6);
  });

  it('normalizes engine types without collapsing directed line-like objects too early', () => {
    expect(normalizeGeometryType('GeoSegment')).toBe('segment');
    expect(normalizeGeometryType('ray')).toBe('ray');
    expect(normalizeGeometryType('circle')).toBe('circle');
    for (const type of ['Ellipse', 'Hyperbola', 'Parabola', 'IntersectingLines', 'ParallelLines', 'DoubleLine', 'EmptySet']) {
      expect(normalizeGeometryType(type)).toBe('conic');
    }
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

describe('reusable tool definitions and P1 outputs', () => {
  const definition = (name: string, compose: ToolOverload['compose']): ToolDefinition => ({
    name, description: name, overloads: [{ params: [{ name: 'P', type: 'point' }], returns: 'point', compose }],
  });

  it('composes with typed arguments without allowing file tools or caller labels to replace dependencies', () => {
    const scope = environment();
    scope.macros.add('circumcenter');
    scope.objects.set('Orthocenter', 'function');
    const expression = compile('NinePointCenter(A,B,C)', scope);
    expect(expression).toContain('TriangleCenter');
    expect(expression).not.toMatch(/Circumcenter|Orthocenter/u);
    expect(compile('Circumcenter(A,B,C)', scope)).toBe('Circumcenter(A,B,C)');
    expect(compile('Centroid(Polygon(A,B,C))')).toBe('Centroid(Polygon(A,B,C))');
  });

  it('retains native implementations inside dependencies and preserves arguments already compiled by the caller', () => {
    const native = { ...definition('Native', undefined), overloads: [{ params: [{ name: 'P', type: 'point' as const }], returns: 'point' as const, expression: 'Centroid($P,$P,$P)' }] };
    const wrapped = definition('Wrapped', 'Native($P)');
    const tools = new Map([native, wrapped].map((tool) => [tool.name.toLowerCase(), tool]));
    expect(compileStudioCommand('Wrapped(A)', environment(), tools)).toMatch(/^Centroid\(/u);
    const source = 'CircumcevianTriangle(A,B,C,IsogonalConjugate(A,B,C,P),1)';
    const expression = compile(source);
    expect(expression).not.toMatch(/IsogonalConjugate|Circumcevian/u);
    expect(expression).toContain('ConjugateDiameter');
    expect(expression.length).toBeLessThan(30_000);
  });

  it('detects direct and indirect cycles, while allowing distinct overloads of the same tool', () => {
    for (const tools of [
      [definition('Loop', 'Loop($P)')],
      [definition('Loop', 'Other($P)'), definition('Other', 'Loop($P)')],
    ]) {
      expect(() => compileStudioCommand('Loop(A)', environment(), new Map(tools.map((tool) => [tool.name.toLowerCase(), tool])))).toThrow('Cyclic tool composition');
    }
    expect(compile('Antipode(A,B,C)')).toContain('Reflect');
  });

  it('keeps dependency locals hygienic in the presence of user Zip bindings and long point labels', () => {
    const scope = environment();
    scope.objects.set('PointAlpha', 'point');
    scope.objects.set('v1', 'point');
    const expression = compile('Zip(NinePointCircle(PointAlpha,B,v2),v2,{C,D})', scope);
    expect(expression.match(/,v2,\{/gu)).toHaveLength(1);
    expect(expression).toContain('PointAlpha');
    expect(expression).not.toMatch(/NinePoint|Circumcenter|Orthocenter/u);
    expect(compile('Excircle(PointAlpha,B,C)', scope)).toContain('Distance');
  });

  it('emits each triangle vertex or circle as an independent object and keeps nested results scalar', () => {
    for (const [name, arguments_, count] of [
      ['Excenters', 'A,B,C', 3], ['Excircles', 'A,B,C', 3], ['BrocardPoints', 'A,B,C', 2],
      ['MedialTriangle', 'A,B,C', 3], ['OrthicTriangle', 'A,B,C', 3], ['CevianTriangle', 'A,B,C,P', 3],
      ['PedalTriangle', 'A,B,C,P', 3], ['IntouchTriangle', 'A,B,C', 3], ['AnticevianTriangle', 'A,B,C,P', 3],
      ['CircumcevianTriangle', 'A,B,C,P', 3], ['TangentialTriangle', 'A,B,C', 3],
      ['AntipedalTriangle', 'A,B,C,P', 3], ['CarnotTriangle', 'A,B,C,P', 3], ['DiagonalPoints', 'A,B,C,D', 3],
    ] as const) {
      const outputs = compile(`Result=${name}(${arguments_})`).split('\n');
      expect(outputs, name).toHaveLength(count);
      expect(outputs[0], name).toMatch(/^Result=/u);
      expect(outputs.slice(1).every((line) => !line.startsWith('Result=')), name).toBe(true);
      expect(compile(`${name}(${arguments_},2)`), name).not.toContain('\n');
      expect(compile(`Line(${name}(${arguments_}),P)`), name).not.toContain('\n');
      expect(outputs.every((line) => line.length < 30_000), name).toBe(true);
    }
  });

  it('compiles every catalog signature and excludes the explicitly rejected tools', () => {
    const scope = environment();
    scope.objects.set('curve', 'implicitCurve');
    for (const tool of studioToolLibrary.tools) for (const overload of tool.overloads) {
      if (['conic', 'conicBranch'].includes(overload.builder ?? '')) continue;
      const fixtures: Partial<Record<ToolOverload['params'][number]['type'], string>> = { point: 'A', circle: 'circle', conic: 'circle', implicitCurve: 'curve', lineLike: 's', number: '1' };
      const arguments_ = overload.params.map((param) => fixtures[param.type]);
      expect(arguments_.every(Boolean), tool.name).toBe(true);
      expect(() => compile(`${tool.name}(${arguments_.join(',')})`, scope), tool.name).not.toThrow();
    }
    expect(studioTools.has('complementofisotomicconjugate')).toBe(false);
    expect(studioTools.has('circumsymmedianpoint')).toBe(false);
    expect(studioTools.get('directsimilarity')?.overloads).toHaveLength(2);
    expect(studioTools.get('oppositesimilarity')?.overloads).toHaveLength(2);
    expect(compile('Antipode(circle,A)')).toContain('Center');
    expect(compile('NorthPole(A,B,C)')).toContain('ConjugateDiameter');
  });

  it('validates composition implementations, placeholders and local order', () => {
    for (const invalid of [
      { compose: [] }, { compose: '' }, { compose: '$missing' }, { compose: 'Loop($P)', expression: '$P' },
      { compose: '$later', locals: [{ name: 'earlier', expression: '$later' }, { name: 'later', expression: '$P' }] },
    ]) {
      const tool = definition('Loop', '$P');
      Object.assign(tool.overloads[0], invalid);
      expect(() => validateToolLibrary({ schemaVersion: 1, id: 'test', version: '1', tools: [tool] })).toThrow();
    }
  });
});

describe('command execution boundary', () => {
  const engineMock = () => {
    const scope = environment();
    const callApi = vi.fn(async (method: string, args: unknown[]) => {
      if (method === 'getAllObjectNames') return [...scope.objects.keys()];
      if (method === 'getObjectType') return scope.objects.get(String(args[0]));
      if (method === 'getXML') return `<element type="${scope.objects.get(String(args[0]))}" label="${args[0]}"/>`;
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
    expect(callApi.mock.calls.every(([name]) => ['getAllObjectNames', 'getObjectType', 'getXML', 'getFileJSON'].includes(name))).toBe(true);
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
