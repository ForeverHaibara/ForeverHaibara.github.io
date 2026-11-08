import { advancedCommands } from '../advancedCommands';
import { gibertCurveRecords } from '../custom/builders/relatedCurves';
import { studioToolCatalog, toolSignature } from '../custom/toolLibrary';
import type { GeometryType } from '../custom/types';
import { referenceNotes, toolGroups } from './referenceNotes';

export const specialGroup = 'Special commands';
const otherGroup = 'Other constructions';
export const referenceGroups = [...Object.keys(toolGroups), otherGroup, specialGroup];
export const gibertReferenceIds = gibertCurveRecords.map(({ id }) => id);

export interface ReferenceTool {
  name: string;
  description: string;
  aliases: readonly string[];
  groups: readonly string[];
  signatures: readonly { text: string; type?: GeometryType }[];
  notes: (typeof referenceNotes)[string];
}

const groupsByTool = new Map<string, string[]>();
for (const [group, names] of Object.entries(toolGroups)) {
  for (const name of names) {
    const groups = groupsByTool.get(name) ?? [];
    groups.push(group);
    groupsByTool.set(name, groups);
  }
}

const constructions: ReferenceTool[] = studioToolCatalog.tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  aliases: tool.aliases ?? [],
  groups: groupsByTool.get(tool.name) ?? [otherGroup],
  signatures: tool.overloads.map((overload) => ({ text: toolSignature(tool, overload), type: overload.returns })),
  notes: referenceNotes[tool.name],
}));

export function getReferenceTools(): ReferenceTool[] {
  const special = advancedCommands.list().map(({ name, description, signatures }) => {
    const command = `!${name}`;
    return {
      name: command,
      description,
      aliases: [],
      groups: [specialGroup],
      signatures: signatures.map((text) => ({ text: `!${text}` })),
      notes: referenceNotes[command],
    };
  });
  return [...constructions, ...special].sort((a, b) => a.name.localeCompare(b.name, 'en'));
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
    const index = [...labels, ...tool.groups, tool.description, tool.notes?.keywords ?? ''].join(' ').toLowerCase();
    const numberedMatch = (tool.name === 'TriangleCenter' && /^x\(\s*\d+\s*\)$/u.test(key))
      || (tool.name === 'GibertCurve' && gibertReferenceIds.includes(key.toUpperCase()));
    if (!numberedMatch && !terms.every((term) => index.includes(term))) return [];
    const rank = numberedMatch || labels.includes(key) ? 0 : labels.some((label) => label.startsWith(key)) ? 1 : 2;
    const alias = key ? tool.aliases.find((name) => name.toLowerCase().includes(key)) : undefined;
    return [{ tool, alias, rank }];
  }).sort((a, b) => a.rank - b.rank);
}
