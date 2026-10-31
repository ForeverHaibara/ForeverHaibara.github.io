import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { readFileTools } from '../../../src/features/geogebra/commands/custom/commandEnvironment';
import { createFileToolCompletionProvider } from '../../../src/features/geogebra/commands/completion/fileToolCompletionProvider';
import { verifyBasicGeometry, verifyRadicalAxis } from './geogebra-basic-geometry-smoke';
import { verifyConstructions } from './geogebra-constructions-smoke';
import { verifyCubic, verifyCubicTools, verifyCubicMisc, verifyIsocubics } from './geogebra-cubic-smoke';
import { verifyQaPerformance } from './geogebra-qa-performance';
import { verifyMaterializationPerformance } from './geogebra-materialization-performance';
import { verifyNamedExecution } from './geogebra-named-execution-smoke';
import { verifyNamedLifecycle } from './geogebra-named-lifecycle-smoke';
import { verifyAlgebraicGeometry } from './geogebra-algebraic-geometry-smoke';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const canvas = document.querySelector<HTMLDivElement>('#canvas')!;
const engine = new GeoGebraEmbeddingAdapter();
const originalExecute = engine.executeCommand.bind(engine);
engine.executeCommand = async (command) => {
  console.log('Executing', command.slice(0, 80), command.length);
  const result = await originalExecute(command);
  console.log('Executed', command.slice(0, 40), result.success);
  return result;
};
const originalCall = engine.callApi.bind(engine);
engine.callApi = async (method, args) => {
  if (method === 'getFileJSON') console.log('Reading construction archive');
  const result = await originalCall(method, args);
  if (method === 'getFileJSON') console.log('Read construction archive');
  return result;
};
let initialized = false;
const report = (text: string) => { results.textContent += `${text}\n`; results.scrollTop = results.scrollHeight; status.textContent = text; };
const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
// GgbAPI.getValue evaluates numeric expressions without labeled diagnostic
// objects. Repeatedly redefining a list can otherwise rebuild the construction.
const value = async (expression: string) => Number(await api('getValue', expression));
const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
const list = async (expression: string, length: number): Promise<number[]> => {
  return Promise.all(Array.from({ length }, (_, i) => value(`Element(${expression},${i + 1})`)));
};
const quad = (q: number[][], p: number[]) => p.reduce((sum, pi, i) => sum + pi * q[i].reduce((row, qij, j) => row + qij * p[j], 0), 0);
const adj = (q: number[][]) => Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => {
  const r = [0, 1, 2].filter((k) => k !== j);
  const c = [0, 1, 2].filter((k) => k !== i);
  return (-1) ** (i + j) * (q[r[0]][c[0]] * q[r[1]][c[1]] - q[r[0]][c[1]] * q[r[1]][c[0]]);
}));
const run = async (command: string) => {
  report(`RUN ${command.slice(0, 90).replace(/\n/gu, '; ')}`);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  const result = await executeCommandPipeline(engine, command);
  if (!result.success) {
    report(`Expanded: ${result.expandedCommand?.slice(0, 1600) ?? command}`);
    report(`A type/value: ${await api('getObjectType', 'A')} / ${await api('getValueString', 'A')}`);
    throw new Error(`${command}: ${result.error}`);
  }
  return result;
};

button.onclick = async () => {
  button.disabled = true;
  results.textContent = 'Initializing engine…\n';
  try {
    if (!initialized) { await engine.initialize(canvas); initialized = true; }
    await api('newConstruction');
    if (new URLSearchParams(window.location.search).get('suite') === 'cubic-misc') {
      await verifyCubicMisc(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'isocubics') {
      await verifyIsocubics(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'qa-performance') {
      await verifyQaPerformance(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'materialization') {
      await verifyMaterializationPerformance(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'named-execution') {
      await verifyNamedExecution(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'named-lifecycle') {
      await verifyNamedLifecycle(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'cubic-tools') {
      await verifyCubicTools(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'algebraic') {
      await verifyAlgebraicGeometry(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'cubic') {
      await verifyCubic(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'radical') {
      await verifyRadicalAxis(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'basic') {
      await verifyBasicGeometry(engine, report);
      report('COMPLETE');
      return;
    }
    if (new URLSearchParams(window.location.search).get('suite') === 'constructions') {
      await verifyConstructions(engine, report);
      report('COMPLETE');
      return;
    }
    await run('A=(0,0)\nB=(4,0)\nC=(0,3)\nP=(-0.5,0.75)\nD=(3,2)\nE=(2,4)\nl:x=1\nm:y=2\nn:x+y=4\no:x-y=3\nr:2x+y=6\ns=Segment((1,-2),(1,4))\nt=Ray((0,2),(1,2))\ncircle=Circle(A,2)\nU=(2,0)\nV=(2,1)');
    await run('F1=(1,0)\nF2=(0,1)\nF3=(-1,0)\nF4=(0,-1)\nF5=(0.6,0.8)\nf:x+y=sqrt(2)\ng:2x-y=sqrt(5)\nh:x-2y=sqrt(5)\nj:3x+y=sqrt(10)\nk:x+3y=sqrt(10)\nfs=Segment((0,sqrt(2)),(sqrt(2),0))\nft=Ray((0,-sqrt(5)),(1,2-sqrt(5)))');
    const before = await api('getAllObjectNames') as string[];
    await run('I=Incenter(A,B,C)');
    check(Math.abs(await value('Distance(I,(1,1))')) < 1e-8, 'incenter uses the native X(1) construction');
    await run('G=IsogonalConjugate(A,B,C,P)\nH=IsotomicConjugate(A,B,C,P)');
    await run('G2=IsogonalConjugate(A,B,C,G)\nH2=IsotomicConjugate(A,B,C,H)');
    check(await value('Distance(P,G2)+Distance(P,H2)') < 1e-7, 'both conjugations are involutions');
    await run('Q=(2,0)\nJ=IsogonalConjugate(A,B,C,Q)');
    check(await value('Distance(J,C)') < 1e-8, 'sideline conjugate extends to opposite vertex');
    await run('W=SecondIntersection(circle,U,V)');
    check(await value('Distance(U,W)') < 1e-8, 'second circle intersection is continuous at tangency');
    const version = await api('getVersion');
    report(`Engine version: ${version}`);
    const conicOutputs = new Map<string, string[]>();
    for (const [name, expression] of [
      ['K5', 'Conic(F1,F2,F3,F4,F5)'],
      ['K4', 'Conic(F1,F2,F3,F4,f)'],
      ['K3', 'Conic(F1,F2,F3,f,g)'],
      ['K2', 'Conic(F1,F2,f,g,h)'],
      ['K1', 'Conic(F1,f,g,h,j)'],
      ['K0', 'Conic(f,g,h,j,k)'],
      ['KS', 'Conic(F1,fs,F2,ft,F3)'],
    ]) {
      const result = await run(`${name}=${expression}`);
      const outputs = result.labels ?? [];
      conicOutputs.set(name, outputs);
      check(Boolean(await api('isDefined', name)), `${expression} is defined (${result.expandedCommand?.length ?? expression.length} characters)`);
      report(`${name}: ${await api('getValueString', name)}`);
      const count = outputs.length;
      check(count === ({ K5: 1, K4: 2, K3: 4, K2: 4, K1: 2, K0: 1, KS: 4 } as Record<string, number>)[name], `${name} has all expected real solutions (${count})`);
      let containsCircle = false;
      for (let index = 1; index <= count; index += 1) {
        const output = outputs[index - 1];
        check(await api('getObjectType', output) !== 'list', `${output} is an independent geometric object`);
        const raw = await list(`Coefficients(${output})`, 6);
        const scale = Math.max(...raw.map(Math.abs));
        if (!Number.isFinite(scale) || scale === 0) throw new Error(`Invalid coefficients for ${name}[${index}]`);
        const [a, b, c, d, e, f] = raw.map((coefficient) => coefficient / scale);
        const q = [[a, d / 2, e / 2], [d / 2, b, f / 2], [e / 2, f / 2, c]];
        containsCircle ||= Math.abs(a - b) + Math.abs(a + c) + Math.abs(d) + Math.abs(e) + Math.abs(f) < 1e-6;
        for (const input of expression.slice(6, -1).split(',')) {
          const type = await api('getObjectType', input);
          const point = type === 'point';
          const line = type === 'line' ? input : `Line(Point(${input},0),Point(${input},0.5))`;
          const v = point ? [Number(await api('getXcoord', input)), Number(await api('getYcoord', input)), 1] : await list(`{x(${line}),y(${line}),z(${line})}`, 3);
          const residual = Math.abs(quad(point ? q : adj(q), v)) / v.reduce((sum, entry) => sum + entry * entry, 0);
          if (!Number.isFinite(residual) || residual > 1e-6) throw new Error(`${name}[${index}] violates ${input} (residual ${residual})`);
        }
      }
      check(containsCircle, `${name} includes the known unit-circle solution; all outputs satisfy all five constraints`);
    }
    const iBefore = await api('getValueString', 'I');
    await api('setCoords', 'B', 6, 0);
    check(iBefore !== await api('getValueString', 'I'), 'dragging an input updates the output');
    check(await value('Distance(P,G2)+Distance(P,H2)') < 1e-7, 'conjugates retain dependencies after dragging');
    const conicBefore = await api('getValueString', 'K3');
    await api('setCoords', 'F1', 1.03, 0.02);
    check(conicBefore !== await api('getValueString', 'K3'), 'mixed conics update when a constraint point is dragged');
    const updatedOutputs = conicOutputs.get('K3')!;
    let maxIncidenceResidual = 0;
    for (const output of updatedOutputs) {
      const raw = await list(`Coefficients(${output})`, 6);
      const scale = Math.max(...raw.map(Math.abs));
      const [a, b, c, d, e, f] = raw.map((coefficient) => coefficient / scale);
      maxIncidenceResidual = Math.max(maxIncidenceResidual, Math.abs(a * 1.03 ** 2 + b * 0.02 ** 2 + c + d * 1.03 * 0.02 + e * 1.03 + f * 0.02));
    }
    check(updatedOutputs.length > 0 && maxIncidenceResidual < 1e-6, 'updated mixed conics satisfy the moved input constraint');
    const after = await api('getAllObjectNames') as string[];
    check(after.length - before.length === 26, `only requested output objects were created, without labeled helpers (actual ${after.length - before.length})`);
    await run('v1=Midpoint(P,P)\nv2=9');
    const safe = await run('Safe=IsogonalConjugate(A,B,C,v1)');
    check(!safe.expandedCommand?.match(/,v[12],\{/u) && await value('Distance(Safe,G)') < 1e-7 && await value('v2') === 9, 'short locals avoid existing point/numeric labels without changing dependencies');
    await run('Nested=IsogonalConjugate(A,B,C,IsogonalConjugate(A,B,C,P))');
    check(await value('Distance(Nested,P)') < 1e-7, 'nested short local bindings do not capture one another');
    await run('Chosen=Conic(F1,F2,F3,f,g,2)');
    check(await value(`If(AreEqual(Chosen,${updatedOutputs[1]}),1,0)`) === 1, 'the optional sixth argument selects one independent conic');
    await run('Seed=(0.515,0.51)');
    const dormant = await run('Dormant=Conic(F1,F2,Seed,f,g)');
    const dormantOutputs = dormant.labels ?? [];
    check(dormantOutputs.length === 4 && (await Promise.all(dormantOutputs.map((label) => api('isDefined', label)))).every((defined) => !defined), 'singular frames create undefined conic slots without visible helper objects');
    await api('setCoords', 'Seed', -1, 0);
    check((await Promise.all(dormantOutputs.map((label) => api('isDefined', label)))).some(Boolean), 'initially undefined slots become geometric conics after dragging');
    await run('el:x^2/9+y^2/4=1\nhy:x^2/4-y^2=1\npa:y=x^2\nskew:x^2+x*y+y^2-3*x-4*y=0\npair:x*y=0\ninfinite:x*y=1\nshape=4\ndynamic:x^2+shape*y^2=4');
    report(`Native degenerate conic type: ${await api('getObjectType', 'pair')}`);
    for (const [name, expression, expected] of [
      ['SE', 'SecondIntersection(el,(3,0),(-3,0))', '(-3,0)'],
      ['SH', 'SecondIntersection(hy,(2,0),(-2,0))', '(-2,0)'],
      ['SP', 'SecondIntersection(pa,(1,1),(0,0))', '(0,0)'],
      ['SS', 'SecondIntersection(skew,(0,0),(1,2))', '(11/7,22/7)'],
      ['SD', 'SecondIntersection(pair,(1,0),(0,1))', '(0,1)'],
      ['SC', 'SecondIntersection(circle,(2,0),(0,2))', '(0,2)'],
      ['SR', 'SecondIntersection(circle,(2,0),(4,0))', '(-2,0)'],
      ['TE', 'SecondIntersection(el,(3,0),(3,1))', '(3,0)'],
      ['TH', 'SecondIntersection(hy,(2,0),(2,1))', '(2,0)'],
      ['TP', 'SecondIntersection(pa,(1,1),(2,3))', '(1,1)'],
    ]) {
      await run(`${name}=${expression}`);
      check(await value(`Distance(${name},${expected})`) < 1e-7, `${expression} has the expected second intersection`);
    }
    await run('NoFinite=SecondIntersection(infinite,(1,1),(2,1))\nContained=SecondIntersection(pair,(1,0),(2,0))\nMoving=SecondIntersection(dynamic,(2,0),(0,1))');
    check(!await api('isDefined', 'NoFinite') && !await api('isDefined', 'Contained'), 'an infinite second point or a contained line stays undefined');
    check(await value('Distance(Moving,(0,1))') < 1e-7, 'the dynamic conic starts as an ellipse');
    await api('setValue', 'shape', 1);
    check(await value('Distance(Moving,(-1.2,1.6))') < 1e-7, 'the same dependent construction updates when the conic becomes a circle');
    await api('setValue', 'shape', 0);
    check(await value('Distance(Moving,(-2,2))') < 1e-7, 'the same dependent construction handles degeneration into a line pair');
    const file = await engine.exportGgb();
    await engine.importGgb(new File([file], 'smoke.ggb'));
    await api('setCoords', 'B', 5, 0);
    check(await value('Distance(P,G2)+Distance(P,H2)') < 1e-7, 'exported/reopened constructions remain dynamic');
    const reloadedConic = await api('getValueString', 'K3');
    await api('setCoords', 'F1', 1.04, 0.03);
    check(reloadedConic !== await api('getValueString', 'K3'), 'exported/reopened mixed conics retain dynamic constraints');
    await run('macroResult=Midpoint(A,B)');
    const archive = await api('getFileJSON') as { archive: Array<{ fileName: string; fileContent: string }> };
    const macroConstruction = `${await api('getXML', 'A')}${await api('getXML', 'B')}${await api('getXML', 'C')}${await api('getAlgorithmXML', 'macroResult')}`;
    const macroXml = `<?xml version="1.0" encoding="utf-8"?><geogebra format="5.0" version="5.4.920.0" app="classic" platform="w"><macro cmdName="Incenter" toolName="File incenter" toolHelp="Priority test" showInToolBar="false"><macroInput a0="A" a1="B" a2="C"/><macroOutput a0="macroResult"/><construction>${macroConstruction}</construction></macro></geogebra>`;
    archive.archive.push({ fileName: 'geogebra_macro.xml', fileContent: macroXml });
    await api('setFileJSON', archive);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    const fileTools = await readFileTools(engine, true);
    check(fileTools.some((tool) => tool.name === 'Incenter'), 'file-defined macro is discovered without installing site macros');
    const macroResult = await run('FilePriority=Incenter(A,B,C)');
    check(!macroResult.expandedCommand?.includes('TriangleCenter'), 'file macro takes precedence over site command');
    check(await value('Distance(FilePriority,Midpoint(A,B))') < 1e-8, 'the file-defined tool actually executes');
    const provider = createFileToolCompletionProvider(engine);
    const suggestions = await provider.provide({ input: 'Inc', cursor: 3, prefix: 'Inc', range: { start: 0, end: 3 }, mode: 'command', explicit: true }, new AbortController().signal);
    check(suggestions.some((item) => item.label === 'Incenter' && item.priority === 100), 'file-tool completion has higher priority than site completion');
    report('COMPLETE');
  } catch (error) {
    report(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  } finally { button.disabled = false; }
};
