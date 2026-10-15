import type { GeoGebraEngine } from '../src/features/geogebra/types';
import { executeCommandPipeline } from '../src/features/geogebra/commands/commandPipeline';
import { studioToolLibrary } from '../src/features/geogebra/commands/custom/toolLibrary';

/** Real-engine checks; open geogebra-smoke.html?suite=p1 and run verification. */
export const verifyP1 = async (engine: GeoGebraEngine, report: (message: string) => void) => {
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
  const original = new Set(['Incenter', 'IsogonalConjugate', 'IsotomicConjugate', 'Conic', 'SecondIntersection']);
  let serial = 0;
  for (const tool of studioToolLibrary.tools.filter((tool) => !original.has(tool.name))) {
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
  await engine.importGgb(new File([file], 'p1-smoke.ggb'));
  await api('setCoords', 'C', 1, 5);
  await near('Distance(MovingPole,P)', 'composition survives export and reopening');
  await near('Distance(Center(Moving),TriangleCenter(A,B,C,5))', 'reopened circle retains its native dependencies');
};
