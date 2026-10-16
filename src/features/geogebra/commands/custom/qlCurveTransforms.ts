import { add, bind, mul } from './expressionGeometry';

type Allocate = () => string;
export const QUARTIC_MONOMIALS: ReadonlyArray<readonly [number, number]> = Array.from({ length: 5 }, (_, n) =>
  Array.from({ length: n + 1 }, (_, j) => [n - j, j] as const)).flat();
const sum = (vs: string[]) => vs.length ? add(vs) : '0';
const choose = (n: number, k: number) => {
  let v = 1;
  for (let i = 1; i <= k; i++) v = v * (n - i + 1) / i;
  return v;
};

/** Coefficient of z^i conjugate(z)^j under x=(z+zb)/2, y=(z-zb)/(2i). */
export const complexBasisCoefficient = (coefficients: string[], monomials: ReadonlyArray<readonly [number, number]>, i: number, j: number): [string, string] => {
  const real: string[] = []; const imaginary: string[] = [];
  monomials.forEach(([a, b], index) => {
    if (a + b !== i + j) return;
    let weight = 0;
    for (let k = 0; k <= a; k++) {
      const l = i - k;
      if (l >= 0 && l <= b) weight += choose(a, k) * choose(b, l) * (-1) ** (b - l) / 2 ** (a + b);
    }
    if (weight) (b % 2 ? imaginary : real).push(mul(String(weight * [1, -1, -1, 1][b % 4]), coefficients[index]));
  });
  return [sum(real), sum(imaginary)];
};

const imagePolynomial = (coefficients: string[], monomials: ReadonlyArray<readonly [number, number]>, center: string, u: string, v: string, allocate: Allocate) => {
  const degree = Math.max(...monomials.map(([a, b]) => a + b));
  const pairs = Array.from({ length: degree + 1 }, (_, n) => Array.from({ length: Math.floor(n / 2) + 1 }, (_, j) => [n - j, j])).flat();
  return bind(pairs.flatMap(([i, j]) => complexBasisCoefficient(coefficients, monomials, i, j)), allocate, (components) =>
    bind(pairs.map(([i, j], index) => `ToPoint(ToComplex((${components[2 * index]},${components[2 * index + 1]}))*ToComplex((${u},${v}))^${i}*conjugate(ToComplex((${u},${v})))^${j})`), allocate, (images) => {
      const x = `(x-x(${center}))`; const y = `(y-y(${center}))`; const rho = `(${x}^2+${y}^2)`;
      const realPowers = ['1', x, `(${x}^2-${y}^2)`, `(${x}^3-3*${x}*${y}^2)`, `(${x}^4-6*${x}^2*${y}^2+${y}^4)`];
      const imaginaryPowers = ['0', y, `(2*${x}*${y})`, `(3*${x}^2*${y}-${y}^3)`, `(4*${x}^3*${y}-4*${x}*${y}^3)`];
      const polynomial = (m: number) => sum(pairs.flatMap(([i, j], index) => i > m ? [] : [
        i === j ? `x(${images[index]})*${rho}^${m - i}`
          : `2*(x(${images[index]})*${realPowers[i - j]}+y(${images[index]})*${imaginaryPowers[i - j]})*${rho}^${m - i}`,
      ]));
      // In complex coordinates inversion exchanges z^i*zb^j with z^(m-i)*zb^(m-j).
      // Choosing m=max(i,j) cancels every artificial rho factor, including dynamic
      // degree drops and circles. This is exact algebra, not a geometric branch choice.
      let result = '';
      for (let m = 1; m <= degree; m++) {
        const group = sum(pairs.flatMap(([i], index) => i === m ? [`${components[2 * index]}^2+${components[2 * index + 1]}^2`] : []));
        result = `If(${group}!=0,ImplicitCurve(${polynomial(m)})${result ? `,${result}` : ''})`;
      }
      return result;
    }));
};

export const conjugateConic = (q: string, center: string, u: string, v: string, allocate: Allocate) =>
  bind([`Coefficients(${q})`], allocate, ([list]) =>
    bind([1, 2, 3, 4, 5, 6].map((i) => `Element(${list},${i})`), allocate, ([a, b, f, h, d, e]) =>
      bind([`${a}*x(${center})^2+${b}*y(${center})^2+${h}*x(${center})*y(${center})+${d}*x(${center})+${e}*y(${center})+${f}`,
        `2*${a}*x(${center})+${h}*y(${center})+${d}`, `2*${b}*y(${center})+${h}*x(${center})+${e}`, a, h, b], allocate,
      (coefficients) => imagePolynomial(coefficients, QUARTIC_MONOMIALS.slice(0, 6), center, u, v, allocate))));

export const conjugatePolynomial = (curve: string, center: string, u: string, v: string, allocate: Allocate) =>
  bind([`LeftSide(${curve})-RightSide(${curve})`], allocate, ([f]) =>
    bind([`${f}(x+x(${center}),y+y(${center}))`], allocate, ([local]) =>
      bind([`Join(Reverse(Coefficients(${local}(x,x^5)+0*x)),{${Array(21).fill('0').join(',')}})`], allocate, ([encoded]) =>
        bind(QUARTIC_MONOMIALS.map(([i, j]) => `Element(${encoded},${i + 5 * j + 1})`), allocate, (coefficients) => {
          const reconstructed = add(coefficients.map((c, k) => mul(c, `x^${QUARTIC_MONOMIALS[k][0]}`, `y^${QUARTIC_MONOMIALS[k][1]}`)));
          return `If(AreEqual(${local},${reconstructed}),${imagePolynomial(coefficients, QUARTIC_MONOMIALS, center, u, v, allocate)})`;
        }))));
