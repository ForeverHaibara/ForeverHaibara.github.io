import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';

/** Focused native-engine check: geogebra-smoke.html?suite=cubic-tools[&tool=Name]. */
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
