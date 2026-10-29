import type { BindValueKind, BindingAllocator } from './algebra/homogeneous';

interface BindingNode {
  token: string;
  names: string[];
  values: string[];
  body: string;
  kinds?: BindValueKind[];
}

export interface CompiledBindingPlan {
  output: string;
  helpers: Array<{ name: string; expression: string; kind: BindValueKind }>;
  materialized: boolean;
}

/** Captures bind() calls before either backend prints their GeoGebra syntax. */
export const createBindingCapture = () => {
  const nodes = new Map<string, BindingNode>();
  let serial = 0;
  const captureBinding: NonNullable<BindingAllocator['captureBinding']> = (names, values, body, kinds) => {
    const token = `GGBBINDTOKEN${++serial}Z`;
    nodes.set(token, { token, names, values, body, kinds });
    return token;
  };
  const marker = /\bGGBBINDTOKEN\d+Z\b/gu;
  const expand = (source: string, render: (node: BindingNode) => string) => source.replace(marker, (token) => {
    const node = nodes.get(token);
    if (!node) throw new Error(`Unknown binding token ${token}`);
    return render(node);
  });
  const anonymous = (source: string): string => {
    const render = (node: BindingNode): string =>
      `Element(Zip(${expand(node.body, render)},${node.names.map((name, i) => `${name},{${expand(node.values[i], render)}}`).join(',')}),1)`;
    const output = expand(source, render);
    if (output.length > 500_000) throw new Error('Expanded command exceeds 500,000 characters.');
    return output;
  };

  const lower = (source: string, groupId: string, eligible: boolean): CompiledBindingPlan => {
    if (!/^[0-9a-f]{16}$/u.test(groupId)) throw new Error('Invalid internal helper group.');
    if (!eligible || nodes.size === 0 || nodes.size > 128 || [...nodes.values()].some((node) =>
      !node.kinds || node.kinds.length !== node.values.length)) {
      return { output: anonymous(source), helpers: [], materialized: false };
    }
    // The first backend intentionally rejects constructs with their own local
    // variables. A later scope-aware backend may accept individual safe nodes.
    const raw = [source, ...[...nodes.values()].flatMap((node) => [node.body, ...node.values])].join('\n');
    if (raw.length > 500_000 || /\b(?:Zip|KeepIf|Sequence|Curve|Sum|Product)\s*\(/u.test(raw))
      return { output: anonymous(source), helpers: [], materialized: false };

    const names = new Map([...nodes.values()].flatMap((node) => node.names.map((name) => [name, `ggbaux${groupId}n${name}`] as const)));
    const rename = (sourceText: string) => sourceText.replace(/\bv\d+\b/gu, (name) => names.get(name) ?? name);
    const helpers: CompiledBindingPlan['helpers'] = [];
    const rendered = new Map<string, string>();
    const render = (node: BindingNode): string => {
      const cached = rendered.get(node.token);
      if (cached !== undefined) return cached;
      node.names.forEach((name, i) => {
        helpers.push({ name: names.get(name)!, expression: rename(expand(node.values[i], render)), kind: node.kinds![i] });
      });
      const body = expand(node.body, render);
      rendered.set(node.token, body);
      return body;
    };
    const output = rename(expand(source, render));
    if (output.length + helpers.reduce((length, helper) => length + helper.name.length + helper.expression.length + 2, 0) > 500_000)
      return { output: anonymous(source), helpers: [], materialized: false };
    return { output, helpers, materialized: helpers.length > 0 };
  };
  return { captureBinding, lower };
};
