import type { GeoGebraEngine } from '../src/features/geogebra/types';
import { executeCommandPipeline } from '../src/features/geogebra/commands/commandPipeline';

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
    }
    report(`PASS ${name}`);
  }
};
