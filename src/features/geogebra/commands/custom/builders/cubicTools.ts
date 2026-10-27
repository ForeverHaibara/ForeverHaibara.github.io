import type { ExpressionBuilder, TypedExpression } from '../types';
import { add, adjugate, barycentricPoint, bind, coefficientLine, coefficientList, cross, homogeneous, matrix, mul, sub } from '../algebra/homogeneous';
import type { Matrix } from '../algebra/homogeneous';
import { monomial, polynomialDeterminant, polynomialProduct, polynomialSum } from '../algebra/polynomial';
import type { Polynomial } from '../algebra/polynomial';
import { CUBIC_COEFFICIENT_INDICES, CUBIC_MONOMIALS, withCubic } from './curves';

const sum = (terms: string[]) => terms.length ? add(terms) : '0';
const entries = (args: readonly TypedExpression[]) => args.map((arg) => arg.expression);
const value = (p: string, axis: 0 | 1) => `${axis ? 'y' : 'x'}(${p})`;
const power = (v: string, n: number) => n === 0 ? '1' : n === 1 ? v : `(${v})^${n}`;

/** H_F(X)=Hx X+Hy Y+Hz Z, with the six repeated entries left symmetric. */
export const cubicHessian = (c: string[]): string[][][] => [0, 1, 2].map((a) => [0, 1, 2].map((b) => [0, 1, 2].map((basis) =>
  sum(c.flatMap((coefficient, index) => {
    const [i, j] = CUBIC_MONOMIALS[index];
    const exponents = [i, j, 3 - i - j];
    const factor = exponents[a] * (exponents[b] - (a === b ? 1 : 0));
    if (!factor) return [];
    exponents[a]--; exponents[b]--;
    return exponents[basis] === 1 ? [mul(String(factor), coefficient)] : [];
  })))));

const hessianAt = (h: string[][][], p: string[]) => h.map((row) => row.map((entry) => sum(entry.map((c, i) => mul(c, p[i])))));
const coefficientPolynomial = (c: string[]) => add(c.map((coefficient, i) => {
  const [x, y] = CUBIC_MONOMIALS[i];
  return mul(coefficient, power('x', x), power('y', y));
}));
const determinant3 = (m: Matrix) => add([
  mul(m[0][0], sub(mul(m[1][1], m[2][2]), mul(m[1][2], m[2][1]))),
  `-(${mul(m[0][1], sub(mul(m[1][0], m[2][2]), mul(m[1][2], m[2][0])))})`,
  mul(m[0][2], sub(mul(m[1][0], m[2][1]), mul(m[1][1], m[2][0]))),
]);

const guardedCubic = (p: Polynomial, allocate: () => string) => {
  const coefficients = CUBIC_MONOMIALS.map(([x, y]) => p.get(`${x},${y}`) ?? '0');
  return bind(coefficients, allocate, (numbers) => {
    const polynomial = coefficientPolynomial(numbers);
    return `If(${sum(numbers.map((n) => `${n}^2`))}!=0,ImplicitCurve(${polynomial}))`;
  });
};
const hessianCubic: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) =>
  guardedCubic(polynomialDeterminant(cubicHessian(c).map((row) => row.map(linearPolynomial))), allocate));

const orthicAxis: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) => {
  const h = cubicHessian(c);
  return coefficientLine([0, 1, 2].map((i) => add([h[0][0][i], h[1][1][i]])), allocate);
});

const circularPolarPoint: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) => {
  const h = cubicHessian(c);
  const p = cross([0, 1, 2].map((i) => sub(h[0][0][i], h[1][1][i])), h[0][1]);
  return `((${p[0]})/(${p[2]}),(${p[1]})/(${p[2]}))`;
});

const hessianCorrespondent: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) => {
  const p = args[1].expression;
  const h = hessianAt(cubicHessian(c), [value(p, 0), value(p, 1), '1']);
  const adj = adjugate(h);
  return bind(adj.flat(), allocate, (numbers) => {
    const columns = [0, 1, 2].map((j) => [numbers[j], numbers[3 + j], numbers[6 + j]]);
    const norm = (v: string[]) => sum(v.map((x) => `${x}^2`));
    const chosen = [0, 1, 2].map((i) => `If(${norm(columns[0])}!=0,${columns[0][i]},If(${norm(columns[1])}!=0,${columns[1][i]},${columns[2][i]}))`);
    return `If(${determinant3(h)}==0,(${chosen[0]}/${chosen[2]},${chosen[1]}/${chosen[2]}))`;
  });
});

const mixedPolar: ExpressionBuilder = (args, allocate) => {
  const [p, q, curve] = entries(args);
  return withCubic(curve, allocate, (c) => {
    const h = cubicHessian(c);
    const pp = [value(p, 0), value(p, 1), '1'];
    const qq = [value(q, 0), value(q, 1), '1'];
    return coefficientLine([0, 1, 2].map((k) => sum(h.flatMap((row, i) => row.map((entry, j) => mul(pp[i], entry[k], qq[j]))))), allocate);
  });
};

const linearPolynomial = ([a, b, c]: string[]): Polynomial => polynomialSum(monomial(1, 0, a), monomial(0, 1, b), monomial(0, 0, c));
const poloconic: ExpressionBuilder = (args, allocate) => {
  const line = homogeneous(args[0]);
  return `Conic(${withCubic(args[1].expression, allocate, (c) => {
    const h = cubicHessian(c).map((row) => row.map(linearPolynomial));
    const cofactor = (i: number, j: number) => {
      const rows = [0, 1, 2].filter((r) => r !== j);
      const cols = [0, 1, 2].filter((r) => r !== i);
      const a = polynomialProduct(h[rows[0]][cols[0]], h[rows[1]][cols[1]]);
      const b = polynomialProduct(h[rows[0]][cols[1]], h[rows[1]][cols[0]]);
      return polynomialSum(a, new Map([...b].map(([key, v]) => [key, `-(${v})`])));
    };
    const terms = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) =>
      new Map([...cofactor(i, j)].map(([key, v]) => [key, mul(line[i], line[j], (i + j) & 1 ? `-(${v})` : v)]))));
    const polynomial = polynomialSum(...terms);
    const at = (x: number, y: number) => polynomial.get(`${x},${y}`) ?? '0';
    return coefficientList([at(2, 0), at(0, 2), at(0, 0), at(1, 1), at(1, 0), at(0, 1)]);
  })})`;
};

const conicGradient = (coefficients: string[]): string[][] => {
  const [a, b, f, h, d, e] = coefficients;
  return [[mul('2', a), h, d], [h, mul('2', b), e], [d, e, mul('2', f)]];
};
const jacobianCubic: ExpressionBuilder = (args, allocate) => {
  const qs = entries(args);
  return bind(qs.map((q) => `Coefficients(${q})`), allocate, (lists) => {
    const gradients = lists.map((list) => conicGradient([1, 2, 3, 4, 5, 6].map((i) => `Element(${list},${i})`)));
    const rows = gradients.map((row) => row.map(linearPolynomial));
    return guardedCubic(polynomialDeterminant(rows), allocate);
  });
};

const conicLineCubic: ExpressionBuilder = (args) => {
  const [q, l] = args;
  const line = homogeneous(l);
  return `ImplicitCurve((LeftSide(${q.expression})-RightSide(${q.expression}))*(${line[0]}*x+${line[1]}*y+${line[2]}))`;
};

const cubicPencil: ExpressionBuilder = (args, allocate) => {
  const [f, g, p] = entries(args);
  return bind([`LeftSide(${f})-RightSide(${f})`, `LeftSide(${g})-RightSide(${g})`], allocate, ([ff, gg]) =>
    bind([ff, gg].map((source) => `Join(Reverse(Coefficients(${source}(x,x^4)+0*x)),{${Array(13).fill('0').join(',')}})`), allocate, ([fl, gl]) =>
      bind([fl, gl].flatMap((list) => CUBIC_COEFFICIENT_INDICES.map((index) => `Element(${list},${index})`)), allocate, (coefficients) => {
        const fc = coefficients.slice(0, 10);
        const gc = coefficients.slice(10);
        const valid = [fc, gc].map((c, i) => `AreEqual(${i ? gg : ff},${coefficientPolynomial(c)})&&(${sum(c.slice(6).map((v) => `${v}^2`))})!=0`).join('&&');
        const fp = `${ff}(x(${p}),y(${p}))`;
        const gp = `${gg}(x(${p}),y(${p}))`;
        const member = sub(mul(`${ff}(x,y)`, gp), mul(`${gg}(x,y)`, fp));
        return `If(${valid}&&(${fp})^2+(${gp})^2!=0&&MatrixRank(${matrix([fc, gc])})==2,ImplicitCurve(${member}))`;
      })));
};

const CIRCULAR_MONOMIALS: ReadonlyArray<readonly [number, number, number][]> = [
  [[3, 0, 0], [1, 2, 0]], [[2, 1, 0], [0, 3, 0]], [[2, 0, 1]], [[1, 1, 1]],
  [[0, 2, 1]], [[1, 0, 2]], [[0, 1, 2]], [[0, 0, 3]],
];
const ordinaryMonomials: ReadonlyArray<readonly [number, number, number][]> = [
  [[3, 0, 0]], [[2, 1, 0]], [[2, 0, 1]], [[1, 2, 0]], [[1, 1, 1]],
  [[1, 0, 2]], [[0, 3, 0]], [[0, 2, 1]], [[0, 1, 2]], [[0, 0, 3]],
];
type Basis = typeof CIRCULAR_MONOMIALS;
const evaluateBasis = (basis: Basis, p: string, derivative?: number) => basis.map((polynomial) => sum(polynomial.flatMap(([i, j, k]) => {
  const exponents = [i, j, k];
  const factor = derivative === undefined ? 1 : exponents[derivative];
  if (!factor) return [];
  if (derivative !== undefined) exponents[derivative]--;
  return [mul(String(factor), power(value(p, 0), exponents[0]), power(value(p, 1), exponents[1]))];
})));
const pointMatrix = (basis: Basis, points: string[]) => points.map((p) => evaluateBasis(basis, p));
const minor = (rows: string[][], skip: number) => `Determinant(${matrix(rows.map((row) => row.filter((_, j) => j !== skip)))})`;
export const circularCubicMinors = (points: string[]) => {
  const rows = pointMatrix(CIRCULAR_MONOMIALS, points);
  const cs = CIRCULAR_MONOMIALS.map((_, j) => `${j % 2 ? '-' : ''}${minor(rows, j)}`);
  return { rows, cs };
};
const circularCubic: ExpressionBuilder = (args) => {
  const { rows, cs } = circularCubicMinors(entries(args));
  const rho = '(x^2+y^2)';
  const polynomial = add([mul(cs[0], 'x', rho), mul(cs[1], 'y', rho), mul(cs[2], 'x^2'),
    mul(cs[3], 'x', 'y'), mul(cs[4], 'y^2'), mul(cs[5], 'x'), mul(cs[6], 'y'), cs[7]]);
  return `If(MatrixRank(${matrix(rows)})==7,ImplicitCurve(${polynomial}))`;
};

const conicBasis: Basis = [[[2, 0, 0]], [[1, 1, 0]], [[1, 0, 1]], [[0, 2, 0]], [[0, 1, 1]], [[0, 0, 2]]];
const circleBasis: Basis = [[[2, 0, 0], [0, 2, 0]], [[1, 0, 1]], [[0, 1, 1]], [[0, 0, 2]]];
/** Cayley–Bacharach's determinant formula: three conic minors and three cubic-pencil tangent minors. */
export const cayleyBacharachMinors = (points: string[]) => {
  const circular = points.length === 6;
  const conic = circular ? circleBasis : conicBasis;
  const cubic = circular ? CIRCULAR_MONOMIALS : ordinaryMonomials;
  const common = points.slice(3);
  const c = points.slice(0, 3).map((p) => `Determinant(${matrix(pointMatrix(conic, [p, ...common]))})`);
  const d = [0, 1, 2].map((i) => {
    const others = [points[(i + 1) % 3], points[(i + 2) % 3], ...common];
    const rows = [...pointMatrix(cubic, others), ...[0, 1, 2].map((axis) => evaluateBasis(cubic, points[i], axis))];
    return `Determinant(${matrix(rows)})`;
  });
  return [...c, ...d];
};
const cayleyBacharach: ExpressionBuilder = (args, allocate) => {
  const points = entries(args);
  // The three anchor points must span the plane. For distinct points with no
  // four collinear, swapping the third and fourth covers the only lost chart.
  const swap = `AreCollinear(${points[0]},${points[1]},${points[2]})`;
  const anchored = [points[0], points[1], `If(${swap},${points[3]},${points[2]})`,
    `If(${swap},${points[2]},${points[3]})`, ...points.slice(4)];
  return bind(cayleyBacharachMinors(anchored), allocate, ([cx, cy, cz, dx, dy, dz]) =>
    barycentricPoint(anchored.slice(0, 3), [mul(cx, dy, dz), mul(dx, cy, dz), mul(dx, dy, cz)]));
};

export const CUBIC_TOOL_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  circularCubic, cayleyBacharach, orthicAxisCubic: orthicAxis, circularPolarPoint,
  hessianCubic, hessianCorrespondent, mixedPolar, poloconic, jacobianCubic,
  conicLineCubic, cubicPencil,
};
