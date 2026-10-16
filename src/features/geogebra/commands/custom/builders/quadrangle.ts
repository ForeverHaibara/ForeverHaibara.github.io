import type { ExpressionBuilder } from '../types';
import { add, mul, sub, cross, bind, triangleAreas, barycentricPoint, matrix, triangleSideSquares, coefficientList, translatedConicCoefficients } from '../algebra/homogeneous';

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);

const qap2: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d] = expressions(args);
  // Subtract the equation at D: the constant vanishes, leaving a 3x4 nullspace.
  return bind([`sqrt((Distance(${a},${d})^2+Distance(${b},${d})^2+Distance(${c},${d})^2)/3)`], allocate, ([scale]) =>
    bind([a, b, c].map((p) => `((${p})-(${d}))/${scale}`), allocate, (ps) => {
      const rows = ps.map((p) => [`x(${p})^2-y(${p})^2`, `2*x(${p})*y(${p})`, `x(${p})`, `y(${p})`]);
      return bind([0, 1, 2, 3].map((j) => `${j % 2 ? '-' : ''}Determinant(${matrix(rows.map((row) => row.filter((_, k) => k !== j)))})`), allocate, ([u, v, l, m]) =>
        `(${d})+${scale}*((-${u}*${l}-${v}*${m})/(2*(${u}^2+${v}^2)),(-${v}*${l}+${u}*${m})/(2*(${u}^2+${v}^2)))`);
    }));
};

const qap4: ExpressionBuilder = (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...triangleSideSquares(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3, 6); const o = values[6];
    return bind(s.map((v, i) => mul(v, p[(i + 1) % 3], p[(i + 2) % 3])), allocate, (w) =>
      bind([add(w.map((v, i) => mul(v, `x(${vertices[i]})-x(${o})`))), add(w.map((v, i) => mul(v, `y(${vertices[i]})-y(${o})`))), add(w)], allocate, ([x, y, z]) =>
        `(${o})+(Distance(${vertices[0]},${o})^2*${z}/(${x}^2+${y}^2))*(${x},${y})`));
  });
};

const qap5: ExpressionBuilder = (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind(triangleAreas(expressions(args)), allocate, (p) =>
    `If(!AreCollinear(${vertices.join(',')}),${barycentricPoint(vertices, p.map((v, i) => {
      const q = p[(i + 1) % 3]; const r = p[(i + 2) % 3];
      return `${q}*${r}*(${q}+${r})*(2*${v}+${q}+${r})`;
    }))})`);
};

export const centeredConicShape = (rows: string[][]) => cross(rows[1].map((value, i) => sub(value, rows[0][i])), rows[2].map((value, i) => sub(value, rows[0][i])));

const ninePointConic: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d] = args.map((arg) => arg.expression);
  const coefficients = bind([`((${a})+(${b})+(${c})+(${d}))/4`], allocate, ([center]) =>
    bind([`((${a})+(${b}))/2-${center}`, `((${a})+(${c}))/2-${center}`, `((${a})+(${d}))/2-${center}`], allocate, (points) => {
      const rows = points.map((p) => [`x(${p})^2`, `y(${p})^2`, `x(${p})*y(${p})`]);
      return bind(centeredConicShape(rows), allocate, (shape) => {
        const constant = `-${add(shape.map((coefficient, i) => mul(coefficient, rows[0][i])))}`;
        return coefficientList(translatedConicCoefficients([shape[0], shape[1], constant, shape[2], '0', '0'], center));
      });
    }));
  return `Conic(${coefficients})`;
};

export const QUADRANGLE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { qap2, qap4, qap5, ninePointConic };
