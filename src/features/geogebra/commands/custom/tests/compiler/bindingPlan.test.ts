import { describe, expect, it } from 'vitest';
import { compileStudioCommand, compileStudioPlan } from '../../commandCompiler';
import type { CommandEnvironment, GeometryType } from '../../types';

const environment = (): CommandEnvironment => ({
  objects: new Map<string, GeometryType>([
    ...['A', 'B', 'C', 'D', 'E', 'G', 'H', 'P'].map((name) => [name, 'point'] as [string, GeometryType]),
    ...['f', 'g', 'h', 'j', 'k', 'l'].map((name) => [name, 'line'] as [string, GeometryType]),
    ['F', 'implicitCurve'], ['q1', 'conic'], ['q2', 'conic'], ['q3', 'conic'],
    ['c1', 'circle'], ['c2', 'circle'],
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
    ['OrthicAxis(F)', 15],
    ['Poloconic(l,F)', 12],
    ['CircularCubic(A,B,C,D,E,G,l)', 8],
    ['NodalCubic(A,B,C,D,E,G,H)', 7],
    ['NodalCubic(A,B,C,D,E)', 5],
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
    for (const source of ['QACu1Inv(A,B,C,P)', 'QACu1(A,B,C,D)', 'OrthopivotalCubic(A,B,C,P)',
      'QLQu3(A,B,C,D)', 'Conic(A,f,g,h,j)', 'Polar(P,F)',
      'ThirdIntersection(F,A,B)', 'CayleyBacharachPoint(A,B,C,D,E,G,H,P)', 'CubicPencil(F,F,P)',
      'OrthicAxis(A,B,C)', 'CircularCubic(A,B,C,D,E,G,H)',
      'NodalCubic(A,B,C,D)', 'NodalCubic(A,B,C,D,l)', 'Zip(Pretangential(F,P,1),P,{A,B})']) {
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

  it.each(['medium', 'high'] as const)('preserves composed argument bindings when falling back in %s mode', (mode) => {
    const source = 'InconicWithFocus(A,B,C,D)';
    const plan = compileStudioPlan(source, environment(), id, mode);
    expect(plan.materialized).toBe(false);
    expect(plan.output).toBe(compileStudioCommand(source, environment()));
  });

  it('materializes segment input for verified line-like overloads', () => {
    const scope = environment();
    scope.objects.set('l', 'segment');
    for (const source of ['Poloconic(l,F)', 'CircularCubic(A,B,C,D,E,G,l)']) {
      const plan = compileStudioPlan(`out=${source}`, scope, id);
      expect(plan.materialized).toBe(true);
      expect(plan.helpers.length).toBeGreaterThan(0);
    }
  });

  it('limits point intermediates to High mode and the verified circle overload', () => {
    const source = 'out=QLCi3(A,B,C,D)';
    const medium = compileStudioPlan(source, environment(), id);
    const high = compileStudioPlan(source, environment(), id, 'high');
    expect(medium.materialized).toBe(false);
    expect(high.materialized).toBe(true);
    expect(high.helpers).toHaveLength(6);
    expect(high.helpers.every((helper) => helper.kind === 'point')).toBe(true);
    expect(high.output).not.toContain('Element(Zip(');
  });

  it('shares geometric prefix bindings across CommonTangents outputs only in High', () => {
    for (const source of ['CommonTangents(c1,c2,1)', 'CommonTangents(c1,c2,1,1)']) {
      const medium = compileStudioPlan(`out=${source}`, environment(), id);
      const high = compileStudioPlan(`out=${source}`, environment(), id, 'high');
      expect(medium.materialized).toBe(false);
      expect(high.materialized).toBe(true);
      expect(high.helpers).toHaveLength(19);
      expect(high.helpers.filter((helper) => helper.expression === 'Center(c1)')).toHaveLength(1);
      expect(high.helpers.filter((helper) => helper.expression === 'Radius(c1)')).toHaveLength(1);
      expect(high.output).not.toContain('GGBBINDTOKEN');
      expect(high.output.split('\n')).toHaveLength(source === 'CommonTangents(c1,c2,1,1)' ? 1 : 2);
    }
  });

  it.each([
    ['ApolloniusProblem(A,B,l)', 2, true, 34, 14],
    ['ApolloniusProblem(A,l,c1)', 4, true, 59, 28],
    ['ApolloniusProblem(f,g,l)', 4, true, 25, 8],
    ['ApolloniusProblem(c1,c2,l)', 8, false, 109, 56],
    ['ApolloniusProblem(c1,c2,c3)', 8, false, 109, 56],
  ])('shares scalar bindings across %s solution slots', (source, slots, inMedium, helpers, anonymousBindings) => {
    const scope = environment();
    scope.objects.set('c3', 'circle');
    scope.objects.set('l', 'segment');
    const command = `out=${source}`;
    const low = compileStudioCommand(command, scope);
    const medium = compileStudioPlan(command, scope, id, 'medium');
    const high = compileStudioPlan(command, scope, id, 'high');
    expect(low.match(/Element\(Zip\(/gu)).toHaveLength(anonymousBindings);
    expect(medium.materialized).toBe(inMedium);
    expect(medium.output).toBe(inMedium ? high.output : low);
    expect(high.materialized).toBe(true);
    expect(high.helpers).toHaveLength(helpers);
    expect(high.helpers.every(({ kind }) => kind === 'number')).toBe(true);
    const expanded = high.helpers.map(({ expression }) => expression).concat(high.output).join('\n');
    expect(expanded).not.toMatch(/\b(?:Element|Zip)\(/u);
    expect(high.output.split('\n')).toHaveLength(slots);
    if (source.includes('c1')) {
      expect(high.helpers.filter(({ expression }) => expression === 'Radius(c1)')).toHaveLength(1);
    }
  });

  it('leaves the three-point Apollonius construction on its native path', () => {
    const source = 'out=ApolloniusProblem(A,B,C)';
    const plan = compileStudioPlan(source, environment(), id, 'high');
    expect(plan.materialized).toBe(false);
    expect(plan.output).toContain('Circle(A,B,C)');
  });

  it('requires High for the vector and numeric QLQu3 binding chain', () => {
    const source = 'out=QLQu3(A,B,C,D)';
    expect(compileStudioPlan(source, environment(), id).materialized).toBe(false);
    const high = compileStudioPlan(source, environment(), id, 'high');
    expect(high.materialized).toBe(true);
    expect(high.helpers).toHaveLength(55);
    expect(high.helpers.filter((helper) => helper.kind === 'vector')).toHaveLength(5);
    expect(high.output).not.toContain('Element(Zip(');
  });

  it('shares one numeric Prehessian pencil across three High outputs', () => {
    const source = 'out=PrehessianCubic(F)';
    expect(compileStudioPlan(source, environment(), id).materialized).toBe(false);
    const high = compileStudioPlan(source, environment(), id, 'high');
    expect(high.materialized).toBe(true);
    expect(high.helpers).toHaveLength(46);
    expect(high.helpers.every((helper) => ['number', 'numberList', 'function'].includes(helper.kind))).toBe(true);
    expect(high.output.split('\n')).toHaveLength(3);
    expect(high.output).not.toContain('Element(Zip(');
  });

  it('shares cusp pencil data in Medium for each supported geometry', () => {
    const general = environment(); general.objects.set('F', 'point');
    for (const [source, scope, count] of [
      ['CuspidalCubic(A,B,C,D,E,F)', general, 18],
      ['CuspidalCubic(A,B,C,D)', environment(), 14],
      ['CuspidalCubic(A,B,C,l)', environment(), 14],
    ] as const) {
      const plan = compileStudioPlan(`out=${source}`, scope, id);
      expect(plan.materialized).toBe(true);
      expect(plan.helpers).toHaveLength(count);
      expect(plan.helpers.every((helper) => helper.kind === 'number')).toBe(true);
      expect(plan.output.split('\n')).toHaveLength(2);
      expect(plan.output).not.toContain('Element(Zip(');
    }
  });
});
