import { expect, it } from 'vitest';
import { createBindingCapture } from '../../bindingPlan';
import { compileStudioCommand, compileStudioPlan, containsStudioCall, extendedTriangleCenterIds } from '../../commandCompiler';
import { prepareTriangleCenter } from '../../builders/triangleCenters';
import { studioTools } from '../../toolLibrary';
import type { CommandEnvironment, GeometryType } from '../../types';

const scope = (): CommandEnvironment => ({
  objects: new Map(['A', 'B', 'C', 'P'].map((label) => [label, 'point' as GeometryType])),
  macros: new Set(),
});
const compile = (source: string, environment = scope()) => compileStudioCommand(source, environment);
const group = '0123456789abcdef';

it('passes ordered slots to native and custom calls and keeps ordinary nesting scalar', () => {
  const outer = compile('O=TriangleCenter(...IntouchTriangle(A,B,C),3)');
  expect(outer).toMatch(/^O=TriangleCenter\(/u);
  for (const line of ['Line(B,C)', 'Line(C,A)', 'Line(A,B)']) expect(outer).toContain(line);
  expect(outer.split('\n')).toHaveLength(1);
  expect(compile('Midpoint(P,IntouchTriangle(A,B,C))')).not.toContain('Line(C,A)');
  const affine = compile('Affine[...MedialTriangle(A,B,C), ...IntouchTriangle(A,B,C), P]');
  expect(affine).not.toMatch(/Affine\[|\.\.\./u);
  expect(affine).toContain('Line(A,B)');
});

it('names outputs in order and validates labels and arity', () => {
  const result = compile('(D,E,F)=IntouchTriangle(A,B,C)').split('\n');
  expect(result.map((line) => line.slice(0, 2))).toEqual(['D=', 'E=', 'F=']);
  expect(result[0]).toContain('Line(B,C)');
  expect(result[1]).toContain('Line(C,A)');
  expect(result[2]).toContain('Line(A,B)');
  expect(() => compile('(D,E)=IntouchTriangle(A,B,C)')).toThrow('requires 3 output labels');
  expect(() => compile('(D,D,F)=IntouchTriangle(A,B,C)')).toThrow('distinct');
  expect(() => compile('(A,E,F)=IntouchTriangle(A,B,C)')).toThrow('new output label: A');
});

it('recognizes explicit fixed-output calls and preserves native lexical forms', () => {
  expect(containsStudioCall('Circle(...Unknown(A,B,C))')).toBe(true);
  expect(containsStudioCall('Text("...IntouchTriangle(A,B,C)")')).toBe(false);
  expect(compile('Sequence(.5*k,k,1,5)+1..5')).toBe('Sequence(.5*k,k,1,5)+1..5');
  expect(compile('Circle(\n # comment with )\n ... MedialTriangle(A,B,C)\n)')).toBe(compile('Circle(...MedialTriangle(A,B,C))'));
  expect(() => compile('Circle(...{A,B,C})')).toThrow('direct fixed-output');
  expect(() => compile('Circle(...IntouchTriangle(A,B,C,2))')).toThrow('does not provide fixed outputs');
  const environment = scope();
  environment.macros.add('intouchtriangle');
  expect(() => compile('Circle(...IntouchTriangle(A,B,C))', environment)).toThrow('does not provide fixed outputs');
});

it('finds extended TriangleCenter recipes at the expanded argument position', async () => {
  const source = 'TriangleCenter(...MedialTriangle(A,B,C),3054)';
  expect(extendedTriangleCenterIds(source, scope())).toEqual([3054]);
  await prepareTriangleCenter(3054);
  expect(compile(source)).not.toContain('3054');
  expect(compile(source)).toContain('Midpoint');
});

it('shares eligible bindings across expanded arguments and unpacked labels', () => {
  const morley = 'Circle(...MorleyTriangle(A,B,C,2))';
  const plan = compileStudioPlan(morley, scope(), group);
  expect(plan.materialized).toBe(true);
  expect(plan.helpers).toHaveLength(7);
  expect(plan.output).not.toContain('Zip(');
  const unpack = '(D,E,F)=IntouchTriangle(A,B,C)';
  expect(compileStudioPlan(unpack, scope(), group).materialized).toBe(false);
  const high = compileStudioPlan(unpack, scope(), group, 'high');
  expect(high.helpers).toHaveLength(1);
  expect(high.output.split('\n')).toHaveLength(3);
  expect(compileStudioPlan(`If(1<2,${morley})`, scope(), group, 'high').materialized).toBe(false);
  const yff = compileStudioPlan('Circle(...YffCentralTriangle(A,B,C))', scope(), group, 'medium');
  const macBeath = compileStudioPlan('Circle(...MacBeathTriangle(A,B,C))', scope(), group, 'high');
  expect(yff.helpers).toHaveLength(6);
  expect(macBeath.helpers).toHaveLength(4);
  expect(yff.output + macBeath.output).not.toContain('Zip(');
});

it('substitutes template inputs in the shared binding graph', () => {
  const tools = new Map(studioTools);
  tools.set('sample', { name: 'Sample', canonicalName: 'Sample', description: 'Template spread', overloads: [{
    params: ['A', 'B', 'C'].map((name) => ({ name, type: 'point' })),
    returns: 'circle',
    compose: 'Circle(...MorleyTriangle($A,$B,$C))',
  }] });
  const capture = { ...createBindingCapture(), selected: [] };
  const output = compileStudioCommand('Sample(A,B,C)', scope(), tools, capture);
  const plan = capture.lower(output, group, true);
  expect(plan.helpers.filter(({ expression }) => expression.startsWith('Distance(')).map(({ expression }) => expression))
    .toEqual(['Distance((B),(C))', 'Distance((C),(A))', 'Distance((A),(B))']);
  expect(plan.output).toMatch(/^Circle\(/u);
});

it('compiles the spread replacements for the retired circle commands', () => {
  const names = ['Tangential', 'Reflection', 'Midheight', 'Hexyl', 'Incentral', 'Symmedial', 'YffContact',
    'TangentialMidArc', 'Yiu', 'InnerVecten', 'OuterVecten', 'InnerNapoleon', 'OuterNapoleon',
    'Intangents', 'Extangents', 'YffCentral', 'MacBeath', 'Morley'];
  const replacements = names.map((name) => [`${name}Circle`, `Circle(...${name}Triangle(A,B,C))`]);
  replacements.push(['MandartCircle', 'Circle(...ExtouchTriangle(A,B,C))'],
    ['SpiekerCircle', 'Incircle(...MedialTriangle(A,B,C))'],
    ['ThirdLemoineCircle', 'Circle(...LemoineTriangle(A,B,C))']);
  for (const [retired, source] of replacements) {
    expect(studioTools.has(retired.toLowerCase()), retired).toBe(false);
    expect(compile(source)).toMatch(/^(?:Circle|Incircle)\(/u);
  }
  expect(compile('Circle(...ReflectionTriangle(A,B,C,P))')).toContain('Reflect');
  expect(compile('Circle(...MorleyTriangle(A,B,C,2))')).toContain('π/3');
});
