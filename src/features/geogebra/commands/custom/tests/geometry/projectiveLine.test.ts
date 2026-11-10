import { describe, expect, it } from 'vitest';
import { createBindingCapture } from '../../bindingPlan';
import { compileStudioCommand } from '../../commandCompiler';
import { outerCalls, splitTopLevel } from '../../commandSyntax';
import { expandTool, studioTools } from '../../toolLibrary';
import type { BindingAllocator } from '../../algebra/homogeneous';
import type { GeometryType, TypedExpression } from '../../types';

// Evaluate the builder's numeric bindings with exact point and line fixtures.
// GeoGebra still handles parsing, object creation and dependency updates.
const image = (name: string, fixtures: number[][]) => {
  const args = fixtures.map((value, i): TypedExpression => ({
    expression: `P${i}`, type: value.length === 2 ? 'point' : 'line',
  }));
  const tool = studioTools.get(name.toLowerCase())!;
  const overload = tool.overloads.find((candidate) => candidate.params.length === args.length)!;
  const capture = createBindingCapture();
  let index = 0;
  const allocate: BindingAllocator = () => `v${++index}`;
  allocate.captureBinding = capture.captureBinding;
  const built = expandTool(overload, args, allocate);
  const plan = capture.lower(built.expression, '0123456789abcdef', true);
  const values: Record<string, unknown> = {
    x: (point: number[]) => point[0],
    y: (point: number[]) => point[1],
    ...Object.fromEntries(args.map(({ expression }, i) => [expression, fixtures[i]])),
  };
  const evaluate = (expression: string) =>
    Function(...Object.keys(values), `return ${expression}`)(...Object.values(values));
  for (const { name: label, expression } of plan.helpers) values[label] = evaluate(expression);
  const guard = outerCalls(plan.output)[0];
  if (!evaluate(guard.args[0])) return undefined;
  const point = splitTopLevel(guard.args[1].slice(1, -1)).map(evaluate);
  return point.every(Number.isFinite) ? point : undefined;
};

describe('projective line images', () => {
  it('reuses the directed affine ratio for finite points and accepts infinity as input', () => {
    const objects = new Map<string, GeometryType>([['A', 'point'], ['B', 'point'], ['C', 'point'], ['D', 'point'], ['P', 'point']]);
    const scope = { objects, macros: new Set<string>() };
    const expanded = compileStudioCommand('AffineL(A,B,C,D,P)', scope).replace(/\(\(([ABCDP])\)\)/gu, '($1)');
    expect(expanded).toBe(compileStudioCommand('AffineL(A,B,C,D,P)', scope));
    // expect(compileStudioCommand('AffineL(A,B,C,D,l)', scope)).toBe('(0/0,0/0)');
  });

  it('maps both ways between finite points and infinity on distinct carriers', () => {
    const horizontal = [0, -2, 14];
    const calibration = [[0, 7], [1, 7], horizontal, [5, 1], [5, 0.5], [5, 0]];
    expect(image('CollineationL', [...calibration, [3, 7]])).toEqual([5, 0.25]);
    expect(image('CollineationL', [...calibration, [0, 7, 5]])).toEqual([5, 0]);
    expect(image('CollineationL', [...calibration, [-1, 7]])).toBeUndefined();
    expect(image('CollineationL', [...calibration.slice(3), ...calibration.slice(0, 3), [1, 0, 7]])).toEqual([-1, 7]);
  });

  it('computes a nonaffine involution and its center with finite or direction calibration', () => {
    const horizontal = [0, 1, -7];
    const calibration = [[0, 7], [1, 7], [0.5, 7], [-1, 7]];
    expect(image('InvolutionL', [...calibration, [3, 7]])).toEqual([5, 7]);
    expect(image('InvolutionL', [...calibration, [5, 7]])).toEqual([3, 7]);
    expect(image('InvolutionL', calibration)).toEqual([2, 7]);
    expect(image('InvolutionL', [...calibration, horizontal])).toEqual([2, 7]);
    expect(image('InvolutionL', [...calibration, [2, 7]])).toBeUndefined();
    expect(image('InvolutionL', [horizontal, [1, 7], [2, 7], [-1, 7], [3, 7]])).toEqual([5, 7]);
  });
});
