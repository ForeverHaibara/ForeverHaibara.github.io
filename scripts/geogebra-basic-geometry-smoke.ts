import type { GeoGebraEngine } from '../src/features/geogebra/types';
import { executeCommandPipeline } from '../src/features/geogebra/commands/commandPipeline';
import { studioToolLibrary } from '../src/features/geogebra/commands/custom/toolLibrary';

/** Focused regression; geogebra-smoke.html?suite=radical. */
export const verifyRadicalAxis = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
  const near = async (expression: string, message: string) => check(Math.abs(Number(await api('getValue', expression))) < 1e-7, message);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand}`);
    return result;
  };
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nD=(-2,3)\nc1=Circle(A,2)\nc2=Circle(B,1.5)\nc3=Circle(C,1.2)\nl1=Line(A,B)\nl2=Line(B,C)\nl3=Line(C,D)\nl4=Line(D,A)');
  for (const [label, circle, point] of [
    ['Disjoint', 'c2', '(151/48,0)'],
    ['Intersecting', 'Circle((2,0),2)', '(1,0)'],
    ['ExternalTouch', 'Circle((4,0),2)', '(2,0)'],
    ['InternalTouch', 'Circle((1,0),1)', '(2,0)'],
    ['Vertical', 'Circle((0,6),2)', '(0,3)'],
  ]) {
    const before = (await api('getAllObjectNames') as string[]).length;
    await run(`${label}=RadicalAxis(c1,${circle})`);
    check((await api('getAllObjectNames') as string[]).length === before + 1, `${label}: no helper labels`);
    check(await api('isDefined', label) === true && await api('getObjectType', label) === 'line', `${label}: defined native line`);
    await near(`Distance(${point},${label})`, `${label}: equal-power point lies on axis`);
    await near(`x(${label})*x(Line(A,Center(${circle})))+y(${label})*y(Line(A,Center(${circle})))`, `${label}: axis is perpendicular to center line`);
  }
  await run('Z=(3,0)\nMovingAxis=RadicalAxis(c1,Circle(Z,1))\nConcentric=RadicalAxis(c1,Circle(A,1))\nCoincident=RadicalAxis(c1,c1)\nRC=RadicalCenter(c1,c2,c3)\nQS=SteinerLineQ(A,B,C,D)\nQSL=SteinerLineQ(l1,l2,l3,l4)\nTP=TangentParabola(A,B,C,D)\nTPL=TangentParabola(l1,l2,l3,l4)');
  check(!await api('isDefined', 'Concentric') && !await api('isDefined', 'Coincident'), 'concentric and coincident circles have no unique finite axis');
  await api('setCoords', 'Z', 0, 0);
  check(!await api('isDefined', 'MovingAxis'), 'radical axis becomes undefined when centers coincide');
  await api('setCoords', 'Z', 3, 0);
  check(await api('isDefined', 'MovingAxis') === true, 'radical axis recovers when centers separate again');
  await near('Distance((2,0),MovingAxis)', 'recovered radical axis has the expected equal-power point');
  await run('sideSegment=Segment(A,B)\nsideRay=Ray(A,B)\nSecondLine=SecondIntersection(Circle(A,B,C),A,l1)\nSecondSegment=SecondIntersection(Circle(A,B,C),A,sideSegment)\nSecondRay=SecondIntersection(Circle(A,B,C),A,sideRay)\nOrthoLine=Orthopole(A,B,C,l1)\nOrthoSegment=Orthopole(A,B,C,sideSegment)\nOrthoRay=Orthopole(A,B,C,sideRay)\nAntiLine=AntiSteinerPoint(A,B,C,l1)\nAntiSegment=AntiSteinerPoint(A,B,C,sideSegment)\nAntiRay=AntiSteinerPoint(A,B,C,sideRay)\nMiquelPoints=MiquelPoint(A,B,C,D)\nMiquelLines=MiquelPoint(l1,l2,l3,l4)\nNewtonPoints=NewtonLine(A,B,C,D)\nNewtonLines=NewtonLine(l1,l2,l3,l4)');
  for (const label of ['RC', 'QS', 'QSL', 'TP', 'TPL']) check(await api('isDefined', label) === true, `${label}: downstream result is defined`);
  const checkDependencies = async () => {
    await near('Distance(RC,A)^2-Radius(c1)^2-Distance(RC,B)^2+Radius(c2)^2', 'radical center has equal powers to c1 and c2');
    await near('Distance(RC,A)^2-Radius(c1)^2-Distance(RC,C)^2+Radius(c3)^2', 'radical center has equal powers to c1 and c3');
    for (const triple of [['l1', 'l2', 'l3'], ['l1', 'l2', 'l4'], ['l1', 'l3', 'l4'], ['l2', 'l3', 'l4']]) {
      const [u, v, w] = triple.map((line, i) => `Intersect(${line},${triple[(i + 1) % 3]})`);
      const orthocenter = `Intersect(PerpendicularLine(${u},Line(${v},${w})),PerpendicularLine(${v},Line(${u},${w})))`;
      await near(`Distance(${orthocenter},QS)`, `SteinerLineQ contains orthocenter of ${triple.join('/')}`);
    }
    await near('Distance(Point(QS,0.25),QSL)+Distance(Point(QS,0.5),QSL)', 'point and line SteinerLineQ overloads agree');
    await near('Distance(SecondLine,B)+Distance(SecondSegment,B)+Distance(SecondRay,B)', 'second intersections agree for line, segment and ray supports');
    await near('Distance(OrthoLine,OrthoSegment)+Distance(OrthoLine,OrthoRay)', 'orthopoles agree for line, segment and ray supports');
    await near('Distance(AntiLine,AntiSegment)+Distance(AntiLine,AntiRay)', 'AntiSteinerPoint agrees for line, segment and ray supports');
    await near('Distance(MiquelPoints,MiquelLines)', 'point and line MiquelPoint overloads agree');
    await near('Distance(Point(NewtonPoints,0.25),NewtonLines)+Distance(Point(NewtonPoints,0.5),NewtonLines)', 'point and line NewtonLine overloads agree');
    for (const conic of ['TP', 'TPL']) for (const line of ['l1', 'l2', 'l3', 'l4']) {
      await near(`Distance(Reflect(Focus(${conic}),${line}),Directrix(${conic}))`, `${conic}: focus reflected in ${line} lies on directrix`);
    }
  };
  // For a parabola, the reflection of its focus in a tangent lies on the directrix.
  // Check that incidence directly rather than relying on intersection multiplicity.
  await checkDependencies();
  await api('setCoords', 'B', 7, 1);
  await checkDependencies();
  const file = await engine.exportGgb();
  await engine.importGgb(new File([file], 'radical-smoke.ggb'));
  await api('setCoords', 'B', 6, 0);
  await checkDependencies();
  report('PASS radical-axis dependencies survive dragging and export/reopen');
};

/** Real-engine checks; open geogebra-smoke.html?suite=basic and run verification. */
export const verifyBasicGeometry = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const value = async (expression: string) => Number(await api('getValue', expression));
  const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
  const near = async (expression: string, message: string) => check(Math.abs(await value(expression)) < 1e-7, message);
  const run = async (source: string) => {
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand}`);
    return result;
  };
  await run('A=(0,0)\nB=(6,0)\nC=(1,4)\nP=(2,1)\nD=(-2,3)\nE=(5,2)\nPointAlpha=(2,1)\nellipse:x^2/9+y^2/4=1\ncircleOne=Circle(A,2)\ncircleTwo=Circle(B,1.5)\ncircleThree=Circle(C,1.2)\nsideOne=Line(A,B)\nsideTwo=Line(B,C)\nsideThree=Line(C,D)\nsideFour=Line(D,A)');
  const basicToolNames = new Set([
    'AnticevianTriangle', 'Anticomplement', 'AntipedalTriangle', 'Antipode', 'ArcMidpoint',
    'BrocardCircle', 'BrocardPoints', 'CarnotTriangle', 'Centroid', 'CevianTriangle',
    'Circumcenter', 'CircumcevianPoint', 'CircumcevianTriangle', 'Complement', 'DiagonalPoints',
    'DirectSimilarity', 'EulerLine', 'Excenter', 'Excenters', 'Excircle',
    'Excircles', 'FuhrmannCircle', 'GergonnePoint', 'GoldenSectionPoint', 'HarmonicConjugate',
    'IntouchTriangle', 'IsodynamicPoint', 'IsogonalComplement', 'MedialTriangle', 'Mittenpunkt',
    'NagelPoint', 'NewtonLine', 'NinePointCenter', 'NinePointCircle', 'NorthPole',
    'OppositeArcMidpoint', 'OppositeSimilarity', 'OrthicTriangle', 'Orthocenter', 'Orthopole',
    'PedalCircle', 'PedalTriangle', 'RadicalCenter', 'SimilarityCenter', 'SouthPole',
    'SpiekerCenter', 'SymmedianPoint', 'TangentialTriangle', 'TransferRatio', 'TrilinearPolar',
    'TrilinearPole', 'TrisectionPoint',
  ]);
  let serial = 0;
  for (const tool of studioToolLibrary.tools.filter((tool) => basicToolNames.has(tool.name))) {
    for (const overload of tool.overloads) {
      const arguments_ = overload.params.map((param) => {
        if (param.type === 'point') return param.name;
        if (param.type === 'number') return '1';
        if (param.type === 'conic') return 'ellipse';
        if (param.type === 'circle') return ({ c1: 'circleOne', c2: 'circleTwo', c3: 'circleThree' } as Record<string, string>)[param.name];
        return ({ l: 'sideOne', l1: 'sideOne', l2: 'sideTwo', l3: 'sideThree', l4: 'sideFour' } as Record<string, string>)[param.name];
      });
      const before = (await api('getAllObjectNames') as string[]).length;
      const result = await run(`Result${++serial}=${tool.name}(${arguments_.join(',')})`);
      const labels = result.labels ?? [];
      check(labels.length === (await api('getAllObjectNames') as string[]).length - before, `${tool.name} creates only requested outputs`);
      check(labels.length > 0, `${tool.name} returns geometric objects`);
      for (const label of labels) {
        check(Boolean(await api('isDefined', label)), `${tool.name}: ${label} is defined`);
        const type = await api('getObjectType', label);
        check(type !== 'list' && (type === overload.returns || overload.returns === 'point' && type === 'complex'), `${tool.name}: ${label} has type ${String(type)}`);
      }
    }
  }

  await run('Harmonic=HarmonicConjugate(A,B,P)\nHarmonicBack=HarmonicConjugate(A,B,Harmonic)\nComplementBack=Anticomplement(A,B,C,Complement(A,B,C,P))\nPolarLine=TrilinearPolar(A,B,C,P)\nPoleBack=TrilinearPole(A,B,C,PolarLine)');
  await near('Distance(P,HarmonicBack)+Distance(P,ComplementBack)+Distance(P,PoleBack)', 'harmonic conjugation, complements and triangle polarity recover P');
  await near('abs((ToComplex(P-A)*ToComplex(Harmonic-B))/(ToComplex(P-B)*ToComplex(Harmonic-A))+1)', 'non-collinear harmonic conjugate has complex cross-ratio -1');
  await run('Along=HarmonicConjugate(A,B,(2,0))');
  await near('Distance(Along,(-6,0))', 'circular harmonic formula extends to the directed collinear conjugate');

  await run('DirectFour=DirectSimilarity(A,B,C,P)\nDirectFive=DirectSimilarity(A,B,P,A,C)\nOppositeFour=OppositeSimilarity(A,B,C,P)\nOppositeFive=OppositeSimilarity(A,B,P,A,C)');
  await near('Distance(DirectFour,DirectFive)+Distance(OppositeFour,OppositeFive)', 'four- and five-point similarity signatures agree');
  await near('Distance(DirectFour,A)*Distance(A,B)-Distance(P,A)*Distance(A,C)', 'similarity preserves the prescribed distance ratio');
  await run('Directed=TransferRatio(A,B,D,E,(-3,0))');
  await near('Distance(Directed,D-(E-D)/2)', 'ratio transfer retains exterior division and direction');

  await run('FirstBrocard=BrocardPoints(A,B,C,1)\nSecondBrocard=BrocardPoints(A,B,C,2)\nSwappedBrocard=BrocardPoints(A,C,B,1)\nArc=ArcMidpoint(A,B,C)\nArcAlias=SouthPole(A,B,C)\nOppositeArc=OppositeArcMidpoint(A,B,C)\nOppositeAlias=NorthPole(A,B,C)');
  await near('Distance(SecondBrocard,SwappedBrocard)', 'reversing the triangle order exchanges Brocard points');
  await near('Distance(Arc,ArcAlias)+Distance(OppositeArc,OppositeAlias)', 'north and south aliases retain the exact arc-midpoint definitions');
  await near('Distance(Arc,B)-Distance(Arc,C)', 'arc midpoint is equidistant from B and C');
  await near('Distance(Midpoint(Arc,OppositeArc),TriangleCenter(A,B,C,3))', 'the two arc midpoints are antipodal');

  await run('Projection=PedalTriangle(A,B,C,P,3)\nsegment=Segment(A,B)\nray=Ray(A,B)\nPoleSegment=TrilinearPole(A,B,C,segment)\nPoleLine=TrilinearPole(A,B,C,sideOne)\nOrthoSegment=Orthopole(A,B,C,segment)\nOrthoRay=Orthopole(A,B,C,ray)');
  await near('Distance(Projection,(2,0))', 'pedal output order is BC, CA, AB');
  await near('Distance(OrthoSegment,OrthoRay)', 'segments and rays use the same unbounded supporting line');
  // Two dual coordinates vanish on a sideline, leaving no unique reciprocal pole.
  check(!await api('isDefined', 'PoleSegment') && !await api('isDefined', 'PoleLine'), 'a sideline pole is indeterminate in both line-like forms');
  await run('BadIndex=Excenters(A,B,C,1.5)\nBadSign=SimilarityCenter(circleOne,circleTwo,0)');
  check(!await api('isDefined', 'BadIndex') && !await api('isDefined', 'BadSign'), 'invalid indices and similarity signs are dynamically undefined');

  await run('Moving=NinePointCircle(A,B,C)\nMovingPole=TrilinearPole(A,B,C,TrilinearPolar(A,B,C,P))\nRightFoot=OrthicTriangle(A,B,C,2)');
  await api('setCoords', 'C', 0, 4);
  await near('Distance(RightFoot,A)', 'orthic triangle retains the coincident altitude foot at a right angle');
  await near('Distance(MovingPole,P)', 'composed point dependencies update after dragging');
  await near('Distance(Center(Moving),TriangleCenter(A,B,C,5))', 'composed circle center updates after dragging');
  const file = await engine.exportGgb();
  await engine.importGgb(new File([file], 'basic-geometry-smoke.ggb'));
  await api('setCoords', 'C', 1, 5);
  await near('Distance(MovingPole,P)', 'composition survives export and reopening');
  await near('Distance(Center(Moving),TriangleCenter(A,B,C,5))', 'reopened circle retains its native dependencies');
};
