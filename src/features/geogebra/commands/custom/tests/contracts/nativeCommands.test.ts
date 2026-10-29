import { describe, expect, it } from 'vitest';
import { GEOGEBRA_COMMAND_NAMES } from '../../../completion/geogebraCommandNames';
import { compileStudioCommand, compileStudioPlan } from '../../commandCompiler';
import { outerCalls } from '../../commandSyntax';
import { studioToolLibrary } from '../../toolLibrary';
import type { CommandEnvironment, GeometryType, ParameterType } from '../../types';

// The manual's command index excludes scalar parser functions and coordinates.
// This checks names only; overload availability still needs native-engine checks.
const nativeNames = new Set([...GEOGEBRA_COMMAND_NAMES, 'x', 'y', 'z', 'abs', 'sqrt', 'sin', 'cos', 'acos', 'floor', 'conjugate']);
const unsupportedCalls = (source: string): string[] => outerCalls(source).flatMap((call) => [
  ...(!nativeNames.has(call.name) && !/^v\d+$/u.test(call.name) ? [call.name] : []),
  ...call.args.flatMap(unsupportedCalls),
]);
const infinitePathEndpoints = (source: string): string[] => outerCalls(source).flatMap((call) => [
  ...(call.name === 'Point' && call.args.length === 2 && ['0', '1'].includes(call.args[1].trim()) ? [source.slice(call.start, call.end)] : []),
  ...call.args.flatMap(infinitePathEndpoints),
]);

const variants = (type: ParameterType): GeometryType[] => type === 'catalogId' ? ['number'] : type === 'lineLike' ? ['line', 'segment', 'ray']
  : type === 'pointOrLine' ? ['point', 'line']
    : type === 'conic' ? ['conic', 'circle'] : [type];

describe('native command compatibility', () => {
  it('emits only indexed commands, scalar functions and allocated local calls for every catalog overload', () => {
    for (const tool of studioToolLibrary.tools) for (const overload of tool.overloads) {
      // Exercise family members independently, plus all mixed Conic point/line
      // combinations, so a more specific overload cannot hide a builder branch.
      const signatures = overload.params.reduce<GeometryType[][]>((rows, param) => rows.flatMap((row) => variants(param.type).map((type) => [...row, type])), [[]]);
      for (const types of signatures) {
        const environment: CommandEnvironment = { objects: new Map(), macros: new Set() };
        const args = types.map((type, i) => {
          if (overload.params[i].type === 'catalogId') return '12';
          if (type === 'number') return '1';
          const label = `Fixture${i}`;
          environment.objects.set(label, type);
          return label;
        });
        const source = `${tool.name}(${args.join(',')})`;
        const plan = overload.requiresNamed ? compileStudioPlan(source, environment, '0123456789abcdef') : null;
        const expanded = plan ? plan.helpers.map((h) => h.expression).concat(plan.output).join('\n') : compileStudioCommand(source, environment);
        expect([...new Set(unsupportedCalls(expanded))], `${tool.name}(${types.join(',')})`).toEqual([]);
        // Generic supporting-line extraction must avoid infinite endpoints of
        // native normalized paths (line: 0/1; ray: 1).
        expect(infinitePathEndpoints(expanded), source).toEqual([]);
      }
    }
  }, 15000);

  it('detects unexpanded site calls and unknown native names, including bracket syntax', () => {
    expect(unsupportedCalls('Intersect[RadicalAxis(c1,c2),MissingNative(c1)]')).toEqual(['RadicalAxis', 'MissingNative']);
    expect(unsupportedCalls('Element(Zip(v1(0,0)+sqrt(x(P)),v1,{LeftSide(F)}),1)')).toEqual([]);
  });

  it('expands the radical axis and its downstream tools through the site dependency compiler', () => {
    const environment: CommandEnvironment = {
      objects: new Map<string, GeometryType>([['c1', 'circle'], ['c2', 'circle'], ['c3', 'circle'], ['A', 'point'], ['B', 'point'], ['C', 'point'], ['D', 'point'], ['l', 'line'], ['s', 'segment'], ['r', 'ray']]),
      macros: new Set(),
    };
    expect(GEOGEBRA_COMMAND_NAMES).not.toContain('RadicalAxis');
    for (const source of ['RadicalAxis(c1,c2)', 'RadicalCenter(c1,c2,c3)', 'SteinerLineQ(A,B,C,D)', 'SteinerLineQ(l,s,r,l)', 'TangentParabola(A,B,C,D)', 'TangentParabola(l,s,r,l)']) {
      const expanded = compileStudioCommand(source, environment);
      if (source.startsWith('Radical')) expect(expanded, source).toContain('PerpendicularLine');
      expect(expanded, source).not.toContain('RadicalAxis');
      expect(unsupportedCalls(expanded), source).toEqual([]);
      expect(expanded.length, source).toBeLessThan(100_000);
    }
    expect(compileStudioCommand('Intersect(RadicalAxis(c1,c2),l)', environment)).toContain('PerpendicularLine');
    environment.macros.add('radicalaxis');
    expect(compileStudioCommand('RadicalAxis(c1,c2)', environment)).toBe('RadicalAxis(c1,c2)');
    expect(compileStudioCommand('RadicalCenter(c1,c2,c3)', environment)).not.toContain('RadicalAxis');
    expect(compileStudioCommand('SteinerLineQ(A,B,C,D)', environment)).not.toContain('RadicalAxis');
  });

  it('emits SteinerLineQ directly from coordinates with the same diameter-circle power difference', () => {
    const environment: CommandEnvironment = {
      objects: new Map<string, GeometryType>(['A', 'B', 'C', 'D'].map((name) => [name, 'point'])),
      macros: new Set(),
    };
    const expanded = compileStudioCommand('SteinerLineQ(A,B,C,D)', environment);
    expect(expanded).not.toMatch(/RadicalAxis|Circle|Center|Radius|Distance|PerpendicularLine|Zip/u);
    expect(expanded).toMatch(/=0\)$/u);
    const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1];
    const difference = (p: number[], q: number[]) => p.map((value, i) => value - q[i]);
    for (const vertices of [
      [[1, 2], [5, -1], [-2, 6], [7, 3]],
      [[0, 0], [0, 2], [4, 0], [4, 2]], // horizontal line
      [[0, 0], [2, 0], [0, 4], [2, 4]], // vertical line
      [[0, 0], [1, -1], [2, 0], [1, 1]], // coincident diameter circles
      [[0, 0], [1, -2], [2, 0], [1, 2]], // concentric, unequal circles
    ]) {
      const polynomial = expanded.replace(/([xy])\(\(([ABCD])\)\)/gu,
        (_, axis: string, name: string) => `(${vertices['ABCD'.indexOf(name)][axis === 'x' ? 0 : 1]})`).replace(/=0\)$/u, ')');
      const residual = Function('x', 'y', `return ${polynomial}`) as (x: number, y: number) => number;
      const [a, b, c, d] = vertices;
      for (const p of [[0, 0], [2, -3], [-4, 5]]) {
        const powers = dot(difference(p, a), difference(p, c)) - dot(difference(p, b), difference(p, d));
        expect(residual(p[0], p[1])).toBeCloseTo(powers, 10);
      }
    }
  });
});
