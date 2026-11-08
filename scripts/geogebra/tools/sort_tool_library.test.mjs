import { describe, expect, it } from 'vitest';
import { readCategories, sortLibrary } from './sort_tool_library.mjs';

const categories = `export const toolGroups: ToolCategory = {
  First: { Inner: ['B', 'A'] },
  Second: ['B'],
};`;
const source = `{
  "version": 2,
  "tools": [
    {"name":"A", "aliases":["Alpha"], "custom":{"nested":true}, "reference":{"keywords":"垂足", "related":["B"]}},
    {"name":"C", "overloads":[{"expression":"a,b"}]},
    {"name":"B", "description":"Text with } and \\\"quotes\\\""}
  ]
}\n`;

describe('sort tool library', () => {
  it('preserves complete entries, keeps unclassified tools, and reports cross-listed tools', () => {
    const result = sortLibrary(source, readCategories(categories));
    const original = JSON.parse(source);
    const sorted = JSON.parse(result.output);
    expect(sorted.tools.map((tool) => tool.name)).toEqual(['B', 'A', 'C']);
    expect(sorted.tools).toEqual([original.tools[2], original.tools[0], original.tools[1]]);
    expect(result.output).toContain('{"name":"A", "aliases":["Alpha"], "custom":{"nested":true}, "reference":{"keywords":"垂足", "related":["B"]}}');
    expect(result.unclassified).toEqual(['C']);
    expect(result.repeated).toEqual(['B: First / Inner | Second']);
    expect(sortLibrary(result.output, readCategories(categories)).output).toBe(result.output);
  });

  it('rejects unknown category entries and duplicate library names', () => {
    expect(() => sortLibrary(source, readCategories(`export const toolGroups = { X: ['Missing'] };`)))
      .toThrow('X: Missing');
    expect(() => sortLibrary('{"tools":[{"name":"A"},{"name":"a"}]}', []))
      .toThrow('duplicate library tool name');
  });

  it('skips documented native-only names without losing custom entries', () => {
    const entries = readCategories(`export const toolGroups = { X: ['Native', 'B', 'A'] };`);
    const result = sortLibrary(source, entries, ['Native', 'B']);
    expect(JSON.parse(result.output).tools.map((tool) => tool.name)).toEqual(['B', 'A', 'C']);
    expect(result.unclassified).toEqual(['C']);
  });
});
