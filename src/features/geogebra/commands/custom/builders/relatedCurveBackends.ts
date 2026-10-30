import circuitsJson from '../generated/relatedCurveCircuits.json';
import { add, bind, squaredNorm } from '../algebra/homogeneous';
import type { BindingAllocator } from '../algebra/homogeneous';
import type { BuiltExpression, TypedExpression } from '../types';

interface Circuit {
  degree: number;
  scalars: string[][];
  coefficients: string[];
}
export const similarityCurveCircuits = circuitsJson as unknown as Record<string, Circuit>;
export type RelatedCurveBackend = (
  id: string, args: readonly TypedExpression[], allocate: BindingAllocator,
) => string | BuiltExpression;

const render = (source: string, bindings: ReadonlyMap<string, string>) => source.replace(/\b[a-z]\w*\b/gu, (name) => {
  const value = bindings.get(name);
  if (!value) throw new Error(`Unknown circuit input ${name}.`);
  return `(${value})`;
});
export const triangularBasis = (degree: number): Array<[number, number]> => Array.from({ length: degree + 1 }, (_, n) =>
  Array.from({ length: n + 1 }, (_, i) => [i, n - i] as [number, number])).flat();
const choose = (n: number, k: number) => {
  let value = 1;
  for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
};
const power = (name: string, n: number) => n === 0 ? '1' : n === 1 ? `(${name})` : `(${name})^${n}`;
const sum = (terms: string[]) => terms.length ? add(terms) : '0';

/** Numeric coefficients of F(ex*x+ey*y,-ey*x+ex*y), separately by total degree. */
export const rotateCurveCoefficients = (
  coefficients: string[], basis: Array<[number, number]>, ex: string, ey: string,
): string[] => basis.map(([p, q]) => sum(basis.flatMap(([i, j], index) => {
    if (i + j !== p + q || coefficients[index] === '0') return [];
    const weights = new Map<number, number>();
    for (let k = Math.max(0, p - j); k <= Math.min(i, p); k++) {
      const exponent = 2 * k + j - p;
      weights.set(exponent, (weights.get(exponent) ?? 0) + choose(i, k) * choose(j, p - k) * (-1) ** (p - k));
    }
    const weight = sum([...weights].filter(([, n]) => n !== 0).map(([m, n]) =>
      `(${n})*${power(ex, m)}*${power(ey, i + j - m)}`));
    return weight === '0' ? [] : [`(${coefficients[index]})*(${weight})`];
  })));

/** Numeric coefficients of G(x-ax,y-ay), reusing the rotation-stage outputs. */
export const translateCurveCoefficients = (
  coefficients: string[], basis: Array<[number, number]>, ax: string, ay: string,
): string[] => basis.map(([p, q]) => sum(basis.flatMap(([i, j], index) =>
  i < p || j < q || coefficients[index] === '0' ? [] : [
    `(${coefficients[index]})*(${choose(i, p) * choose(j, q) * (-1) ** (i + j - p - q)})*${power(ax, i - p)}*${power(ay, j - q)}`])));

/** One bind group per stage; static zero coefficients need no auxiliary objects. */
const bindCoefficients = (values: string[], allocate: BindingAllocator, body: (names: string[]) => string): string => {
  const active = values.flatMap((value, i) => value === '0' ? [] : [i]);
  if (!active.length) return body(values);
  return bind(active.map(i => values[i]), allocate, (locals) => {
    const names = values.map(() => '0');
    active.forEach((index, i) => { names[index] = locals[i]; });
    return body(names);
  }, 'number');
};

const similarityPolynomial: RelatedCurveBackend = (id, args, allocate) => {
  const circuit = similarityCurveCircuits[id];
  if (!circuit) throw new Error(`${id} has no verified similarity polynomial circuit.`);
  const vertices = args.slice(0, 3).map(arg => arg.expression);
  const [a, b, c] = vertices;
  const basis = triangularBasis(circuit.degree);
  return bind([`x(${a})`, `y(${a})`, `x(${b})-x(${a})`, `y(${b})-y(${a})`], allocate, ([ax, ay, dx, dy]) =>
    bind([`${dx}^2+${dy}^2`], allocate, ([sq]) =>
      bind([`${dx}/${sq}`, `${dy}/${sq}`], allocate, ([ex, ey]) =>
        bind([
          `${ex}*(x(${c})-${ax})+${ey}*(y(${c})-${ay})`,
          `${ex}*(y(${c})-${ay})-${ey}*(x(${c})-${ax})`,
        ], allocate, ([t, h]) => {
          const bindings = new Map([['t', t], ['h', h]]);
          const step = (index: number): string => {
            if (index < circuit.scalars.length) {
              const [name, value] = circuit.scalars[index];
              return bind([render(value, bindings)], allocate, ([local]) => {
                bindings.set(name, local);
                return step(index + 1);
              }, 'number');
            }
            return bindCoefficients(circuit.coefficients.map(value => render(value, bindings)), allocate, local =>
              // Restore the length gauge lost in normalization. Without it,
              // native rounding can display a small nonzero equation as 0=0.
              // This factor depends only on ABC and cannot add curve branches.
              bind([squaredNorm(local), `${sq}^(${circuit.degree}/2)`], allocate, ([norm, scale]) =>
                bindCoefficients(rotateCurveCoefficients(local, basis, ex, ey), allocate, rotated =>
                  bindCoefficients(translateCurveCoefficients(rotated, basis, ax, ay), allocate, world => {
                    const polynomial = sum(basis.flatMap(([i, j], index) => world[index] === '0' ? [] : [
                      `(${scale})*(${world[index]})*${power('x', i)}*${power('y', j)}`,
                    ]));
                    const valid = vertices.map(v => `IsDefined(${v})`).join('&&')
                      + `&&!AreCollinear(${vertices.join(',')})&&${sq}!=0&&${norm}!=0`;
                    return `If(${valid},ImplicitCurve(${polynomial}))`;
                  })), 'number'));
          };
          return step(0);
        }, 'number'), 'number'), 'number'), 'number');
};

/** Opt-in implementations alongside the legacy world-coefficient recipe.
 * A hand-written construction can register another key here and select it in
 * one database record; it need not imitate the generated recipe format.
 */
export const RELATED_CURVE_BACKENDS: Readonly<Record<string, RelatedCurveBackend>> = { similarityPolynomial };
