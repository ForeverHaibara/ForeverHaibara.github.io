import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { gibertCurveRecords } from '../../../src/features/geogebra/commands/custom/builders/relatedCurves';
import { InternalHelperLifecycle } from '../../../src/features/geogebra/commands/custom/helperLifecycle';

const params = new URLSearchParams(location.search);
const id = Number(params.get('id') ?? '12');
const mode = (params.get('mode') ?? 'high') as 'low' | 'medium' | 'high';
const selector = params.has('quoted') ? `"Q${String(id).padStart(3,'0')}"` : String(id);
const engine = new GeoGebraEmbeddingAdapter();
const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
const button = document.querySelector<HTMLButtonElement>('#run')!;
const log = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const report = (value: string) => { log.textContent += `${value}\n`; status.textContent = value; };
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const run = async (source: string) => {
  const result = await executeCommandPipeline(engine, source, { helperMode: mode });
  check(result.success, `${source}: ${result.error}`);
  return result;
};
const median = (xs: number[]) => { const values = [...xs].sort((a,b) => a-b); return (values[Math.floor((values.length-1)/2)] + values[Math.floor(values.length/2)]) / 2; };
let initialized = false;
button.onclick = async () => {
  button.disabled = true; log.textContent = '';
  const data: Record<string,unknown> = { id, mode, userAgent: navigator.userAgent, viewport: [innerWidth,innerHeight] };
  try {
    if (!initialized) { report('Initializing'); await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!); initialized = true; }
    data.engine = engine.getCapabilities();
    await api('newConstruction'); await api('setCoordSystem', -2,8,-2,6);
    await run('A=(0,0)\nB=(6,0)\nC=(1,4)');
    const start = performance.now(); const result = await run(`out=GibertCurve(A,B,C,${selector})`);
    data.createMs = performance.now()-start; data.expandedLength = result.expandedCommand?.length;
    check(await api('isDefined','out'), 'out undefined');
    check(/<element\b[^>]*\btype="implicit/u.test(String(await api('getXML','out'))), 'out is not a native implicit curve');
    data.objectCount = (await api('getAllObjectNames') as string[]).length;
    report(`Created Q${id}/${mode}: ${Number(data.createMs).toFixed(1)} ms, ${data.objectCount} objects`);
    if (params.has('history')) {
      await api('undo'); check(!await api('exists','out'),'output survives undo');
      check(!(await api('getAllObjectNames') as string[]).some((name)=>name.startsWith('ggbaux')),'helpers survive undo');
      await api('redo'); check(await api('isDefined','out'),'output lost after redo');
      data.history = true; report('PASS atomic undo/redo');
    }
    const before = String(await api('getValueString','out'));
    const updates: number[] = [];
    for (const [x,y] of [[1.2,3.8],[.8,4.2],[1.4,4.1],[1,4],[1.2,3.8],[.8,4.2],[1.4,4.1],[1,4]]) {
      const time = performance.now(); await api('setCoords','C',x,y); updates.push(performance.now()-time);
      check(await api('isDefined','out'), 'undefined while moving C');
      if (x !== 1) check(String(await api('getValueString','out')) !== before, 'output does not follow C');
    }
    data.updates = updates; data.updateMedian = median(updates);
    report(`Updates: median ${median(updates).toFixed(1)} ms`);
    await run('diagnostic(x,y)=LeftSide(out)-RightSide(out)');
    const gridValues = await Promise.all([[-1,1],[2,1],[4,3],[7,5],[0,-1]].map(async ([x,y]) => Number(await api('getValue',`diagnostic(${x},${y})`))));
    const scale = Math.max(...gridValues.map(Math.abs)); check(Number.isFinite(scale) && scale>1e-12, 'zero polynomial');
    const record = gibertCurveRecords.find((r) => Number(r.id.slice(1)) === id)!;
    const centers: unknown[] = [];
    for (const index of record.centers) {
      await run(`T=TriangleCenter(A,B,C,${index})`);
      check(await api('isDefined','T'), `X${index} unavailable`);
      const residual = Number(await api('getValue','diagnostic(x(T),y(T))')) / scale;
      check(Number.isFinite(residual) && Math.abs(residual)<1e-8, `X${index} residual ${residual}`);
      centers.push({index,residual});
    }
    data.centers = centers; report('PASS known centers');
    for (const point of record.samplePoints ?? []) {
      await run(`T=${point}`);
      const residual = Number(await api('getValue','diagnostic(x(T),y(T))')) / scale;
      check(Number.isFinite(residual) && Math.abs(residual)<1e-8, `sample point ${point}: ${residual}`);
    }
    data.samplePoints = record.samplePoints?.length ?? 0;
    const conditional: unknown[] = [];
    for (const index of record.conditionalCenters ?? []) {
      await run(`T=TriangleCenter(A,B,C,${index})`);
      const defined = Boolean(await api('isDefined','T'));
      const residual = defined ? Number(await api('getValue','diagnostic(x(T),y(T))')) / scale : null;
      if (defined) check(residual !== null && Number.isFinite(residual) && Math.abs(residual)<1e-8, `conditional X${index}: ${residual}`);
      conditional.push({index,defined,residual});
    }
    data.conditionalCenters = conditional;
    for (const [x,y,label] of [[2,0,'collinear'],[0,0,'repeated']] as const) {
      await api('setCoords','C',x,y); check(!await api('isDefined','out'), `${label} not undefined`);
      await api('setCoords','C',1,4); check(await api('isDefined','out'), `no recovery after ${label}`);
    }
    await api('setCoords','C',3,Math.sqrt(27));
    data.equilateralDefined = await api('isDefined','out');
    await api('setCoords','C',1,4); report('PASS degeneracy and recovery');
    const file = await engine.exportGgb(); data.ggbBytes = file.size;
    await engine.importGgb(new File([file],'gibert-smoke.ggb'));
    check(await api('isDefined','out'), 'lost after reopen');
    await api('setCoords','C',1.3,3.9);
    check(String(await api('getValueString','out'))!==before, 'lost dependency after reopen');
    report('PASS export/reopen and dynamic dependency');
    await api('deleteObject','diagnostic'); await api('deleteObject','out');
    const lifecycle = new InternalHelperLifecycle(engine);
    await lifecycle.reconcile(); lifecycle.dispose();
    const remaining = await api('getAllObjectNames') as string[];
    check(!remaining.some((name) => name.startsWith('ggbaux')), 'orphan helpers remain');
    data.cleanup = true; report('PASS helper cleanup');
    if (params.has('keep')) { await run(`out=GibertCurve(A,B,C,${selector})`); report('Recreated curve for visual inspection'); }
    data.success = true; report('COMPLETE');
  } catch (error) { data.success = false; data.error = String(error); report(`FAIL ${String(error)}`); }
  finally { document.querySelector<HTMLPreElement>('#json')!.textContent = JSON.stringify(data,null,2); button.disabled = false; }
};
