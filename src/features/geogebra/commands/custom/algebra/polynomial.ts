import { add, mul, determinant, sub } from './homogeneous';

/** Construct only the final curve; numeric bindings stay inside its function.
 * Do not insert Polynomial here: an undefined Element can lose its function
 * type, and Polynomial rejects it rather than yielding an undefined curve.
 */
export const polynomialCurve = (expression: string) => `ImplicitCurve(${expression})`;

/** Encode x^i y^j as powers of x, padding absent high coefficients with zeros. */
export const encodedPolynomialCoefficients = (f: string, stride: number, padding: number) =>
  `Join(Reverse(Coefficients(${f}(x,x^${stride})+0*x)),{${Array(padding).fill('0').join(',')}})`;

/** Sparse symbolic polynomials. Values are engine expressions, never snapshots. */
export type Polynomial = Map<string, string>;
export const monomial = (x: number, y: number, coefficient: string): Polynomial => new Map([[`${x},${y}`, coefficient]]);
export const polynomialSum = (...ps: Polynomial[]): Polynomial => {
  const terms = new Map<string, string[]>();
  for (const p of ps) for (const [k, v] of p) terms.set(k, [...(terms.get(k) ?? []), v]);
  return new Map([...terms].map(([k, vs]) => [k, vs.length === 1 ? vs[0] : add(vs)]));
};
export const polynomialProduct = (p: Polynomial, q: Polynomial): Polynomial => polynomialSum(...[...p].flatMap(([pk, pv]) => [...q].map(([qk, qv]) => {
  const [px, py] = pk.split(',').map(Number); const [qx, qy] = qk.split(',').map(Number);
  return monomial(px + qx, py + qy, mul(pv, qv));
})));
export const polynomialScale = (p: Polynomial, v: string): Polynomial => new Map([...p].map(([k, c]) => [k, mul(v, c)]));
export const polynomialExpression = (p: Polynomial, x = 'x', y = 'y') => add([...p].map(([k, v]) => {
  const [i, j] = k.split(',').map(Number);
  return mul(v, i ? `(${x})^${i}` : '1', j ? `(${y})^${j}` : '1');
}));
export const polynomialDeterminant = (rows: Polynomial[][]) => polynomialSum(...[
  [0, 1, 2, 1], [1, 2, 0, 1], [2, 0, 1, 1], [2, 1, 0, -1], [1, 0, 2, -1], [0, 2, 1, -1],
].map(([a, b, c, sign]) => polynomialScale(polynomialProduct(polynomialProduct(rows[0][a], rows[1][b]), rows[2][c]), String(sign))));

/** First three homogeneous coefficients of the circle through variable X,U,V. */
export const circlePairRow = (u: string[], v: string[]): Polynomial[] => {
  const [ux, uy, uw = '1'] = u; const [vx, vy, vw = '1'] = v;
  const un = `(${ux}^2+${uy}^2)`; const vn = `(${vx}^2+${vy}^2)`;
  const rho = polynomialSum(monomial(2, 0, '1'), monomial(0, 2, '1'));
  if (u.length === 3 || v.length === 3) {
    const x1 = `(${ux}*${uw})`; const y1 = `(${uy}*${uw})`; const z1 = `(${uw}^2)`;
    const x2 = `(${vx}*${vw})`; const y2 = `(${vy}*${vw})`; const z2 = `(${vw}^2)`;
    return [
      polynomialSum(monomial(1, 0, `${y1}*${z2}-${z1}*${y2}`), monomial(0, 1, `${z1}*${x2}-${x1}*${z2}`), monomial(0, 0, `${x1}*${y2}-${y1}*${x2}`)),
      polynomialSum(polynomialScale(rho, `${z1}*${y2}-${y1}*${z2}`), monomial(0, 1, `${un}*${z2}-${z1}*${vn}`), monomial(0, 0, `${y1}*${vn}-${un}*${y2}`)),
      polynomialSum(polynomialScale(rho, `${x1}*${z2}-${z1}*${x2}`), monomial(1, 0, `${z1}*${vn}-${un}*${z2}`), monomial(0, 0, `${un}*${x2}-${x1}*${vn}`)),
    ];
  }
  return [
    polynomialSum(monomial(1, 0, `${uy}-${vy}`), monomial(0, 1, `${vx}-${ux}`), monomial(0, 0, `${ux}*${vy}-${uy}*${vx}`)),
    polynomialSum(polynomialScale(rho, `${vy}-${uy}`), monomial(0, 1, `${un}-${vn}`), monomial(0, 0, `${uy}*${vn}-${un}*${vy}`)),
    polynomialSum(polynomialScale(rho, `${ux}-${vx}`), monomial(1, 0, `${vn}-${un}`), monomial(0, 0, `${un}*${vx}-${ux}*${vn}`)),
  ];
};

/** Coaxality determinant in the radial basis rho², x*rho, y*rho, x², xy, y², x, y, 1.
 * Each row is [a,b,c,h,j,k]: (a*x+b*y+c, -a*rho+h*y+j, -b*rho-h*x+k).
 * Degree-five terms cancel symbolically before any floating-point evaluation.
 */
export const coaxalQuarticCoefficients = (rows: string[][]): string[] => {
  const [a, b, c, h, j, k] = Array.from({ length: 6 }, (_, i) => rows.map((row) => row[i]));
  const t = (u: string[], v: string[], w: string[]) => determinant([u, v, w]);
  const b0 = add([t(c, a, k), t(c, j, b)]);
  return [t(c, a, b), sub(t(c, a, h), t(a, j, b)), `-(${add([t(b, a, k), t(c, h, b)])})`,
    `-(${t(a, j, h)})-(${b0})`, sub(t(a, h, k), t(b, j, h)), sub(t(b, h, k), b0),
    sub(t(a, j, k), t(c, j, h)), add([t(b, j, k), t(c, h, k)]), t(c, j, k)];
};

export const radialQuarticExpression = ([a, b, c, d, e, f, g, h, i]: string[], x = 'x', y = 'y') => {
  const rho = `(${x}^2+${y}^2)`;
  return `${a}*${rho}^2+(${b}*${x}+${c}*${y})*${rho}+${d}*${x}^2+${e}*${x}*${y}+${f}*${y}^2+${g}*${x}+${h}*${y}+${i}`;
};
