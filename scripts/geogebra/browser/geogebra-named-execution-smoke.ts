import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { isInternalHelperName } from '../../../src/features/geogebra/commands/custom/internalHelpers';
import { GeoGebraConstructionSource } from '../../../src/features/geogebra/analysis/constructionSource';
import { buildDependencyGraph, collapseInternalHelpers } from '../../../src/features/geogebra/analysis/constructionGraph';
import { InternalHelperLifecycle } from '../../../src/features/geogebra/commands/custom/helperLifecycle';

/** Disposable native verification: ?suite=named-execution&tool=<case key below>. */
export const verifyNamedExecution = async (engine: GeoGebraEngine, report: (message: string) => void) => {
  const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
  const tool = new URLSearchParams(location.search).get('tool') ?? 'conic';
  const cases: Record<string, { setup: string; command: string; move: () => Promise<unknown> }> = {
    conic: { setup: 'shift=0\nf:x+y=sqrt(2+shift)\ng:2x-y=sqrt(5)\nh:x-2y=sqrt(5)\nj:3x+y=sqrt(10)\nk:x+3y=sqrt(10)', command: 'out=Conic(f,g,h,j,k)', move: () => api('setValue', 'shift', 0.05) },
    'conic-mixed': { setup: 'shift=0\nf=Segment((0,1+shift),(1,0))\ng=Ray((0,1),(2,0))\nh:x-2y=1\nj:3x+y=2\nk:x+3y=2', command: 'out=Conic(f,g,h,j,k)', move: () => api('setValue', 'shift', 0.1) },
    'conic-parallel': { setup: 'shift=0\nf:x=shift\ng:x=1\nh:x=2\nj:x=3\nk:x=4', command: 'out=Conic(f,g,h,j,k)', move: () => api('setValue', 'shift', 0.1) },
    pretangential: { setup: 'shape=1\nF=ImplicitCurve(y^2-x^3+shape*x+1-shape)\nP=(1,0)', command: 'out=Pretangential(F,P,1)', move: () => api('setValue', 'shape', 1.02) },
    ...Object.fromEntries([2, 3, 4].map((index) => [`pretangential-${index}`, { setup: 'shape=1\nF=ImplicitCurve(y^2-x^3+shape*x+1-shape)\nP=(1,0)', command: `out=Pretangential(F,P,${index})`, move: () => api('setValue', 'shape', 1.02) }])),
    polar: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x+1)\nP=(1,2)', command: 'out=PolarConic(P,F)', move: () => api('setValue', 'shift', 0.1) },
    mixedPolar: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x+1)\nP=(1,2)\nQ=(2,-1)', command: 'out=MixedPolar(P,Q,F)', move: () => api('setValue', 'shift', 0.1) },
    orthicAxis: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x^2*y+1)', command: 'out=OrthicAxis(F)', move: () => api('setValue', 'shift', 0.1) },
    orthicAxisDegenerate: { setup: 'shift=0\nF=ImplicitCurve(x^3+shift*y^3)', command: 'out=OrthicAxis(F)', move: () => api('setValue', 'shift', 0.1) },
    poloconic: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x+1)\nl:y=1', command: 'out=Poloconic(l,F)', move: () => api('setValue', 'shift', 0.1) },
    poloconicDegenerate: { setup: 'shift=0\nF=ImplicitCurve(x^3+shift*y^3)\nl:y=1', command: 'out=Poloconic(l,F)', move: () => api('setValue', 'shift', 0.1) },
    poloconicSegment: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+1)\nl=Segment((0,1),(2+shift,1))', command: 'out=Poloconic(l,F)', move: () => api('setValue', 'shift', 0.1) },
    circularCubicDirection: { setup: 'shift=0\nA=(0,0)\nB=(1/2+shift,1/2)\nC=(1/2,-1/2)\nD=(4/5,8/5)\nE=(4/5,-8/5)\nF=(9/10,27/10)\nl:x=2', command: 'out=CircularCubic(A,B,C,D,E,F,l)', move: () => api('setValue', 'shift', 0.1) },
    circularCubicDirectionSegment: { setup: 'shift=0\nA=(0,0)\nB=(1/2+shift,1/2)\nC=(1/2,-1/2)\nD=(4/5,8/5)\nE=(4/5,-8/5)\nF=(9/10,27/10)\nl=Segment((2,-1),(2,3))', command: 'out=CircularCubic(A,B,C,D,E,F,l)', move: () => api('setValue', 'shift', 0.1) },
    nodalCubic: { setup: 'shift=0\nA=(0,0)\nB=(1/2+shift,1/2)\nC=(1/2,-1/2)\nD=(4/5,8/5)\nE=(4/5,-8/5)\nF=(9/10,27/10)\nG=(-2,3)', command: 'out=NodalCubic(A,B,C,D,E,F,G)', move: () => api('setValue', 'shift', 0.1) },
    nodalCubicSmall: { setup: 'shift=0\nA=(0,0)\nB=(1/2+shift,1/2)\nC=(1/2,-1/2)\nD=(4/5,8/5)\nE=(4/5,-8/5)', command: 'out=NodalCubic(A,B,C,D,E)', move: () => api('setValue', 'shift', 0.1) },
    miquelCircle: { setup: 'shift=0\nA=(0,0)\nB=(4+shift,0)\nC=(3,3)\nD=(0,2)', command: 'out=QLCi3(A,B,C,D)', move: () => api('setValue', 'shift', 0.1) },
    commonTangents: { setup: 'shift=0\nc1=Circle((0,0),1)\nc2=Circle((4+shift,1),1)', command: 'out=CommonTangents(c1,c2,1,1)', move: () => api('setValue', 'shift', 1) },
    commonTangentsMulti: { setup: 'shift=0\nc1=Circle((0,0),1)\nc2=Circle((4+shift,1),1)', command: 'out=CommonTangents(c1,c2,1)', move: () => api('setValue', 'shift', 1) },
    commonTangentsCrossed: { setup: 'shift=0\nc1=Circle((0,0),1)\nc2=Circle((4+shift,1),1)', command: 'out=CommonTangents(c1,c2,-1)', move: () => api('setValue', 'shift', 1) },
    qlQuartic: { setup: 'shift=0\nA=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2+shift)', command: 'out=QLQu3(A,B,C,D)', move: () => api('setValue', 'shift', 0.1) },
    hessian: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x+1)', command: 'out=HessianCubic(F)', move: () => api('setValue', 'shift', 0.1) },
    jacobian: { setup: 'shift=0\nq1=Conic({1,2,-1,0,shift,0})\nq2=Conic({2,1,-1,1,0,0})\nq3=Conic({1,-1,-1,0,1,0})', command: 'out=JacobianCubic(q1,q2,q3)', move: () => api('setValue', 'shift', 0.1) },
  };
  const selected = cases[tool];
  if (!selected) throw new Error(`Unknown named execution tool ${tool}`);
  const snapshot = async (label = 'out') => {
    const type = String(await api('getObjectType', label));
    const value = String(await api('getValueString', label));
    const defined = Boolean(await api('isDefined', label));
    return { type, value, defined };
  };
  const run = async (named: boolean) => {
    await api('newConstruction');
    const setup = await engine.executeCommand(selected.setup);
    if (!setup.success) throw new Error(`Setup failed: ${setup.error}`);
    const started = performance.now();
    const result = await executeCommandPipeline(engine, selected.command, { helperMode: named ? ['miquelCircle', 'commonTangents', 'commonTangentsMulti', 'commonTangentsCrossed', 'qlQuartic'].includes(tool) ? 'high' : 'medium' : 'low' });
    const create = performance.now() - started;
    if (!result.success) throw new Error(`${named ? 'named' : 'anonymous'} failed: ${result.error}`);
    if (tool === 'commonTangentsMulti' && (result.labels.length !== 2 || !result.labels.includes('out')))
      throw new Error(`Expected two tangent labels, received ${result.labels.join(',')}`);
    const before = await snapshot();
    const outputBefore = await Promise.all(result.labels.map((label) => snapshot(label)));
    const names = await api('getAllObjectNames') as string[];
    const helpers = names.filter(isInternalHelperName);
    if (named && !helpers.length || !named && helpers.length) throw new Error(`Unexpected helper count ${helpers.length}`);
    if (result.labels.some(isInternalHelperName)) throw new Error('Internal helper leaked into result labels');
    if (named && (tool === 'miquelCircle' || tool.startsWith('commonTangents'))) for (const helper of helpers) {
      if (await api('getVisible', helper)) throw new Error(`${helper} is visible`);
      if (!/<auxiliary\s+val="true"\s*\/>/u.test(String(await api('getXML', helper)))) throw new Error(`${helper} is not auxiliary`);
    }
    if (named && tool === 'miquelCircle') for (const helper of helpers)
      if (await api('getObjectType', helper) !== 'point') throw new Error('Miquel helper is not a point');
    if (named && tool.startsWith('commonTangents')) {
      const helperTypes = await Promise.all(helpers.map((helper) => api('getObjectType', helper)));
      if (helperTypes.filter((type) => type === 'point').length !== 2) throw new Error('Expected two shared circle centers');
    }
    if (named && (tool === 'miquelCircle' || tool.startsWith('commonTangents'))) {
      const snapshot = await new GeoGebraConstructionSource(engine).read();
      const graph = collapseInternalHelpers(buildDependencyGraph(snapshot.objects));
      if (graph.nodes.some((node) => isInternalHelperName(node.name))) throw new Error('Auxiliary point leaked into relation graph');
      if (!graph.nodes.some((node) => node.name === 'out')) throw new Error('Output missing from relation graph');
    }
    report(`${named ? 'NAMED' : 'BASE'} create ${create.toFixed(1)} ms; helpers ${helpers.length}; result labels ${result.labels.join(',')}`);
    const updateStarted = performance.now();
    await selected.move();
    const after = await snapshot();
    const outputAfter = await Promise.all(result.labels.map((label) => snapshot(label)));
    report(`${named ? 'NAMED' : 'BASE'} update ${(performance.now() - updateStarted).toFixed(1)} ms; type ${after.type}; defined ${after.defined}; changed ${before.value !== after.value}`);
    return { before, after, outputBefore, outputAfter, helpers: helpers.length, labels: result.labels };
  };
  if (tool === 'qlQuartic') {
    const named = await run(true);
    if (named.before.type !== 'implicitpoly' || !named.before.defined || !named.after.defined
      || named.before.value === named.after.value || !/[xy]⁴/u.test(named.before.value))
      throw new Error('High quartic did not produce a dynamic degree-four implicit curve');
    const names = await api('getAllObjectNames') as string[];
    const helpers = names.filter(isInternalHelperName);
    for (const helper of helpers) {
      if (await api('getVisible', helper)) throw new Error(`${helper} is visible`);
      if (!/<auxiliary\s+val="true"\s*\/>/u.test(String(await api('getXML', helper))))
        throw new Error(`${helper} is not auxiliary`);
    }
    const graph = collapseInternalHelpers(buildDependencyGraph((await new GeoGebraConstructionSource(engine).read()).objects));
    if (graph.nodes.some((node) => isInternalHelperName(node.name)) || !graph.nodes.some((node) => node.name === 'out'))
      throw new Error('High quartic leaked into relation graph');
    const exported = await engine.exportGgb();
    await engine.importGgb(new File([exported], 'ql-quartic-high.ggb'));
    if (!await api('isDefined', 'out') || (await api('getAllObjectNames') as string[]).filter(isInternalHelperName).length !== named.helpers)
      throw new Error('High quartic failed to reopen');
    const lifecycle = new InternalHelperLifecycle(engine);
    await api('deleteObject', 'out');
    await lifecycle.reconcile();
    lifecycle.dispose();
    if ((await api('getAllObjectNames') as string[]).some(isInternalHelperName)) throw new Error('High quartic helpers were not collected');
    report(`High quartic equation: ${named.after.value.slice(0, 180)}`);
    report('PASS qlQuartic High-only candidate');
    return;
  }
  const baseline = await run(false);
  const named = await run(true);
  if (baseline.before.type !== named.before.type || baseline.after.type !== named.after.type
    || baseline.before.defined !== named.before.defined || baseline.after.defined !== named.after.defined)
    throw new Error(`Object type changed: ${baseline.after.type} vs ${named.after.type}`);
  if (tool.startsWith('commonTangents') && (JSON.stringify(baseline.outputBefore) !== JSON.stringify(named.outputBefore)
    || JSON.stringify(baseline.outputAfter) !== JSON.stringify(named.outputAfter)))
    throw new Error('Common tangent output changed');
  if (['orthicAxis', 'orthicAxisDegenerate', 'poloconic', 'poloconicDegenerate', 'poloconicSegment',
    'circularCubicDirection', 'circularCubicDirectionSegment', 'nodalCubic', 'nodalCubicSmall', 'miquelCircle'].includes(tool)
    && (baseline.before.value !== named.before.value || baseline.after.value !== named.after.value))
    throw new Error(`Equation changed for ${tool}`);
  // Other fixtures may normalize equivalent polynomials by a nonzero factor.
  report(`BASE equation: ${baseline.after.value.slice(0, 180)}`);
  report(`NAMED equation: ${named.after.value.slice(0, 180)}`);
  if (tool === 'miquelCircle' || tool.startsWith('commonTangents')) {
    const exported = await engine.exportGgb();
    await engine.importGgb(new File([exported], 'geometry-auxiliary.ggb'));
    const reopened = await api('getAllObjectNames') as string[];
    if (reopened.filter(isInternalHelperName).length !== named.helpers || named.labels.some((label) => !reopened.includes(label)))
      throw new Error('Geometry helpers did not survive file reopen');
    const lifecycle = new InternalHelperLifecycle(engine);
    for (const label of named.labels) await api('deleteObject', label);
    await lifecycle.reconcile();
    lifecycle.dispose();
    if ((await api('getAllObjectNames') as string[]).some(isInternalHelperName)) throw new Error('Orphan geometry helpers were not collected');
    report('Geometry helpers survived .ggb reopen and were collected after output deletion');
  }
  report(`PASS ${tool}`);
};
