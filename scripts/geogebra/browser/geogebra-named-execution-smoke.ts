import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { isInternalHelperName } from '../../../src/features/geogebra/commands/custom/internalHelpers';

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
    hessian: { setup: 'shift=0\nF=ImplicitCurve(x^3+y^3+x*y+shift*x+1)', command: 'out=HessianCubic(F)', move: () => api('setValue', 'shift', 0.1) },
    jacobian: { setup: 'shift=0\nq1=Conic({1,2,-1,0,shift,0})\nq2=Conic({2,1,-1,1,0,0})\nq3=Conic({1,-1,-1,0,1,0})', command: 'out=JacobianCubic(q1,q2,q3)', move: () => api('setValue', 'shift', 0.1) },
  };
  const selected = cases[tool];
  if (!selected) throw new Error(`Unknown named execution tool ${tool}`);
  const snapshot = async () => {
    const type = String(await api('getObjectType', 'out'));
    const value = String(await api('getValueString', 'out'));
    const defined = Boolean(await api('isDefined', 'out'));
    return { type, value, defined };
  };
  const run = async (named: boolean) => {
    await api('newConstruction');
    const setup = await engine.executeCommand(selected.setup);
    if (!setup.success) throw new Error(`Setup failed: ${setup.error}`);
    const started = performance.now();
    const result = await executeCommandPipeline(engine, selected.command, { allowNonGeometricHelpers: named });
    const create = performance.now() - started;
    if (!result.success) throw new Error(`${named ? 'named' : 'anonymous'} failed: ${result.error}`);
    const before = await snapshot();
    const names = await api('getAllObjectNames') as string[];
    const helpers = names.filter(isInternalHelperName);
    if (named && !helpers.length || !named && helpers.length) throw new Error(`Unexpected helper count ${helpers.length}`);
    if (result.labels.some(isInternalHelperName)) throw new Error('Internal helper leaked into result labels');
    report(`${named ? 'NAMED' : 'BASE'} create ${create.toFixed(1)} ms; helpers ${helpers.length}; result labels ${result.labels.join(',')}`);
    const updateStarted = performance.now();
    await selected.move();
    const after = await snapshot();
    report(`${named ? 'NAMED' : 'BASE'} update ${(performance.now() - updateStarted).toFixed(1)} ms; type ${after.type}; defined ${after.defined}; changed ${before.value !== after.value}`);
    return { before, after, helpers: helpers.length };
  };
  const baseline = await run(false);
  const named = await run(true);
  if (baseline.before.type !== named.before.type || baseline.after.type !== named.after.type
    || baseline.before.defined !== named.before.defined || baseline.after.defined !== named.after.defined)
    throw new Error(`Object type changed: ${baseline.after.type} vs ${named.after.type}`);
  if (['orthicAxis', 'orthicAxisDegenerate', 'poloconic', 'poloconicDegenerate', 'poloconicSegment',
    'circularCubicDirection', 'circularCubicDirectionSegment', 'nodalCubic', 'nodalCubicSmall'].includes(tool)
    && (baseline.before.value !== named.before.value || baseline.after.value !== named.after.value))
    throw new Error(`Equation changed for ${tool}`);
  // Other fixtures may normalize equivalent polynomials by a nonzero factor.
  report(`BASE equation: ${baseline.after.value.slice(0, 180)}`);
  report(`NAMED equation: ${named.after.value.slice(0, 180)}`);
  report(`PASS ${tool}`);
};
