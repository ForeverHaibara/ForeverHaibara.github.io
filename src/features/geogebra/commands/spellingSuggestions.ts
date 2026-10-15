import type { CompletionItem } from './completion/types';
import { scanFunctionCalls } from './commandTokens';

// Valid mathematical functions also need protection from command-name guesses.
// https://geogebra.github.io/docs/manual/en/Predefined_Functions_and_Operators/
const MATH_FUNCTIONS = 'x y z arg conjugate real imaginary abs alt sgn sign floor ceil round sqrt cbrt nroot random exp ln ld log lg cos sin tan sec csc cosec cot cotan acos arccos acosd asin arcsin asind atan arctan atand atan2 atan2d cosh sinh tanh sech csch coth cotanh acosh arccosh asinh arcsinh atanh arctanh beta betaRegularized gamma gammaRegularized erf psi polygamma sinIntegral cosIntegral expIntegral zeta LambertW nPr'.split(' ');

export interface SpellingCorrection {
  name: string;
  start: number;
  end: number;
  suggestions: string[];
  replacement: string;
}

/** Bounded Damerau-Levenshtein distance; adjacent transpositions count as one edit. */
export const spellingDistance = (left: string, right: string, limit: number): number => {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const rows = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  rows.forEach((row, index) => { row[0] = index; });
  rows[0].forEach((_, index) => { rows[0][index] = index; });
  for (let i = 1; i <= left.length; i += 1) {
    let minimum = rows[i][0];
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1]));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      minimum = Math.min(minimum, rows[i][j]);
    }
    if (minimum > limit) return limit + 1;
  }
  return rows[left.length][right.length];
};

export const findSpellingCorrections = (input: string, items: readonly CompletionItem[]): SpellingCorrection[] => {
  const { calls, declarations } = scanFunctionCalls(input);
  const api = input.trimStart().startsWith('!');
  const protectedNames = new Set([...declarations, ...items.filter((item) => item.kind === 'object').map((item) => item.label)].map((name) => name.toLowerCase()));
  const candidates = items.filter((item) => item.kind !== 'object' && item.callable !== false);
  if (!api) candidates.push(...MATH_FUNCTIONS.map((label) => ({ label, kind: 'command' as const })));
  const exactNames = new Set(candidates.map((item) => item.label));
  return calls.flatMap((call): SpellingCorrection[] => {
    const lower = call.name.toLowerCase();
    if (exactNames.has(call.name) || protectedNames.has(lower) || call.name.length > 64) return [];
    const limit = call.name.length <= 3 ? 0 : call.name.length < 8 ? 1 : 2;
    const matches = candidates.map((item) => ({
      name: item.label,
      distance: item.aliases?.some((alias) => alias.toLowerCase() === lower) ? 0 : spellingDistance(lower, item.label.toLowerCase(), limit),
    })).filter((match) => match.distance <= limit);
    if (!matches.length) return [];
    const best = Math.min(...matches.map((match) => match.distance));
    const suggestions = [...new Set(matches.filter((match) => match.distance === best).map((match) => match.name))].sort((a, b) => a.localeCompare(b, 'en')).slice(0, 4);
    return [{ ...call, suggestions, replacement: suggestions[0] }];
  });
};

export const applySpellingCorrections = (input: string, corrections: readonly SpellingCorrection[]): { value: string; start: number; end: number } => {
  let value = input;
  const ordered = [...corrections].sort((a, b) => a.start - b.start);
  for (const correction of [...ordered].reverse()) {
    if (input.slice(correction.start, correction.end) !== correction.name || !correction.suggestions.includes(correction.replacement)) throw new Error('Spelling suggestions no longer match the input.');
    value = value.slice(0, correction.start) + correction.replacement + value.slice(correction.end);
  }
  const first = ordered[0];
  return { value, start: first?.start ?? value.length, end: first ? first.start + first.replacement.length : value.length };
};
