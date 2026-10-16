import type { ExpressionBuilder } from './types';
import { add, mul, bind, coefficientLine, triangleAreas, matrix } from './expressionGeometry';

/** Coefficients of x^i y^j, constant first, through total degree three. */
export const CUBIC_MONOMIALS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]];
const power = (value: string, degree: number) => degree === 0 ? '1' : degree === 1 ? value : `(${value})^${degree}`;
const term = (coefficient: string, x: string, y: string, i: number, j: number) => mul(coefficient, power(x, i), power(y, j));
const factorial = [1, 1, 2, 6];

/** Exact native Taylor coefficients, not fitted values or JavaScript samples. */
const withCubic = (curve: string, allocate: () => string, body: (coefficients: string[]) => string) =>
  bind([`LeftSide(${curve})-RightSide(${curve})`], allocate, ([f]) => {
    const derivatives = CUBIC_MONOMIALS.map(([i, j]) => {
      let derivative = f;
      if (i) derivative = `Derivative(${derivative},x,${i})`;
      if (j) derivative = `Derivative(${derivative},y,${j})`;
      return `${derivative}(0,0)/${factorial[i] * factorial[j]}`;
    });
    return bind(derivatives, allocate, (coefficients) => {
      const polynomial = add(coefficients.map((coefficient, k) => term(coefficient, 'x', 'y', ...CUBIC_MONOMIALS[k])));
      const cubicPart = coefficients.slice(6).map((coefficient) => `(${coefficient})^2`).join('+');
      // AreEqual on native polynomial functions compares coefficients. It does
      // not merely check the curve at a finite collection of sample points.
      return `If(AreEqual(${f},${polynomial})&&(${cubicPart})!=0,${body(coefficients)})`;
    });
  });

/** Homogeneous gradient at (p,q,1): the second polar line. */
export const cubicPolarLine = (coefficients: string[], p: string, q: string): string[] => [0, 1, 2].map((axis) =>
  add(coefficients.flatMap((coefficient, k) => {
    const [i, j] = CUBIC_MONOMIALS[k];
    const degree = [i, j, 3 - i - j][axis];
    return degree ? [term(mul(String(degree), coefficient), p, q, i - (axis === 0 ? 1 : 0), j - (axis === 1 ? 1 : 0))] : [];
  })));

/** First homogeneous polar, in native Conic coefficient order. */
export const cubicPolarConic = (coefficients: string[], p: string, q: string): string[] => {
  const output = new Map(['20', '02', '00', '11', '10', '01'].map((key) => [key, [] as string[]]));
  coefficients.forEach((coefficient, k) => {
    const [i, j] = CUBIC_MONOMIALS[k];
    if (i) output.get(`${i - 1}${j}`)!.push(mul(String(i), p, coefficient));
    if (j) output.get(`${i}${j - 1}`)!.push(mul(String(j), q, coefficient));
    if (3 - i - j) output.get(`${i}${j}`)!.push(mul(String(3 - i - j), coefficient));
  });
  return [...output.values()].map((terms) => add(terms));
};

/** t^3 and t^2 coefficients of f(p+t*v), used after removing known roots. */
export const cubicRestriction = (c: string[], p: string, q: string, u: string, v: string): string[] => [
  add([term(c[6], u, v, 3, 0), term(c[7], u, v, 2, 1), term(c[8], u, v, 1, 2), term(c[9], u, v, 0, 3)]),
  add([mul(c[3], u, u), mul(c[4], u, v), mul(c[5], v, v), mul('3', c[6], p, u, u),
    mul(c[7], add([mul(q, u, u), mul('2', p, u, v)])),
    mul(c[8], add([mul(p, v, v), mul('2', q, u, v)])), mul('3', c[9], q, v, v)]),
];

const polar: ExpressionBuilder = (args, allocate) => {
  const [p, curve] = args.map((arg) => arg.expression);
  return withCubic(curve, allocate, (coefficients) => coefficientLine(cubicPolarLine(coefficients, `x(${p})`, `y(${p})`), allocate));
};
const polarConic: ExpressionBuilder = (args, allocate) => {
  const [p, curve] = args.map((arg) => arg.expression);
  return withCubic(curve, allocate, (coefficients) => `Conic({${cubicPolarConic(coefficients, `x(${p})`, `y(${p})`).join(',')}})`);
};
const thirdIntersection: ExpressionBuilder = (args, allocate) => {
  const [curve, p, q] = args.map((arg) => arg.expression);
  return withCubic(curve, allocate, (coefficients) => {
    const direction = q ? [`x(${q})-x(${p})`, `y(${q})-y(${p})`] : (() => {
      const gradient = cubicPolarLine(coefficients, `x(${p})`, `y(${p})`);
      return [gradient[1], `-(${gradient[0]})`];
    })();
    return bind(direction, allocate, ([u, v]) =>
      bind(cubicRestriction(coefficients, `x(${p})`, `y(${p})`, u, v), allocate, ([a, b]) =>
        `(${p})+(-${b}/${a}${q ? '-1' : ''})*(${u},${v})`));
  });
};

const pivotal: ExpressionBuilder = (args, allocate) => {
  const [a, b, c] = args.map((arg) => arg.expression);
  return bind([...triangleAreas(args.map((arg) => arg.expression)), `Distance(${b},${c})^2`, `Distance(${c},${a})^2`, `Distance(${a},${b})^2`], allocate,
    ([p, q, r, aa, bb, cc]) => `TriangleCurve(${a},${b},${c},${add([
      mul(r, bb, 'A^2', 'C'), `-${mul(r, aa, 'B^2', 'C')}`, `-${mul(q, cc, 'A^2', 'B')}`,
      mul(q, aa, 'B', 'C^2'), mul(p, cc, 'A', 'B^2'), `-${mul(p, bb, 'A', 'C^2')}`,
    ])}=0)`);
};

const cubicThroughPoints: ExpressionBuilder = (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  return bind([`${add(points)}/9`], allocate, ([origin]) =>
    bind([`sqrt(${add(points.map((p) => `Distance(${p},${origin})^2`))}/9)`], allocate, ([scale]) =>
      bind(points.map((p) => `((${p})-${origin})/${scale}`), allocate, (normalized) => {
        const rows = normalized.map((p) => CUBIC_MONOMIALS.map(([i, j]) => mul(power(`x(${p})`, i), power(`y(${p})`, j))));
        return `If(MatrixRank(${matrix(rows)})==9,Translate(Dilate(ImplicitCurve({${normalized.join(',')}}),${scale},(0,0)),Vector(${origin})))`;
      })));
};

export const CURVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { cubicPolar: polar, cubicPolarConic: polarConic, thirdIntersection, pivotal, cubicThroughPoints };
