import { PYODIDE_VERSION } from './capabilities';
import type { Ag2WorkerRequest, Ag2WorkerResponse } from './protocol';

interface PythonRuntime {
  loadPackage(name: string): Promise<void>;
  FS: { writeFile(path: string, source: string): void };
  globals: { set(name: string, value: string): void; delete(name: string): void };
  runPython(code: string): unknown;
}

const send = (message: Ag2WorkerResponse) => self.postMessage(message);
const readSource = async (url: URL) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load reasoning source (${response.status}).`);
  return response.text();
};
const initialize = async (): Promise<PythonRuntime> => {
  const indexURL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`) as { loadPyodide(options: { indexURL: string }): Promise<PythonRuntime> };
  const runtime = await loadPyodide({ indexURL });
  await runtime.loadPackage('numpy');
  const root = new URL(import.meta.env.BASE_URL, self.location.origin);
  const modules = ['parse', 'numericals', 'elimination', 'ddar'];
  const sources = await Promise.all(modules.map((name) => readSource(new URL(`vendor/alphageometry2/${name}.py`, root))));
  modules.forEach((name, i) => runtime.FS.writeFile(`/home/pyodide/${name}.py`, sources[i]));
  runtime.FS.writeFile('/home/pyodide/ag2_bridge.py', await readSource(new URL('geometry-reasoning/ag2_bridge.py', root)));
  runtime.runPython('from ag2_bridge import solve_json');
  return runtime;
};
let ready: Promise<PythonRuntime> | null = null;

self.onmessage = async (event: MessageEvent<Ag2WorkerRequest>) => {
  const { id, problem } = event.data;
  try {
    send({ id, phase: 'loading' });
    ready ??= initialize();
    const runtime = await ready;
    send({ id, phase: 'solving' });
    runtime.globals.set('_site_problem_json', JSON.stringify(problem));
    try {
      const result = JSON.parse(String(runtime.runPython('solve_json(_site_problem_json)')));
      send({ id, result });
    } finally { runtime.globals.delete('_site_problem_json'); }
  } catch (error) {
    ready = null;
    send({ id, error: error instanceof Error ? error.message : 'AG2 worker failed.' });
  }
};
