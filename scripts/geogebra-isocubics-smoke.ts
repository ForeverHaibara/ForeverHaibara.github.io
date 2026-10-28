import type { GeoGebraEngine } from '../src/features/geogebra/types';
import { executeCommandPipeline } from '../src/features/geogebra/commands/commandPipeline';

/** Focused native check: geogebra-smoke.html?suite=isocubics[&tool=Name]. */
export const verifyIsocubics = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand?.slice(0, 1300)}`);
    return result;
  };
  const selected = new URLSearchParams(window.location.search).get('tool');
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nO=(2,1)\nP=(2,3)\nQ=(3,1)\nN=(1.5,1.2)');
  if (selected === 'qa-interior') {
    await api('setCoordSystem', -2, 8, -2, 6);
    await run('D=(-1,2)\nqa=QACu1(A,B,C,D)\nqi=QACu1Inv(A,B,C,P)');
    for (const [label, moving, positions] of [
      ['qa', 'D', [[-1, 2], [2, 1], [1, 1], [-1, 2]]],
      ['qi', 'P', [[2, 3], [-1, 2], [2, 1], [2, 3]]],
    ] as const) for (const [x, y] of positions) {
      await api('setCoords', moving, x, y);
      if (!await api('isDefined', label)) throw new Error(`${label} undefined at ${moving}=(${x},${y})`);
      if (!await api('getVisible', label)) throw new Error(`${label} hidden at ${moving}=(${x},${y})`);
      const equation = String(await api('getValueString', label));
      if (!/[1-9]/u.test(equation) || equation.toLowerCase().includes('undefined'))
        throw new Error(`${label} has no nonzero polynomial at ${moving}=(${x},${y}): ${equation}`);
      report(`PASS ${label} stays visible and nonzero at ${moving}=(${x},${y})`);
    }
    await api('setCoords', 'D', 2, 1);
    await run('qaFresh=QACu1(A,B,C,D)');
    if (!await api('isDefined', 'qaFresh') || !await api('getVisible', 'qaFresh'))
      throw new Error('a freshly created QA cubic is missing at an interior D');
    report('PASS a fresh QA cubic is visible with D initially inside ABC');
    const file = await engine.exportGgb();
    await engine.importGgb(new File([file], 'qa-interior-smoke.ggb'));
    for (const label of ['qa', 'qi', 'qaFresh']) if (!await api('isDefined', label)) throw new Error(`${label} lost after reopen`);
    report('PASS both QA curves survive export and reopen at interior inputs');
    return;
  }
  if (selected === 'degenerate') {
    for (const [label, source] of [
      ['p0', 'PivotalCubic(A,B,C,A,A)'],
      ['n0', 'NonpivotalCubic(A,B,C,O,P,A)'],
      ['q0', 'QACu1Inv(A,B,C,A)'],
      ['c0', 'ConicoPivotalCubic(A,B,C,A,A)'],
    ]) {
      await run(`${label}=${source}`);
      if (await api('isDefined', label)) throw new Error(`${source} incorrectly defines a zero cubic`);
      report(`PASS ${source} is undefined`);
    }
    return;
  }
  const cases: Array<[string, string, string]> = [
    ['PivotalCubic', 'pc=PivotalCubic(A,B,C,O,P)', 'pc'],
    ['PivotalIsotomicCubic', 'iso=PivotalIsotomicCubic(A,B,C,P)', 'iso'],
    ['NonpivotalCubic6', 'n6=NonpivotalCubic(A,B,C,O,P,Q)', 'n6'],
    ['NonpivotalCubic5', 'n5=NonpivotalCubic(A,B,C,O,P)', 'n5'],
    ['QACu1Inv', 'qi=QACu1Inv(A,B,C,P)', 'qi'],
    ['ConicoPivotalCubic', 'co=ConicoPivotalCubic(A,B,C,N,P)', 'co'],
  ];
  for (const [name, source, label] of cases) {
    if (selected && selected !== name) continue;
    report(`RUN ${name}`);
    const before = (await api('getAllObjectNames') as string[]).length;
    const started = performance.now();
    const result = await run(source);
    const creationMs = Math.round(performance.now() - started);
    if (!await api('isDefined', label)) throw new Error(`${name} is undefined`);
    const xml = String(await api('getXML', label));
    if (!/<element\b[^>]*\btype="implicit/u.test(xml)) throw new Error(`${name} type mismatch: ${xml.slice(0, 250)}`);
    if ((await api('getAllObjectNames') as string[]).length !== before + 1) throw new Error(`${name} made helper objects`);
    report(`PASS ${name} (${result.expandedCommand?.length ?? 0} characters, ${creationMs} ms to create)`);
  }
  const onCurve = async (curve: string, point: string, description: string) => {
    const residual = Number(await api('getValue', `LeftSide(${curve})(x(${point}),y(${point}))-RightSide(${curve})(x(${point}),y(${point}))`));
    if (!Number.isFinite(residual) || Math.abs(residual) > 1e-6) throw new Error(`${description}: residual ${residual}`);
    report(`PASS ${description}`);
  };
  if (!selected || selected === 'PivotalCubic') await onCurve('pc', 'P', 'pivot lies on the pivotal cubic');
  if (!selected || selected === 'NonpivotalCubic6') await onCurve('n6', 'Q', 'specified point lies on the nonpivotal cubic');
  if (!selected || selected === 'QACu1Inv') await onCurve('qi', 'P', 'the fourth vertex P belongs to its QA inverse cubic');
  if (!selected || selected === 'ConicoPivotalCubic') await onCurve('co', 'N', 'designated singular point belongs to the conico-pivotal cubic');
  if (!selected) {
    const before = String(await api('getValueString', 'qi'));
    const started = performance.now();
    await api('setCoords', 'P', 2.2, 3.1);
    if (!await api('isDefined', 'qi') || String(await api('getValueString', 'qi')) === before) throw new Error('QA inverse did not follow P');
    report(`PASS QA inverse updates with P (${Math.round(performance.now() - started)} ms)`);
    await api('setCoords', 'P', 0, 0);
    if (await api('isDefined', 'qi')) throw new Error('QA inverse failed to become undefined at a vertex');
    await api('setCoords', 'P', 2, 3);
    if (!await api('isDefined', 'qi')) throw new Error('QA inverse did not recover');
    report('PASS QA inverse undefined state recovers');
    await api('setCoords', 'Q', 0, 0);
    if (await api('isDefined', 'n6')) throw new Error('Nonpivotal member failed to become undefined at a vertex Q');
    await api('setCoords', 'Q', 3, 1);
    if (!await api('isDefined', 'n6')) throw new Error('Nonpivotal member did not recover');
    report('PASS nonpivotal member undefined state recovers');
    const file = await engine.exportGgb();
    await engine.importGgb(new File([file], 'isocubics-smoke.ggb'));
    for (const curve of ['pc', 'iso', 'n6', 'n5', 'qi', 'co']) if (!await api('isDefined', curve)) throw new Error(`${curve} did not survive reopening`);
    report('PASS all second-stage curves survive export and reopen');
  }
};
