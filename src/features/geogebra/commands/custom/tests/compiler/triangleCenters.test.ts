import { describe, expect, it } from 'vitest';
import { compileStudioCommand, containsStudioCall } from '../../commandCompiler';
import type { CommandEnvironment } from '../../types';

const environment = (): CommandEnvironment => ({
  objects: new Map([['A', 'point'], ['B', 'point'], ['C', 'point'], ['n', 'number']]),
  macros: new Set(),
});

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
    expect(compileStudioCommand('TriangleCenter(A,B,C,3054)', scope)).toBe('TriangleCenter(A,B,C,3054)');
    expect(() => compileStudioCommand('TriangleCenter(A,B,C,3062)', environment())).toThrow('X(3062) is not implemented');
  });
});
