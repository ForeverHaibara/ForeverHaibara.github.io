import type { ExpressionBuilder } from '../types';

import { add, mul, transpose, product, adjugate, determinant, cross, bind, homogeneous, triangleAreas, barycentricPoint, independentOutputs, coefficientList } from '../algebra/homogeneous';
import type { Matrix } from '../algebra/homogeneous';
import { TRIANGLE_BUILDERS } from './triangle';
import { CUBIC_BUILDERS } from './cubics';
import { ISOCUBIC_BUILDERS, TRIANGLE_CURVE_BUILDERS, pivotalIsogonalCubic } from './triangleCubics';
import { CONIC_BUILDERS } from './conics';
import { QUADRANGLE_BUILDERS } from './quadrangle';
import { QUADRILATERAL_BUILDERS } from './quadrilateral';

const conjugate = (isogonal: boolean): ExpressionBuilder => (args, allocate) => {
  const [a, b, c, p] = args.map((arg) => arg.expression);
  // Signed area coordinates; products replace reciprocals and extend across triangle sidelines.
  return bind(triangleAreas([a, b, c, p]), allocate, ([u, v, w]) => {
    const weights = [mul(v, w), mul(w, u), mul(u, v)].map((weight, i) => isogonal ? mul(weight, `Distance(${[b, c, a][i]},${[c, a, b][i]})^2`) : weight);
    return `If((${u}+${v}+${w})!=0,${bind(weights, allocate, ([r, s, t]) => `(${r}*(${a})+${s}*(${b})+${t}*(${c}))/(${r}+${s}+${t})`)})`;
  });
};

const brocard: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const [a, b, c] = vertices;
  const point = (second: boolean) => bind([`Distance(${b},${c})^2`, `Distance(${c},${a})^2`, `Distance(${a},${b})^2`], allocate,
    ([u, v, w]) => barycentricPoint(vertices, second ? [mul(u, v), mul(v, w), mul(w, u)] : [mul(u, w), mul(u, v), mul(v, w)]));
  const outputs = [point(false), point(true)];
  return independentOutputs(outputs, args[3]?.expression);
};

const anticevian: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const areas = triangleAreas(args.map((arg) => arg.expression));
  const outputs = [0, 1, 2].map((index) => bind(areas, allocate, (weights) =>
    `If(${add(weights)}!=0,${barycentricPoint(vertices, weights.map((weight, i) => i === index ? `-(${weight})` : weight))})`));
  return independentOutputs(outputs, args[4]?.expression);
};

const trilinearPolar: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map(homogeneous);
  const sidelines = [cross(vertices[1], vertices[2]), cross(vertices[2], vertices[0]), cross(vertices[0], vertices[1])];
  return bind(triangleAreas(args.map((arg) => arg.expression)), allocate, ([u, v, w]) => {
    const weights = [mul(v, w), mul(w, u), mul(u, v)];
    const coefficients = [0, 1, 2].map((axis) => add(weights.map((weight, i) => mul(weight, sidelines[i][axis]))));
    return bind(coefficients, allocate, ([a, b, c]) =>
      `If((${u}+${v}+${w})!=0,Line((-${a}*${c}/(${a}^2+${b}^2),-${b}*${c}/(${a}^2+${b}^2)),Vector((${b},-${a}))))`);
  });
};

const trilinearPole: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  return bind(homogeneous(args[3]), allocate, ([a, b, c]) =>
    bind(vertices.map((vertex) => `${a}*x(${vertex})+${b}*y(${vertex})+${c}`), allocate, ([u, v, w]) =>
      `If(${determinant(vertices.map((vertex) => [`x(${vertex})`, `y(${vertex})`, '1']))}!=0,${barycentricPoint(vertices, [mul(v, w), mul(w, u), mul(u, v)])})`));
};

// Coefficient order: a²,b²,c²,ab,ac,bc in the projective parameter plane.
const tangency = ([u, v, w]: string[]): string[] => [`-(${u})^2`, `-(${v})^2`, `-(${w})^2`, mul('2', u, v), mul('2', u, w), mul('2', v, w)];
const pairIndex = (i: number, j: number) => ({ '01': 3, '02': 4, '12': 5 })[[i, j].sort().join('') as '01' | '02' | '12'];
const chartConic = (q: string[], fixed: number, free: number[]) => `Conic({${[q[free[0]], q[free[1]], q[fixed], q[pairIndex(...free as [number, number])], q[pairIndex(free[0], fixed)], q[pairIndex(free[1], fixed)]].join(',')}})`;
const incidence = ([u, v, w]: string[]) => [mul(v, w), mul(w, u), mul(u, v)];

/** Five mixed incidence/tangency conditions; solve in primal or dual projective space. */
const conic: ExpressionBuilder = (args, allocate) => {
  const points = args.filter((arg) => arg.type === 'point');
  const lines = args.filter((arg) => arg.type !== 'point');
  if (points.length === 5) return `Conic(${args.map((arg) => arg.expression).join(',')})`;
  const dual = lines.length >= 3;
  const base = dual ? lines : points;
  const tangents = dual ? points : lines;
  const columns = base.slice(0, 3).map(homogeneous);
  const expression = bind(transpose(columns).flat(), allocate, (entries) => {
    const frame = [entries.slice(0, 3), entries.slice(3, 6), entries.slice(6, 9)];
    return bind(adjugate(frame).flat(), allocate, (inverseEntries) => {
      // adj(frame) is a homogeneous inverse: avoid division by its determinant.
      const inverse = [inverseEntries.slice(0, 3), inverseEntries.slice(3, 6), inverseEntries.slice(6, 9)];
      const transformVector = (m: Matrix, v: string[]) => product(m, v.map((entry) => [entry])).flat();
      const extra = base.slice(3).map((arg) => incidence(transformVector(inverse, homogeneous(arg))));
      const tangentVectors = tangents.map((arg) => transformVector(transpose(frame), homogeneous(arg)));
      return bind([...extra.flat(), ...tangentVectors.flat()], allocate, (values) => {
        const extraRows = extra.map((_, i) => values.slice(3 * i, 3 * i + 3));
        const tangentRows = tangents.map((_, i) => values.slice(extra.length * 3 + i * 3, extra.length * 3 + i * 3 + 3));
        // Transport only numbers through the bindings. In the dual case
        // adj(M^-T Q M^-1) is proportional to M adj(Q) M^T: no temporary
        // world conic, coefficient extraction, or numerical matrix inversion.
        const output = (parameters: string[]) => bind(parameters, allocate, ([a, b, c]) => {
          const q = dual
            ? [[`-${a}^2`, `${a}*${b}`, `${a}*${c}`], [`${a}*${b}`, `-${b}^2`, `${b}*${c}`], [`${a}*${c}`, `${b}*${c}`, `-${c}^2`]]
            : [['0', c, b], [c, '0', a], [b, a, '0']];
          const left = dual ? frame : transpose(inverse);
          const right = transpose(left);
          return bind(product(left, q).flat(), allocate, (entries) => {
            const m = product([entries.slice(0, 3), entries.slice(3, 6), entries.slice(6, 9)], right);
            return coefficientList([m[0][0], m[1][1], m[2][2], mul('2', m[0][1]), mul('2', m[0][2]), mul('2', m[1][2])]);
          }, 'number');
        }, 'number');
        if (extraRows.length === 2) return `If(${determinant(frame)}!=0,${output(cross(extraRows[0], extraRows[1]))})`;
        const charts = [0, 1, 2].map((fixed) => {
          const free = [0, 1, 2].filter((i) => i !== fixed);
          const first = chartConic(tangency(tangentRows[0]), fixed, free);
          const second = extraRows.length
            ? `(${extraRows[0][free[0]]})*x+(${extraRows[0][free[1]]})*y+(${extraRows[0][fixed]})=0`
            : chartConic(tangency(tangentRows[1]), fixed, free);
          const candidate = allocate();
          const kept = allocate();
          const parameters = ['0', '0', '0'];
          parameters[fixed] = '1';
          parameters[free[0]] = `x(${candidate})`;
          parameters[free[1]] = `y(${candidate})`;
          // All three affine charts cover projective infinity. Ownership bounds keep
          // each root in its best-conditioned chart (tie priority 0, then 1, then 2).
          const ownership = free.map((axis, i) => `abs(${i === 0 ? 'x' : 'y'}(${kept}))${axis < fixed ? '<' : '<='}1`).join('&&');
          const roots = `KeepIf(IsDefined(${kept})&&(${ownership}),${kept},{Intersect(${first},${second})})`;
          return `Zip(${output(parameters)},${candidate},${roots})`;
        });
        return `If(${determinant(frame)}!=0,RemoveUndefined(Join(${charts.join(',')})),{})`;
      }, 'number');
    }, 'number');
  }, 'number');
  if (points.length === 0) return `Conic(${expression})`;
  const coefficients = allocate();
  const curves = `Zip(Conic(${coefficients}),${coefficients},${expression})`;
  // A conic sentinel gives Element a fixed GeoConic output type even when
  // the real-solution list is initially empty. It is never a labeled object.
  return {
    expression: `Join({Conic({1,1,0/0,0,0,0})},${curves})`,
    outputCount: points.length === 1 || points.length === 4 ? 2 : 4,
    outputOffset: 1,
  };
};

const conicBranch: ExpressionBuilder = (args, allocate) => {
  const built = conic(args.slice(0, 5), allocate);
  const index = args[5].expression;
  if (typeof built === 'string') return `Element({${built}},${index})`;
  return `Element(${built.expression},(${index})+${built.outputOffset ?? 0})`;
};

export const GEOMETRY_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  isogonal: conjugate(true), isotomic: conjugate(false), conic, conicBranch,
  brocard, anticevian, trilinearPolar, trilinearPole,
  ...TRIANGLE_BUILDERS, ...CUBIC_BUILDERS, pivotal: pivotalIsogonalCubic, ...ISOCUBIC_BUILDERS, ...CONIC_BUILDERS, ...QUADRANGLE_BUILDERS, ...TRIANGLE_CURVE_BUILDERS, ...QUADRILATERAL_BUILDERS,
};

