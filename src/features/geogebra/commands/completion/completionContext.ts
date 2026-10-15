import type { CompletionContext, CompletionEdit, CompletionItem } from './types';

const identifierPart = /[\p{L}\p{N}_]/u;
const identifierStart = /[\p{L}_]/u;

const isInLiteral = (input: string, cursor: number, api: boolean): boolean => {
  let quote = '';
  let escaped = false;
  let comment = false;
  for (let index = 0; index < cursor; index += 1) {
    const character = input[index];
    if (comment) {
      if (character === '\n') comment = false;
    } else if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
    } else if (character === '"' || api && character === "'") {
      quote = character;
    } else if (character === '#' || character === '/' && input[index + 1] === '/') {
      comment = true;
    }
  }
  return Boolean(quote || comment);
};

export const getCompletionContext = (input: string, cursor: number, selectionEnd = cursor, explicit = false): CompletionContext | null => {
  if (cursor !== selectionEnd || cursor < 0 || cursor > input.length) return null;
  const api = input.trimStart().startsWith('!');
  if (isInLiteral(input, cursor, api)) return null;
  let start = cursor;
  let end = cursor;
  while (start > 0 && identifierPart.test(input[start - 1])) start -= 1;
  while (end < input.length && identifierPart.test(input[end])) end += 1;
  const prefix = input.slice(start, cursor);
  if (prefix && !identifierStart.test(prefix[0])) return null;
  if (api) {
    // API arguments are values, not method-name completion sites.
    if (!/^\s*!\s*(?:api\s+)?$/.test(input.slice(0, start))) return null;
  } else {
    if (!prefix && !explicit) return null;
    if (/^\s*=(?!=)/.test(input.slice(end))) return null;
    if (start > 0 && /[\p{L}\p{N}_.']/u.test(input[start - 1])) return null;
  }
  return { input, cursor, prefix, range: { start, end }, mode: api ? 'api' : 'command', explicit };
};

export const applyCompletion = (context: CompletionContext, item: CompletionItem): CompletionEdit => {
  const before = context.input.slice(0, context.range.start);
  const after = context.input.slice(context.range.end);
  let text = item.insertText ?? item.label;
  let cursor = before.length + text.length;
  if (item.callable !== false && item.insertText === undefined) {
    const opening = after.match(/^\s*([([])/);
    if (opening) {
      cursor += opening[0].length;
    } else {
      text += '()';
      cursor += 1;
    }
  }
  return { value: before + text + after, cursor };
};
