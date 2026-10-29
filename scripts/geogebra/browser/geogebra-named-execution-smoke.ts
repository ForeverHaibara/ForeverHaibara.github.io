import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { isInternalHelperName } from '../../../src/features/geogebra/commands/custom/internalHelpers';

/** Disposable native verification: ?suite=named-execution&tool=conic|conic-mixed|conic-parallel|pretangential[-2|-3|-4]|polar|hessian|jacobian. */
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
    await selected.move();
    const after = await snapshot();
    report(`${named ? 'NAMED' : 'BASE'} type ${after.type}; defined ${after.defined}; changed ${before.value !== after.value}`);
    return { before, after, helpers: helpers.length };
  };
  const baseline = await run(false);
  const named = await run(true);
  if (baseline.before.type !== named.before.type || baseline.after.type !== named.after.type
    || baseline.before.defined !== named.before.defined || baseline.after.defined !== named.after.defined)
    throw new Error(`Object type changed: ${baseline.after.type} vs ${named.after.type}`);
  // GeoGebra may normalize an equivalent polynomial by a nonzero factor.
  report(`BASE equation: ${baseline.after.value.slice(0, 180)}`);
  report(`NAMED equation: ${named.after.value.slice(0, 180)}`);
  report(`PASS ${tool}`);
};
