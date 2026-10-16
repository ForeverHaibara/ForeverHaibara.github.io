import type { ExpressionBuilder } from '../types';
import { add, mul, bind, triangleAreas, triangleSideSquares, squaredNorm, barycentricVariables, coefficientList } from '../algebra/homogeneous';
import { polynomialCurve } from '../algebra/polynomial';

const expressions = (args: Parameters<ExpressionBuilder>[0]) => args.map((arg) => arg.expression);

/** Six cyclic yz*(r*y-q*z) coefficients of QA-Cu1. */
export const qaCubicCoefficients = (s: string[], p: string[], t: string[]) => [0, 1, 2].flatMap((i) => {
  const j = (i + 1) % 3; const k = (i + 2) % 3;
  return [mul(s[i], t[i], p[k]), `-${mul(s[i], t[i], p[j])}`];
});

const triangleCubic = (orthopivotal: boolean): ExpressionBuilder => (args, allocate) => {
  const vertices = expressions(args).slice(0, 3);
  const data = bind([...triangleSideSquares(vertices), ...triangleAreas(expressions(args))], allocate, (values) => {
    const s = values.slice(0, 3); const p = values.slice(3);
    if (orthopivotal) {
      const coefficients = p.flatMap((v, i) => {
        const j = (i + 1) % 3; const k = (i + 2) % 3;
        return [`(${s[k]}*${v}-(${s[k]}+${s[i]}-${s[j]})*${p[k]})`,
          `-(${s[j]}*${v}-(${s[i]}+${s[j]}-${s[k]})*${p[j]})`];
      });
      return coefficientList(coefficients);
    }
    return bind(p.map((v, i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      return `${s[i]}*(${v}+${p[j]})*(${v}+${p[k]})-${s[j]}*${v}*(${v}+${p[j]})-${s[k]}*${v}*(${v}+${p[k]})`;
    }), allocate, (t) => {
      return coefficientList(qaCubicCoefficients(s, p, t));
    });
  });
  const polynomial = bind([data], allocate, ([list]) => {
    const cs = Array.from({ length: 6 }, (_, i) => `Element(${list},${i + 1})`);
    const xyz = barycentricVariables(vertices);
    const terms = [0, 1, 2].flatMap((i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      // Keep QA's cyclic yz*(r*y-q*z) pairs intact.
      return orthopivotal ? [mul(cs[2*i], xyz[i], `${xyz[j]}^2`), mul(cs[2*i+1], xyz[i], `${xyz[k]}^2`)]
        : [mul(cs[2*i], `${xyz[j]}^2`, xyz[k]), mul(cs[2*i+1], xyz[j], `${xyz[k]}^2`)];
    });
    return `If(${squaredNorm(cs)}!=0,${add(terms)},1+0*x+0*y)`;
  });
  // An undefined function can still produce a defined GeoImplicitCurve in the
  // engine. Keep the all-zero guard on the final curve, outside every Zip.
  const nonzero = bind([data], allocate, ([list]) => `${squaredNorm(Array.from({ length: 6 }, (_, i) => `Element(${list},${i + 1})`))}!=0`);
  return `If(${expressions(args).map((p) => `IsDefined(${p})`).join('&&')}&&!AreCollinear(${vertices.join(',')})&&(${nonzero}),${polynomialCurve(polynomial)})`;
};

export const TRIANGLE_CURVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { qaCubic: triangleCubic(false), orthopivotal: triangleCubic(true) };
