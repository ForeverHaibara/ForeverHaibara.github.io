import { add, mul } from './expressionGeometry';

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
