import type { ExpressionBuilder } from './types';
import { add, mul, sub, cross, bind, homogeneous, triangleAreas, barycentricPoint, barycentricConic, coefficientLine, independentOutputs } from './expressionGeometry';

type Weights = (coordinates: string[][], vertices: string[]) => string[];

/** Products of homogeneous coordinates, without intermediate affine poles. */
const barycentricMap = (weights: Weights): ExpressionBuilder => (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const coordinates = args.slice(3).map((arg) => triangleAreas([...vertices, arg.expression]));
  return bind(coordinates.flat(), allocate, (values) => {
    const points = coordinates.map((_, i) => values.slice(3 * i, 3 * i + 3));
    return `If(${add(points[0])}!=0,${bind(weights(points, vertices), allocate, (result) => barycentricPoint(vertices, result))})`;
  });
};

export const isoconjugateWeights: Weights = (coordinates) => {
  const [x, y, p] = coordinates.length === 2 ? [coordinates[0], coordinates[0], coordinates[1]] : coordinates;
  return [0, 1, 2].map((i) => mul(x[i], y[i], p[(i + 1) % 3], p[(i + 2) % 3]));
};
const isoconjugate = barycentricMap(isoconjugateWeights);

export const crosspointWeights: Weights = ([p, q]) => [0, 1, 2].map((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return mul(p[i], q[i], add([mul(p[j], q[k]), mul(p[k], q[j])]));
});
const crosspoint = barycentricMap(crosspointWeights);

export const cevapointWeights: Weights = ([p, q]) => [0, 1, 2].map((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return mul(add([mul(p[i], q[j]), mul(p[j], q[i])]), add([mul(p[i], q[k]), mul(p[k], q[i])]));
});
const cevapoint = barycentricMap(cevapointWeights);

export const cevaConjugateWeights: Weights = ([x, p]) => [0, 1, 2].map((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return mul(p[i], add([`-${mul(x[j], x[k], p[i])}`, mul(x[k], x[i], p[j]), mul(x[i], x[j], p[k])]));
});
const cevaConjugate = barycentricMap(cevaConjugateWeights);

export const crossConjugateWeights: Weights = ([x, p]) => {
  const d = [0, 1, 2].map((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return add([`-${mul(x[i], p[j], p[k])}`, mul(x[j], p[k], p[i]), mul(x[k], p[i], p[j])]);
  });
  return [0, 1, 2].map((i) => mul(p[i], d[(i + 1) % 3], d[(i + 2) % 3]));
};
const crossConjugate = barycentricMap(crossConjugateWeights);

export const cyclocevianWeights: Weights = ([p], vertices) => {
  const reciprocal = (v: string[]) => [0, 1, 2].map((i) => mul(v[(i + 1) % 3], v[(i + 2) % 3]));
  // X in ABC has coordinates (sum(X)-X_i)/2 in the anticomplementary
  // triangle. The inverse change is sum(Y)-2Y_i. No affine division is needed.
  const x = reciprocal(p);
  const first = [0, 1, 2].map((i) => add([x[(i + 1) % 3], x[(i + 2) % 3]]));
  const second = reciprocal(first).map((weight, i) => mul(weight, `Distance(${vertices[(i + 1) % 3]},${vertices[(i + 2) % 3]})^2`));
  return reciprocal([0, 1, 2].map((i) => add([second[(i + 1) % 3], second[(i + 2) % 3], `-(${second[i]})`])));
};
const cyclocevian = barycentricMap(cyclocevianWeights);

export const antigonalWeights: Weights = ([p], [a, b, c]) => {
  const sides = [`Distance(${b},${c})^2`, `Distance(${c},${a})^2`, `Distance(${a},${b})^2`];
  const d = [0, 1, 2].map((i) => {
    const j = (i + 1) % 3; const k = (i + 2) % 3;
    return add([mul(add([sides[j], sides[k], `-(${sides[i]})`]), p[i], p[i]), `-${mul(sides[i], p[j], p[k])}`,
      mul(sub(sides[j], sides[i]), p[i], p[j]), mul(sub(sides[k], sides[i]), p[i], p[k])]);
  });
  return [0, 1, 2].map((i) => mul(p[i], d[(i + 1) % 3], d[(i + 2) % 3]));
};
const antigonal = barycentricMap(antigonalWeights);

const affineMap = (pedal: boolean): ExpressionBuilder => (args, allocate) => {
  const [a, b, c, x, p] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  return bind(triangleAreas([a, b, c, p]), allocate, (weights) => {
    const images = vertices.map((_, i) => {
      const j = vertices[(i + 1) % 3]; const k = vertices[(i + 2) % 3];
      return pedal ? `((${x})+Reflect(${x},Line(${j},${k})))/2`
        : `Intersect(Line(${vertices[i]},${x}),Line(${j},${k}))`;
    });
    return bind(images, allocate, (targets) => barycentricPoint(targets, weights));
  });
};

export const orthotransversalCoordinates = (vertices: string[][], p: string[]) => {
  const traces = vertices.slice(0, 2).map((vertex, i) => {
    const normal = [sub(vertex[0], p[0]), sub(vertex[1], p[1])];
    const perpendicular = [...normal, `-${add([mul(normal[0], p[0]), mul(normal[1], p[1])])}`];
    return cross(cross(vertices[(i + 1) % 3], vertices[(i + 2) % 3]), perpendicular);
  });
  return cross(traces[0], traces[1]);
};
const orthotransversal: ExpressionBuilder = (args, allocate) =>
  `If(!AreCollinear(${args.slice(0, 3).map((arg) => arg.expression).join(',')}),${coefficientLine(
    orthotransversalCoordinates(args.slice(0, 3).map(homogeneous), homogeneous(args[3])), allocate)})`;

const orthocorrespondent: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  return bind(orthotransversalCoordinates(args.slice(0, 3).map(homogeneous), homogeneous(args[3])), allocate, ([a, b, c]) =>
    bind(vertices.map((p) => `${a}*x(${p})+${b}*y(${p})+${c}`), allocate, ([u, v, w]) =>
      `If(!AreCollinear(${vertices.join(',')}),${barycentricPoint(vertices, [mul(v, w), mul(w, u), mul(u, v)])})`));
};

const lineConjugate = (isogonal: boolean): ExpressionBuilder => (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  return bind(homogeneous(args[3]), allocate, ([a, b, c]) =>
    bind(vertices.map((p) => `${a}*x(${p})+${b}*y(${p})+${c}`), allocate, (weights) => {
      const coefficients = weights.map((weight, i) => isogonal ? mul(weight, `Distance(${vertices[(i + 1) % 3]},${vertices[(i + 2) % 3]})^2`) : weight);
      return barycentricConic(vertices, ['0', '0', '0', coefficients[2], coefficients[1], coefficients[0]]);
    }));
};

const inconicCenter: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  return bind(triangleAreas(args.map((arg) => arg.expression)), allocate, ([p, q, r]) =>
    bind([`${p}+${q}-${r}`, `${p}+${r}-${q}`, `${q}+${r}-${p}`], allocate, ([u, v, w]) =>
      barycentricConic(vertices, [`-${w}^2`, `-${v}^2`, `-${u}^2`, mul('2', v, w), mul('2', u, w), mul('2', u, v)])));
};
const steinerInellipse: ExpressionBuilder = (args) => barycentricConic(args.map((arg) => arg.expression), ['1', '1', '1', '-2', '-2', '-2']);
const steinerCircumellipse: ExpressionBuilder = (args) => barycentricConic(args.map((arg) => arg.expression), ['0', '0', '0', '1', '1', '1']);

export const centeredConicShape = (rows: string[][]) => cross(rows[1].map((value, i) => sub(value, rows[0][i])), rows[2].map((value, i) => sub(value, rows[0][i])));

const ninePointConic: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d] = args.map((arg) => arg.expression);
  return bind([`((${a})+(${b})+(${c})+(${d}))/4`], allocate, ([center]) =>
    bind([`((${a})+(${b}))/2-${center}`, `((${a})+(${c}))/2-${center}`, `((${a})+(${d}))/2-${center}`], allocate, (points) => {
      const rows = points.map((p) => [`x(${p})^2`, `y(${p})^2`, `x(${p})*y(${p})`]);
      return bind(centeredConicShape(rows), allocate, (shape) => {
        const constant = `-${add(shape.map((coefficient, i) => mul(coefficient, rows[0][i])))}`;
        return `Translate(Conic({${shape[0]},${shape[1]},${constant},${shape[2]},0,0}),Vector(${center}))`;
      });
    }));
};

const apollonius: ExpressionBuilder = (args, allocate) => {
  const [a, b, c] = args.map((arg) => arg.expression);
  return bind([`Distance(${c},${a})^2`, `Distance(${a},${b})^2`, `x(${c})-x(${b})`, `y(${c})-y(${b})`], allocate, ([u, v, dx, dy]) =>
    `Translate(Conic({${u}-${v},${u}-${v},-${v}*(${dx}^2+${dy}^2),0,2*${v}*${dx},2*${v}*${dy}}),Vector(${b}))`);
};

export const commonTangentNormal = (dx: string, dy: string, difference: string, squared: string, height: string, sign: number) => [
  `(${difference}*${dx}-(${sign})*${height}*${dy})/${squared}`,
  `(${difference}*${dy}+(${sign})*${height}*${dx})/${squared}`,
];

const commonTangents: ExpressionBuilder = (args, allocate) => {
  const [c1, c2, s] = args.map((arg) => arg.expression);
  const output = (sign: number) => bind([`Center(${c1})`, `Center(${c2})`, `Radius(${c1})`, `Radius(${c2})`], allocate, ([o1, o2, r1, r2]) =>
    bind([`x(${o2})-x(${o1})`, `y(${o2})-y(${o1})`, `${r1}-(${s})*${r2}`], allocate, ([dx, dy, difference]) =>
      bind([`${dx}^2+${dy}^2`, `sqrt(${dx}^2+${dy}^2-${difference}^2)`], allocate, ([squared, height]) =>
        bind(commonTangentNormal(dx, dy, difference, squared, height, sign), allocate, ([nx, ny]) =>
          `If((${s})^2==1,${coefficientLine([nx, ny, `-${r1}-${nx}*x(${o1})-${ny}*y(${o1})`], allocate)})`))));
  return independentOutputs([output(1), output(-1)], args[3]?.expression);
};

export const TRIANGLE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  isoconjugate, crosspoint, cevapoint, cevaConjugate, crossConjugate, cyclocevian, antigonal,
  cevianAffine: affineMap(false), pedalAffine: affineMap(true), orthotransversal, orthocorrespondent,
  isogonalLine: lineConjugate(true), isotomicLine: lineConjugate(false),
  inconicCenter, steinerInellipse, steinerCircumellipse, ninePointConic, apollonius, commonTangents,
};
