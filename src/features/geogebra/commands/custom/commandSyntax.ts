export interface CallSpan {
  name: string;
  start: number;
  end: number;
  open: number;
  args: string[];
  declaration: boolean;
}

const identifier = /[\p{L}_][\p{L}\p{N}_']*/uy;

/** Balanced lexical structure only; untouched GeoGebra mathematics stays opaque. */
export const splitTopLevel = (source: string, separators = ','): string[] => {
  const parts: string[] = [];
  const stack: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (quoted) {
      if (c === '\\') i += 1;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === '#' || c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      if (separators.includes('\n') && stack.length === 0) { parts.push(source.slice(start, i)); start = i + 1; }
      continue;
    }
    if ('([{'.includes(c)) stack.push(c);
    else if (')]}'.includes(c)) {
      if (stack.pop() !== ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[c]) throw new Error('Unbalanced command brackets.');
    } else if (stack.length === 0 && separators.includes(c)) { parts.push(source.slice(start, i)); start = i + 1; }
  }
  if (quoted || stack.length) throw new Error('Unterminated string or command brackets.');
  parts.push(source.slice(start));
  return parts;
};

/** Only outer calls are returned; their arguments are compiled recursively. */
export const outerCalls = (source: string): CallSpan[] => {
  const calls: CallSpan[] = [];
  for (let i = 0; i < source.length;) {
    if (source[i] === '"') {
      i += 1;
      while (i < source.length) { if (source[i] === '\\') i += 2; else if (source[i++] === '"') break; }
      continue;
    }
    if (source[i] === '#' || source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    identifier.lastIndex = i;
    const match = identifier.exec(source);
    if (!match) { i += 1; continue; }
    const start = i;
    i += match[0].length;
    let open = i;
    while (/\s/u.test(source[open] ?? '') && open < source.length) open += 1;
    if (!'(['.includes(source[open] ?? '\0') || source[start - 1] === '.') continue;
    const stack = [source[open]];
    let end = open + 1;
    let quoted = false;
    for (; end < source.length && stack.length; end += 1) {
      const c = source[end];
      if (quoted) { if (c === '\\') end += 1; else if (c === '"') quoted = false; }
      else if (c === '"') quoted = true;
      else if ('([{'.includes(c)) stack.push(c);
      else if (')]}'.includes(c) && stack.pop() !== ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[c]) throw new Error('Unbalanced command brackets.');
    }
    if (stack.length || quoted) throw new Error('Unterminated command call.');
    const body = source.slice(open + 1, end - 1);
    calls.push({ name: match[0], start, end, open, args: body.trim() ? splitTopLevel(body) : [], declaration: !source.slice(0, start).trim() && /^\s*(?::=|=(?!=))/u.test(source.slice(end)) });
    i = end;
  }
  return calls;
};
