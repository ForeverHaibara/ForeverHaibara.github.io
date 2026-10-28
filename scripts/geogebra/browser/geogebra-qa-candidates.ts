/** Benchmark candidates only. Keep them separate until native equivalence and timing pass. */
import { add, barycentricVariables, bind, coefficientList, mul, squaredNorm, triangleAreas, triangleSideSquares } from '../../../src/features/geogebra/commands/custom/algebra/homogeneous';
import { qaCubicCoefficients } from '../../../src/features/geogebra/commands/custom/builders/triangleCubics';
import { qaInverseBarycentricCoefficients, qaInverseCoefficients, qaInverseEquation, qaInverseSevenTermEquation } from '../../../src/features/geogebra/commands/custom/builders/triangleCubics';

const vertices = ['A', 'B', 'C'];
const xyz = barycentricVariables(vertices);
const sides = triangleSideSquares(vertices);

export const directQaEquation = () => {
  const d = triangleAreas([...vertices, 'D']);
  const t = d.map((v, i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return `${sides[i]}*(${v}+${d[j]})*(${v}+${d[k]})-${sides[j]}*${v}*(${v}+${d[j]})-${sides[k]}*${v}*(${v}+${d[k]})`;
  });
  const cs = qaCubicCoefficients(sides, d, t);
  const terms = [0, 1, 2].flatMap((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return [mul(cs[2 * i], `${xyz[j]}^2`, xyz[k]), mul(cs[2 * i + 1], xyz[j], `${xyz[k]}^2`)];
  });
  return `If(IsDefined(A)&&IsDefined(B)&&IsDefined(C)&&IsDefined(D)&&!AreCollinear(A,B,C)&&(${squaredNorm(cs)})!=0,ImplicitCurve(${add(terms)}))`;
};

export const directQaInverseEquation = () => {
  const fixed = triangleAreas([...vertices, 'P']);
  const guard = `${squaredNorm(qaInverseCoefficients(sides, fixed))}!=0`;
  return `If(${guard},ImplicitCurve(${qaInverseEquation(sides, xyz, fixed)}))`;
};

/** Snapshot of the pre-optimization inverse builder for reproducible timings. */
export const legacyQaInverseEquation = () => {
  let index = 0;
  const allocate = () => `qaLegacy${++index}`;
  const fixed = triangleAreas([...vertices, 'P']);
  const values = [...sides, ...fixed];
  const equation = bind(values, allocate, (v) => qaInverseEquation(v.slice(0, 3), xyz, v.slice(3)));
  const guard = bind(values, allocate, (v) => `${squaredNorm(qaInverseCoefficients(v.slice(0, 3), v.slice(3)))}!=0`);
  return `If(${guard},ImplicitCurve(${equation}))`;
};

export const directSevenTermInverseEquation = () => {
  const fixed = triangleAreas([...vertices, 'P']);
  const coefficients = qaInverseBarycentricCoefficients(sides, fixed);
  return `If(${squaredNorm(coefficients)}!=0,ImplicitCurve(${qaInverseSevenTermEquation(xyz, coefficients)}))`;
};

export const boundSevenTermInverseEquation = () => {
  let index = 0;
  const allocate = () => `qaLocal${++index}`;
  const fixed = triangleAreas([...vertices, 'P']);
  const data = bind([...sides, ...fixed], allocate, (values) =>
    coefficientList(qaInverseBarycentricCoefficients(values.slice(0, 3), values.slice(3))));
  const elements = (list: string) => Array.from({ length: 7 }, (_, i) => `Element(${list},${i + 1})`);
  const polynomial = bind([data], allocate, ([list]) => qaInverseSevenTermEquation(xyz, elements(list)));
  const guard = bind([data], allocate, ([list]) => `${squaredNorm(elements(list))}!=0`);
  return `If(${guard},ImplicitCurve(${polynomial}))`;
};
