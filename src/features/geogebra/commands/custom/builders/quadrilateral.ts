import type { ExpressionBuilder, TypedExpression } from '../types';
import { add, bind, cross, homogeneous, independentOutputs, coefficientLine, coefficientList, supportingLine } from '../algebra/homogeneous';
import { circlePairRow, //polynomialExpression, polynomialDeterminant,
   coaxalQuarticCoefficients, radialQuarticExpression, polynomialCurve } from '../algebra/polynomial';
import { conjugateConicData, conjugatePolynomialData, conjugateImagePolynomial, nativePolynomialEligible } from './curves';

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

const clawsonSchmidtConjugation: ExpressionBuilder = (args, allocate) => {
  const object = args[4]; const p = object.expression;
  if (object.type === 'point') return withQL(args, allocate, (m, u, v) => `(${m})+ToPoint(ToComplex((${u},${v}))/ToComplex((${p})-(${m})))`);
  // Only the two points defining the transformation pass through local bindings.
  // The square-root sign changes neither its axis nor its inversion circle.
  const m = withQL(args, allocate, (m) => m);
  const fixed = withQL(args, allocate, (m, u, v) => `(${m})+ToPoint(sqrt(ToComplex((${u},${v}))))`);
  const support = ['segment', 'ray'].includes(object.type) ? supportingLine(object) : p;
  const implicit = object.type === 'conic' ? `ImplicitCurve(LeftSide(${p})-RightSide(${p}))` : support;
  // Reflection and inversion commute here. Reflection first avoids the engine's
  // reflection bug on a line produced by circle inversion.
  const transform = (source: string) => `Reflect(Reflect(${source},Line(${m},${fixed})),Circle(${m},${fixed}))`;
  // Native line/circle inversion has a fixed GeoConic class, including single lines.
  if (['line', 'segment', 'ray', 'circle'].includes(object.type)) return transform(implicit);
  const eligible = object.type === 'conic'
    ? bind([`Coefficients(${p})`], allocate, ([cs]) => `Element(${cs},1)!=Element(${cs},2)||Element(${cs},4)!=0`)
    : nativePolynomialEligible(p, allocate);
  const sourceValid = object.type === 'conic' ? `IsDefined(${p})` : nativePolynomialEligible(p, allocate, true);
  const valid = `IsDefined(${m})&&IsDefined(${fixed})&&(${sourceValid})`;
  const reduced = withQL(args, allocate, (m, u, v) => object.type === 'conic'
    ? conjugateConicData(p, m, u, v, allocate) : conjugatePolynomialData(p, m, u, v, allocate));
  // Guard the inputs, not just the selected result: GeoGebra otherwise updates
  // both expensive image curves even when one branch is never displayed.
  const native = transform(`If(${eligible},${implicit})`);
  const polynomial = conjugateImagePolynomial(reduced, object.type === 'conic' ? 2 : 4, allocate);
  const reducedCurve = polynomialCurve(`If(!(${eligible})&&(${valid}),${polynomial},1+0*x+0*y)`);
  return `If(${valid},If(${eligible},${native},${reducedCurve}))`;
};

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
    bind([[a, b, f], [b, c, e], [c, d, f], [d, a, e]].map((tri) => `TriangleCenter(${tri.join(',')},3)`), allocate, body, 'point'), 'point');
};
const qlCenters = (kind: number): ExpressionBuilder => (args, allocate) => withCenters(args, allocate, (os) => {
  if (kind === 6) return `${add(os)}/4`;
  return bind([`TriangleCenter(${os.slice(0, 3).join(',')},3)`], allocate, ([o]) => kind === 4 ? o : `${add(os)}/2-(${o})`);
});
const miquelCircle: ExpressionBuilder = (args, allocate) => withCenters(args, allocate, (os) => `Circle(${os.slice(0, 3).join(',')})`);

const qlp20: ExpressionBuilder = (args, allocate) => withQL(args, allocate, (m, u, v, vertices) =>
  withNewton(vertices, m, allocate, ([a, b], line) =>
    `Intersect(${line},${coefficientLine([`${u}*${a}+${v}*${b}`, `${v}*${a}-${u}*${b}`, `-(${u}*${a}+${v}*${b})*x(${m})-(${v}*${a}-${u}*${b})*y(${m})`], allocate)})`));

const midpointPolynomial = (m: string, u: string, v: string, [a, b, c]: string[]) => {
  const x = `(x-x(${m}))`; const y = `(y-y(${m}))`;
  return `(${a}*${x}+${b}*${y}+2*(${c}))*(${x}^2+${y}^2)+${a}*(${u}*${x}+${v}*${y})+${b}*(${v}*${x}-${u}*${y})`;
};
const midpointCubic = (m: string, u: string, v: string, n: string[]) => `ImplicitCurve(${midpointPolynomial(m, u, v, n)})`;
/** Directed angles APB = DPC (mod pi): cross(PA,PB)*dot(PD,PC) - cross(PD,PC)*dot(PA,PB).
 * Expand each cross product to degree one; no auxiliary geometry or denominators.
 */
const qlCu1FromFourVertices: ExpressionBuilder = (args) => {
  const [a, b, c, d] = args.map(({ expression: p }) => [`x(${p})`, `y(${p})`]);
  const angle = ([ax, ay]: string[], [bx, by]: string[]) => [
    `((${ay}-${by})*x+(${bx}-${ax})*y+${ax}*${by}-${ay}*${bx})`,
    `(x^2+y^2-(${ax}+${bx})*x-(${ay}+${by})*y+${ax}*${bx}+${ay}*${by})`,
  ];
  const [lab, qab] = angle(a, b); const [ldc, qdc] = angle(d, c);
  return `ImplicitCurve(${lab}*${qdc}-${ldc}*${qab})`;
};
const qlCu1FromPointPairAndLine: ExpressionBuilder = (args, allocate) => {
  if (args.length === 4) return withQL(args, allocate, (m, u, v, vertices) => withNewton(vertices, m, allocate, (n) => midpointCubic(m, u, v, n)));
  const [a, b] = args.map((arg) => arg.expression);
  const valid = `IsDefined(${a})&&IsDefined(${b})&&IsDefined(${supportingLine(args[2])})`;
  const polynomial = bind([`(${b})-(${a})`, ...homogeneous(args[2])], allocate, ([e, nx, ny, c]) =>
    midpointPolynomial(a, `(x(${e})^2-y(${e})^2)`, `(2*x(${e})*y(${e}))`, [nx, ny, `${c}+${nx}*x(${a})+${ny}*y(${a})`]));
  return `If(${valid},${polynomialCurve(`If(${valid},${polynomial},1+0*x+0*y)`)})`;
};

// const qlQu3FromFourVertices: ExpressionBuilder = (args, allocate) => {
//   const vs = args.slice(0, 4).map((arg) => arg.expression);
//   return bind([`${add(vs)}/4`], allocate, ([origin]) =>
//     bind([`sqrt((${vs.map((p) => `Distance(${p},${origin})^2`).join('+')})/4)`], allocate, ([scale]) =>
//       bind(vs.map((p) => `((${p})-${origin})/${scale}`), allocate, (normalized) =>
//         bind(normalized.flatMap((p) => [`x(${p})`, `y(${p})`]), allocate, (values) => {
//           const ps = Array.from({ length: 4 }, (_, i) => [...values.slice(2 * i, 2 * i + 2), '1']);
//           return bind(ps.flatMap((p, i) => i < 2 ? cross(p, ps[i + 1]) : []), allocate, (adjacent) => {
//             const ab = adjacent.slice(0, 3); const bc = adjacent.slice(3, 6);
//             return bind([...cross(ab, cross(ps[2], ps[3])), ...cross(bc, cross(ps[3], ps[0]))], allocate, (opposite) => {
//               const rows = [circlePairRow(ps[0].slice(0, 2), ps[2].slice(0, 2)), circlePairRow(ps[1].slice(0, 2), ps[3].slice(0, 2)), circlePairRow(opposite.slice(0, 3), opposite.slice(3))];
//               // Bind scalar row coefficients before multiplying the polynomial rows.
//               const entriesByRow = rows.map((row) => row.map((p) => [...p]));
//               return bind(entriesByRow.flatMap((row) => row.flatMap((p) => p.map(([, c]) => c))), allocate, (cs) => {
//                 let cursor = 0;
//                 const bound = entriesByRow.map((row) => row.map((p) => new Map(p.map(([key]) => [key, cs[cursor++]]))));
//                 const determinant = polynomialDeterminant(bound);
//                 // All three circles contain X. Degree-five terms cancel identically.
//                 const entries = [...determinant].filter(([k]) => k.split(',').map(Number).reduce((s, v) => s + v, 0) <= 4);
//                 return bind(entries.map(([, v]) => v), allocate, (coefficients) => {
//                   const poly = polynomialExpression(new Map(entries.map(([key], i) => [key, coefficients[i]])));
//                   return `If(${add(coefficients.map((v) => `${v}^2`))}!=0,Translate(Dilate(ImplicitCurve(${poly}),${scale},(0,0)),Vector(${origin})))`;
//                 });
//               });
//             });
//           });
//         }))));
// };

const qlQu3FromFourVertices: ExpressionBuilder = (args, allocate) => {
  const vs = args.slice(0, 4).map((arg) => arg.expression);
  // GeoGebra stores the arithmetic mean as a vector; the four normalized
  // differences are vectors too. Their coordinates remain valid x/y inputs.
  const data = bind([`${add(vs)}/4`], allocate, ([origin]) =>
    bind([`sqrt((${vs.map((p) => `Distance(${p},${origin})^2`).join('+')})/4)`], allocate, ([scale]) =>
      bind(vs.map((p) => `((${p})-${origin})/${scale}`), allocate, (normalized) =>
        bind(normalized.flatMap((p) => [`x(${p})`, `y(${p})`]), allocate, (values) => {
          const ps = Array.from({ length: 4 }, (_, i) => [...values.slice(2 * i, 2 * i + 2), '1']);
          return bind(ps.flatMap((p, i) => i < 2 ? cross(p, ps[i + 1]) : []), allocate, (adjacent) => {
            const ab = adjacent.slice(0, 3); const bc = adjacent.slice(3, 6);
            return bind([...cross(ab, cross(ps[2], ps[3])), ...cross(bc, cross(ps[3], ps[0]))], allocate, (opposite) => {
              const rows = [circlePairRow(ps[0].slice(0, 2), ps[2].slice(0, 2)), circlePairRow(ps[1].slice(0, 2), ps[3].slice(0, 2)), circlePairRow(opposite.slice(0, 3), opposite.slice(3))];
              const data = rows.map(([s, d, e]) => [s.get('1,0')!, s.get('0,1')!, s.get('0,0')!, d.get('0,1')!, d.get('0,0')!, e.get('0,0')!]);
              return bind(data.flat(), allocate, (cs) =>
                bind(coaxalQuarticCoefficients([cs.slice(0, 6), cs.slice(6, 12), cs.slice(12, 18)]), allocate, (coefficients) => {
                  return coefficientList([...coefficients, `x(${origin})`, `y(${origin})`, scale]);
                }, 'number'), 'number');
            }, 'number');
          }, 'number');
        }, 'number'), 'vector'), 'number'), 'vector');
  // One function binding outside the entire numerical pipeline. Returning a
  // function through every nested Zip still triggers expensive symbolic copies.
  const nonzero = bind([data], allocate, ([list]) => `${add(Array.from({ length: 9 }, (_, i) => `Element(${list},${i + 1})^2`))}!=0`, 'numberList');
  const polynomial = bind([data], allocate, ([list]) => {
    const values = Array.from({ length: 12 }, (_, i) => `Element(${list},${i + 1})`);
    const cs = values.slice(0, 9);
    return `If(${add(cs.map((v) => `${v}^2`))}!=0,${radialQuarticExpression(cs, `((x-${values[9]})/${values[11]})`, `((y-${values[10]})/${values[11]})`)},1+0*x+0*y)`;
  }, 'numberList');
  return `If(${vs.map((p) => `IsDefined(${p})`).join('&&')}&&(${nonzero}),${polynomialCurve(polynomial)})`;
};



export const QUADRILATERAL_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  qlTransform: clawsonSchmidtConjugation, qlPlucker: qlPair(1), qlNewtonPair: qlPair(2), qlFixedPair: qlPair(3),
  qlMiquelCircle: miquelCircle, qlMiquelCenter: qlCenters(4), qlClawsonCenter: qlCenters(5), qlDimidiumCenter: qlCenters(6),
  qlp20, qlCubic: qlCu1FromPointPairAndLine, qlCubicCoordinates: qlCu1FromFourVertices, qlQuartic: qlQu3FromFourVertices,
};
