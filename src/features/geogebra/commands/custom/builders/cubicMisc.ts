import type { ExpressionBuilder } from '../types';
import { add, bind, homogeneous, independentOutputs, matrix, mul, supportingLine } from '../algebra/homogeneous';

type Term = readonly [number, number];
type Basis = readonly (readonly Term[])[];
const power = (value: string, degree: number) => degree === 0 ? '1' : degree === 1 ? value : `(${value})^${degree}`;
const sum = (terms: string[]) => terms.length ? add(terms) : '0';
const basisValue = (basis: Basis, x: string, y: string) => basis.map((terms) =>
  sum(terms.map(([i, j]) => mul(power(x, i), power(y, j)))));
const minor = (rows: string[][], skip: number) => `Determinant(${matrix(rows.map((row) => row.filter((_, j) => j !== skip)))})`;
/** A full-rank (n-1) by n evaluation matrix has this null vector. */
export const kernelMinors = (rows: string[][]) => rows[0].map((_, i) => `${i % 2 ? '-' : ''}${minor(rows, i)}`);
const polynomialFromKernel = (rows: string[][], basis: Basis, x: string, y: string, allocate: () => string) =>
  bind(kernelMinors(rows), allocate, (coefficients) => {
    const terms = basisValue(basis, x, y);
    const equation = sum(coefficients.map((c, i) => mul(c, terms[i])));
    return `If(${sum(coefficients.map((c) => `(${c})^2`))}!=0,ImplicitCurve(${equation}))`;
  });

const circularBasis: Basis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0]], [[1, 1]],
  [[0, 2]], [[1, 0]], [[0, 1]], [[0, 0]],
];
const nodeBasis: Basis = [
  [[3, 0]], [[2, 1]], [[1, 2]], [[0, 3]], [[2, 0]], [[1, 1]], [[0, 2]],
];
const circularNodeBasis: Basis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0]], [[1, 1]], [[0, 2]],
];
/** Orthogonal tangent cone at the double point: quadratic trace is zero. */
const strophoidBasis: Basis = [
  [[3, 0], [1, 2]], [[2, 1], [0, 3]], [[2, 0], [0, 2]], [[1, 1]],
];
const localPoint = (p: string, node: string): [string, string] => [`x(${p})-x(${node})`, `y(${p})-y(${node})`];
const localVariable = (node: string): [string, string] => [`x-x(${node})`, `y-y(${node})`];
const direction = (line: string): [string, string] => [`y(${line})`, `-x(${line})`];
const infinityRow = (basis: Basis, line: string) => {
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

export const CUBIC_MISC_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  circularCubicDirection, nodalCubic, strophoid, cubicAsymptotes,
};
