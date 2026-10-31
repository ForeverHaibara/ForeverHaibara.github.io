import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { add, barycentricVariables, bind, coefficientList, mul, squaredNorm, triangleAreas, triangleSideSquares } from '../../../src/features/geogebra/commands/custom/algebra/homogeneous';
import { qaCu1Coefficients } from '../../../src/features/geogebra/commands/custom/builders/triangleCubics';
import { qaCu1InverseBarycentricCoefficients, qaCu1InverseCoefficients, qaCu1InverseEquation, qaCu1InverseSevenTermEquation } from '../../../src/features/geogebra/commands/custom/builders/triangleCubics';

type Sample = { create: number; updates: number[] };
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};

/** Isolated native comparison on geogebra-smoke.html?suite=qa-performance&tool=qa|inverse. */
export const verifyQaPerformance = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
  const tool = new URLSearchParams(location.search).get('tool') === 'inverse' ? 'inverse' : 'qa';
  const variant = new URLSearchParams(location.search).get('variant') ?? (tool === 'inverse' ? 'bound' : 'direct');
  const old = tool === 'qa' ? 'out=QACu1(A,B,C,D)' : 'out=QACu1Inv(A,B,C,P)';
  const direct = `out=${tool === 'qa' ? directQaEquation()
    : variant === 'bound' ? boundSevenTermInverseEquation()
    : variant === 'seven' ? directSevenTermInverseEquation()
    : directQaInverseEquation()}`;
  const candidateName = tool === 'inverse' && variant === 'bound' ? 'seven-coefficient' : variant;
  const moving = tool === 'qa' ? 'D' : 'P';
  const positions = [[1.8, 1.1], [2.1, 1.2], [1.9, 0.9], [2, 1]];
  const setup = async () => {
    await api('newConstruction');
    await api('setCoordSystem', -2, 8, -2, 6);
    const result = await engine.executeCommand('A=(0,0)\nB=(6,0)\nC=(1,4)\nD=(2,1)\nP=(2,3)');
    if (!result.success) throw new Error(result.error ?? 'setup failed');
  };
  await setup();
  const oldExpanded = tool === 'inverse' ? `out=${legacyQaInverseEquation()}` : await (async () => {
    const result = await executeCommandPipeline(engine, old);
    if (!result.success || !result.expandedCommand) throw new Error(`baseline expansion failed: ${result.error}`);
    return result.expandedCommand;
  })();
  report(`${tool}/${variant}: baseline=${oldExpanded.length} chars, candidate=${direct.length} chars`);
  const samples: Record<'current' | 'direct', Sample[]> = { current: [], direct: [] };
  const run = async (kind: 'current' | 'direct', warmup: boolean) => {
    await setup();
    const started = performance.now();
    const result = await engine.executeCommand(kind === 'current' ? oldExpanded : direct);
    const create = performance.now() - started;
    if (!result.success || !await api('isDefined', 'out')) throw new Error(`${kind} ${tool} failed to create: ${result.error}`);
    const updates: number[] = [];
    for (const [x, y] of positions) {
      const updateStart = performance.now();
      await api('setCoords', moving, x, y);
      const equation = String(await api('getValueString', 'out'));
      updates.push(performance.now() - updateStart);
      if (!await api('isDefined', 'out') || !/[1-9]/u.test(equation))
        throw new Error(`${kind} ${tool} lost its nonzero curve at ${moving}=(${x},${y})`);
    }
    if (!warmup) samples[kind].push({ create, updates });
    report(`${warmup ? 'WARM' : 'RUN'} ${kind === 'current' ? (tool === 'inverse' ? 'legacy' : 'current') : candidateName}: create ${create.toFixed(1)} ms; updates ${updates.map((v) => v.toFixed(1)).join(', ')} ms`);
  };
  await run('current', true);
  await run('direct', true);
  for (const kind of ['current', 'direct', 'direct', 'current'] as const) await run(kind, false);
  for (const kind of ['current', 'direct'] as const) {
    const create = samples[kind].map((v) => v.create);
    const updates = samples[kind].flatMap((v) => v.updates);
    report(`RESULT ${tool}/${variant} ${kind === 'current' ? (tool === 'inverse' ? 'legacy' : 'current') : candidateName}: create median ${median(create).toFixed(1)} ms; update median ${median(updates).toFixed(1)} ms; raw create ${create.map((v) => v.toFixed(1)).join(', ')}`);
  }
};

/** Benchmark candidates only. Keep them separate until native equivalence and timing pass. */

const vertices = ['A', 'B', 'C'];
const xyz = barycentricVariables(vertices);
const sides = triangleSideSquares(vertices);

export const directQaEquation = () => {
  const d = triangleAreas([...vertices, 'D']);
  const t = d.map((v, i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return `${sides[i]}*(${v}+${d[j]})*(${v}+${d[k]})-${sides[j]}*${v}*(${v}+${d[j]})-${sides[k]}*${v}*(${v}+${d[k]})`;
  });
  const cs = qaCu1Coefficients(sides, d, t);
  const terms = [0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [mul(cs[2 * i], `${xyz[j]}^2`, xyz[k]), mul(cs[2 * i + 1], xyz[j], `${xyz[k]}^2`)];
  });
  return `If(IsDefined(A)&&IsDefined(B)&&IsDefined(C)&&IsDefined(D)&&!AreCollinear(A,B,C)&&(${squaredNorm(cs)})!=0,ImplicitCurve(${add(terms)}))`;
};

export const directQaInverseEquation = () => {
  const fixed = triangleAreas([...vertices, 'P']);
  const guard = `${squaredNorm(qaCu1InverseCoefficients(sides, fixed))}!=0`;
  return `If(${guard},ImplicitCurve(${qaCu1InverseEquation(sides, xyz, fixed)}))`;
};

/** Snapshot of the pre-optimization inverse builder for reproducible timings. */
export const legacyQaInverseEquation = () => {
  let index = 0;
  const allocate = () => `qaLegacy${++index}`;
  const fixed = triangleAreas([...vertices, 'P']);
  const values = [...sides, ...fixed];
  const equation = bind(values, allocate, (v) => qaCu1InverseEquation(v.slice(0, 3), xyz, v.slice(3)));
  const guard = bind(values, allocate, (v) => `${squaredNorm(qaCu1InverseCoefficients(v.slice(0, 3), v.slice(3)))}!=0`);
  return `If(${guard},ImplicitCurve(${equation}))`;
};

export const directSevenTermInverseEquation = () => {
  const fixed = triangleAreas([...vertices, 'P']);
  const coefficients = qaCu1InverseBarycentricCoefficients(sides, fixed);
  return `If(${squaredNorm(coefficients)}!=0,ImplicitCurve(${qaCu1InverseSevenTermEquation(xyz, coefficients)}))`;
};

export const boundSevenTermInverseEquation = () => {
  let index = 0;
  const allocate = () => `qaLocal${++index}`;
  const fixed = triangleAreas([...vertices, 'P']);
  const data = bind([...sides, ...fixed], allocate, (values) =>
    coefficientList(qaCu1InverseBarycentricCoefficients(values.slice(0, 3), values.slice(3))));
  const elements = (list: string) => Array.from({ length: 7 }, (_, i) => `Element(${list},${i + 1})`);
  const polynomial = bind([data], allocate, ([list]) => qaCu1InverseSevenTermEquation(xyz, elements(list)));
  const guard = bind([data], allocate, ([list]) => `${squaredNorm(elements(list))}!=0`);
  return `If(${guard},ImplicitCurve(${polynomial}))`;
};
