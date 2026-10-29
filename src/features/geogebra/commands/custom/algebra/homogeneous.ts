import type { BuiltExpression, TypedExpression } from '../types';

export type Matrix = string[][];
export const add = (terms: string[]) => `(${terms.join('+')})`;
export const mul = (...terms: string[]) => `(${terms.map((term) => `(${term})`).join('*')})`;
export const squaredNorm = (values: string[]) => add(values.map((value) => `(${value})^2`));
export const coordinatesToPoint = ([x, y, z]: string[]) => `((${x})/(${z}),(${y})/(${z}))`;
export const triangleSideSquares = ([a, b, c]: string[]) => [b, c, a].map((p, i) => `Distance(${p},${[c, a, b][i]})^2`);
export const sub = (a: string, b: string) => `((${a})-(${b}))`;
export const matrix = (m: Matrix) => `{${m.map((row) => `{${row.join(',')}}`).join(',')}}`;
export const transpose = (m: Matrix): Matrix => m[0].map((_, j) => m.map((row) => row[j]));
export const product = (a: Matrix, b: Matrix): Matrix => a.map((row) => b[0].map((_, j) => add(row.map((value, k) => mul(value, b[k][j])))));
export const adjugate = (m: Matrix): Matrix => Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => {
  const rows = [0, 1, 2].filter((r) => r !== j);
  const cols = [0, 1, 2].filter((c) => c !== i);
  const minor = sub(mul(m[rows[0]][cols[0]], m[rows[1]][cols[1]]), mul(m[rows[0]][cols[1]], m[rows[1]][cols[0]]));
  return (i + j) % 2 ? `-(${minor})` : minor;
}));
export const determinant = (m: Matrix) => add(m[0].map((value, j) => mul(value, adjugate(m)[j][0])));
export const cross = (a: string[], b: string[]): string[] => [0, 1, 2].map((i) => sub(mul(a[(i + 1) % 3], b[(i + 2) % 3]), mul(a[(i + 2) % 3], b[(i + 1) % 3])));

export type BindValueKind = 'number' | 'numberList' | 'function' | 'point' | 'vector' | 'line' | 'circle' | 'conic' | 'implicitCurve';
export type BindingAllocator = (() => string) & {
  captureBinding?: (names: string[], values: string[], expression: string, kinds?: BindValueKind[]) => string;
};

/** One formula source; the compiler may lower typed bindings to construction objects. */
export function bind(values: string[], allocate: BindingAllocator, body: (names: string[]) => string,
  kinds?: BindValueKind | BindValueKind[]): string;
export function bind(values: string[], allocate: BindingAllocator, body: (names: string[]) => BuiltExpression,
  kinds?: BindValueKind | BindValueKind[]): BuiltExpression;
export function bind(values: string[], allocate: BindingAllocator, body: (names: string[]) => string | BuiltExpression,
  kinds?: BindValueKind | BindValueKind[]): string | BuiltExpression;
export function bind(values: string[], allocate: BindingAllocator, body: (names: string[]) => string | BuiltExpression,
  kinds?: BindValueKind | BindValueKind[]): string | BuiltExpression {
  const names = values.map(() => allocate());
  const result = body(names);
  const declared = kinds === undefined ? undefined : Array.isArray(kinds) ? kinds : values.map(() => kinds);
  const wrap = (expression: string) => allocate.captureBinding?.(names, values, expression, declared)
    ?? `Element(Zip(${expression},${names.map((name, i) => `${name},{${values[i]}}`).join(',')}),1)`;
  if (typeof result === 'string') return wrap(result);
  if (result.outputExpressions) {
    const outputExpressions = result.outputExpressions.map(wrap);
    return { ...result, expression: outputExpressions[0], outputExpressions };
  }
  return { ...result, expression: wrap(result.expression) };
}

export const supportingLine = (arg: TypedExpression) => arg.type === 'line' ? arg.expression
  : `Line(Point(${arg.expression},0.25),Point(${arg.expression},0.5))`;

export const homogeneous = (arg: TypedExpression): string[] => {
  const e = arg.expression;
  if (arg.type === 'point') return [`x(${e})`, `y(${e})`, '1'];
  // Interior normalized path parameters are finite on lines, rays and segments.
  // In particular, Point(line,0) is at infinity, as is Point(ray,1).
  const line = supportingLine(arg);
  return [`x(${line})`, `y(${line})`, `z(${line})`];
};

export const triangleAreas = ([a, b, c, p]: string[]) => {
  const area = (u: string, v: string) => sub(mul(`x(${u})-x(${p})`, `y(${v})-y(${p})`), mul(`y(${u})-y(${p})`, `x(${v})-x(${p})`));
  return [area(b, c), area(c, a), area(a, b)];
};
export const barycentricPoint = ([a, b, c]: string[], [u, v, w]: string[]) => `((${u})*(${a})+(${v})*(${b})+(${w})*(${c}))/((${u})+(${v})+(${w}))`;
export const independentOutputs = (outputs: string[], index?: string) => index
  ? `If(${index}==floor(${index})&&${index}>=1&&${index}<=${outputs.length},Element({${outputs.join(',')}},${index}))`
  : { expression: outputs[0], outputExpressions: outputs };

/** Native line through its closest point to the origin, with no slope chart. */
export const coefficientLine = (coefficients: string[], allocate: () => string) => bind(coefficients, allocate, ([a, b, c]) =>
  `Line((-${a}*${c}/(${a}^2+${b}^2),-${b}*${c}/(${a}^2+${b}^2)),Vector((${b},-${a})))`, 'number');

/** Homogeneous barycentrics -> a native conic in the world plane. */
export const barycentricConic = (vertices: string[], coefficients: string[] | string) =>
  `If(!AreCollinear(${vertices.join(',')}),ApplyMatrix({{${vertices.map((p) => `x(${p})`).join(',')}},{${vertices.map((p) => `y(${p})`).join(',')}},{1,1,1}},Conic(${typeof coefficients === 'string' ? coefficients : coefficientList(coefficients)})))`;

export const coefficientList = (coefficients: string[]) => `{${coefficients.join(',')}}`;

/** Translate a conic by its center, retaining a native GeoConic at line limits. */
export const translatedConicCoefficients = ([a, b, f, h, d, e]: string[], center: string): string[] => {
  const x = `x(${center})`; const y = `y(${center})`;
  return [a, b, `${f}+(${a})*${x}^2+(${b})*${y}^2+(${h})*${x}*${y}-(${d})*${x}-(${e})*${y}`, h,
    `(${d})-2*(${a})*${x}-(${h})*${y}`, `(${e})-(${h})*${x}-2*(${b})*${y}`];
};

/** Signed homogeneous barycentrics of the variable point (x,y), with linear cross products. */
export const barycentricVariables = (vertices: string[]): string[] => vertices.map((_, i) => {
  const a = vertices[(i + 1) % 3]; const b = vertices[(i + 2) % 3];
  return `((y(${a})-y(${b}))*x+(x(${b})-x(${a}))*y+x(${a})*y(${b})-y(${a})*x(${b}))`;
});

