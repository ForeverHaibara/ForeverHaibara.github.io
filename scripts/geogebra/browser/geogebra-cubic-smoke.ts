import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';

/** Focused native-engine regression: verification.html?page=smoke&suite=cubic. */
export const verifyCubic = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
  const near = async (expression: string, message: string) => check(Math.abs(Number(await api('getValue', expression))) < 1e-7, message);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand}`);
    return result;
  };
  await run('offset=1\nF=ImplicitCurve(y^2-x^3+x-offset)\nP=(0,sqrt(offset))\nQ=(1,sqrt(offset))');
  for (const [label, source, type] of [
    ['PolarResult', 'Polar(P,F)', 'line'],
    ['ConicResult', 'PolarConic(P,F)', 'conic'],
    ['SecantResult', 'ThirdIntersection(F,P,Q)', 'point'],
    ['TangentResult', 'ThirdIntersection(F,P)', 'point'],
  ]) {
    const before = (await api('getAllObjectNames') as string[]).length;
    await run(`${label}=${source}`);
    check(await api('isDefined', label) === true, `${source} is defined`);
    check(new RegExp(`<element\\b[^>]*\\btype="${type}"`, 'u').test(String(await api('getXML', label))), `${source} has type ${type}`);
    check((await api('getAllObjectNames') as string[]).length === before + 1, `${source} creates no helper labels`);
  }
  await near('Distance(P,PolarResult)', 'polar at a smooth curve point is the tangent');
  await near('Distance(SecantResult,(-1,1))', 'secant residual intersection is correct');
  await near('Distance(TangentResult,(0.25,0.875))', 'tangent residual intersection is correct');
  const checkDependencies = async () => {
    await near('Distance(P,PolarResult)', 'polar updates with the curve and pole');
    await near('x(SecantResult)+1', 'secant residual retains its defining root');
    await near('y(SecantResult)-sqrt(offset)', 'secant residual follows coefficient changes');
    await near('y(TangentResult)^2-x(TangentResult)^3+x(TangentResult)-offset', 'tangent residual stays on the changing cubic');
    await near('Distance(P,Polar(PolarResult,ConicResult))', 'polar conic retains its second-polar tangent at the pole');
  };
  await api('setValue', 'offset', 2);
  await checkDependencies();
  report('RUN export cubic construction');
  const file = await engine.exportGgb();
  report('PASS export cubic construction');
  await engine.importGgb(new File([file], 'cubic-smoke.ggb'));
  report('PASS reopen cubic construction');
  await api('setValue', 'offset', 3);
  await checkDependencies();
  await api('setValue', 'offset', 1);
  report('PASS cubic operations survive coefficient changes and export/reopen');
  await run('Generic=ImplicitCurve(4-3*x+2*y+5*x^2-2*x*y+7*y^2+x^3+3*x^2*y-4*x*y^2+2*y^3)\nGenericPolar=Polar((1.2,-0.4),Generic)\nGenericConic=PolarConic((1.2,-0.4),Generic)');
  await near('Distance((0,-4),GenericPolar)+Distance((-12.48/10.6,0),GenericPolar)', 'all ten cubic coefficients contribute to the correct second polar');
  const expectedConic = [7.4, -0.2, 7.6, 8.4, 6.8, -4];
  for (let i = 0; i < expectedConic.length; i++) await near(`Element(Coefficients(GenericConic),${i + 1})*7.4-Element(Coefficients(GenericConic),1)*(${expectedConic[i]})`, `first polar coefficient ${i + 1} includes mixed and lower terms`);
  await run('VerticalCurve=ImplicitCurve(y*(y-1)*(y-2)+x)\nVerticalThird=ThirdIntersection(VerticalCurve,(0,0),(0,1))\nInflectionCurve=ImplicitCurve(y-x^3)\nInflectionThird=ThirdIntersection(InflectionCurve,(0,0))\nPureY=ImplicitCurve(y^3+0*x)\nPureYPolar=Polar((1,1),PureY)');
  await near('Distance(VerticalThird,(0,2))+Distance(InflectionThird,(0,0))+Distance((1,0),PureYPolar)', 'vertical secants, inflections and sparse pure-y cubics work');
  await run('Quartic=ImplicitCurve(x^4+y^4-1)\nCollision=ImplicitCurve(x^4-y+x^3)\nQuadratic=ImplicitCurve(x^2+y^2-1)');
  for (const curve of ['Quartic', 'Collision', 'Quadratic']) for (const [name, source] of [
    ['Line', `Polar(P,${curve})`], ['Conic', `PolarConic(P,${curve})`],
    ['Secant', `ThirdIntersection(${curve},P,Q)`], ['Tangent', `ThirdIntersection(${curve},P)`],
  ]) {
    const label = `${curve}${name}`;
    await run(`${label}=${source}`);
    check(!await api('isDefined', label), `${source} rejects noncubic input`);
  }
  await run('shape=1\nChanging=ImplicitCurve(shape*x^3+y^2+x-1)\nChangingPolar=Polar(P,Changing)');
  check(await api('isDefined', 'ChangingPolar') === true, 'dynamic degree guard initially accepts a cubic');
  await api('setValue', 'shape', 0);
  check(!await api('isDefined', 'ChangingPolar'), 'degree guard rejects a dynamic drop to degree two');
  await api('setValue', 'shape', 1);
  check(await api('isDefined', 'ChangingPolar') === true, 'zero-padding and degree guard recover after restoring the cubic term');
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nNativeTriangle=Cubic(A,B,C,1)\nPivot=PivotalIsogonalCubic(A,B,C,(2,1))\nInterpolated=Cubic((-1,1),(-1,-1),(0,1),(0,-1),(1,1),(1,-1),(2,sqrt(7)),(2,-sqrt(7)),(3,5))');
  for (const curve of ['NativeTriangle', 'Pivot', 'Interpolated']) {
    await run(`${curve}Polar=Polar((3,2),${curve})`);
    check(await api('isDefined', `${curve}Polar`) === true, `coefficient extraction accepts ${curve}`);
  }
};


/** Focused native-engine check: verification.html?page=smoke&suite=cubic-tools[&tool=Name]. */
export const verifyCubicTools = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand?.slice(0, 1000)}`);
    return result;
  };
  const selected = new URLSearchParams(window.location.search).get('tool');
  const cases: Array<[string, string, string, string]> = [
    ['OrthicAxis', 'oa=OrthicAxis(F)', 'oa', 'line'],
    ['CircularPolarPoint', 'cp=CircularPolarPoint(CF)', 'cp', 'point'],
    ['HessianCubic', 'hc=HessianCubic(F)', 'hc', 'implicit'],
    ['HessianCorrespondent', 'hp=HessianCorrespondent(F,P)', 'hp', 'point'],
    ['MixedPolar', 'mp=MixedPolar(P,Q,F)', 'mp', 'line'],
    ['Poloconic', 'po=Poloconic(l,F)', 'po', 'conic'],
    ['JacobianCubic', 'jc=JacobianCubic(q1,q2,q3)', 'jc', 'implicit'],
    ['ConicLineCubic', 'cl=ConicLineCubic(q1,l)', 'cl', 'implicit'],
    ['CubicPencil', 'pc=CubicPencil(F,G,Q)', 'pc', 'implicit'],
    ['CircularCubic', 'cc=CircularCubic(A,B,C,D,E,T,U)', 'cc', 'implicit'],
    ['CayleyBacharachPoint8', 'cb8=CayleyBacharachPoint(A8,B8,C8,D8,E8,F8,G8,H8)', 'cb8', 'point'],
    ['CayleyBacharachPoint6', 'cb6=CayleyBacharachPoint(A6,B6,C6,D6,E6,F6)', 'cb6', 'point'],
  ];
  await run('F=ImplicitCurve(x^3+y^3+(x+y+1)^3)\nCF=ImplicitCurve(x*(x^2+y^2)+x^2-y^2)\nG=ImplicitCurve(x^3+y^3+x^2+1)\nP=(0,1)\nQ=(0,0)\nl:x=0\nq1=Conic(1,1,-1,0,0,0)\nq2=Conic(1,2,-1,0,1,0)\nq3=Conic(0,0,-1,1,0,1)');
  if (selected === 'degenerate') {
    await run('A=(0,0)\nF0=ImplicitCurve(x^3+y^3)\nG0=ImplicitCurve(x^3-y^3)\nO0=(0,0)\ncc0=CircularCubic(A,A,A,A,A,A,A)\ncp0=CubicPencil(F0,G0,O0)');
    for (const label of ['cc0', 'cp0']) if (await api('isDefined', label)) throw new Error(`${label} incorrectly defines a zero cubic`);
    report('PASS dependent seven-point and base-point pencil configurations are undefined');
    return;
  }
  if (!selected || selected === 'CircularCubic') await run('A=(2,-2)\nB=(2,-1)\nC=(2,0)\nD=(2,1)\nE=(3,4)\nT=(-3,4)\nU=(0,-5)');
  if (!selected || selected === 'CayleyBacharachPoint8') await run('A8=(0,0)\nB8=(1,0)\nC8=(2,0)\nD8=(0,1)\nE8=(1,1)\nF8=(2,1)\nG8=(0,2)\nH8=(1,2)');
  if (!selected || selected === 'CayleyBacharachPoint6') await run('A6=(2,sqrt(21))\nB6=(2,-sqrt(21))\nC6=(0,3)\nD6=(0,-3)\nE6=(5,0)\nF6=(-5,0)');
  for (const [name, source, label, type] of cases) {
    if (selected && selected !== name) continue;
    report(`RUN ${name}`);
    const before = (await api('getAllObjectNames') as string[]).length;
    const result = await run(source);
    if (!await api('isDefined', label)) throw new Error(`${name} is undefined`);
    const xml = String(await api('getXML', label));
    if (!new RegExp(`<element\\b[^>]*\\btype="${type}`, 'u').test(xml)) throw new Error(`${name} type mismatch: ${xml.slice(0, 250)}`);
    if ((await api('getAllObjectNames') as string[]).length !== before + 1) throw new Error(`${name} made helper objects`);
    report(`PASS ${name} (${result.expandedCommand?.length ?? 0} characters)`);
  }
  if (!selected || selected === 'HessianCorrespondent') {
    const d = Number(await api('getValue', 'Distance(hp,(-1,0))'));
    if (Math.abs(d) > 1e-7) throw new Error(`Hessian correspondent residual ${d}`);
    report('PASS Hessian correspondent is the polar-conic singular point');
  }
  if (!selected || selected === 'CircularPolarPoint') {
    const d = Number(await api('getValue', 'Distance(cp,(-1,0))'));
    if (Math.abs(d) > 1e-7) throw new Error(`Circular polar point residual ${d}`);
    report('PASS circular polar point');
  }
  if (selected === 'Poloconic') {
    const c = await Promise.all(Array.from({ length: 6 }, (_, i) => api('getValue', `Element(Coefficients(po),${i + 1})`))).then((values) => values.map(Number));
    const scale = Math.max(...c.map(Math.abs));
    if (!(scale > 0) || Math.max(Math.abs(c[0]), Math.abs(c[2]), Math.abs(c[4]), Math.abs(c[1] - c[3]), Math.abs(c[1] - c[5])) / scale > 1e-7)
      throw new Error(`Poloconic coefficient mismatch: ${c.join(', ')}`);
    report('PASS poloconic equals y(x+y+1)=0 for the independent example');
  }
  if (!selected || selected === 'CayleyBacharachPoint8') {
    const d = Number(await api('getValue', 'Distance(cb8,(2,2))'));
    if (Math.abs(d) > 1e-6) throw new Error(`Eight-point Cayley–Bacharach residual ${d}`);
    report('PASS general Cayley–Bacharach point');
  }
  if (!selected || selected === 'CayleyBacharachPoint6') {
    const d = Number(await api('getValue', 'Distance(cb6,(0,0))'));
    if (Math.abs(d) > 1e-6) throw new Error(`Six-point Cayley–Bacharach residual ${d}`);
    report('PASS circular Cayley–Bacharach point');
  }
  if (selected === 'CubicPencil') {
    const before = String(await api('getValueString', 'pc'));
    await api('setCoords', 'Q', 0.2, 0.3);
    if (!await api('isDefined', 'pc') || String(await api('getValueString', 'pc')) === before) throw new Error('CubicPencil did not update after moving P');
    report('PASS CubicPencil updates when its selected point moves');
    const file = await engine.exportGgb();
    await engine.importGgb(new File([file], 'cubic-tools-smoke.ggb'));
    if (!await api('isDefined', 'pc')) throw new Error('CubicPencil did not survive reopening');
    report('PASS CubicPencil survives export and reopen');
  }
  if (selected === 'CayleyBacharachPoint8') {
    const before = String(await api('getValueString', 'cb8'));
    await api('setCoords', 'H8', 1.1, 2);
    if (!await api('isDefined', 'cb8') || String(await api('getValueString', 'cb8')) === before) throw new Error('CayleyBacharachPoint did not update after moving an input');
    report('PASS CayleyBacharachPoint updates when an input moves');
  }
};


/** Native checks for the inserted cubic-tool section. */
export const verifyCubicMisc = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand?.slice(0, 1200)}`);
    return result;
  };
  const selected = new URLSearchParams(window.location.search).get('tool');
  const setup = [
    'A=(0,0)', 'B=(1/2,1/2)', 'C=(1/2,-1/2)', 'D=(4/5,8/5)', 'E=(4/5,-8/5)',
    'F=(9/10,27/10)', 'G=(-2,3)', 'J=(3,-2)', 'l:x=2',
    'T=ImplicitCurve(x^3-x+1-y^2)', 'P=(0,1)',
    'K=ImplicitCurve(x^3-3*x*y^2+1)',
    'W=ImplicitCurve(y^2-x^3+x)', 'X=(1,0)', 'Y=(2,sqrt(6))',
  ].join('\n');
  await run(setup);
  const cases: Array<[string, string, string[], string]> = [
    ['CircularCubicDirection', 'CircularCubic(A,B,C,D,E,F,l)', ['cc'], 'implicit'],
    ['NodalCubic7', 'NodalCubic(A,B,C,D,E,F,G)', ['nc'], 'implicit'],
    ['NodalCubic5', 'NodalCubic(A,B,C,D,E)', ['nc'], 'implicit'],
    ['NodalCubicDirection', 'NodalCubic(A,B,C,D,l)', ['nc'], 'implicit'],
    ['NodalStrophoid', 'NodalCubic(A,B,C,D)', ['nc'], 'implicit'],
    ['NodalStrophoidDirection', 'NodalCubic(A,B,C,l)', ['nc'], 'implicit'],
    ['Strophoid4', 'Strophoid(A,B,C,D)', ['st'], 'implicit'],
    ['StrophoidDirection', 'Strophoid(A,B,C,l)', ['st'], 'implicit'],
    ['StrophoidAngles', 'Strophoid(A,B,C)', ['st'], 'implicit'],
    ['StrophoidCircle', 'Strophoid(A,B,l)', ['st'], 'implicit'],
    ['Tangential', 'Tangential(T,P)', ['ta'], 'point'],
    ['CubicAsymptotes', 'CubicAsymptotes(K)', ['as_1', 'as_2', 'as_3'], 'line'],
    ['Pretangential', 'Pretangential(W,X)', ['pr_1', 'pr_2', 'pr_3', 'pr_4'], 'point'],
    ['CubicInvolution', 'CubicInvolution(W,Y)', ['iv_1', 'iv_2', 'iv_3'], 'point'],
  ];
  for (const [name, command, labels, type] of cases) {
    if (selected && selected !== name) continue;
    await api('newConstruction');
    await run(setup);
    report(`RUN ${name}`);
    const label = labels[0].split('_')[0];
    const before = (await api('getAllObjectNames') as string[]).length;
    const result = await run(`${label}=${command}`);
    report(`EXPANDED ${name} ${result.expandedCommand?.length ?? 0}`);
    const outputs = labels.length > 1 ? result.labels : [label];
    if (outputs.length !== labels.length) throw new Error(`${name}: expected ${labels.length} independent outputs, received ${outputs.join(',')}`);
    const after = (await api('getAllObjectNames') as string[]).length;
    if (after !== before + labels.length) throw new Error(`${name}: created ${after - before} objects for ${labels.length} outputs`);
    for (const output of outputs) {
      if (!await api('isDefined', output)) throw new Error(`${name}: ${output} undefined`);
      const xml = String(await api('getXML', output));
      if (!new RegExp(`<element\\b[^>]*\\btype="${type}`, 'u').test(xml)) throw new Error(`${name}: ${output} wrong XML type: ${xml.slice(0, 250)}`);
      if (name === 'Pretangential' || name === 'CubicInvolution') {
        const x = Number(await api('getXcoord', output)); const y = Number(await api('getYcoord', output));
        const y0 = Math.sqrt(6); const tangentSlope = 11 / (2 * y0);
        const targetX = name === 'Pretangential' ? 1 : tangentSlope ** 2 - 4;
        const targetY = name === 'Pretangential' ? 0 : y0 + tangentSlope * (targetX - 2);
        if (Math.abs(y * y - x ** 3 + x) > 1e-6 ||
          Math.abs((1 - 3 * x * x) * (targetX - x) + 2 * y * (targetY - y)) > 1e-5)
          throw new Error(`${name}: ${output} fails cubic/tangent conditions`);
        if (name === 'CubicInvolution' && Math.hypot(x - 2, y - y0) < 1e-6)
          throw new Error(`${name}: ${output} equals the excluded input Y`);
      }
    }
    report(`PASS ${name}`);
  }
  for (const [name, command, expected] of [
    ['PretangentialFlex', 'fp=Pretangential(V,Z)', [true, true, false, false]],
    ['CubicInvolutionFlex', 'fi=CubicInvolution(V,Z)', [true, false, false]],
  ] as const) {
    if (selected && selected !== name) continue;
    await api('newConstruction');
    await run('V=ImplicitCurve(y^2-x^3-1)\nZ=(0,1)');
    report(`RUN ${name}`);
    const before = (await api('getAllObjectNames') as string[]).length;
    const result = await run(command);
    if (result.labels.length !== expected.length) throw new Error(`${name}: expected ${expected.length} independent outputs`);
    const after = (await api('getAllObjectNames') as string[]).length;
    if (after !== before + expected.length) throw new Error(`${name}: created ${after - before} objects for ${expected.length} outputs`);
    for (let i = 0; i < expected.length; i++) {
      const label = result.labels[i];
      if (Boolean(await api('isDefined', label)) !== expected[i]) throw new Error(`${name}: ${label} unexpected defined state`);
      if (await api('getObjectType', label) !== 'point') throw new Error(`${name}: ${label} is not a point`);
    }
    report(`PASS ${name}`);
  }
};


/** Focused native check: verification.html?page=smoke&suite=isocubics[&tool=Name]. */
export const verifyIsocubics = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand?.slice(0, 1300)}`);
    return result;
  };
  const selected = new URLSearchParams(window.location.search).get('tool');
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nO=(2,1)\nP=(2,3)\nQ=(3,1)\nN=(1.5,1.2)');
  if (selected === 'qa-neuberg') {
    await run('isoPoint=TriangleCenter(A,B,C,15)\ncenter3=TriangleCenter(A,B,C,3)\ninv=QACu1Inv(A,B,C,isoPoint)\nneub=OrthopivotalCubic(A,B,C,center3)');
    if (!await api('isDefined', 'inv') || !await api('isDefined', 'neub')) throw new Error('isodynamic specialization is undefined');
    await run('inverseFunction(x,y)=LeftSide(inv)-RightSide(inv)\nneubergFunction(x,y)=LeftSide(neub)-RightSide(neub)');
    const samples = [[2, 1], [3, 2], [4, 1], [-1, 2]];
    const pairs = await Promise.all(samples.map(async ([x, y]) => [
      Number(await api('getValue', `inverseFunction(${x},${y})`)),
      Number(await api('getValue', `neubergFunction(${x},${y})`)),
    ]));
    const reference = pairs.find(([, second]) => Number.isFinite(second) && Math.abs(second) > 1e-6);
    if (!reference) throw new Error('no nonzero Neuberg reference sample');
    const scale = reference[0] / reference[1];
    if (!pairs.every(([first, second]) => Number.isFinite(first) && Number.isFinite(second)
      && Math.abs(first - scale * second) <= 1e-6 * Math.max(1, Math.abs(first), Math.abs(scale * second))))
      throw new Error(`QA inverse at X15 differs from Neuberg cubic: ${JSON.stringify(pairs)}`);
    report('PASS QACu1Inv at X15 is proportional to Neuberg cubic K001');
    return;
  }
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
