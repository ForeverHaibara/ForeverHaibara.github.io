import { describe, expect, it, vi } from 'vitest';
import { compileStudioCommand } from './commandCompiler';
import { normalizeGeometryType, readCommandEnvironment } from './commandEnvironment';
import type { GeoGebraEngine } from '../../types';
import type { CommandEnvironment, GeometryType } from './types';

const scope = (): CommandEnvironment => ({
  objects: new Map<string, GeometryType>([['A', 'point'], ['B', 'point'], ['C', 'point'], ['D', 'point'], ['P', 'point'], ['X', 'point'], ['Y', 'point'], ['l', 'line'], ['s', 'segment'], ['r', 'ray'], ['q', 'conic'], ['c', 'circle'], ['f', 'implicitCurve']]),
  macros: new Set(),
});
const compile = (source: string) => compileStudioCommand(source, scope());

describe('P2 type dispatch and symbolic construction boundaries', () => {
  it('recognizes implicit curve constructors and preserves native Cubic and Polar forms', () => {
    for (const type of ['implicitpoly', 'ImplicitCurve', 'GeoImplicitCurve']) expect(normalizeGeometryType(type)).toBe('implicitCurve');
    expect(normalizeGeometryType('implicitpoly3d')).toBe('unknown');
    expect(compile('Cubic(A,B,C,1)')).toBe('Cubic(A,B,C,1)');
    expect(compile('Polar(P,q)')).toBe('Polar(P,q)');
    expect(compile('Polar(l,q)')).toBe('Polar(l,q)');
    expect(compile('Incenter(Polar(l,q),B,C)')).toContain('TriangleCenter');
    expect(compile('Polar(P,Cubic(A,B,C,1))')).toContain('LeftSide');
    expect(compile('PolarConic(P,ImplicitCurve(x^3+y^3-1))')).toContain('Coefficients');
    expect(() => compile('PolarConic(P,q)')).toThrow('No overload');
    expect(() => compile('IsogonalConjugate(A,B,C,f)')).toThrow('No overload');
  });

  it('retains the conic class when the engine displays a line or point degeneration', async () => {
    const callApi = vi.fn(async (method: string, args: unknown[]) => {
      if (method === 'getAllObjectNames') return ['lineConic', 'pointConic', 'plainLine', 'curve'];
      if (method === 'getObjectType') return ({ lineConic: 'line', pointConic: 'point', plainLine: 'line', curve: 'implicitpoly' } as Record<string, string>)[String(args[0])];
      if (method === 'getXML') return `<element type="${String(args[0]).endsWith('Conic') ? 'conic' : 'line'}" label="${args[0]}"/>`;
      if (method === 'getFileJSON') return { archive: [] };
      throw new Error(`Unexpected numeric read or mutation: ${method}`);
    });
    const environment = await readCommandEnvironment({ callApi } as unknown as GeoGebraEngine);
    expect(environment.objects.get('lineConic')).toBe('conic');
    expect(environment.objects.get('pointConic')).toBe('conic');
    expect(environment.objects.get('plainLine')).toBe('line');
    expect(environment.objects.get('curve')).toBe('implicitCurve');
    expect(callApi.mock.calls.filter(([method]) => method === 'getXML')).toHaveLength(3);
  });

  it('expands conic line-images and uses unbounded supports for all line-like overloads', () => {
    expect(compile('Antipode(IsogonalConjugate(A,B,C,l),P)')).toContain('ApplyMatrix');
    for (const source of ['IsotomicConjugate(A,B,C,s)', 'SecondIntersection(q,P,s)', 'AntiSteinerPoint(A,B,C,r)', 'MiquelPoint(s,l,r,l)', 'SteinerLineQ(s,l,r,l)', 'TangentParabola(s,l,r,l)']) {
      const expression = compile(source);
      expect(expression, source).toContain('0.5');
      expect(expression, source).not.toMatch(/SetValue|SetCoords|Execute|Delete/u);
      expect(expression.length, source).toBeLessThan(100_000);
    }
  });

  it('uses univariate coefficient encoding and a dynamic cubic-degree guard without CAS or sampled path points', () => {
    for (const source of ['Polar(P,f)', 'PolarConic(P,f)', 'ThirdIntersection(f,P)', 'ThirdIntersection(f,P,B)']) {
      const expression = compile(source);
      expect(expression).toContain('LeftSide');
      expect(expression).toContain('RightSide');
      expect(expression).toMatch(/Reverse\(Coefficients\(v\d+\(x,x\^4\)\+0\*x\)\)/u);
      expect(expression).toContain('{0,0,0,0,0,0,0,0,0,0,0,0,0}');
      expect(expression).toContain('AreEqual');
      expect(expression).not.toMatch(/Derivative\(|Point\(|Intersect\(|Cubic\(/u);
      expect(expression.length, source).toBeLessThan(20_000);
    }
    const cubic = compile('Cubic(A,B,C,D,P,X,Y,(1,2),(3,4))');
    expect(cubic).toContain('MatrixRank');
    expect(cubic).toContain('ImplicitCurve');
    expect(cubic).toContain('Translate(Dilate(');
  });

  it('emits fixed independent output slots and dynamic selection for P2 families', () => {
    for (const [source, count] of [['CommonTangents(c,c,1)', 2], ['MixtilinearIncircles(A,B,C)', 3], ['MixtilinearExcircles(A,B,C)', 3], ['ApolloniusCircles(A,B,C)', 3], ['SteinerFoci(A,B,C)', 2], ['IsogonalPairWithMidpoint(A,B,C,P)', 2]] as const) {
      const outputs = compile(`Result=${source}`).split('\n');
      expect(outputs, source).toHaveLength(count);
      expect(outputs[0]).toMatch(/^Result=/u);
      expect(outputs.every((output) => output.length < 100_000), source).toBe(true);
      expect(compile(`Line(${source},P)`)).not.toContain('\n');
    }
    expect(compile('CommonTangents(c,c,-1,2)')).toContain('floor');
  });
});
