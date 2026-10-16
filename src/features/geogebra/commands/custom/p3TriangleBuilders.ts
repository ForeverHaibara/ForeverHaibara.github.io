import type { ExpressionBuilder } from './types';
import { add, mul, bind, cross, homogeneous, triangleAreas, barycentricPoint, barycentricConic, coefficientLine, matrix } from './expressionGeometry';

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);
const sumSquares = (values: string[]) => add(values.map((v) => `(${v})^2`));
const point = ([x, y, z]: string[]) => `((${x})/(${z}),(${y})/(${z}))`;
const sides = ([a, b, c]: string[]) => [b, c, a].map((p, i) => `Distance(${p},${[c, a, b][i]})^2`);

const orthicAxis: ExpressionBuilder = (args, allocate) => {
  const vertices = args.map(homogeneous);
  return bind(sides(expressions(args)), allocate, (s) => {
    const weights = s.map((v, i) => `(${s[(i + 1) % 3]}+${s[(i + 2) % 3]}-${v})`);
    const lines = vertices.map((_, i) => cross(vertices[(i + 1) % 3], vertices[(i + 2) % 3]));
    return `If(!AreCollinear(${expressions(args).join(',')}),${coefficientLine([0, 1, 2].map((j) => add(weights.map((w, i) => mul(w, lines[i][j])))), allocate)})`;
  });
};

const stammler: ExpressionBuilder = (args, allocate) => bind(sides(expressions(args)), allocate, (s) =>
  barycentricConic(expressions(args), [...s.map((v, i) => `((${s[(i + 1) % 3]})-(${s[(i + 2) % 3]}))/(${v})`), '0', '0', '0']));

const liangZelich: ExpressionBuilder = (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...sides(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`], allocate, (values) => {
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
  return bind([...sides(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`, `TriangleCenter(${vertices.join(',')},4)`], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3, 6); const o = values[6]; const h = values[7];
    return bind(s.map((v, i) => mul(v, p[(i + 1) % 3], p[(i + 2) % 3])), allocate, (weights) =>
      bind([add(weights.map((w, i) => mul(w, `x(${vertices[i]})`))), add(weights.map((w, i) => mul(w, `y(${vertices[i]})`))), add(weights)], allocate, (q) => {
        const input = homogeneous(args[3]);
        return bind([...cross([`x(${o})`, `y(${o})`, '1'], psi ? q : input), ...cross([`x(${h})`, `y(${h})`, '1'], psi ? input : q)], allocate, (lines) =>
          `If(!AreCollinear(${vertices.join(',')}),${point(cross(lines.slice(0, 3), lines.slice(3)))})`);
      }));
  });
};

export const scimemiCoordinates = ([a, b, h, d, e]: string[], [x, y]: string[], inverse: boolean): string[] => {
  const t = `(${a}+${b})`; const r = `(${b}-${a})`; const delta = `((${a}-${b})^2+(${h})^2)`;
  if (!inverse) return [`(${r}*(${x})-(${h})*(${y})-(${d}))/${t}`, `(-(${h})*(${x})-${r}*(${y})-(${e}))/${t}`];
  const px = `(${t}*(${x})+(${d}))`; const py = `(${t}*(${y})+(${e}))`;
  return [`(${r}*${px}-(${h})*${py})/${delta}`, `(-(${h})*${px}-${r}*${py})/${delta}`];
};
const scimemi = (inverse: boolean): ExpressionBuilder => (args, allocate) => {
  const [p, q] = expressions(args);
  return bind([`Coefficients(${q})`], allocate, ([list]) =>
    bind([1, 2, 4, 5, 6].map((i) => `Element(${list},${i})`), allocate, (coefficients) => `(${scimemiCoordinates(coefficients, [`x(${p})`, `y(${p})`], inverse).join(',')})`));
};

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
  return bind([...sides(vertices), ...triangleAreas(expressions(args)), `TriangleCenter(${vertices.join(',')},3)`], allocate, (values) => {
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

/** Six cyclic yz*(r*y-q*z) coefficients of QA-Cu1. */
export const qaCubicCoefficients = (s: string[], p: string[], t: string[]) => [0, 1, 2].flatMap((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return [mul(s[i], t[i], p[k]), `-${mul(s[i], t[i], p[j])}`];
});

const triangleCubic = (orthopivotal: boolean): ExpressionBuilder => (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...sides(vertices), ...triangleAreas(expressions(args))], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3); const xyz = ['A', 'B', 'C'];
    if (orthopivotal) {
      const coefficients = p.flatMap((v, i) => {
        const j = (i + 1) % 3; const k = (i + 2) % 3;
        return [`(${s[k]}*${v}-(${s[k]}+${s[i]}-${s[j]})*${p[k]})`,
          `-(${s[j]}*${v}-(${s[i]}+${s[j]}-${s[k]})*${p[j]})`];
      });
      return bind(coefficients, allocate, (cs) => {
        const terms = p.flatMap((_, i) => [mul(cs[2 * i], xyz[i], `${xyz[(i + 1) % 3]}^2`), mul(cs[2 * i + 1], xyz[i], `${xyz[(i + 2) % 3]}^2`)]);
        return `If(!AreCollinear(${vertices.join(',')})&&${sumSquares(cs)}!=0,TriangleCurve(${vertices.join(',')},${add(terms)}=0))`;
      });
    }
    return bind(p.map((v, i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      return `${s[i]}*(${v}+${p[j]})*(${v}+${p[k]})-${s[j]}*${v}*(${v}+${p[j]})-${s[k]}*${v}*(${v}+${p[k]})`;
    }), allocate, (t) => {
      const coefficients = qaCubicCoefficients(s, p, t);
      // Keep cyclic pairs intact: yz*(r*y-q*z), zx*(p*z-r*x), xy*(q*x-p*y).
      const terms = p.flatMap((_, i) => {
        const j = (i + 1) % 3; const k = (i + 2) % 3;
        return [mul(coefficients[2 * i], `${xyz[j]}^2`, xyz[k]), mul(coefficients[2 * i + 1], xyz[j], `${xyz[k]}^2`)];
      });
      return `If(!AreCollinear(${vertices.join(',')})&&${sumSquares(coefficients)}!=0,TriangleCurve(${vertices.join(',')},${add(terms)}=0))`;
    });
  });
};

const orthopolar: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, p] = expressions(args);
  const xy = (v: string) => [`x(${v})`, `y(${v})`];
  const dot = (u: string[], v: string[]) => add(u.map((x, i) => mul(x, v[i])));
  return bind([`(${c})-(${b})`, `(${a})-(${c})`, `(${p})-(${a})`, `(${p})-(${b})`, `(TriangleCenter(${a},${b},${c},4)+(${p}))/2`], allocate, ([l, m, pa, pb, n]) => {
    const determinant = `x(${l})*y(${m})-y(${l})*x(${m})`;
    const solve = (v: string[]) => [`((${v[0]})*y(${m})-y(${l})*(${v[1]}))/(2*(${determinant}))`, `(x(${l})*(${v[1]})-(${v[0]})*x(${m}))/(2*(${determinant}))`];
    const cos = [dot(xy(l), [`x(${pa})`, `-y(${pa})`]), dot(xy(m), [`x(${pb})`, `-y(${pb})`])];
    const sin = [dot(xy(l), [`y(${pa})`, `x(${pa})`]), dot(xy(m), [`y(${pb})`, `x(${pb})`])];
    return bind([...solve(cos), ...solve(sin)], allocate, ([ux, uy, vx, vy]) => {
      const det = `(${ux}*${vy}-${uy}*${vx})`;
      return `Translate(Conic({${vy}^2+${uy}^2,${vx}^2+${ux}^2,-${det}^2,-2*(${vx}*${vy}+${ux}*${uy}),0,0}),Vector(${n}))`;
    });
  });
};

export const P3_TRIANGLE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  orthicAxis, stammler, liangZelich, cundyPhi: cundyParry(false), cundyPsi: cundyParry(true),
  scimemi: scimemi(false), inverseScimemi: scimemi(true), qap2, qap4, qap5,
  qaCubic: triangleCubic(false), orthopivotal: triangleCubic(true), orthopolar,
};
