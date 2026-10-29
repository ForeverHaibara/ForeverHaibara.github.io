import { describe, expect, it } from 'vitest';
import { compileStudioCommand, compileStudioPlan } from '../commandCompiler';
import type { CommandEnvironment, GeometryType } from '../types';

const environment = (): CommandEnvironment => ({
  objects: new Map<string, GeometryType>([
    ...['A', 'B', 'C', 'D', 'P'].map((name) => [name, 'point'] as [string, GeometryType]),
    ...['f', 'g', 'h', 'j', 'k'].map((name) => [name, 'line'] as [string, GeometryType]),
    ['F', 'implicitCurve'], ['q1', 'conic'], ['q2', 'conic'], ['q3', 'conic'],
  ]), macros: new Set(),
});
const id = '0123456789abcdef';

describe('one formula source with two binding lowerings', () => {
  it.each([
    ['Conic(f,g,h,j,k)', 36],
    ['Pretangential(F,P,1)', 93],
    ['PolarConic(P,F)', 12],
    ['HessianCubic(F)', 22],
    ['MixedPolar(P,A,F)', 15],
    ['JacobianCubic(q1,q2,q3)', 13],
  ])('materializes typed bindings for %s', (source, minimum) => {
    const plan = compileStudioPlan(`out=${source}`, environment(), id);
    expect(plan.materialized).toBe(true);
    expect(plan.helpers.length).toBeGreaterThanOrEqual(minimum);
    expect(plan.helpers.every((helper) => /^ggbaux0123456789abcdefnv\d+$/u.test(helper.name))).toBe(true);
    expect(plan.helpers.every((helper) => !/GGBBINDTOKEN/u.test(helper.expression))).toBe(true);
    expect(plan.output).not.toContain('GGBBINDTOKEN');
    expect(plan.output).not.toContain('Element(Zip(');
  });

  it('keeps unsupported and scope-sensitive tools anonymous', () => {
    for (const source of ['QACu1Inv(A,B,C,P)', 'QLQu3(A,B,C,D)', 'Conic(A,f,g,h,j)', 'Polar(P,F)', 'Zip(Pretangential(F,P,1),P,{A,B})']) {
      const command = `out=${source}`;
      const plan = compileStudioPlan(command, environment(), id);
      expect(plan.materialized).toBe(false);
      expect(plan.helpers).toHaveLength(0);
      expect(plan.output).toBe(compileStudioCommand(command, environment()));
    }
  });

  it('never captures a user object named like an anonymous local', () => {
    const scope = environment();
    scope.objects.set('v1', 'line');
    const plan = compileStudioPlan('out=Conic(v1,g,h,j,k)', scope, id);
    expect(plan.materialized).toBe(true);
    expect(plan.helpers.some((helper) => /\bv1\b/u.test(helper.expression))).toBe(true);
  });
});
