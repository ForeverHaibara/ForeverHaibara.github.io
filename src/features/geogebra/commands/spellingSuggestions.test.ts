import { describe, expect, it } from 'vitest';
import { scanFunctionCalls } from './commandTokens';
import { applySpellingCorrections, findSpellingCorrections, spellingDistance } from './spellingSuggestions';
import type { CompletionItem } from './completion/types';

const items: CompletionItem[] = ['Circle', 'Distance', 'Intersect', 'Incircle', 'Min', 'Max'].map((label) => ({ label, kind: 'command' }));

describe('failed-command spelling suggestions', () => {
  it('recognizes case differences and adjacent transpositions', () => {
    expect(findSpellingCorrections('c = cIRClE(A, 2)', items)[0].replacement).toBe('Circle');
    expect(findSpellingCorrections('c = Circel(A, 2)', items)[0].replacement).toBe('Circle');
    expect(spellingDistance('circel', 'circle', 1)).toBe(1);
  });

  it('bounds fuzzy guesses by name length and does not guess for short or distant names', () => {
    expect(findSpellingCorrections('Mim(1, 2)', items)).toEqual([]);
    expect(findSpellingCorrections('MIN(1, 2)', items)[0].replacement).toBe('Min');
    expect(findSpellingCorrections('Crcl(A, 2)', items)).toEqual([]);
    expect(findSpellingCorrections('xxxxxxxxxxxxxx(A)', items)).toEqual([]);
    expect(findSpellingCorrections('Intersexx(A, B)', items)[0].replacement).toBe('Intersect');
  });

  it('scans only calls, skips strings/comments, and preserves assignment labels and object references', () => {
    const input = 'Circel = A\nc = Circel(A, 2)\nText("Circel(A)")\n# Circel(A)\n// Circel(A)';
    const corrections = findSpellingCorrections(input, items);
    expect(corrections).toHaveLength(1);
    expect(applySpellingCorrections(input, corrections).value).toBe(input.replace('c = Circel', 'c = Circle'));
    expect(findSpellingCorrections('Circel + A', items)).toEqual([]);
    expect(findSpellingCorrections('Circel "text" (A)', items)).toEqual([]);
  });

  it('protects known commands, math functions, object functions and inline declarations', () => {
    expect(findSpellingCorrections('Circle(A) + sin(A) + sqrt(A)', items)).toEqual([]);
    expect(findSpellingCorrections('Circel(A) + CIRCEL(A)', [...items, { label: 'Circel', kind: 'object', callable: false }])).toEqual([]);
    expect(findSpellingCorrections('Circel(x) = x + 1\nCircel(2)', items)).toEqual([]);
    expect(scanFunctionCalls('f(x) := Circel(A, 2)').declarations).toEqual(['f']);
  });

  it('supports nested calls, square brackets, escaped strings and primed functions', () => {
    const input = 'Distance(Circel[A, 2], B) + Text("a\\\"Circel(A)") + f\'(2)';
    expect(scanFunctionCalls(input).calls.map((call) => call.name)).toEqual(['Distance', 'Circel', 'Text', "f'"]);
    expect(findSpellingCorrections(input, items).map((correction) => correction.replacement)).toEqual(['Circle']);
    expect(scanFunctionCalls('object.Circel(A)').calls).toEqual([]);
  });

  it('includes custom commands and aliases, with multiple equally close options for review', () => {
    const custom: CompletionItem[] = [{ label: 'MyCenter', kind: 'custom', aliases: ['centerTool'] }, { label: 'Fire', kind: 'custom' }, { label: 'Tire', kind: 'custom' }];
    expect(findSpellingCorrections('mycenter(A)', custom)[0].replacement).toBe('MyCenter');
    expect(findSpellingCorrections('centerTool(A)', custom)[0].replacement).toBe('MyCenter');
    const alternatives = findSpellingCorrections('Dire(A)', custom)[0];
    expect(alternatives.suggestions).toEqual(['Fire', 'Tire']);
    expect(applySpellingCorrections('Dire(A)', [{ ...alternatives, replacement: 'Tire' }]).value).toBe('Tire(A)');
  });

  it('only checks the API method name and leaves its string arguments unchanged', () => {
    const api: CompletionItem[] = [{ label: 'getObjectType', kind: 'api' }];
    const input = '!GETOBJECTTYPE("Circel(A)")';
    expect(applySpellingCorrections(input, findSpellingCorrections(input, api)).value).toBe('!getObjectType("Circel(A)")');
    expect(findSpellingCorrections('!getObjectType', api)).toEqual([]);
    expect(scanFunctionCalls("!api GETOBJECTTYPE('Circel(A)')").calls.map((call) => call.name)).toEqual(['GETOBJECTTYPE']);
  });

  it('applies several edits from right to left and rejects stale input or invalid replacements', () => {
    const input = 'Cricle(A, B) + DISTANCE(A, B)';
    const corrections = findSpellingCorrections(input, items);
    expect(corrections).toHaveLength(2);
    const edit = applySpellingCorrections(input, corrections);
    expect(edit.value).toBe('Circle(A, B) + Distance(A, B)');
    expect(edit.value.slice(edit.start, edit.end)).toBe('Circle');
    expect(() => applySpellingCorrections('changed', corrections)).toThrow('no longer match');
    expect(() => applySpellingCorrections(input, [{ ...corrections[0], replacement: 'Delete' }])).toThrow('no longer match');
  });
});
