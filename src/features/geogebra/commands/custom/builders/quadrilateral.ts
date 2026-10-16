import type { ExpressionBuilder, TypedExpression } from '../types';
import { add, bind, cross, homogeneous, independentOutputs, coefficientLine } from '../algebra/homogeneous';
import { circlePairRow, polynomialDeterminant, polynomialExpression } from '../algebra/polynomial';
import { conjugateConic, conjugatePolynomial } from './curveTransforms';

type Allocate = () => string;
type QLBody = (m: string, u: string, v: string, vertices: string[]) => string;
const withQL = (args: readonly TypedExpression[], allocate: Allocate, body: QLBody) => {
  const vertices = args.slice(0, 4).map((a) => a.expression);
  return bind(vertices, allocate, ([a, b, c, d]) =>
    bind([`(${a})+ToPoint(ToComplex((${b})-(${a}))*ToComplex((${d})-(${a}))/ToComplex((${b})+(${d})-(${c})-(${a})))`], allocate, ([m]) =>
      bind([`ToPoint(ToComplex((${a})-(${m}))*ToComplex((${c})-(${m})))`], allocate, ([k]) =>
        `If(x(${k})^2+y(${k})^2!=0,${body(m, `x(${k})`, `y(${k})`, [a, b, c, d])})`)));
};

const withNewton = (vertices: string[], m: string, allocate: Allocate, body: (n: string[], line: string) => string) => {
  const [a, b, c, d] = vertices;
  return bind([`Line(((${a})+(${c}))/2,((${b})+(${d}))/2)`], allocate, ([line]) =>
    bind([`x(${line})`, `y(${line})`, `z(${line})+x(${line})*x(${m})+y(${line})*y(${m})`], allocate, (n) => body(n, line)));
};
const translatedConic = (m: string, coefficients: string[]) => `Translate(Conic({${coefficients.join(',')}}),Vector(${m}))`;
const imageLine = ([nx, ny, c]: string[], u: string, v: string) => [c, c, '0', '0', `${u}*${nx}+${v}*${ny}`, `${v}*${nx}-${u}*${ny}`];

const qlTransform: ExpressionBuilder = (args, allocate) => withQL(args, allocate, (m, u, v) => {
  const object = args[4]; const p = object.expression;
  if (object.type === 'point') return `(${m})+ToPoint(ToComplex((${u},${v}))/ToComplex((${p})-(${m})))`;
  if (['line', 'segment', 'ray'].includes(object.type)) return bind(homogeneous(object), allocate, ([a, b, c]) =>
    translatedConic(m, imageLine([a, b, `${c}+${a}*x(${m})+${b}*y(${m})`], u, v)));
  if (object.type === 'circle') return bind([`Center(${p})`, `Radius(${p})`], allocate, ([o, r]) =>
    bind([`x(${o})-x(${m})`, `y(${o})-y(${m})`], allocate, ([x, y]) => {
      const constant = `(${x}^2+${y}^2-${r}^2)`;
      return translatedConic(m, [constant, constant, `${u}^2+${v}^2`, '0', `-2*(${u}*${x}+${v}*${y})`, `-2*(${v}*${x}-${u}*${y})`]);
    }));
  return object.type === 'conic' ? conjugateConic(p, m, u, v, allocate) : conjugatePolynomial(p, m, u, v, allocate);
});

const qlPair = (kind: number): ExpressionBuilder => (args, allocate) => {
  const output = (index: number | string) => withQL(args, allocate, (m, u, v, vertices) => {
    const [a, b, c, d] = vertices;
    if (kind === 3) return `(${m})+(3-2*(${index}))*ToPoint(sqrt(ToComplex((${u},${v}))))`;
    if (kind === 2) return withNewton(vertices, m, allocate, (n, line) => `Intersect(${line},${translatedConic(m, imageLine(n, u, v))},${index})`);
    return `Intersect(Circle(((${a})+(${c}))/2,Distance(${a},${c})/2),Circle(((${b})+(${d}))/2,Distance(${b},${d})/2),${index})`;
  });
  const index = args[4]?.expression;
  return index ? `If((${index})==floor(${index})&&(${index})>=1&&(${index})<=2,${output(index)})` : independentOutputs([output(1), output(2)]);
};

const withCenters = (args: readonly TypedExpression[], allocate: Allocate, body: (centers: string[]) => string) => {
  const [a, b, c, d] = args.slice(0, 4).map((arg) => arg.expression);
  return bind([`Intersect(Line(${a},${b}),Line(${c},${d}))`, `Intersect(Line(${b},${c}),Line(${d},${a}))`], allocate, ([e, f]) =>
    bind([[a, b, f], [b, c, e], [c, d, f], [d, a, e]].map((tri) => `TriangleCenter(${tri.join(',')},3)`), allocate, body));
};
const qlCenters = (kind: number): ExpressionBuilder => (args, allocate) => withCenters(args, allocate, (os) => {
  if (kind === 6) return `${add(os)}/4`;
  return bind([`TriangleCenter(${os.slice(0, 3).join(',')},3)`], allocate, ([o]) => kind === 4 ? o : `${add(os)}/2-(${o})`);
});
const miquelCircle: ExpressionBuilder = (args, allocate) => withCenters(args, allocate, (os) => `Circle(${os.slice(0, 3).join(',')})`);

const qlp20: ExpressionBuilder = (args, allocate) => withQL(args, allocate, (m, u, v, vertices) =>
  withNewton(vertices, m, allocate, ([a, b], line) =>
    `Intersect(${line},${coefficientLine([`${u}*${a}+${v}*${b}`, `${v}*${a}-${u}*${b}`, `-(${u}*${a}+${v}*${b})*x(${m})-(${v}*${a}-${u}*${b})*y(${m})`], allocate)})`));

const midpointCubic = (m: string, u: string, v: string, [a, b, c]: string[]) => {
  const x = `(x-x(${m}))`; const y = `(y-y(${m}))`;
  return `ImplicitCurve((${a}*${x}+${b}*${y}+2*${c})*(${x}^2+${y}^2)+${a}*(${u}*${x}+${v}*${y})+${b}*(${v}*${x}-${u}*${y}))`;
};
const qlCubic: ExpressionBuilder = (args, allocate) => {
  if (args.length === 4) return withQL(args, allocate, (m, u, v, vertices) => withNewton(vertices, m, allocate, (n) => midpointCubic(m, u, v, n)));
  const [a, b] = args.map((arg) => arg.expression);
  return bind([`(${b})-(${a})`, ...homogeneous(args[2])], allocate, ([e, nx, ny, c]) =>
    `${midpointCubic(a, `(x(${e})^2-y(${e})^2)`, `(2*x(${e})*y(${e}))`, [nx, ny, `${c}+${nx}*x(${a})+${ny}*y(${a})`])}`);
};

const qlQuartic: ExpressionBuilder = (args, allocate) => {
  const vs = args.slice(0, 4).map((arg) => arg.expression);
  return bind([`${add(vs)}/4`], allocate, ([origin]) =>
    bind([`sqrt((${vs.map((p) => `Distance(${p},${origin})^2`).join('+')})/4)`], allocate, ([scale]) =>
      bind(vs.map((p) => `((${p})-${origin})/${scale}`), allocate, (normalized) =>
        bind(normalized.flatMap((p) => [`x(${p})`, `y(${p})`]), allocate, (values) => {
          const ps = Array.from({ length: 4 }, (_, i) => [...values.slice(2 * i, 2 * i + 2), '1']);
          return bind(ps.flatMap((p, i) => i < 2 ? cross(p, ps[i + 1]) : []), allocate, (adjacent) => {
            const ab = adjacent.slice(0, 3); const bc = adjacent.slice(3, 6);
            return bind([...cross(ab, cross(ps[2], ps[3])), ...cross(bc, cross(ps[3], ps[0]))], allocate, (opposite) => {
              const rows = [circlePairRow(ps[0].slice(0, 2), ps[2].slice(0, 2)), circlePairRow(ps[1].slice(0, 2), ps[3].slice(0, 2)), circlePairRow(opposite.slice(0, 3), opposite.slice(3))];
              // Bind scalar row coefficients before multiplying the polynomial rows.
              const entriesByRow = rows.map((row) => row.map((p) => [...p]));
              return bind(entriesByRow.flatMap((row) => row.flatMap((p) => p.map(([, c]) => c))), allocate, (cs) => {
                let cursor = 0;
                const bound = entriesByRow.map((row) => row.map((p) => new Map(p.map(([key]) => [key, cs[cursor++]]))));
                const determinant = polynomialDeterminant(bound);
                // All three circles contain X. Degree-five terms cancel identically.
                const entries = [...determinant].filter(([k]) => k.split(',').map(Number).reduce((s, v) => s + v, 0) <= 4);
                return bind(entries.map(([, v]) => v), allocate, (coefficients) => {
                  const poly = polynomialExpression(new Map(entries.map(([key], i) => [key, coefficients[i]])));
                  return `If(${add(coefficients.map((v) => `${v}^2`))}!=0,Translate(Dilate(ImplicitCurve(${poly}),${scale},(0,0)),Vector(${origin})))`;
                });
              });
            });
          });
        }))));
};

export const QUADRILATERAL_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  qlTransform, qlPlucker: qlPair(1), qlNewtonPair: qlPair(2), qlFixedPair: qlPair(3),
  qlMiquelCircle: miquelCircle, qlMiquelCenter: qlCenters(4), qlClawsonCenter: qlCenters(5), qlDimidiumCenter: qlCenters(6),
  qlp20, qlCubic, qlQuartic,
};
