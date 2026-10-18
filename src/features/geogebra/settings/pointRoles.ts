import type { GeoGebraEngine } from '../types';

export type PointRole = 'free' | 'constrained' | 'dependent';

const decodeAttribute = (value: string) => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name]!);
const attribute = (source: string, name: string) => {
  const match = source.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'u'));
  return match ? decodeAttribute(match[2]) : null;
};

/** Inspect the target algorithm, not a localized description or current color.
 * XML can also contain anonymous parent algorithms; match the named output. */
export function readPointConstraint(xml: string, name: string): { command: string; input: string | null } | null {
  for (const block of xml.matchAll(/<command\b([^>]*)>([\s\S]*?)<\/command>/gu)) {
    const command = attribute(block[1], 'name');
    if (command !== 'Point' && command !== 'PointIn') continue;
    const output = block[2].match(/<output\b([^>]*)\/?\s*>/u)?.[1] ?? '';
    const outputs = [...output.matchAll(/\ba\d+\s*=\s*(["'])(.*?)\1/gu)].map((item) => decodeAttribute(item[2]));
    if (!outputs.includes(name)) continue;
    const input = block[2].match(/<input\b([^>]*)\/?\s*>/u)?.[1] ?? '';
    return { command, input: attribute(input, 'a0') };
  }
  return null;
}

export async function readPointRole(engine: GeoGebraEngine, name: string): Promise<PointRole> {
  if (await engine.callApi('isIndependent', [name]) === true) return 'free';
  const xml = await engine.callApi('getAlgorithmXML', [name]);
  const constraint = typeof xml === 'string' ? readPointConstraint(xml, name) : null;
  if (!constraint) return 'dependent';
  if (constraint.command === 'PointIn') return 'constrained';
  // Point({x,y}) constructs coordinates from a list, not a point on a path.
  if (constraint.input?.trimStart().startsWith('{')) return 'dependent';
  if (constraint.input) {
    const type = await engine.callApi('getObjectType', [constraint.input]);
    if (type === 'list' && await engine.callApi('isMoveable', [name]) !== true) return 'dependent';
  }
  return 'constrained';
}
