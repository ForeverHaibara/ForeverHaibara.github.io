import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { boundSevenTermInverseEquation, directQaEquation, directQaInverseEquation, directSevenTermInverseEquation, legacyQaInverseEquation } from './geogebra-qa-candidates';

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
