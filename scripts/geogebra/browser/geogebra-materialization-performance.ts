import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { splitTopLevel } from '../../../src/features/geogebra/commands/custom/commandSyntax';

type Trial = { create: number; updates: number[]; values?: number[][] };
const median = (samples: number[]) => {
  const values = [...samples].sort((a, b) => a - b);
  return (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2;
};

// Extract whole Element(Zip(...),1) subexpressions, respecting nested parentheses.
// The longest repeated one in these tools is their numeric coefficient list.
const bindingCandidate = (source: string, allowSingle: boolean): string => {
  const found: string[] = [];
  for (let start = source.indexOf('Element(Zip('); start >= 0; start = source.indexOf('Element(Zip(', start + 1)) {
    let depth = 0;
    for (let end = start; end < source.length; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')' && --depth === 0) {
        const expression = source.slice(start, end + 1);
        if (expression.endsWith(',1)') && (allowSingle || source.split(expression).length > 2)) found.push(expression);
        break;
      }
    }
  }
  const result = found.sort((a, b) => b.length - a.length)[0];
  if (!result) throw new Error('No suitable anonymous binding found');
  return result;
};

// Benchmark-only lowering of bind()'s singleton Zip into live construction
// objects. The selected sites bind numbers, lists, and (for Pretangential) one
// multivariable function; none add geometric objects to the construction.
const flattenBindings = (source: string) => {
  const assignments = new Map<string, string>();
  const rewrite = (input: string): string => {
    let output = '';
    let cursor = 0;
    for (let start = input.indexOf('Element(Zip(', cursor); start >= 0; start = input.indexOf('Element(Zip(', cursor)) {
      let depth = 0;
      let end = start;
      for (; end < input.length; end++) {
        if (input[end] === '(') depth++;
        else if (input[end] === ')' && --depth === 0) { end++; break; }
      }
      const outer = splitTopLevel(input.slice(start + 'Element('.length, end - 1));
      if (outer.length !== 2 || outer[1] !== '1' || !outer[0].startsWith('Zip(')) {
        output += input.slice(cursor, end); cursor = end; continue;
      }
      const zip = splitTopLevel(outer[0].slice(4, -1));
      if (zip.length < 3 || zip.length % 2 !== 1) {
        output += input.slice(cursor, end); cursor = end; continue;
      }
      output += input.slice(cursor, start);
      for (let i = 1; i < zip.length; i += 2) {
        const name = zip[i].trim();
        const singleton = zip[i + 1].trim();
        if (!/^v\d+$/u.test(name) || !singleton.startsWith('{') || !singleton.endsWith('}')) throw new Error('Unexpected bind shape');
        const value = rewrite(singleton.slice(1, -1));
        const previous = assignments.get(name);
        if (previous && previous !== value) throw new Error(`Conflicting binding ${name}`);
        if (!previous) assignments.set(name, value);
      }
      output += rewrite(zip[0]);
      cursor = end;
    }
    return output + input.slice(cursor);
  };
  const result = rewrite(source);
  if (!assignments.size || result.includes('Element(Zip(')) throw new Error('Anonymous bindings remain after flattening');
  return { assignments: [...assignments].map(([name, value]) => `${name}=${value}`), result };
};

/** Disposable native comparison on verification.html?page=smoke&suite=materialization&tool=inverse|quartic|conic|pretangential. */
export const verifyMaterializationPerformance = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
  const requested = new URLSearchParams(location.search).get('tool');
  const tool = requested === 'quartic' || requested === 'conic' || requested === 'pretangential' ? requested : 'inverse';
  const input = tool === 'quartic' ? 'out=QLQu3(A,B,C,D)' : tool === 'conic' ? 'out=Conic(f,g,h,j,k)'
    : tool === 'pretangential' ? 'out=Pretangential(W,X,1)' : 'out=QACu1Inv(A,B,C,P)';
  const moving = tool === 'quartic' ? 'D' : 'P';
  const positions = tool === 'quartic' ? [[-1.1, 2.1], [-0.9, 2.2], [-1, 2]] : [[2.1, 2.9], [1.9, 3.1], [2, 3]];
  const setup = async () => {
    await api('newConstruction');
    await api('setCoordSystem', -3, 8, -3, 6);
    const result = await engine.executeCommand(tool === 'conic'
      ? 'shift=0\nf:x+y=sqrt(2+shift)\ng:2x-y=sqrt(5)\nh:x-2y=sqrt(5)\nj:3x+y=sqrt(10)\nk:x+3y=sqrt(10)'
      : tool === 'pretangential' ? 'shape=1\nW=ImplicitCurve(y^2-x^3+shape*x+1-shape)\nX=(1,0)'
        : 'A=(0,0)\nB=(6,0)\nC=(1,4)\nD=(-1,2)\nP=(2,3)');
    if (!result.success) throw new Error(result.error ?? 'setup failed');
  };
  await setup();
  const compiled = await executeCommandPipeline(engine, input);
  if (!compiled.success || !compiled.expandedCommand) throw new Error(`expansion failed: ${compiled.error}`);
  const baseline = compiled.expandedCommand;
  const binding = tool === 'pretangential' ? '' : bindingCandidate(baseline, tool === 'conic');
  const materialized = binding ? baseline.split(binding).join('benchData') : '';
  const flattened = tool === 'quartic' ? null : flattenBindings(baseline);
  const copies = binding ? baseline.split(binding).length - 1 : 0;
  report(`${tool}: baseline ${baseline.length} chars${binding ? `; shared list ${binding.length} chars × ${copies}; output after sharing ${materialized.length} chars` : ''}`);
  if (flattened) report(`${tool}: fully named ${flattened.assignments.length} scalar/list helpers; output ${flattened.result.length} chars`);
  const samples: Record<'baseline' | 'shared' | 'flattened', Trial[]> = { baseline: [], shared: [], flattened: [] };
  let reference: number[][] | undefined;
  let inverseReference: string[] | undefined;
  const conicCoefficients = async () => Promise.all(Array.from({ length: 6 }, (_, i) => api('getValue', `Element(Coefficients(out),${i + 1})`).then(Number)));
  const proportional = (a: number[], b: number[]) => {
    const aa = Math.max(...a.map(Math.abs)); const bb = Math.max(...b.map(Math.abs));
    return aa > 0 && bb > 0 && a.every((v, i) => Math.abs(v / aa - b[i] / bb) < 1e-5)
      || aa > 0 && bb > 0 && a.every((v, i) => Math.abs(v / aa + b[i] / bb) < 1e-5);
  };
  const pointCoordinates = async () => [Number(await api('getXcoord', 'out')), Number(await api('getYcoord', 'out'))];
  const run = async (kind: 'baseline' | 'shared' | 'flattened', warmup: boolean) => {
    await setup();
    const start = performance.now();
    if (kind === 'shared') {
      const helper = await engine.executeCommand(`benchData=${binding}`);
      if (!helper.success || !await api('isDefined', 'benchData')) throw new Error(`list creation failed: ${helper.error}`);
      const helperType = String(await api('getObjectType', 'benchData'));
      if (helperType !== 'list') throw new Error(`helper is ${helperType}, expected list`);
    }
    const result = await engine.executeCommand(kind === 'shared' ? materialized
      : kind === 'flattened' ? `${flattened!.assignments.join('\n')}\n${flattened!.result}` : baseline);
    const create = performance.now() - start;
    if (!result.success || !await api('isDefined', 'out')) throw new Error(`${kind} output failed: ${result.error}`);
    const updates: number[] = [];
    const equations: string[] = [];
    const values: number[][] = [];
    if (tool === 'conic') values.push(await conicCoefficients());
    if (tool === 'pretangential') values.push(await pointCoordinates());
    for (const [index, [x, y]] of positions.entries()) {
      const updateStart = performance.now();
      if (tool === 'conic') await api('setValue', 'shift', [0.05, -0.05, 0][index]);
      else if (tool === 'pretangential') await api('setValue', 'shape', [1.02, 0.98, 1][index]);
      else await api('setCoords', moving, x, y);
      const equation = String(await api('getValueString', 'out'));
      equations.push(equation);
      updates.push(performance.now() - updateStart);
      if (!await api('isDefined', 'out') || !/[1-9]/u.test(equation)) throw new Error(`${kind} lost its curve at update ${index}: ${equation}`);
      if (tool === 'conic') values.push(await conicCoefficients());
      if (tool === 'pretangential') values.push(await pointCoordinates());
    }
    if (!warmup) {
      if ((tool === 'conic' || tool === 'pretangential')) {
        if (kind === 'baseline' && !reference) reference = values;
        const matches = tool === 'conic'
          ? values.every((row, i) => proportional(row, reference![i]))
          : values.every((row, i) => row.every((v, j) => Number.isFinite(v) && Math.abs(v - reference![i][j]) < 1e-5));
        if (!matches) throw new Error(`${kind} result differs from baseline: ${JSON.stringify(values)} vs ${JSON.stringify(reference)}`);
        if (tool === 'conic' && proportional(values[0], values[1])) throw new Error(`${kind} conic failed to depend on shift`);
      }
      if (tool === 'inverse') {
        if (kind === 'baseline' && !inverseReference) inverseReference = equations;
        if (inverseReference && equations.some((equation, i) => equation !== inverseReference![i]))
          throw new Error(`${kind} inverse equation differs from baseline: ${JSON.stringify(equations)} vs ${JSON.stringify(inverseReference)}`);
      }
      if (kind === 'flattened' && samples.flattened.length === 0) {
        const names = await api('getAllObjectNames') as string[];
        const helpers = names.filter((name) => /^v\d+$/u.test(name));
        const types = await Promise.all(helpers.map((name) => api('getObjectType', name).then(String)));
        report(`${tool}: created ${helpers.length} helpers, types ${JSON.stringify([...new Set(types)])}`);
        if (helpers.length !== flattened!.assignments.length || types.some((type) => ['point', 'line', 'conic', 'implicitpoly', 'vector', 'segment', 'ray'].includes(type)))
          throw new Error(`${tool}: helper count or type invalid`);
      }
      samples[kind].push({ create, updates, ...(values.length ? { values } : {}) });
    }
    report(`${warmup ? 'WARM' : 'RUN'} ${kind}: create ${create.toFixed(1)} ms; updates ${updates.map((n) => n.toFixed(1)).join(', ')} ms`);
  };
  await run('baseline', true);
  if (binding) await run('shared', true);
  if (flattened) await run('flattened', true);
  for (const kind of (tool === 'pretangential' ? ['baseline', 'flattened', 'flattened', 'baseline']
    : flattened
    ? ['baseline', 'shared', 'flattened', 'flattened', 'shared', 'baseline']
    : ['baseline', 'shared', 'shared', 'baseline']) as Array<'baseline' | 'shared' | 'flattened'>) await run(kind, false);
  for (const kind of (tool === 'pretangential' ? ['baseline', 'flattened']
    : flattened ? ['baseline', 'shared', 'flattened'] : ['baseline', 'shared']) as Array<'baseline' | 'shared' | 'flattened'>) {
    const creates = samples[kind].map((s) => s.create);
    const updates = samples[kind].flatMap((s) => s.updates);
    report(`RESULT ${tool} ${kind}: create median ${median(creates).toFixed(1)} ms; update median ${median(updates).toFixed(1)} ms`);
  }
};
