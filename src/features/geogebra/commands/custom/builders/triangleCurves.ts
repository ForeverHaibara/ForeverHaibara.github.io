import type { ExpressionBuilder } from '../types';
import { add, mul, bind, triangleAreas, triangleSideSquares, squaredNorm } from '../algebra/homogeneous';

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);

/** Six cyclic yz*(r*y-q*z) coefficients of QA-Cu1. */
export const qaCubicCoefficients = (s: string[], p: string[], t: string[]) => [0, 1, 2].flatMap((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return [mul(s[i], t[i], p[k]), `-${mul(s[i], t[i], p[j])}`];
});

const triangleCubic = (orthopivotal: boolean): ExpressionBuilder => (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  return bind([...triangleSideSquares(vertices), ...triangleAreas(expressions(args))], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3); const xyz = ['A', 'B', 'C'];
    if (orthopivotal) {
      const coefficients = p.flatMap((v, i) => {
        const j = (i + 1) % 3; const k = (i + 2) % 3;
        return [`(${s[k]}*${v}-(${s[k]}+${s[i]}-${s[j]})*${p[k]})`,
          `-(${s[j]}*${v}-(${s[i]}+${s[j]}-${s[k]})*${p[j]})`];
      });
      return bind(coefficients, allocate, (cs) => {
        const terms = p.flatMap((_, i) => [mul(cs[2 * i], xyz[i], `${xyz[(i + 1) % 3]}^2`), mul(cs[2 * i + 1], xyz[i], `${xyz[(i + 2) % 3]}^2`)]);
        return `If(!AreCollinear(${vertices.join(',')})&&${squaredNorm(cs)}!=0,TriangleCurve(${vertices.join(',')},${add(terms)}=0))`;
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
      return `If(!AreCollinear(${vertices.join(',')})&&${squaredNorm(coefficients)}!=0,TriangleCurve(${vertices.join(',')},${add(terms)}=0))`;
    });
  });
};

export const TRIANGLE_CURVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { qaCubic: triangleCubic(false), orthopivotal: triangleCubic(true) };
