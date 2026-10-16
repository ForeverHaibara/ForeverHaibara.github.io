import type { TypedExpression } from './types';

export type Matrix = string[][];
export const add = (terms: string[]) => `(${terms.join('+')})`;
export const mul = (...terms: string[]) => `(${terms.map((term) => `(${term})`).join('*')})`;
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

/** Local bindings in a native dynamic expression. No labeled construction objects. */
export const bind = (values: string[], allocate: () => string, body: (names: string[]) => string): string => {
  const names = values.map(() => allocate());
  return `Element(Zip(${body(names)},${names.map((name, i) => `${name},{${values[i]}}`).join(',')}),1)`;
};

export const homogeneous = (arg: TypedExpression): string[] => {
  const e = arg.expression;
  if (arg.type === 'point') return [`x(${e})`, `y(${e})`, '1'];
  // Interior normalized path parameters are finite on lines, rays and segments.
  // In particular, Point(line,0) is at infinity, as is Point(ray,1).
  const line = arg.type === 'line' ? e : `Line(Point(${e},0.25),Point(${e},0.5))`;
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
  `Line((-${a}*${c}/(${a}^2+${b}^2),-${b}*${c}/(${a}^2+${b}^2)),Vector((${b},-${a})))`);

/** Homogeneous barycentrics -> a native conic in the world plane. */
export const barycentricConic = (vertices: string[], coefficients: string[]) =>
  `If(!AreCollinear(${vertices.join(',')}),ApplyMatrix({{${vertices.map((p) => `x(${p})`).join(',')}},{${vertices.map((p) => `y(${p})`).join(',')}},{1,1,1}},Conic({${coefficients.join(',')}})))`;

