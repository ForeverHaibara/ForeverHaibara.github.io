import type { ApiCall } from '../types';

const splitArguments = (value: string): string[] => {
  const result: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote && current.at(-2) !== '\\') quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
      current += character;
    } else if (character === '(' || character === '[' || character === '{') {
      depth += 1;
      current += character;
    } else if (character === ')' || character === ']' || character === '}') {
      depth -= 1;
      current += character;
    } else if (character === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
};

const parseArgument = (value: string): unknown => {
  if (value === '') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value;
  }
};

export const parseApiCall = (input: string): ApiCall => {
  const match = input.trim().match(/^api\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:\((.*)\))?$/s);
  if (!match) throw new Error('Use the format: api methodName(arg1, arg2)');
  const method = match[1];
  const body = match[2] ?? '';
  return { method, args: body.trim() ? splitArguments(body).map(parseArgument) : [] };
};

export const formatApiResult = (result: unknown): string => {
  if (typeof result === 'string') return result;
  if (result === undefined) return 'undefined';
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};
