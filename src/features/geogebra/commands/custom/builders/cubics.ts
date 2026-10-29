import type { ExpressionBuilder, TypedExpression } from '../types';
import { add, adjugate, barycentricPoint, bind, coefficientLine, coefficientList, cross, homogeneous, matrix, mul, sub, independentOutputs, supportingLine } from '../algebra/homogeneous';
import type { Matrix } from '../algebra/homogeneous';
import { monomial, polynomialDeterminant, polynomialProduct, polynomialSum, encodedPolynomialCoefficients } from '../algebra/polynomial';
import type { Polynomial } from '../algebra/polynomial';

const sum = (terms: string[]) => terms.length ? add(terms) : '0';
const entries = (args: readonly TypedExpression[]) => args.map((arg) => arg.expression);
const value = (p: string, axis: 0 | 1) => `${axis ? 'y' : 'x'}(${p})`;
const power = (v: string, n: number) => n === 0 ? '1' : n === 1 ? v : `(${v})^${n}`;

/** Coefficients of x^i y^j, constant first, through total degree three. */
export const CUBIC_MONOMIALS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]];
const term = (coefficient: string, x: string, y: string, i: number, j: number) => mul(coefficient, power(x, i), power(y, j));
/** Encode x^i*y^j as x^(i+4j); cubic monomials have distinct exponents. */
export const CUBIC_COEFFICIENT_INDICES: readonly number[] = CUBIC_MONOMIALS.map(([i, j]) => i + 4 * j + 1);

/** Native cubic coefficient extraction, assuming the input is a cubic. */
export const withCubic = (curve: string, allocate: () => string, body: (coefficients: string[]) => string) =>
  bind([`LeftSide(${curve})-RightSide(${curve})`], allocate, ([f]) =>
    // Coefficients accepts a one-variable function, not an implicit curve or
    // a two-variable function. Keep a formal x even for constant restrictions;
    // reverse and pad so missing high-degree terms read as zero dynamically.
    bind([encodedPolynomialCoefficients(f, 4, 13)], allocate, ([encoded]) =>
      bind(CUBIC_COEFFICIENT_INDICES.map((index) => `Element(${encoded},${index})`), allocate,
        (coefficients) => `(${body(coefficients)})`, 'number'), 'numberList'), 'function');

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

const cubicSecondPolarLine: ExpressionBuilder = (args, allocate) => {
  const [p, curve] = args.map((arg) => arg.expression);
  return withCubic(curve, allocate, (coefficients) => coefficientLine(cubicPolarLine(coefficients, `x(${p})`, `y(${p})`), allocate));
};
const cubicFirstPolarConic: ExpressionBuilder = (args, allocate) => {
  const [p, curve] = args.map((arg) => arg.expression);
  return `Conic(${withCubic(curve, allocate, (coefficients) => coefficientList(cubicPolarConic(coefficients, `x(${p})`, `y(${p})`)))})`;
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

const cubicThroughNinePoints: ExpressionBuilder = (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  return bind([`${add(points)}/9`], allocate, ([origin]) =>
    bind([`sqrt(${add(points.map((p) => `Distance(${p},${origin})^2`))}/9)`], allocate, ([scale]) =>
      bind(points.map((p) => `((${p})-${origin})/${scale}`), allocate, (normalized) => {
        const rows = normalized.map((p) => CUBIC_MONOMIALS.map(([i, j]) => mul(power(`x(${p})`, i), power(`y(${p})`, j))));
        return `If(MatrixRank(${matrix(rows)})==9,Translate(Dilate(ImplicitCurve({${normalized.join(',')}}),${scale},(0,0)),Vector(${origin})))`;
      })));
};

const CUBIC_POLAR_AND_INTERSECTION_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { cubicPolar: cubicSecondPolarLine, cubicPolarConic: cubicFirstPolarConic, thirdIntersection, cubicThroughPoints: cubicThroughNinePoints };

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

const cubicFromPolynomialCoefficients = (p: Polynomial, allocate: () => string) => {
  const coefficients = CUBIC_MONOMIALS.map(([x, y]) => p.get(`${x},${y}`) ?? '0');
  return bind(coefficients, allocate, (numbers) => {
    const polynomial = coefficientPolynomial(numbers);
    return `ImplicitCurve(${polynomial})`;
  }, 'number');
};
const hessianCubic: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) =>
  cubicFromPolynomialCoefficients(polynomialDeterminant(cubicHessian(c).map((row) => row.map(linearPolynomial))), allocate));

const cubicOrthicAxis: ExpressionBuilder = (args, allocate) => withCubic(args[0].expression, allocate, (c) => {
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
    return cubicFromPolynomialCoefficients(polynomialDeterminant(rows), allocate);
  }, 'numberList');
};

const conicLineCubic: ExpressionBuilder = (args) => {
  const [q, l] = args;
  const line = homogeneous(l);
  return `ImplicitCurve((LeftSide(${q.expression})-RightSide(${q.expression}))*(${line[0]}*x+${line[1]}*y+${line[2]}))`;
};

const cubicPencil: ExpressionBuilder = (args, allocate) => {
  const [f, g, p] = entries(args);
  const equations = [`LeftSide(${f})-RightSide(${f})`, `LeftSide(${g})-RightSide(${g})`];
  const member = (ff: string, gg: string, x: string, y: string) => {
    const fp = `${ff}(x(${p}),y(${p}))`;
    const gp = `${gg}(x(${p}),y(${p}))`;
    return sub(mul(`${ff}(${x},${y})`, gp), mul(`${gg}(${x},${y})`, fp));
  };
  const polynomial = bind(equations, allocate, ([ff, gg]) => member(ff, gg, 'x', 'y'));
  // A cubic is zero iff it vanishes on this fixed unisolvent grid. This
  // checks the final equation without extracting two ten-coefficient lists.
  const grid = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]];
  const guard = bind(equations, allocate, ([ff, gg]) =>
    `${sum(grid.map(([x, y]) => `(${member(ff, gg, String(x), String(y))})^2`))}!=0`);
  return `If(${guard},ImplicitCurve(${polynomial}))`;
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
  const cs = circularCubicMinors(entries(args)).cs;
  const rho = '(x^2+y^2)';
  const polynomial = add([mul(cs[0], 'x', rho), mul(cs[1], 'y', rho), mul(cs[2], 'x^2'),
    mul(cs[3], 'x', 'y'), mul(cs[4], 'y^2'), mul(cs[5], 'x'), mul(cs[6], 'y'), cs[7]]);
  // All eight minors vanish exactly when the seven constraints have no
  // unique circular cubic. Avoid a second 7x8 MatrixRank computation.
  return `If(${sum(cs.map((coefficient) => `(${coefficient})^2`))}!=0,ImplicitCurve(${polynomial}))`;
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

const CUBIC_PROJECTIVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  circularCubic, cayleyBacharach, orthicAxisCubic: cubicOrthicAxis, circularPolarPoint,
  hessianCubic, hessianCorrespondent, mixedPolar, poloconic, jacobianCubic,
  conicLineCubic, cubicPencil,
};

// Affine interpolation and contact constructions for general cubics.
type Term = readonly [number, number];
type AffineBasis = readonly (readonly Term[])[];
const basisValue = (basis: AffineBasis, x: string, y: string) => basis.map((terms) =>
  sum(terms.map(([i, j]) => mul(power(x, i), power(y, j)))));
/** A full-rank (n-1) by n evaluation matrix has this null vector. */
export const kernelMinors = (rows: string[][]) => rows[0].map((_, i) => `${i % 2 ? '-' : ''}${minor(rows, i)}`);
const polynomialFromKernel = (rows: string[][], basis: AffineBasis, x: string, y: string, allocate: () => string) =>
  bind(kernelMinors(rows), allocate, (coefficients) => {
    const terms = basisValue(basis, x, y);
    const equation = sum(coefficients.map((c, i) => mul(c, terms[i])));
    return `If(${sum(coefficients.map((c) => `(${c})^2`))}!=0,ImplicitCurve(${equation}))`;
  });

const circularBasis: AffineBasis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0]], [[1, 1]],
  [[0, 2]], [[1, 0]], [[0, 1]], [[0, 0]],
];
const nodeBasis: AffineBasis = [
  [[3, 0]], [[2, 1]], [[1, 2]], [[0, 3]], [[2, 0]], [[1, 1]], [[0, 2]],
];
const circularNodeBasis: AffineBasis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0]], [[1, 1]], [[0, 2]],
];
/** Orthogonal tangent cone at the double point: quadratic trace is zero. */
const strophoidBasis: AffineBasis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0], [0, 2]], [[1, 1]],
];
const localPoint = (p: string, node: string): [string, string] => [`x(${p})-x(${node})`, `y(${p})-y(${node})`];
const localVariable = (node: string): [string, string] => [`x-x(${node})`, `y-y(${node})`];
const direction = (line: string): [string, string] => [`y(${line})`, `-x(${line})`];
const infinityRow = (basis: AffineBasis, line: string) => {
  const [dx, dy] = direction(line);
  return basisValue(basis, dx, dy).map((term, i) =>
    basis[i].some(([a, b]) => a + b === 3) ? term : '0');
};
const circularCubicDirection: ExpressionBuilder = (args, allocate) => {
  const points = args.slice(0, 6).map((arg) => arg.expression);
  const line = supportingLine(args[6]);
  const rows = [...points.map((p) => basisValue(circularBasis, `x(${p})`, `y(${p})`)), infinityRow(circularBasis, line)];
  return polynomialFromKernel(rows, circularBasis, 'x', 'y', allocate);
};

/** General nodal, circular nodal, and orthogonal circular nodal cubics. */
const nodalCubic: ExpressionBuilder = (args, allocate) => {
  const node = args[0].expression;
  const last = args.at(-1)!;
  const hasDirection = last.type !== 'point';
  const points = args.slice(1, hasDirection ? -1 : undefined).map((arg) => arg.expression);
  const basis = points.length === 6 ? nodeBasis : points.length === 4 ? circularNodeBasis :
    points.length === 3 && hasDirection ? circularNodeBasis : strophoidBasis;
  const rows = points.map((p) => basisValue(basis, ...localPoint(p, node)));
  if (hasDirection) rows.push(infinityRow(basis, supportingLine(last)));
  return polynomialFromKernel(rows, basis, ...localVariable(node), allocate);
};

/** The 3/4-point overloads coincide with the corresponding nodal construction. */
const strophoid: ExpressionBuilder = (args, allocate) => {
  if (args.length === 4) return nodalCubic(args, allocate);
  const [a, b, c] = args.map((arg) => arg.expression);
  if (args[2].type !== 'point') {
    // C moves on l; eliminate it from C in BX and |X-C|²=|A-C|².
    const line = homogeneous(args[2]);
    const [lx, ly, lz] = line;
    const dx = `(x-x(${b}))`; const dy = `(y-y(${b}))`;
    const ax = `(x-x(${a}))`; const ay = `(y-y(${a}))`;
    const quadratic = `((${ax})^2+(${ay})^2-2*(x(${b})-x(${a}))*(${ax})-2*(y(${b})-y(${a}))*(${ay}))`;
    const equation = `${quadratic}*(${lx}*${dx}+${ly}*${dy})+2*(${lx}*x(${b})+${ly}*y(${b})+${lz})*(${dx}*${ax}+${dy}*${ay})`;
    return `ImplicitCurve(${equation})`;
  }
  // Equal unoriented angles BXA and AXC. The signed equation retains both
  // internal and external bisectors and their full cubic algebraic closure.
  const ux = `(x(${a})-x)`; const uy = `(y(${a})-y)`;
  const bx = `(x(${b})-x)`; const by = `(y(${b})-y)`;
  const cx = `(x(${c})-x)`; const cy = `(y(${c})-y)`;
  const crossAB = `(${ux}*${by}-${uy}*${bx})`;
  const crossAC = `(${ux}*${cy}-${uy}*${cx})`;
  const dotAB = `(${ux}*${bx}+${uy}*${by})`;
  const dotAC = `(${ux}*${cx}+${uy}*${cy})`;
  return `If(!(AreEqual(${a},${b})&&AreEqual(${a},${c})),ImplicitCurve(${crossAB}*${dotAC}+${crossAC}*${dotAB}))`;
};

const cubicAsymptotes: ExpressionBuilder = (args, allocate) => {
  const list = `Asymptote(${args[0].expression})`;
  const outputs = [1, 2, 3].map((i) => bind([list], allocate, ([named]) => `Element(${named},${i})`));
  return independentOutputs(outputs, args[1]?.expression);
};

/** F = (1+d/a·U) Q + V R in the tangent/normal frame at T.
 *  Q=2gV+aU²+bUV+cV²; aR is used to avoid dividing by a. */
const withContactConics = (curve: string, target: string, allocate: () => string,
  body: (polar: string, residual: string, tangentQuadratic: string, flexLine: string) => string) => withCubic(curve, allocate, (coefficients) => {
    const px = `x(${target})`; const py = `y(${target})`;
    const [gx, gy] = cubicPolarLine(coefficients, px, py);
    return bind([gx, gy], allocate, ([nx, ny]) => {
      const tangent: [string, string] = [ny, `-(${nx})`];
      const normal: [string, string] = [nx, ny];
      const [d, a] = cubicRestriction(coefficients, px, py, ...tangent);
      const [h, c] = cubicRestriction(coefficients, px, py, ...normal);
      const plus: [string, string] = [`${tangent[0]}+${nx}`, `${tangent[1]}+${ny}`];
      const minus: [string, string] = [`${tangent[0]}-${nx}`, `${tangent[1]}-${ny}`];
      const [splus, bplus] = cubicRestriction(coefficients, px, py, ...plus);
      const [sminus] = cubicRestriction(coefficients, px, py, ...minus);
      return bind([d, a, h, c, splus, bplus, sminus], allocate, ([dd, aa, hh, cc, sp, bp, sm]) => {
        const g = `(${nx}^2+${ny}^2)`;
        const b = `(${bp}-${aa}-${cc})`;
        const e = `((${sp}-${sm})/2-${hh})`;
        const f = `((${sp}+${sm})/2-${dd})`;
        const transform = `{{${ny},${nx},${px}},{-${nx},${ny},${py}},{0,0,1}}`;
        const q = `ApplyMatrix(${transform},Conic({${aa},${cc},0,${b},0,2*${g}}))`;
        const r = `ApplyMatrix(${transform},Conic({${aa}*${e}-${dd}*${b},${aa}*${hh},-${aa}*${g},${aa}*${f}-${dd}*${cc},-2*${g}*${dd},0}))`;
        // At a flex aa=0, Q=V(2g+bU+cV). Its other line meets F at the
        // three remaining contacts; line/cubic intersections work natively.
        const lineX = `${b}*${ny}+${cc}*${nx}`;
        const lineY = `-${b}*${nx}+${cc}*${ny}`;
        const flexLine = coefficientLine([lineX, lineY, `2*(${g})^2-(${lineX})*${px}-(${lineY})*${py}`], allocate);
        return body(q, r, aa, flexLine);
      }, 'number');
    }, 'number');
  });

const contactPointAt = (curve: string, target: string, index: number, allocate: () => string) =>
  withContactConics(curve, target, allocate, (q, r, aa, flexLine) =>
    `If(${aa}==0,${index === 1 ? target : `Intersect(${curve},${flexLine},${index - 1})`},Intersect(${q},${r},${index}))`);

const pretangential: ExpressionBuilder = (args, allocate) => {
  const [curve, target] = args.map((arg) => arg.expression);
  return independentOutputs([1, 2, 3, 4].map((i) => contactPointAt(curve, target, i, allocate)), args[2]?.expression);
};

const cubicInvolution: ExpressionBuilder = (args, allocate) => {
  const [curve, point] = args.map((arg) => arg.expression);
  const tangentImage = thirdIntersection([
    { expression: curve, type: 'implicitCurve' }, { expression: point, type: 'point' },
  ], allocate) as string;
  const branch = (index: number) => bind([tangentImage], allocate, ([target]) =>
    withContactConics(curve, target, allocate, (q, r, aa, flexLine) => {
      const candidate = allocate();
      const keep = (list: string) => `Element(KeepIf(IsDefined(${candidate})&&!AreEqual(${candidate},${point}),${candidate},${list}),${index})`;
      const flex = keep(`{${target},Intersect(${curve},${flexLine})}`);
      return `If(${aa}==0,${flex},${keep(`{Intersect(${q},${r})}`)})`;
    }));
  return independentOutputs([1, 2, 3].map(branch), args[2]?.expression);
};

const CUBIC_CONTACT_AND_INTERPOLATION_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  circularCubicDirection, nodalCubic, strophoid, cubicAsymptotes, pretangential, cubicInvolution,
};

export const CUBIC_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  ...CUBIC_POLAR_AND_INTERSECTION_BUILDERS, ...CUBIC_PROJECTIVE_BUILDERS, ...CUBIC_CONTACT_AND_INTERPOLATION_BUILDERS,
};
