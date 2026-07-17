import type { ExpressionNode, ParseDiagnostic, ParsedConstruction } from './graphTypes';

type Token = {
  kind: 'number' | 'string' | 'identifier' | 'object' | 'operator' | 'punctuation' | 'eof';
  value: string;
  position: number;
};

const isIdentifierCharacter = (value: string | undefined): boolean => Boolean(value && /[\p{L}\p{N}_{}]/u.test(value));

const sortNamesForMatching = (names: readonly string[]): string[] =>
  [...new Set(names.filter(Boolean))].sort((left, right) => right.length - left.length);

const tokenize = (source: string, objectNames: readonly string[], diagnostics: ParseDiagnostic[]): Token[] => {
  const tokens: Token[] = [];
  const sortedObjectNames = sortNamesForMatching(objectNames);
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    const objectName = sortedObjectNames.find((candidate) => {
      if (!source.startsWith(candidate, index)) return false;
      const before = source[index - 1];
      const after = source[index + candidate.length];
      return !isIdentifierCharacter(before) && !isIdentifierCharacter(after);
    });
    if (objectName) {
      tokens.push({ kind: 'object', value: objectName, position: index });
      index += objectName.length;
      continue;
    }

    if (/[0-9.]/u.test(character)) {
      const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u);
      if (match) {
        tokens.push({ kind: 'number', value: match[0], position: index });
        index += match[0].length;
        continue;
      }
    }

    if (character === '"' || character === "'") {
      const quote = character;
      const start = index;
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') index += 2;
        else if (source[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      const value = source.slice(start, index);
      if (value.at(-1) !== quote) diagnostics.push({ message: 'Unterminated string literal.', position: start, severity: 'error' });
      tokens.push({ kind: 'string', value, position: start });
      continue;
    }

    if (/\p{L}/u.test(character) || character === '_') {
      const start = index;
      index += 1;
      while (index < source.length && isIdentifierCharacter(source[index])) index += 1;
      tokens.push({ kind: 'identifier', value: source.slice(start, index), position: start });
      continue;
    }

    const operator = ['==', '!=', '<=', '>=', '&&', '||', '=>', '**'].find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ kind: 'operator', value: operator, position: index });
      index += operator.length;
      continue;
    }
    if ('+-*/^=<>!~%'.includes(character)) {
      tokens.push({ kind: 'operator', value: character, position: index });
      index += 1;
      continue;
    }
    if ('(),[]{}'.includes(character)) {
      tokens.push({ kind: 'punctuation', value: character, position: index });
      index += 1;
      continue;
    }

    diagnostics.push({ message: `Unrecognized character '${character}'.`, position: index, severity: 'error' });
    tokens.push({ kind: 'punctuation', value: character, position: index });
    index += 1;
  }

  tokens.push({ kind: 'eof', value: '', position: source.length });
  return tokens;
};

const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '=': 3,
  '==': 3,
  '!=': 3,
  '<': 3,
  '>': 3,
  '<=': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '^': 6,
  '**': 6,
};

class ExpressionParser {
  private index = 0;

  public constructor(
    private readonly source: string,
    private readonly tokens: Token[],
    private readonly diagnostics: ParseDiagnostic[],
  ) {}

  public parse(): ExpressionNode | null {
    if (this.peek().kind === 'eof') return null;
    const expression = this.parseExpression(0);
    if (this.peek().kind !== 'eof') {
      this.diagnostics.push({ message: `Unexpected token '${this.peek().value}'.`, position: this.peek().position, severity: 'warning' });
      return { kind: 'unknown', raw: this.source };
    }
    return expression;
  }

  private parseExpression(minPrecedence: number): ExpressionNode {
    let left = this.parsePrefix();
    while (true) {
      const token = this.peek();
      const precedence = token.kind === 'operator' ? PRECEDENCE[token.value] : undefined;
      if (precedence === undefined || precedence < minPrecedence) break;
      this.advance();
      const right = this.parseExpression(token.value === '^' || token.value === '**' ? precedence : precedence + 1);
      left = { kind: 'binary', operator: token.value, left, right, raw: this.rawBetween(left, right) };
    }
    return left;
  }

  private parsePrefix(): ExpressionNode {
    const token = this.advance();
    if (token.kind === 'operator' && '+-!~'.includes(token.value)) {
      const operand = this.parseExpression(7);
      return { kind: 'unary', operator: token.value, operand, raw: this.rawBetweenToken(token, operand) };
    }
    if (token.kind === 'number' || token.kind === 'string') return { kind: 'literal', value: token.value, raw: token.value };
    if (token.kind === 'object') return this.parsePostfix({ kind: 'reference', name: token.value, raw: token.value });
    if (token.kind === 'identifier') return this.parsePostfix({ kind: 'identifier', name: token.value, raw: token.value });
    if (token.value === '(') {
      const expression = this.parseExpression(0);
      this.consumeClosing(')');
      return this.parsePostfix(expression);
    }
    if (token.value === '[' || token.value === '{') {
      const closing = token.value === '[' ? ']' : '}';
      const items: ExpressionNode[] = [];
      while (this.peek().kind !== 'eof' && this.peek().value !== closing) {
        items.push(this.parseExpression(0));
        if (this.peek().value === ',') this.advance();
        else if (this.peek().value !== closing) {
          this.diagnostics.push({ message: `Expected ',' or '${closing}'.`, position: this.peek().position, severity: 'warning' });
          break;
        }
      }
      this.consumeClosing(closing);
      return { kind: 'sequence', items, raw: this.source.slice(token.position, this.previousEnd()) };
    }
    this.diagnostics.push({ message: `Expected an expression near '${token.value || 'end of input'}'.`, position: token.position, severity: 'error' });
    return { kind: 'unknown', raw: token.value };
  }

  private parsePostfix(base: ExpressionNode): ExpressionNode {
    while (this.peek().value === '(') {
      this.advance();
      const args: ExpressionNode[] = [];
      while (this.peek().kind !== 'eof' && this.peek().value !== ')') {
        args.push(this.parseExpression(0));
        if (this.peek().value === ',') this.advance();
        else if (this.peek().value !== ')') {
          this.diagnostics.push({ message: "Expected ',' or ')'.", position: this.peek().position, severity: 'warning' });
          break;
        }
      }
      this.consumeClosing(')');
      base = { kind: 'call', callee: base, args, raw: this.rawBetween(base, args.at(-1) ?? base) };
    }
    return base;
  }

  private consumeClosing(value: string): void {
    if (this.peek().value === value) this.advance();
    else this.diagnostics.push({ message: `Missing closing '${value}'.`, position: this.peek().position, severity: 'error' });
  }

  private peek(): Token { return this.tokens[this.index] ?? this.tokens.at(-1)!; }
  private advance(): Token { const token = this.peek(); this.index += 1; return token; }
  private previousEnd(): number { return this.tokens[Math.max(0, this.index - 1)]?.position ?? this.source.length; }
  private rawBetween(left: ExpressionNode, right: ExpressionNode): string { return `${left.raw} ${right.raw}`; }
  private rawBetweenToken(token: Token, operand: ExpressionNode): string { return `${token.value}${operand.raw}`; }
}

const collectDependencies = (node: ExpressionNode | null, result: Set<string>): void => {
  if (!node) return;
  if (node.kind === 'reference') result.add(node.name);
  if (node.kind === 'call') {
    node.args.forEach((argument) => collectDependencies(argument, result));
    return;
  }
  if (node.kind === 'unary') collectDependencies(node.operand, result);
  if (node.kind === 'binary') {
    collectDependencies(node.left, result);
    collectDependencies(node.right, result);
  }
  if (node.kind === 'sequence') node.items.forEach((item) => collectDependencies(item, result));
};

export const parseConstruction = (source: string | null | undefined, objectNames: readonly string[] = []): ParsedConstruction => {
  const normalized = source?.trim() ?? '';
  if (!normalized) return { ast: null, dependencies: [], diagnostics: [], status: 'empty', source: source ?? '' };

  const diagnostics: ParseDiagnostic[] = [];
  const tokens = tokenize(normalized, objectNames, diagnostics);
  const parser = new ExpressionParser(normalized, tokens, diagnostics);
  let ast: ExpressionNode | null = null;
  try {
    ast = parser.parse();
  } catch (error) {
    diagnostics.push({ message: error instanceof Error ? error.message : 'Unexpected parser failure.', severity: 'error' });
    ast = { kind: 'unknown', raw: normalized };
  }

  const dependencies = new Set<string>();
  collectDependencies(ast, dependencies);
  const filteredDependencies = [...dependencies].filter((name) => objectNames.includes(name));
  const status = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ? 'failed'
    : diagnostics.length > 0 ? 'partial' : 'parsed';
  return { ast, dependencies: filteredDependencies, diagnostics, status, source: source ?? '' };
};
