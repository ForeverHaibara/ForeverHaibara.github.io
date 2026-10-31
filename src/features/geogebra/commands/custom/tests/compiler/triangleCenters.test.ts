import { beforeAll, describe, expect, it } from 'vitest';
import { compileStudioCommand, containsStudioCall, extendedTriangleCenterIds } from '../../commandCompiler';
import { prepareTriangleCenter } from '../../builders/triangleCenters';
import type { CommandEnvironment } from '../../types';

const environment = (): CommandEnvironment => ({
  objects: new Map([['A', 'point'], ['B', 'point'], ['C', 'point'], ['n', 'number']]),
  macros: new Set(),
});

beforeAll(async () => { for (const id of [3054, 3056, 3058, 3060, 3061, 3064, 3070, 3071, 3081, 3094, 3095, 3097, 3098, 3100, 3109, 3114, 3134, 3154, 3162, 3221, 3234, 3281, 3396, 3357, 3933, 4182, 5091, 5305, 6004, 6012, 72060, 73007, 72478, 73001, 72003, 8036, 9464]) await prepareTriangleCenter(id); });

describe('extended TriangleCenter dispatch', () => {
  it('leaves native selectors untouched, including computed numbers', () => {
    for (const selector of ['1', '3053', 'n', '3+3051', 'Floor(n)', '3e3', '-1', '0']) {
      const source = `TriangleCenter(A,B,C,${selector})`;
      expect(containsStudioCall(source), selector).toBe(false);
      expect(compileStudioCommand(source, environment())).toBe(source);
    }
  });

  it('expands only reviewed higher literals using native dependencies', () => {
    expect(containsStudioCall('P=TriangleCenter(A,B,C,(3054))')).toBe(true);
    expect(compileStudioCommand('P=TriangleCenter(A,B,C,3054)', environment()))
      .toBe('P=Midpoint(TriangleCenter(A,B,C,590),TriangleCenter(A,B,C,615))');
    for (const selector of ['3054.0', '3.054e3', '+3054', '(3054)']) {
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${selector})`, environment()))
        .toBe('Midpoint(TriangleCenter(A,B,C,590),TriangleCenter(A,B,C,615))');
    }
    expect(compileStudioCommand('TriangleCenter(A,B,C,3060)', environment()))
      .toBe('Reflect(TriangleCenter(A,B,C,2),TriangleCenter(A,B,C,51))');
    expect(compileStudioCommand('TriangleCenter(A,B,C,3061)', environment()))
      .toBe('Intersect(Line(TriangleCenter(A,B,C,1),TriangleCenter(A,B,C,6)),Line(TriangleCenter(A,B,C,2),TriangleCenter(A,B,C,257)))');
  });

  it('keeps file tools first and reports unsupported extended IDs', () => {
    const scope = environment();
    scope.macros.add('trianglecenter');
    expect(extendedTriangleCenterIds('TriangleCenter(A,B,C,3054)', scope)).toEqual([]);
    expect(compileStudioCommand('TriangleCenter(A,B,C,3054)', scope)).toBe('TriangleCenter(A,B,C,3054)');
    expect(extendedTriangleCenterIds('P=TriangleCenter(A,B,C,3070)+TriangleCenter(A,B,C,3054)', environment()))
      .toEqual([3070, 3054]);
    expect(() => compileStudioCommand('TriangleCenter(A,B,C,100000)', environment())).toThrow('X(100000) is not implemented');
  });

  it('uses compact affine recipes without loading symbolic coordinates', () => {
    expect(compileStudioCommand('TriangleCenter(A,B,C,3070)', environment()))
      .toBe('((A)+(B)+(C)-(TriangleCenter(A,B,C,490)))/2');
    expect(compileStudioCommand('TriangleCenter(A,B,C,3100)', environment()))
      .toBe('(A)+(B)+(C)-2*(TriangleCenter(A,B,C,1861))');
    for (const id of [3071, 3081, 3094, 3095, 3097, 3098, 3357]) {
      const expanded = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(expanded).not.toContain(`,${id})`);
      expect(expanded.length).toBeLessThan(400);
    }
  });

  it('resolves a later ETC block through a non-native cross-chunk dependency', () => {
    const projection = 'ClosestPoint(Line(TriangleCenter(A,B,C,2),TriangleCenter(A,B,C,3)),TriangleCenter(A,B,C,1))';
    expect(compileStudioCommand('TriangleCenter(A,B,C,3109)', environment())).toBe(projection);
    expect(compileStudioCommand('TriangleCenter(A,B,C,73001)', environment()))
      .toBe(`Reflect(TriangleCenter(A,B,C,476),${projection})`);
  });

  it('expands automatically extracted recipes with forward and cross-chunk references', () => {
    const forward = compileStudioCommand('TriangleCenter(A,B,C,3154)', environment());
    expect(forward).toContain('Midpoint(');
    expect(forward).not.toContain('TriangleCenter(A,B,C,3258)');
    const crossChunk = compileStudioCommand('TriangleCenter(A,B,C,3933)', environment());
    expect(crossChunk).not.toContain('TriangleCenter(A,B,C,5305)');
    const later = compileStudioCommand('TriangleCenter(A,B,C,72478)', environment());
    expect(later).toContain('Reflect(');
    expect(later).not.toContain('TriangleCenter(A,B,C,3057)');
  });

  it('uses the shared conjugate builder and the new line relations', () => {
    const isogonal = compileStudioCommand('TriangleCenter(A,B,C,3396)', environment());
    const isotomic = compileStudioCommand('TriangleCenter(A,B,C,9464)', environment());
    expect(isogonal).toContain('Distance(');
    expect(isogonal).not.toContain('IsogonalConjugate(');
    expect(isotomic).toContain('If(');
    expect(isotomic).not.toContain('IsotomicConjugate(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,5091)', environment())).toContain('ClosestPoint(Line(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,73007)', environment())).toContain('Reflect(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,73007)', environment())).toContain('Line(');
    expect(isogonal.length).toBeLessThan(50_000);
  });

  it('uses ideal directions in intersections and isogonal conjugates', () => {
    const intersection = compileStudioCommand('TriangleCenter(A,B,C,3058)', environment());
    expect(intersection).toContain('Line(TriangleCenter(A,B,C,1),Line(TriangleCenter(A,B,C,2),TriangleCenter(A,B,C,3)))');
    expect(intersection).toContain('Intersect(');
    const conjugate = compileStudioCommand('TriangleCenter(A,B,C,6012)', environment());
    expect(conjugate).toContain('Vector(TriangleCenter(A,B,C,659),TriangleCenter(A,B,C,1734))');
    expect(conjugate).toContain('Distance(');
    for (const id of [3221, 6004, 72060]) {
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).toBe('If(false,A)');
    }
  });

  it('expands centers recovered from nonstandard ETC line lists', () => {
    for (const id of [3134, 3162, 3234]) {
      const command = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(command).toContain('Intersect(Line(');
      expect(command).not.toContain(`,${id})`);
    }
  });

  it('expands compact cyclic coordinates and Conway symbols', () => {
    const barycentric = compileStudioCommand('TriangleCenter(A,B,C,4182)', environment());
    expect(barycentric).toContain('Distance(B,C)');
    expect(barycentric).toContain('^(1/2)');
    expect(barycentric).toContain('If(');
    const trilinear = compileStudioCommand('TriangleCenter(A,B,C,3281)', environment());
    expect(trilinear).toContain('acos(');
    expect(trilinear).toContain('cos(');
    const conway = compileStudioCommand('TriangleCenter(A,B,C,8036)', environment());
    expect(conway).toContain('sqrt(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,72003)', environment())).toContain('^3');
    for (const output of [barycentric, trilinear, conway]) expect(output.length).toBeLessThan(50_000);
  });
});
