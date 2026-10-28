import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';

/** Focused native-engine regression: geogebra-smoke.html?suite=cubic. */
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
