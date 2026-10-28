import type { ExpressionBuilder } from '../types';
import { add, bind, coefficientList, mul, sub, triangleAreas, triangleSideSquares, barycentricVariables } from '../algebra/homogeneous';
import { monomial, polynomialProduct, polynomialScale, polynomialSum } from '../algebra/polynomial';
import type { Polynomial } from '../algebra/polynomial';
import { qaCubicCoefficients } from './triangleCurves';

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);
const term = (...factors: string[]) => mul(...factors);
// GeoGebra currently reports ImplicitCurve(0) as a defined implicitpoly.
// Check numeric coefficient sums outside the final curve, avoiding symbolic
// comparison of a full function or an extra matrix-rank computation.
const nonzero = (coefficients: string[]) => `${add(coefficients.map((c) => `(${c})^2`))}!=0`;
const cubic = (equation: string, coefficients: string[]) => `If(${nonzero(coefficients)},ImplicitCurve(${equation}))`;
const pivotalCoefficients = ([p, q, r]: string[], [u, v, w]: string[]) =>
  [term(u, r), term(u, q), term(v, p), term(v, r), term(w, q), term(w, p)];
const nonpivotalCoefficients = (pole: string[], root: string[], point: string[]) => {
  const dual = [term(pole[0], point[1], point[2]), term(pole[1], point[2], point[0]), term(pole[2], point[0], point[1])];
  return [...[0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [term(root[i], point[j], dual[j]), term(root[i], point[k], dual[k])];
  }), add([0, 1, 2].map((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return term(root[i], add([term(point[j], dual[k]), term(point[k], dual[j])]));
  }))];
};
const conicoCoefficients = ([f, g, h]: string[], [u, v, w]: string[]) =>
  [term(u, h, h), term(u, g, g), term(v, f, f), term(v, h, h), term(w, g, g), term(w, f, f),
    add([term(u, h, g), term(v, f, h), term(w, g, f)])];

/** (p:q:r) is the conjugation pole; (u:v:w) is the pivot. */
export const pivotalEquation = (xyz: string[], [p, q, r]: string[], [u, v, w]: string[]) => {
  const [x, y, z] = xyz;
  return add([
    term(u, x, sub(term(r, `${y}^2`), term(q, `${z}^2`))),
    term(v, y, sub(term(p, `${z}^2`), term(r, `${x}^2`))),
    term(w, z, sub(term(q, `${x}^2`), term(p, `${y}^2`))),
  ]);
};

/** SITP's nK_0 member of the nonpivotal family. */
export const apolarEquation = (xyz: string[], [p, q, r]: string[], [u, v, w]: string[]) => {
  const [x, y, z] = xyz;
  return add([
    term(u, x, add([term(r, `${y}^2`), term(q, `${z}^2`)])),
    term(v, y, add([term(p, `${z}^2`), term(r, `${x}^2`)])),
    term(w, z, add([term(q, `${x}^2`), term(p, `${y}^2`)])),
  ]);
};

/** The six-argument nonpivotal member, with Q and Q* on the curve. */
export const nonpivotalEquation = (xyz: string[], pole: string[], root: string[], point: string[]) => {
  const dual = [term(pole[0], point[1], point[2]), term(pole[1], point[2], point[0]), term(pole[2], point[0], point[1])];
  return add([0, 1, 2].map((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return term(root[i], xyz[i], sub(term(point[j], xyz[k]), term(point[k], xyz[j])),
      sub(term(dual[j], xyz[k]), term(dual[k], xyz[j])));
  }));
};

export const conicoPivotalEquation = (xyz: string[], [f, g, h]: string[], root: string[]) => {
  const [x, y, z] = xyz;
  return add([
    term(root[0], x, `${sub(term(h, y), term(g, z))}^2`),
    term(root[1], y, `${sub(term(f, z), term(h, x))}^2`),
    term(root[2], z, `${sub(term(g, x), term(f, y))}^2`),
  ]);
};

const pivotal: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, pole, pivot] = expressions(args);
  const xyz = barycentricVariables([a, b, c]);
  const values = [...triangleAreas([a, b, c, pole]), ...triangleAreas([a, b, c, pivot])];
  const equation = bind(values, allocate, (v) => pivotalEquation(xyz, v.slice(0, 3), v.slice(3)));
  return cubic(equation, pivotalCoefficients(values.slice(0, 3), values.slice(3)));
};

const pivotalIsotomic: ExpressionBuilder = (args) => {
  const [a, b, c, pivot] = expressions(args);
  const xyz = barycentricVariables([a, b, c]);
  const root = triangleAreas([a, b, c, pivot]);
  return cubic(pivotalEquation(xyz, ['1', '1', '1'], root), pivotalCoefficients(['1', '1', '1'], root));
};

const nonpivotal: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, pole, root, point] = expressions(args);
  const xyz = barycentricVariables([a, b, c]);
  const quantities = [...triangleAreas([a, b, c, pole]), ...triangleAreas([a, b, c, root])];
  if (point) quantities.push(...triangleAreas([a, b, c, point]));
  const equation = bind(quantities, allocate, (values) => point
    ? nonpivotalEquation(xyz, values.slice(0, 3), values.slice(3, 6), values.slice(6))
    : apolarEquation(xyz, values.slice(0, 3), values.slice(3)));
  return cubic(equation, point
    ? nonpivotalCoefficients(quantities.slice(0, 3), quantities.slice(3, 6), quantities.slice(6))
    : pivotalCoefficients(quantities.slice(0, 3), quantities.slice(3)));
};

const conicoPivotal: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, singular, root] = expressions(args);
  const xyz = barycentricVariables([a, b, c]);
  const values = [...triangleAreas([a, b, c, singular]), ...triangleAreas([a, b, c, root])];
  const equation = bind(values, allocate, (v) => conicoPivotalEquation(xyz, v.slice(0, 3), v.slice(3)));
  return cubic(equation, conicoCoefficients(values.slice(0, 3), values.slice(3)));
};

/** Evaluate QA-Cu1(A,B,C,D) at P while D=(x,y) varies. */
export const qaInverseEquation = (sideSquares: string[], variable: string[], fixed: string[]) => {
  const t = variable.map((v, i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return sub(sub(term(sideSquares[i], add([v, variable[j]]), add([v, variable[k]])),
      term(sideSquares[j], v, add([v, variable[j]]))),
    term(sideSquares[k], v, add([v, variable[k]])));
  });
  const coefficients = qaCubicCoefficients(sideSquares, variable, t);
  return add([0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [term(coefficients[2 * i], `${fixed[j]}^2`, fixed[k]),
      term(coefficients[2 * i + 1], fixed[j], `${fixed[k]}^2`)];
  }));
};

/** Seven circum-cubic coefficients in the variable fourth vertex's barycentrics. */
export const qaInverseBarycentricCoefficients = (s: string[], f: string[]): string[] => {
  const square = (value: string) => `(${value})^2`;
  const edge = [0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [
      add([`-${term(s[i], sub(s[i], add([s[j], s[k]])), f[j], square(f[k]))}`,
        term(s[j], sub(s[j], s[i]), f[i], square(f[k])),
        `-${term(square(s[k]), f[i], square(f[j]))}`]),
      add([`-${term(s[i], sub(s[i], s[j]), f[j], square(f[k]))}`,
        term(s[j], sub(s[j], add([s[i], s[k]])), f[i], square(f[k])),
        term(square(s[k]), square(f[i]), f[j])]),
    ];
  });
  const mixed = add([0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [term(s[i], sub(s[i], s[j]), square(f[j]), f[k]),
      `-${term(s[i], sub(s[i], s[k]), f[j], square(f[k]))}`];
  }));
  return [...edge, mixed];
};

export const qaInverseSevenTermEquation = (variable: string[], coefficients: string[]): string => add([
  ...[0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3;
    return [term(coefficients[2 * i], `${variable[i]}^2`, variable[j]),
      term(coefficients[2 * i + 1], variable[i], `${variable[j]}^2`)];
  }),
  term(coefficients[6], ...variable),
]);

/** Ten coefficients in the affine barycentric chart D=(s:t:1). */
export const qaInverseCoefficients = (sideSquares: string[], fixed: string[]): string[] => {
  const v: Polynomial[] = [monomial(1, 0, '1'), monomial(0, 1, '1'), monomial(0, 0, '1')];
  const product = (...ps: Polynomial[]) => ps.reduce(polynomialProduct);
  const t = v.map((entry, i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    const viVj = polynomialSum(entry, v[j]); const viVk = polynomialSum(entry, v[k]);
    return polynomialSum(polynomialScale(product(viVj, viVk), sideSquares[i]),
      polynomialScale(product(entry, viVj), `-(${sideSquares[j]})`),
      polynomialScale(product(entry, viVk), `-(${sideSquares[k]})`));
  });
  const equation = polynomialSum(...[0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [polynomialScale(product(t[i], v[k]), term(sideSquares[i], `${fixed[j]}^2`, fixed[k])),
      polynomialScale(product(t[i], v[j]), `-(${term(sideSquares[i], fixed[j], `${fixed[k]}^2`)})`)];
  }));
  return [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]]
    .map(([x, y]) => equation.get(`${x},${y}`) ?? '0');
};

const qaInverse: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, p] = expressions(args);
  const values = [...triangleSideSquares([a, b, c]), ...triangleAreas([a, b, c, p])];
  const data = bind(values, allocate, (v) =>
    coefficientList(qaInverseBarycentricCoefficients(v.slice(0, 3), v.slice(3))));
  const coefficients = (list: string) => Array.from({ length: 7 }, (_, i) => `Element(${list},${i + 1})`);
  const equation = bind([data], allocate, ([list]) =>
    qaInverseSevenTermEquation(barycentricVariables([a, b, c]), coefficients(list)));
  const guard = bind([data], allocate, ([list]) => nonzero(coefficients(list)));
  return `If(${guard},ImplicitCurve(${equation}))`;
};

export const ISOCUBIC_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  pivotalCubic: pivotal,
  pivotalIsotomicCubic: pivotalIsotomic,
  nonpivotalCubic: nonpivotal,
  conicoPivotalCubic: conicoPivotal,
  qaCu1Inverse: qaInverse,
};
