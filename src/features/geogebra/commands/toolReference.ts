import gibertCurveRecords from './custom/data/related-curves/curves.json';
import nativeData from './nativeCommandReference.json';
import type { AdvancedCommand } from './advancedCommands';
import type { GeometryType, ToolDefinition, ToolLibrary, ToolOverload } from './custom/types';
import { toolGroups } from './custom/toolCategories';
import type { ToolCategory } from './custom/toolCategories';

export interface ReferenceMetadata {
  keywords?: string;
  details?: string[];
  examples?: Array<{ command: string; note?: string }>;
  related?: string[];
}

export function validateReferenceMetadata(value: unknown, name: string): void {
  if (value === undefined) return;
  const invalid = () => { throw new Error(`Invalid reference metadata: ${name}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['keywords', 'details', 'examples', 'related'].includes(key))) return invalid();
  if (record.keywords !== undefined && typeof record.keywords !== 'string') return invalid();
  for (const key of ['details', 'related']) {
    const items = record[key];
    if (items !== undefined && (!Array.isArray(items) || items.some((item) => typeof item !== 'string' || !item.trim()))) return invalid();
  }
  if (record.examples !== undefined && (!Array.isArray(record.examples) || record.examples.some((example) =>
    !example || typeof example !== 'object' || Array.isArray(example)
      || Object.keys(example).some((key) => !['command', 'note'].includes(key))
      || typeof example.command !== 'string' || !example.command.trim()
      || example.note !== undefined && typeof example.note !== 'string'))) return invalid();
}

export const toolSignature = (tool: ToolDefinition, overload: ToolOverload) =>
  `${tool.name}(${overload.params.map((param) => `${param.name}: ${param.type}${overload.variadic ? '…' : ''}`).join(', ')})`;

export const specialGroup = 'Special commands';
const otherGroup = 'Other constructions';
export const referenceGroups = [...Object.keys(toolGroups), otherGroup, specialGroup];
export const gibertReferenceIds = gibertCurveRecords.map(({ id }) => id);

export interface NativeCommandReference {
  description: string;
  signatures: Array<{ text: string; type?: string; note?: string; shared?: boolean }>;
  dispatch?: string;
  reference?: ReferenceMetadata;
}

/** Curated native forms for the Studio reference; the generated name index covers more commands. */
export const nativeCommandReference: Readonly<Record<string, NativeCommandReference>> = nativeData;

export interface ReferenceTool {
  name: string;
  description: string;
  aliases: readonly string[];
  groups: readonly string[];
  paths: readonly (readonly string[])[];
  signatures: readonly { text: string; type?: GeometryType }[];
  native?: NativeCommandReference;
  notes: ReferenceMetadata | undefined;
}

const groupsByTool = new Map<string, string[]>();
const pathsByTool = new Map<string, string[][]>();
export function visitToolCategories(categories: ToolCategory, visit: (path: string[], names: readonly string[]) => void, parent: string[] = []) {
  for (const [label, children] of Object.entries(categories)) {
    const path = [...parent, label];
    if (Array.isArray(children)) visit(path, children);
    else visitToolCategories(children as ToolCategory, visit, path);
  }
}
visitToolCategories(toolGroups, (path, names) => {
  for (const name of names) {
    const paths = pathsByTool.get(name) ?? [];
    paths.push(path);
    pathsByTool.set(name, paths);
    const groups = groupsByTool.get(name) ?? [];
    if (!groups.includes(path[0])) groups.push(path[0]);
    groupsByTool.set(name, groups);
  }
});

export function getReferenceTools(catalog: ToolLibrary, advanced: readonly AdvancedCommand[]): ReferenceTool[] {
  const constructions: ReferenceTool[] = catalog.tools.map((tool) => {
    const native = nativeCommandReference[tool.name];
    const nativeNotes = native?.reference;
    const notes = nativeNotes && tool.reference ? {
      keywords: [tool.reference.keywords, nativeNotes.keywords].filter(Boolean).join(' '),
      details: [...new Set([...(tool.reference.details ?? []), ...(nativeNotes.details ?? [])])],
      examples: [...new Map([...(nativeNotes.examples ?? []), ...(tool.reference.examples ?? [])].map((example) => [example.command, example])).values()],
      related: [...new Set([...(tool.reference.related ?? []), ...(nativeNotes.related ?? [])])],
    } : tool.reference ?? nativeNotes;
    return {
      name: tool.name,
      description: tool.description,
      aliases: tool.aliases ?? [],
      groups: groupsByTool.get(tool.name) ?? [otherGroup],
      paths: pathsByTool.get(tool.name) ?? [[otherGroup]],
      signatures: tool.overloads.map((overload) => ({ text: toolSignature(tool, overload), type: overload.returns })),
      notes,
      native,
    };
  });
  const customNames = new Set(catalog.tools.map((tool) => tool.name.toLowerCase()));
  const nativeOnly: ReferenceTool[] = Object.entries(nativeCommandReference)
    .filter(([name]) => !customNames.has(name.toLowerCase()))
    .map(([name, native]) => ({
      name,
      description: native.description,
      aliases: [],
      groups: groupsByTool.get(name) ?? [otherGroup],
      paths: pathsByTool.get(name) ?? [[otherGroup]],
      signatures: [],
      notes: native.reference,
      native,
    }));
  const special = advanced.map(({ name, description, signatures, reference }) => {
    const command = `!${name}`;
    return {
      name: command,
      description,
      aliases: [],
      groups: [specialGroup],
      paths: [[specialGroup]],
      signatures: signatures.map((text) => ({ text: `!${text}` })),
      notes: reference,
    };
  });
  return [...constructions, ...nativeOnly, ...special].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export const toolReferencePath = (name?: string) =>
  name ? `/geogebra/tools/${encodeURIComponent(name)}` : '/geogebra/tools';

export function findReferenceTool(tools: readonly ReferenceTool[], name: string | undefined) {
  const key = name?.toLowerCase();
  return key ? tools.find((tool) => [tool.name, ...tool.aliases].some((label) => label.toLowerCase() === key)) : undefined;
}

export function searchReferenceTools(tools: readonly ReferenceTool[], query: string, group: string) {
  const key = query.trim().toLowerCase();
  const terms = key.split(/\s+/u);
  return tools.flatMap((tool) => {
    if (group && !tool.groups.includes(group)) return [];
    const labels = [tool.name, ...tool.aliases].flatMap((name) =>
      name.startsWith('!') ? [name.toLowerCase(), name.slice(1).toLowerCase()] : [name.toLowerCase()],
    );
    const index = [...labels, ...tool.paths.flat(), tool.description, tool.notes?.keywords ?? ''].join(' ').toLowerCase();
    const numberedMatch = (tool.name === 'TriangleCenter' && /^x\(\s*\d+\s*\)$/u.test(key))
      || (tool.name === 'GibertCurve' && gibertReferenceIds.includes(key.toUpperCase()));
    if (!numberedMatch && !terms.every((term) => index.includes(term))) return [];
    const rank = numberedMatch || labels.includes(key) ? 0 : labels.some((label) => label.startsWith(key)) ? 1 : 2;
    const alias = key ? tool.aliases.find((name) => name.toLowerCase().includes(key)) : undefined;
    return [{ tool, alias, rank }];
  }).sort((a, b) => a.rank - b.rank);
}
