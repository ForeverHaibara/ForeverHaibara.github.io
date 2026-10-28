import type { ExpressionBuilder } from '../types';
import { add, mul, sub, cross, bind, homogeneous, triangleAreas, barycentricPoint, barycentricConic, coefficientLine, triangleSideSquares, coordinatesToPoint, coefficientList, translatedConicCoefficients } from '../algebra/homogeneous';

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
  const coefficients = bind(homogeneous(args[3]), allocate, ([a, b, c]) =>
    bind(vertices.map((p) => `${a}*x(${p})+${b}*y(${p})+${c}`), allocate, (weights) => {
      const coefficients = weights.map((weight, i) => isogonal ? mul(weight, `Distance(${vertices[(i + 1) % 3]},${vertices[(i + 2) % 3]})^2`) : weight);
      return coefficientList(['0', '0', '0', coefficients[2], coefficients[1], coefficients[0]]);
    }));
  return barycentricConic(vertices, coefficients);
};

const inconicCenter: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const coefficients = bind(triangleAreas(args.map((arg) => arg.expression)), allocate, ([p, q, r]) =>
    bind([`${p}+${q}-${r}`, `${p}+${r}-${q}`, `${q}+${r}-${p}`], allocate, ([u, v, w]) =>
      coefficientList([`-${w}^2`, `-${v}^2`, `-${u}^2`, mul('2', v, w), mul('2', u, w), mul('2', u, v)])));
  return barycentricConic(vertices, coefficients);
};
const steinerInellipse: ExpressionBuilder = (args) => barycentricConic(args.map((arg) => arg.expression), ['1', '1', '1', '-2', '-2', '-2']);
const steinerCircumellipse: ExpressionBuilder = (args) => barycentricConic(args.map((arg) => arg.expression), ['0', '0', '0', '1', '1', '1']);

const apolloniusCircle: ExpressionBuilder = (args, allocate) => {
  const [a, b, c] = args.map((arg) => arg.expression);
  const coefficients = bind([`Distance(${c},${a})^2`, `Distance(${a},${b})^2`, `x(${c})-x(${b})`, `y(${c})-y(${b})`], allocate, ([u, v, dx, dy]) =>
    coefficientList(translatedConicCoefficients([`${u}-${v}`, `${u}-${v}`, `-${v}*(${dx}^2+${dy}^2)`, '0', `2*${v}*${dx}`, `2*${v}*${dy}`], b)));
  return `Conic(${coefficients})`;
};

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);

const triangleOrthicAxis: ExpressionBuilder = (args, allocate) => {
  const vertices = args.map(homogeneous);
  return bind(triangleSideSquares(expressions(args)), allocate, (s) => {
    const weights = s.map((v, i) => `(${s[(i + 1) % 3]}+${s[(i + 2) % 3]}-${v})`);
    const lines = vertices.map((_, i) => cross(vertices[(i + 1) % 3], vertices[(i + 2) % 3]));
    return `If(!AreCollinear(${expressions(args).join(',')}),${coefficientLine([0, 1, 2].map((j) => add(weights.map((w, i) => mul(w, lines[i][j])))), allocate)})`;
  });
};

const stammlerHyperbola: ExpressionBuilder = (args, allocate) => barycentricConic(expressions(args), bind(triangleSideSquares(expressions(args)), allocate, (s) =>
  coefficientList([...s.map((v, i) => `((${s[(i + 1) % 3]})-(${s[(i + 2) % 3]}))/(${v})`), '0', '0', '0'])));

const liangZelichPerspector: ExpressionBuilder = (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...triangleSideSquares(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3, 6); const o = values[6];
    return bind(p.map((v, i) => `(${v})^2/${s[i]}`), allocate, (squares) =>
      bind(squares.map((_, i) => `((${squares[(i + 1) % 3]})-(${squares[(i + 2) % 3]}))/${s[i]}`), allocate, (q) => {
        const l = cross([`x(${o})`, `y(${o})`, '1'], homogeneous(args[3]));
        return bind(vertices.map((v) => add([mul(l[0], `x(${v})`), mul(l[1], `y(${v})`), l[2]])), allocate, (line) =>
          `If(!AreCollinear(${vertices.join(',')}),${barycentricPoint(vertices, q.map((_, i) => mul(line[i], q[(i + 1) % 3], q[(i + 2) % 3])))})`);
      }));
  });
};

const cundyParry = (psi: boolean): ExpressionBuilder => (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...triangleSideSquares(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`, `TriangleCenter(${vertices.join(',')},4)`], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3, 6); const o = values[6]; const h = values[7];
    return bind(s.map((v, i) => mul(v, p[(i + 1) % 3], p[(i + 2) % 3])), allocate, (weights) =>
      bind([add(weights.map((w, i) => mul(w, `x(${vertices[i]})`))), add(weights.map((w, i) => mul(w, `y(${vertices[i]})`))), add(weights)], allocate, (q) => {
        const input = homogeneous(args[3]);
        return bind([...cross([`x(${o})`, `y(${o})`, '1'], psi ? q : input), ...cross([`x(${h})`, `y(${h})`, '1'], psi ? input : q)], allocate, (lines) =>
          `If(!AreCollinear(${vertices.join(',')}),${coordinatesToPoint(cross(lines.slice(0, 3), lines.slice(3)))})`);
      }));
  });
};
const orthopolarConic: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, p] = expressions(args);
  const xy = (v: string) => [`x(${v})`, `y(${v})`];
  const dot = (u: string[], v: string[]) => add(u.map((x, i) => mul(x, v[i])));
  const coefficients = bind([`(${c})-(${b})`, `(${a})-(${c})`, `(${p})-(${a})`, `(${p})-(${b})`, `(TriangleCenter(${a},${b},${c},4)+(${p}))/2`], allocate, ([l, m, pa, pb, n]) => {
    const determinant = `x(${l})*y(${m})-y(${l})*x(${m})`;
    const solve = (v: string[]) => [`((${v[0]})*y(${m})-y(${l})*(${v[1]}))/(2*(${determinant}))`, `(x(${l})*(${v[1]})-(${v[0]})*x(${m}))/(2*(${determinant}))`];
    const cos = [dot(xy(l), [`x(${pa})`, `-y(${pa})`]), dot(xy(m), [`x(${pb})`, `-y(${pb})`])];
    const sin = [dot(xy(l), [`y(${pa})`, `x(${pa})`]), dot(xy(m), [`y(${pb})`, `x(${pb})`])];
    return bind([...solve(cos), ...solve(sin)], allocate, ([ux, uy, vx, vy]) => {
      const det = `(${ux}*${vy}-${uy}*${vx})`;
      return coefficientList(translatedConicCoefficients([`${vy}^2+${uy}^2`, `${vx}^2+${ux}^2`, `-${det}^2`, `-2*(${vx}*${vy}+${ux}*${uy})`, '0', '0'], n));
    });
  });
  return `Conic(${coefficients})`;
};

export const TRIANGLE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  isoconjugate, crosspoint, cevapoint, cevaConjugate, crossConjugate, cyclocevian, antigonal,
  cevianAffine: affineMap(false), pedalAffine: affineMap(true), orthotransversal, orthocorrespondent,
  isogonalLine: lineConjugate(true), isotomicLine: lineConjugate(false),
  inconicCenter, steinerInellipse, steinerCircumellipse, apollonius: apolloniusCircle,
  orthicAxis: triangleOrthicAxis, stammler: stammlerHyperbola, liangZelich: liangZelichPerspector, cundyPhi: cundyParry(false), cundyPsi: cundyParry(true), orthopolar: orthopolarConic,
};
