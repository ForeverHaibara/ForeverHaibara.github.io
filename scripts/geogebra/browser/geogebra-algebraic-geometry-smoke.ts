import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { studioToolLibrary } from '../../../src/features/geogebra/commands/custom/toolLibrary';

/** Disposable native construction: geogebra-smoke.html?suite=algebraic. */
const verifyAlgebraicConstruction = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (method: string, ...args: unknown[]) => engine.callApi(method, args);
  const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); report(`PASS ${message}`); };
  const value = async (expression: string) => Number(await api('getValue', expression));
  const near = async (expression: string, message: string, tolerance = 1e-6) => check(Math.abs(await value(expression)) < tolerance, message);
  const run = async (source: string) => {
    report(`RUN ${source.slice(0, 110).replace(/\n/gu, '; ')}`);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const result = await executeCommandPipeline(engine, source);
    if (!result.success) throw new Error(`${source}: ${result.error}\n${result.expandedCommand}`);
    // These tests inspect algebra, not 40 overlaid implicit-curve plots.
    for (const label of result.labels) await api('setVisible', label, false);
    return result;
  };
  await run('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2)\nP=(1,1)\nl:x+2*y=3\nseg=Segment((0,1.5),(3,0))\nray=Ray((0,1.5),(3,0))\ncircle=Circle((1,2),3)\nq=Conic({2,5,-3,1,-3,7})\nF=ImplicitCurve(x^4+2*x*y+y^2-2)');
  const names = new Set(['BrocardAxis', 'LemoineAxis', 'OrthicAxis', 'SoddyPoint', 'LiangZelichPerspector', 'StammlerHyperbola', 'OrthopolarConic', 'CundyParryPhi', 'CundyParryPsi', 'CoTf3', 'InvCoTf3', 'QAP2', 'QAP3', 'QAP4', 'QAP5', 'QL2P1', 'QL2P2', 'QL2P3', 'QLP3', 'QLP4', 'QLP5', 'QLP6', 'QLP7', 'QLP19', 'QLP20', 'QLP21', 'QLTf1', 'QLCi3', 'QLCi5', 'QLCi6', 'QLCu1', 'QACu1', 'QLQu3', 'OrthopivotalCubic']);
  let index = 0;
  const focused = new URLSearchParams(window.location.search).get('tool');
  for (const tool of studioToolLibrary.tools.filter((t) => names.has(t.name) && (!focused || t.name === focused))) for (const overload of tool.overloads) {
    const args = overload.params.map((p) => p.type === 'number' ? '1' : p.type === 'lineLike' ? 'seg' : p.type === 'circle' ? 'circle' : p.type === 'conic' ? 'q' : p.type === 'implicitCurve' ? 'F' : p.name);
    const label = `AlgebraicResult${++index}`;
    const before = (await api('getAllObjectNames') as string[]).length;
    const source = `${tool.name}(${args.join(',')})`;
    await run(`${label}=${source}`);
    const count = tool.name.startsWith('QL2P') && args.length === 4 ? 2 : 1;
    check((await api('getAllObjectNames') as string[]).length === before + count, `${source} creates ${count} output(s), no helpers`);
    const xmlType = overload.returns === 'circle' ? 'conic' : overload.returns === 'implicitCurve' ? 'implicitpoly' : overload.returns;
    check(new RegExp(`<element\\b[^>]*\\btype="${xmlType}"`, 'u').test(String(await api('getXML', label))), `${source} has ${xmlType} XML class`);
    if (!tool.name.startsWith('QL2P1') && !tool.name.startsWith('QL2P2')) check(await api('isDefined', label) === true, `${source} is defined`);
  }
  if (focused) return;
  await run('M=MiquelPoint(A,B,C,D)\nQ=QLTf1(A,B,C,D,P)\nQQ=QLTf1(A,B,C,D,Q)\nQAC=QLTf1(A,B,C,D,A)\nQBD=QLTf1(A,B,C,D,B)\nFixedA=QL2P3(A,B,C,D,1)\nFixedB=QL2P3(A,B,C,D,2)\nFixedImage=QLTf1(A,B,C,D,FixedA)\nMix=CoTf3(P,q)\nUnmix=InvCoTf3(Mix,q)\nOrth=OrthicAxis(A,B,C)\nOrthConic=OrthopolarConic(A,B,C,P)\nStam=StammlerHyperbola(A,B,C)');
  await near('Distance(P,QQ)+Distance(QAC,C)+Distance(QBD,D)', 'QLTf1 is involutory and exchanges opposite vertices');
  await near('Distance(FixedA,FixedImage)', 'complex square root returns actual fixed points');
  await near('Distance(P,Unmix)', 'Scimemi maps are mutually inverse');
  await run('PedalA=ClosestPoint(Line(B,C),P)\nPedalB=ClosestPoint(Line(C,A),P)\nPedalC=ClosestPoint(Line(A,B),P)');
  await near('Distance(PedalA,OrthConic)+Distance(PedalB,OrthConic)+Distance(PedalC,OrthConic)', 'orthopolar conic contains all three pedal feet');
  await run('ScCircle=CoTf3(P,circle)\nParab=Parabola((0,0.25),y=-0.25)\nScParab=CoTf3(P,Parab)\nRect=Conic({1,-1,-1,0,-4,6})\nInvRect=InvCoTf3(P,Rect)');
  await near('Distance(ScCircle,Center(circle))+Distance(ScParab,(-1,2))+Distance(InvRect,(2,3))', 'Scimemi circle, parabola and rectangular-hyperbola limits');
  await run('QAcenter=QAP2(A,B,C,D)\nQAother=QAP2(D,B,A,C)\nCyclicD=Point(Circle(A,B,C),0.61)\nCyclicCenter=QAP4(A,B,C,CyclicD)\nMiCircle=QLCi3(A,B,C,D)\nPlCircle=QLCi5(A,B,C,D)\nDimCircle=QLCi6(A,B,C,D)\nDimCenter=QLP6(A,B,C,D)');
  await near('Distance(QAcenter,QAother)+Distance(CyclicCenter,Center(Circle(A,B,C)))', 'QA permutation invariance and cyclic isogonal-center limit');
  await near('Distance(M,MiCircle)+Distance(M,PlCircle)+Distance(M,DimCircle)+Distance(Center(DimCircle),DimCenter)', 'QL circles and their centers agree');
  await run('LineImage=QLTf1(A,B,C,D,l)\nRayImage=QLTf1(A,B,C,D,ray)\nSupportImage=QLTf1(A,B,C,D,seg)');
  await near('Distance(Center(LineImage),Center(RayImage))+Distance(Center(LineImage),Center(SupportImage))', 'line, ray and segment images use the same support');
  await api('setCoords', 'C', 4, 3);
  check(await api('isDefined', 'Orth') === true, 'orthic axis remains defined at a right triangle');
  await near('Distance(B,Orth)', 'right-triangle orthic-axis limit passes through its right vertex');
  await api('setCoords', 'C', 3, 3);
  await api('setCoords', 'P', 2, -1);
  await near('Distance(P,QQ)+Distance(P,Unmix)', 'dependencies update after dragging');
  const blob = await engine.exportGgb();
  await engine.importGgb(new File([blob], 'algebraic-geometry-smoke.ggb'));
  await api('setCoords', 'P', -1, 0.5);
  await near('Distance(P,QQ)+Distance(P,Unmix)', 'native dependencies survive export/reopen');
  report('PASS all algebraic-geometry overloads, geometry identities, dragging and round trip');
};

export const verifyAlgebraicGeometry = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  await engine.callApi('setRepaintingActive', [false]);
  try { await verifyAlgebraicConstruction(engine, report); }
  finally { await engine.callApi('setRepaintingActive', [true]); }
};
