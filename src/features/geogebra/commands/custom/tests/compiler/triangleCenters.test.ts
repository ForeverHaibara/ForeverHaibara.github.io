import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compileStudioCommand, containsStudioCall, extendedTriangleCenterIds } from '../../commandCompiler';
import { prepareTriangleCenter } from '../../builders/triangleCenters';
import { createBindingCapture } from '../../bindingPlan';
import type { CommandEnvironment } from '../../types';

// Exercise a distance-scoped combo without publishing Part 20 data.
vi.mock('../../data/triangle-centers/chunks/40.txt?raw', async (importOriginal) => {
  const original = await importOriginal<{ default: string }>();
  return { default: original.default.trimEnd() + '\n40999 F 560:2*R^2 3:d^2-R^2\n40998 B 9 x\n40997 B 1 2 x*u\n' };
});

const environment = (): CommandEnvironment => ({
  objects: new Map([['A', 'point'], ['B', 'point'], ['C', 'point'], ['n', 'number']]),
  macros: new Set(),
});

beforeAll(async () => { for (const id of [3054, 3056, 3058, 3060, 3061, 3064, 3070, 3071, 3078, 3081, 3094, 3095, 3097, 3098, 3100, 3109, 3110, 3114, 3134, 3154, 3162, 3221, 3234, 3283, 3371, 3385, 3396, 3357, 3455, 3856, 3933, 4174, 4180, 4181, 4182, 5091, 5305, 5600, 5957, 5998, 6004, 6012, 7044, 72060, 73007, 72478, 72657, 73001, 72003, 72005, 8036, 9043, 9232, 9464]) await prepareTriangleCenter(id); });

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
    const isogonal = compileStudioCommand('TriangleCenter(A,B,C,3385)', environment());
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

  it('closes isogonal relations after coordinate anchors without duplicating their formulas', () => {
    const expanded = compileStudioCommand('TriangleCenter(A,B,C,3385)', environment());
    expect(expanded).toContain('sec(');
    expect(expanded).not.toContain('IsogonalConjugate(');
    expect(expanded.match(/sec\(/gu)).toHaveLength(3);
    expect(expanded.length).toBeLessThan(6000);
    for (const id of [7044, 72657]) {
      const relation = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(relation).toContain('Distance(');
      expect(relation.length).toBeLessThan(6000);
    }
  });

  it('renders circumcircle inversion of native and extended source points', () => {
    expect(compileStudioCommand('TriangleCenter(A,B,C,3455)', environment()))
      .toBe('Reflect(TriangleCenter(A,B,C,67),Circle(A,B,C))');
    const chained = compileStudioCommand('TriangleCenter(A,B,C,3110)', environment());
    expect(chained).toContain('Reflect(');
    expect(chained).toContain('Circle(A,B,C)');
    expect(chained).not.toContain('TriangleCenter(A,B,C,3286)');
  });

  it('uses ideal directions in intersections and isogonal conjugates', () => {
    const intersection = compileStudioCommand('TriangleCenter(A,B,C,3058)', environment());
    expect(intersection).toContain('Line(TriangleCenter(A,B,C,1),Line(TriangleCenter(A,B,C,2),TriangleCenter(A,B,C,3)))');
    expect(intersection).toContain('Intersect(');
    const conjugate = compileStudioCommand('TriangleCenter(A,B,C,6012)', environment());
    expect(conjugate).toContain('Vector(TriangleCenter(A,B,C,659),TriangleCenter(A,B,C,1734))');
    expect(conjugate).toContain('Distance(');
    for (const id of [3221, 5957, 6004, 72060]) {
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).toBe('If(false,A)');
    }
  });

  it('keeps centers identified by a single infinity line undefined', async () => {
    for (const id of [5959, 6364, 6365, 9043]) {
      await prepareTriangleCenter(id);
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).toBe('If(false,A)');
    }
  });

  it('compiles constant and Conway-weighted ETC combos with a guarded sum', async () => {
    for (const id of [3622, 8350]) await prepareTriangleCenter(id);
    const constant = compileStudioCommand('TriangleCenter(A,B,C,3622)', environment());
    expect(constant).toContain('TriangleCenter(A,B,C,1)');
    expect(constant).toContain('TriangleCenter(A,B,C,2)');
    expect(constant).toContain('If(');
    const conway = compileStudioCommand('TriangleCenter(A,B,C,8350)', environment());
    expect(conway).toContain('Distance(B,C)');
    expect(conway).toContain('TriangleCenter(A,B,C,6)');
    expect(conway).toContain('If(');
    expect(conway).not.toContain('SW');
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
    const trilinear = compileStudioCommand('TriangleCenter(A,B,C,3283)', environment());
    expect(trilinear).toContain('acos(');
    expect(trilinear).toContain('cos(');
    const piFormula = compileStudioCommand('TriangleCenter(A,B,C,3371)', environment());
    expect(piFormula).toContain('sin(');
    expect(piFormula).toContain('pi');
    for (const id of [4180, 4181]) {
      const radical = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(radical).toContain('^(1/2)');
      expect(radical).toContain('If(');
    }
    const shinagawa = compileStudioCommand('TriangleCenter(A,B,C,3078)', environment());
    expect(shinagawa).toContain('TriangleCenter(A,B,C,2)');
    expect(shinagawa).toContain('TriangleCenter(A,B,C,4)');
    expect(shinagawa).toContain('Distance(B,C)');
    expect(shinagawa).not.toMatch(/\b[EF]\b/u);
    expect(compileStudioCommand('TriangleCenter(A,B,C,5600)', environment())).toContain('^(4)');
    expect(compileStudioCommand('TriangleCenter(A,B,C,4174)', environment())).toContain('^(6)');
    expect(compileStudioCommand('TriangleCenter(A,B,C,5600)', environment())).toContain('^(1/2)');
    expect(compileStudioCommand('TriangleCenter(A,B,C,5998)', environment())).toContain('^(1/2)');
    for (const id of [72005, 9232]) {
      const independent = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(independent).toContain('If(');
      expect(independent).toContain('Distance(B,C)');
    }
    const conway = compileStudioCommand('TriangleCenter(A,B,C,8036)', environment());
    expect(conway).toContain('sqrt(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,72003)', environment())).toContain('^3');
    for (const output of [barycentric, trilinear, conway]) expect(output.length).toBeLessThan(50_000);
  });

  it('loads recovered wrapped and longer coordinates and their dependent constructions', async () => {
    for (const id of [5374, 7638, 7639, 7640, 9728, 72514]) {
      await prepareTriangleCenter(id);
      const result = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(result).not.toContain(`,${id})`);
      if (id !== 72514) expect(result.length).toBeLessThan(50_000);
    }
    expect(compileStudioCommand('TriangleCenter(A,B,C,5374)', environment())).toContain('cot(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,9728)', environment())).toContain('Distance(B,C)');
    expect(compileStudioCommand('TriangleCenter(A,B,C,72514)', environment()).length).toBeGreaterThan(5_000);
  });

  it('loads a coordinate followed by attribution and its dependent center', async () => {
    for (const id of [5458, 5509, 5508]) {
      await prepareTriangleCenter(id);
      const result = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(result).not.toContain(`,${id})`);
      expect(result).toContain('Distance(');
    }
  });

  it('loads recovered conjugate, reflection and coordinate cases', async () => {
    for (const id of [3232, 5528, 7002, 8183]) await prepareTriangleCenter(id);
    expect(compileStudioCommand('TriangleCenter(A,B,C,3232)', environment())).toContain('asinh(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,5528)', environment()))
      .toBe('Reflect(TriangleCenter(A,B,C,9),TriangleCenter(A,B,C,100))');
    expect(compileStudioCommand('TriangleCenter(A,B,C,7002)', environment())).toContain('sec(');
    expect(compileStudioCommand('TriangleCenter(A,B,C,8183)', environment())).toContain('^(1/3)');
  });

  it('compiles additional ETC coordinate and partially real combo definitions', async () => {
    for (const id of [3408, 3409, 5002, 5003, 5390, 5431, 5455, 5500, 5945, 6160, 6188, 7985, 9393]) {
      await prepareTriangleCenter(id);
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).not.toContain(`,${id})`);
    }
    expect(compileStudioCommand('TriangleCenter(A,B,C,3408)', environment())).toContain('atan(');
  });

  it('loads reviewed coordinate seeds for conflicting ETC entries', async () => {
    for (const id of [5507, 8064, 72904]) {
      await prepareTriangleCenter(id);
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).toContain('Distance(B,C)');
    }
  });

  it('permits long triangle-center binding output without relaxing other plans', () => {
    const longValue = '1+'.repeat(250_001) + '1';
    const ordinary = createBindingCapture();
    const normalToken = ordinary.captureBinding(['v1'], [longValue], 'v1', ['number']);
    expect(() => ordinary.lower(normalToken, '0000000000000000', false)).toThrow('500,000');
    const triangleCenter = createBindingCapture(true);
    const centerToken = triangleCenter.captureBinding(['v1'], [longValue], 'v1', ['number']);
    expect(triangleCenter.lower(centerToken, '0000000000000000', false).output.length).toBeGreaterThan(500_000);
  });
  it('loads the independently reviewed PB cluster anchors without unresolved scalars', async () => {
    for (const id of [11753, 11754]) {
      await prepareTriangleCenter(id);
      const result = compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment());
      expect(result).toContain('sqrt(3)');
      expect(result).not.toMatch(/\bU\b/u);
      expect(result).not.toContain(`,${id})`);
    }
  });

  it('compiles finite three-center circles and natural-log coordinates', async () => {
    for (const id of [11619, 40300, 72481, 72891]) await prepareTriangleCenter(id);
    expect(compileStudioCommand('TriangleCenter(A,B,C,11619)', environment()))
      .toBe('Center(Circle(TriangleCenter(A,B,C,5),TriangleCenter(A,B,C,6),TriangleCenter(A,B,C,22)))');
    for (const id of [72481, 72891]) {
      expect(compileStudioCommand(`TriangleCenter(A,B,C,${id})`, environment())).toContain('Center(Circle(');
    }
    const logarithmic = compileStudioCommand('TriangleCenter(A,B,C,40300)', environment());
    expect(logarithmic).toContain('ln(');
    expect(logarithmic).not.toContain('log(');
    expect(logarithmic).not.toContain(',40300)');
  });

  it('loads reviewed cyclic roots and the Brocard inverse dependency graph', async () => {
    for (const id of [11667, 4254]) await prepareTriangleCenter(id);
    const roots = compileStudioCommand('TriangleCenter(A,B,C,11667)', environment());
    expect(roots).toContain('sqrt(');
    expect(roots).not.toMatch(/\b[UVW]\b/u);
    const inverse = compileStudioCommand('TriangleCenter(A,B,C,4254)', environment());
    expect(inverse).toContain('Reflect(');
    expect(inverse).toContain('Circle(TriangleCenter(A,B,C,182),TriangleCenter(A,B,C,3))');
    expect(inverse).not.toContain(',4254)');
    expect(inverse).not.toContain(',5120)');
  });

  it('binds the two input points and distance in a Vu first PCC combo', async () => {
    await prepareTriangleCenter(40999);
    const result = compileStudioCommand('TriangleCenter(A,B,C,40999)', environment());
    expect(result).toContain('Distance(');
    expect(result).toContain('TriangleCenter(A,B,C,560)');
    expect(result).not.toMatch(/\bd\b/u);
    expect(result).not.toContain(',40999)');
  });

  it('binds source barycentrics in a dependent coordinate recipe', async () => {
    await prepareTriangleCenter(40998);
    const result = compileStudioCommand('TriangleCenter(A,B,C,40998)',environment());
    expect(result).toContain('TriangleCenter(A,B,C,9)');
    expect(result).toContain('x(');
    expect(result).not.toMatch(/\b[xyz]\b(?!\s*\()/u);
    expect(result).not.toContain(',40998)');
    expect(result.match(/TriangleCenter\(A,B,C,9\)/gu)).toHaveLength(1);
  });

  it('binds both sources once for a two-input coordinate recipe',async () => {
    await prepareTriangleCenter(40997);
    const result=compileStudioCommand('TriangleCenter(A,B,C,40997)',environment());
    expect(result).not.toMatch(/\b[xyzuvw]\b(?!\s*\()/u);
    expect(result).not.toContain(',40997)');
    for (const id of [1,2]) expect(result.match(new RegExp(`TriangleCenter\\(A,B,C,${id}\\)`,'gu'))).toHaveLength(1);
  });

  it('loads the reviewed Vijay-Paasche-Hutson seeds from their new chunk',async () => {
    for (const id of [38493,38494]) {
      await prepareTriangleCenter(id);
      const result=compileStudioCommand(`TriangleCenter(A,B,C,${id})`,environment());
      expect(result).toContain('Distance(');
      expect(result).not.toMatch(/\bR\b/u);
      expect(result).not.toContain(`,${id})`);
    }
  });

});
