import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { readCommandEnvironment } from '../../../src/features/geogebra/commands/custom/commandEnvironment';
import { studioToolLibrary } from '../../../src/features/geogebra/commands/custom/toolLibrary';

/** Disposable native-engine checks: verification.html?page=smoke&suite=constructions. */
export const verifyConstructions = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const value = async (expression: string) => Number(await api('getValue', expression));
  const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
  const near = async (expression: string, message: string) => check(Math.abs(await value(expression)) < 2e-7, message);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand}`);
    return result;
  };
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nD=(-2,3)\nP=(2,1)\nQ=(1.5,1.4)\nX=(2.1,1.2)\nY=(1.2,0.8)\nc1=Circle(A,1)\nc2=Circle(B,2)\nl=Line(A,B)\nl1=Line(A,B)\nl2=Line(B,C)\nl3=Line(C,D)\nl4=Line(D,A)\ncurveOffset=1\ncubicCurve:y^2=x^3-x+curveOffset');
  const cubicPoints = ['(-1,sqrt(curveOffset))', '(-1,-sqrt(curveOffset))', '(0,sqrt(curveOffset))', '(0,-sqrt(curveOffset))', '(1,sqrt(curveOffset))', '(1,-sqrt(curveOffset))', '(2,sqrt(6+curveOffset))', '(2,-sqrt(6+curveOffset))', '(3,sqrt(24+curveOffset))'];
  await run(cubicPoints.map((point, i) => `P${i + 1}=${point}`).join('\n'));
  const names = new Set([
    'FermatPoint', 'FeuerbachPoint', 'SimsonLine', 'SteinerLine', 'AntiSteinerPoint',
    'Orthotransversal', 'Orthocorrespondent', 'TaylorCircle', 'AntigonalConjugate', 'CevianAffineMap',
    'PedalAffineMap', 'Isoconjugate', 'Crosspoint', 'Cevapoint', 'CevaConjugate',
    'CrossConjugate', 'CyclocevianConjugate', 'CommonTangents', 'MixtilinearIncircle', 'MixtilinearIncircles',
    'MixtilinearContactPoint', 'MixtilinearExcircle', 'MixtilinearExcircles', 'HaggeCircle', 'HaggeInverse',
    'ApolloniusCircle', 'ApolloniusCircles', 'IsogonalConjugate', 'IsotomicConjugate', 'KiepertHyperbola',
    'JerabekHyperbola', 'FeuerbachHyperbola', 'SteinerInellipse', 'SteinerCircumellipse', 'SteinerFoci',
    'InconicWithFocus', 'InconicWithCenter', 'IsogonalPairWithMidpoint', 'MiquelPoint', 'SteinerLineQ',
    'TangentParabola', 'NinePointConic', 'Cubic', 'Polar', 'PolarConic',
    'SecondIntersection', 'ThirdIntersection', 'PivotalIsogonalCubic',
  ]);
  let serial = 0;
  for (const tool of studioToolLibrary.tools.filter((tool) => names.has(tool.name))) for (const overload of tool.overloads) {
    if (['IsogonalConjugate', 'IsotomicConjugate', 'SecondIntersection'].includes(tool.name) && !overload.params.some((param) => param.type === 'lineLike')) continue;
    const arguments_ = overload.params.map((param) => {
      if (param.type === 'number') return '1';
      if (param.type === 'implicitCurve') return 'cubicCurve';
      if (tool.name === 'ThirdIntersection' && param.name === 'P') return '(0,1)';
      if (tool.name === 'ThirdIntersection' && param.name === 'Q') return '(1,1)';
      if (tool.name === 'SecondIntersection' && param.name === 'q') return 'Circle(A,B,C)';
      if (tool.name === 'SecondIntersection' && param.name === 'P') return 'A';
      return param.name;
    });
    const source = `${tool.name}(${arguments_.join(',')})`;
    const before = (await api('getAllObjectNames') as string[]).length;
    const result = await run(`Ptwo${++serial}=${source}`);
    const labels = result.labels ?? [];
    check(labels.length > 0 && (await api('getAllObjectNames') as string[]).length - before === labels.length, `${source}: only independent requested objects`);
    for (const label of labels) {
      check(Boolean(await api('isDefined', label)), `${label} is defined`);
      const xml = String(await api('getXML', label));
      const type = /<element\b[^>]*\btype="([^"]+)"/u.exec(xml)?.[1];
      check(type === ({ implicitCurve: 'implicitpoly', circle: 'conic' } as Record<string, string>)[overload.returns] || type === overload.returns, `${label} retains its promised geometry class (${type})`);
    }
  }

  // Evaluate a native conic with scale-normalized coefficients.
  const conicResidual = async (conic: string, point: string) => {
    const coefficients = await Promise.all(Array.from({ length: 6 }, (_, i) => value(`Element(Coefficients(${conic}),${i + 1})`)));
    const scale = Math.max(...coefficients.map(Math.abs));
    const [a, b, c, d, e, f] = coefficients.map((coefficient) => coefficient / scale);
    const x = await value(`x(${point})`); const y = await value(`y(${point})`);
    return Math.abs(a * x * x + b * y * y + c + d * x * y + e * x + f * y) / (1 + x * x + y * y);
  };
  await run('AG=AntigonalConjugate(A,B,C,P)\nAGback=AntigonalConjugate(A,B,C,AG)\nIso=Isoconjugate(A,B,C,X,Y,P)\nIsoBack=Isoconjugate(A,B,C,X,Y,Iso)\nCeva=CevaConjugate(A,B,C,Cevapoint(A,B,C,P,Q),P)\nCross=CrossConjugate(A,B,C,Crosspoint(A,B,C,P,Q),P)\nAffine=CevianAffineMap(A,B,C,Centroid(A,B,C),P)\nComplementary=Complement(A,B,C,P)\nCycle=CyclocevianConjugate(A,B,C,P)\nCycleBack=CyclocevianConjugate(A,B,C,Cycle)');
  await near('Distance(AGback,P)+Distance(IsoBack,P)+Distance(Ceva,Q)+Distance(Cross,Q)+Distance(Affine,Complementary)+Distance(CycleBack,P)', 'conjugation and affine defining identities');
  await run('PoleInput=(2*A+2*B-C)/3\nPoleCycle=CyclocevianConjugate(A,B,C,PoleInput)\nPoleCycleBack=CyclocevianConjugate(A,B,C,PoleCycle)\nOrthoH=Orthocorrespondent(A,B,C,Orthocenter(A,B,C))');
  await near('Distance(PoleCycleBack,PoleInput)+Distance(OrthoH,Centroid(A,B,C))', 'finite continuation through intermediate points and lines at infinity');

  await run('Mixt=MixtilinearIncircle(A,B,C)\nMixtOut=MixtilinearExcircle(A,B,C)\nCircum=Circle(A,B,C)\nContact=MixtilinearContactPoint(A,B,C)');
  for (const circle of ['Mixt', 'MixtOut']) {
    await near(`Distance(Center(${circle}),Line(A,B))-Radius(${circle})`, `${circle} touches AB`);
    await near(`Distance(Center(${circle}),Line(A,C))-Radius(${circle})`, `${circle} touches AC`);
  }
  await near('Distance(Center(Mixt),Center(Circum))+Radius(Mixt)-Radius(Circum)', 'internal mixtilinear tangency');
  await near('Distance(Center(MixtOut),Center(Circum))-Radius(MixtOut)-Radius(Circum)', 'external mixtilinear tangency');
  await near('Distance(Contact,Center(Circum))-Radius(Circum)', 'mixtilinear contact is on the circumcircle');
  await near('Distance(Contact,Center(Mixt))-Radius(Mixt)', 'mixtilinear contact is on the smaller circle');

  await run('Inner=SteinerInellipse(A,B,C)\nOuter=SteinerCircumellipse(A,B,C)\nCenterConic=InconicWithCenter(A,B,C,P)\nFocusOne=IsogonalPairWithMidpoint(A,B,C,P,1)\nFocusTwo=IsogonalPairWithMidpoint(A,B,C,P,2)\nFocusConjugate=IsogonalConjugate(A,B,C,FocusOne)\nMidConic=NinePointConic(A,B,C,D)');
  await near('Distance(Center(CenterConic),P)+Distance(Midpoint(FocusOne,FocusTwo),P)+Distance(FocusConjugate,FocusTwo)', 'central inconic and its isogonal foci');
  for (const point of ['(A+B)/2', '(B+C)/2', '(C+A)/2']) check(await conicResidual('Inner', point) < 1e-7, 'Steiner inellipse midpoint incidence');
  for (const point of ['A', 'B', 'C']) check(await conicResidual('Outer', point) < 1e-7, 'Steiner circumellipse vertex incidence');
  for (const pair of ['A,B', 'A,C', 'A,D', 'B,C', 'B,D', 'C,D']) check(await conicResidual('MidConic', `Midpoint(${pair})`) < 1e-7, 'six-midpoint conic incidence');
  await api('setCoords', 'D', -5, 4);
  check(Boolean(await api('isDefined', 'MidConic')), 'nine-point conic survives a parallelogram as a degenerate conic');
  await api('setCoords', 'D', -2, 3);

  await run('Miquel=MiquelPoint(A,B,C,D)\nMiquelLines=MiquelPoint(l1,l2,l3,l4)\nParabola=TangentParabola(A,B,C,D)\nQSteiner=SteinerLineQ(A,B,C,D)');
  await near('Distance(Miquel,MiquelLines)', 'point and line quadrilateral overloads agree');
  for (const line of ['l1', 'l2', 'l3', 'l4']) await near(`Distance(Reflect(Miquel,${line}),QSteiner)`, 'parabola focus reflects onto its directrix at each tangent');

  await run('EqualCircle=Circle(B,1)\nDirectTangent=CommonTangents(c1,EqualCircle,1,1)\nTransverse=CommonTangents(c1,c2,-1,2)');
  await near('Distance(A,DirectTangent)-1', 'equal-radius direct tangents remain finite');
  await near('Distance(B,DirectTangent)-1', 'equal-radius direct tangent touches both circles');
  await near('Distance(A,Transverse)-1', 'transverse tangent touches first circle');
  await near('Distance(B,Transverse)-2', 'transverse tangent touches second circle');

  await run('KH=KiepertHyperbola(A,B,C)\nJH=JerabekHyperbola(A,B,C)\nFH=FeuerbachHyperbola(A,B,C)\nAp=ApolloniusCircle(A,B,C)');
  await api('setCoords', 'C', 0, 4);
  for (const hyperbola of ['KH', 'JH', 'FH']) check(Boolean(await api('isDefined', hyperbola)), `${hyperbola} survives the right-triangle position`);
  await api('setCoords', 'C', 0, 6);
  check((await readCommandEnvironment(engine)).objects.get('Ap') === 'conic', 'linear Apollonius degeneration retains conic dispatch');
  await api('setCoords', 'C', 1, 4);

  await run('Interpolated=Cubic(P1,P2,P3,P4,P5,P6,P7,P8,P9)\nCurveP=(0,sqrt(curveOffset))\nCurveQ=(1,sqrt(curveOffset))\nSecantThird=ThirdIntersection(cubicCurve,CurveP,CurveQ)\nTangentThird=ThirdIntersection(cubicCurve,CurveP)\nCubicPolar=Polar(CurveP,cubicCurve)\nCubicPolarConic=PolarConic(CurveP,cubicCurve)\nQuarticCurve:x^4+y^4=1\nRejectedPolar=Polar(P,QuarticCurve)\nInflectionCurve=ImplicitCurve(y-x^3)\nInflectionThird=ThirdIntersection(InflectionCurve,(0,0))');
  await near('Distance(SecantThird,(-1,1))+Distance(TangentThird,(0.25,0.875))+Distance(InflectionThird,(0,0))', 'secant, tangent and inflection residual intersections');
  await near('Distance(CurveP,CubicPolar)', 'second polar at a smooth curve point is its tangent');
  check(await conicResidual('CubicPolarConic', 'CurveP') < 1e-7, 'first polar conic includes its on-curve pole');
  check(!await api('isDefined', 'RejectedPolar'), 'quartic inputs are rejected dynamically');
  await api('setValue', 'curveOffset', 2);
  await near('x(SecantThird)+1', 'residual-root construction updates with cubic coefficients');
  await near('y(TangentThird)^2-x(TangentThird)^3+x(TangentThird)-curveOffset', 'tangent residual stays on the moving cubic');
  const file = await engine.exportGgb();
  await engine.importGgb(new File([file], 'constructions-smoke.ggb'));
  await api('setValue', 'curveOffset', 3);
  await near('y(TangentThird)^2-x(TangentThird)^3+x(TangentThird)-curveOffset', 'native cubic operations survive export/reopen');
};
