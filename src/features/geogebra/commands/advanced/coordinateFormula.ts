/** Restricted arithmetic parser for the maintained ETC formulas (no JavaScript eval). */
type Scope = Record<string, number>;
type Formula = (scope: Scope) => number;
const functions: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs,
  sinh: Math.sinh, asinh: Math.asinh, atan: Math.atan, ln: Math.log,
  cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x),
};
const cache = new Map<string, Formula>();
export const formula = (source: string): Formula => {
  const existing = cache.get(source);
  if (existing)
    return existing;
  const tokens = source.match(/\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]+|[()+*/^,-]/gu) ?? [];
  if (tokens.join('') !== source)
    throw new Error(`Invalid coordinate formula: ${source}`);
  let index = 0;
  const expression = (minimum = 0): Formula => {
    const token = tokens[index++];
    let left: Formula;
    if (token === '-' || token === '+') {
      const child = expression(3);
      left = token === '-' ? (s) => -child(s) : child;
    }
    else if (token === '(') {
      left = expression();
      if (tokens[index++] !== ')')
        throw new Error('Missing coordinate parenthesis.');
    }
    else if (/^(?:\d|\.)/u.test(token ?? '')) {
      const value = Number(token);
      left = () => value;
    }
    else if (token && /^[A-Za-z_]+$/u.test(token)) {
      if (tokens[index] === '(') {
        const fn = functions[token];
        if (!fn)
          throw new Error(`Unknown coordinate function: ${token}`);
        index++;
        const child = expression();
        if (tokens[index++] !== ')')
          throw new Error('Missing function parenthesis.');
        left = (s) => fn(child(s));
      }
      else
        left = (s) => s[token] ?? NaN;
    }
    else
      throw new Error('Invalid coordinate expression.');
    while (index < tokens.length) {
      const op = tokens[index];
      const precedence = op === '+' || op === '-' ? 1 : op === '*' || op === '/' ? 2 : op === '^' ? 3 : 0;
      if (!precedence || precedence < minimum)
        break;
      index++;
      const right = expression(precedence + (op === '^' ? 0 : 1));
      const first = left;
      left = op === '+' ? (s) => first(s) + right(s) : op === '-' ? (s) => first(s) - right(s)
        : op === '*' ? (s) => first(s) * right(s) : op === '/' ? (s) => first(s) / right(s) : (s) => first(s) ** right(s);
    }
    return left;
  };
  const result = expression();
  if (index !== tokens.length)
    throw new Error('Unexpected coordinate token.');
  cache.set(source, result);
  return result;
};
