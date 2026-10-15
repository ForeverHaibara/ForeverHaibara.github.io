interface CommandToken {
  text: string;
  start: number;
  end: number;
  identifier: boolean;
}

/** Lightweight lexical scan; strings and comments never become executable tokens. */
const tokenize = (input: string, api: boolean): CommandToken[] => {
  const tokens: CommandToken[] = [];
  let index = 0;
  while (index < input.length) {
    const character = input[index];
    if (/\s/u.test(character)) { index += 1; continue; }
    if (character === '#' || character === '/' && input[index + 1] === '/') {
      while (index < input.length && input[index] !== '\n') index += 1;
      continue;
    }
    if (character === '"' || api && character === "'") {
      const quote = character;
      index += 1;
      while (index < input.length) {
        if (input[index] === '\\') { index += 2; continue; }
        if (input[index++] === quote) break;
      }
      continue;
    }
    const start = index++;
    const identifier = /[\p{L}_]/u.test(character);
    if (identifier) while (index < input.length && /[\p{L}\p{N}_']/u.test(input[index])) index += 1;
    tokens.push({ text: input.slice(start, index), start, end: index, identifier });
  }
  return tokens;
};

export interface FunctionCallName {
  name: string;
  start: number;
  end: number;
}

export const scanFunctionCalls = (input: string): { calls: FunctionCallName[]; declarations: string[] } => {
  const api = input.trimStart().startsWith('!');
  const tokens = tokenize(input, api);
  const closes = new Map<number, number>();
  const stack: number[] = [];
  tokens.forEach((token, index) => {
    if (token.text === '(' || token.text === '[' || token.text === '{') stack.push(index);
    else if (token.text === ')' || token.text === ']' || token.text === '}') {
      const open = stack.pop();
      if (open !== undefined) closes.set(open, index);
    }
  });
  const calls: FunctionCallName[] = [];
  const declarations: string[] = [];
  tokens.forEach((token, index) => {
    if (!token.identifier || !['(', '['].includes(tokens[index + 1]?.text) || tokens[index - 1]?.text === '.') return;
    if (input.slice(token.end, tokens[index + 1].start).trim()) return;
    if (api && !/^\s*!\s*(?:api\s+)?$/.test(input.slice(0, token.start))) return;
    const close = closes.get(index + 1);
    const after = close === undefined ? undefined : tokens[close + 1]?.text;
    if (!api && (after === '=' || after === ':' && tokens[close! + 2]?.text === '=')) {
      declarations.push(token.text);
      return;
    }
    calls.push({ name: token.text, start: token.start, end: token.end });
  });
  return { calls, declarations };
};
