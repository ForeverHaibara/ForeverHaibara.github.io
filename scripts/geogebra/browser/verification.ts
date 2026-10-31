const page = new URLSearchParams(location.search).get('page') ?? 'smoke';
const title = document.querySelector<HTMLElement>('#title')!;
const description = document.querySelector<HTMLElement>('#description')!;
const show = (selector: string) => { document.querySelector<HTMLElement>(selector)!.hidden = false; };
const hide = (selector: string) => { document.querySelector<HTMLElement>(selector)!.hidden = true; };
const modes: Record<string, { title: string; description?: string; load: () => Promise<unknown> }> = {
  smoke: { title: 'GeoGebra custom command verification', description: 'Disposable real-engine construction. Site macros are never installed; the final check imports a user-tool fixture.', load: () => import('./geogebra-smoke') },
  curve: { title: 'Curve optimization verification', load: () => import('./geogebra-curve-optimization-smoke') },
  gibert: { title: 'GibertCurve native verification', description: 'Disposable production-pipeline checks. ID and mode are selected by URL.', load: () => import('./geogebra-gibert-smoke') },
  structured: { title: 'Structured Gibert curve verification', load: () => import('./geogebra-gibert-structured-smoke') },
  batch: { title: 'Gibert precision batch', load: () => import('./geogebra-gibert-batch') },
  qlcu1: { title: 'QLCu1 timing comparison', description: 'Disposable native construction; production QLCu1 stays unchanged. Fixed 800×480 view, algebra panel closed. Timings exclude site compilation and applet/module loading.', load: () => import('./geogebra-qlcu1-benchmark') },
  probe: { title: 'Related curves planning probe', description: 'Disposable Q012 / Q039 experiment; no production command is registered.', load: () => import('./geogebra-related-curves-probe') },
};
const mode = modes[page];
if (!mode) throw new Error(`Unknown verification page: ${page}`);
document.body.dataset.page = page;
document.title = title.textContent = mode.title;
description.textContent = mode.description ?? '';
if (page === 'curve') show('#command-controls');
if (page === 'qlcu1') { show('#timing'); show('#raw-details'); document.querySelector('#run')!.textContent = 'Run comparison'; }
if (['gibert', 'structured', 'probe', 'batch'].includes(page)) show('#json-details');
if (page === 'probe') document.querySelector('#run')!.textContent = 'Run probe';
if (page === 'batch') { hide('#viewport'); hide('#results'); show('#test'); document.querySelector('#run')!.textContent = 'Run five candidates'; }
void mode.load();
