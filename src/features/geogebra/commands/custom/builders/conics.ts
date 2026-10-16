import type { ExpressionBuilder } from '../types';
import { bind, coefficientLine, independentOutputs } from '../algebra/homogeneous';

export const scimemiCoordinates = ([a, b, h, d, e]: string[], [x, y]: string[], inverse: boolean): string[] => {
  const t = `(${a}+${b})`; const r = `(${b}-${a})`; const delta = `((${a}-${b})^2+(${h})^2)`;
  if (!inverse) return [`(${r}*(${x})-(${h})*(${y})-(${d}))/${t}`, `(-(${h})*(${x})-${r}*(${y})-(${e}))/${t}`];
  const px = `(${t}*(${x})+(${d}))`; const py = `(${t}*(${y})+(${e}))`;
  return [`(${r}*${px}-(${h})*${py})/${delta}`, `(-(${h})*${px}-${r}*${py})/${delta}`];
};
const scimemi = (inverse: boolean): ExpressionBuilder => (args, allocate) => {
  const [p, q] = args.map((arg) => arg.expression);
  return bind([`Coefficients(${q})`], allocate, ([list]) =>
    bind([1, 2, 4, 5, 6].map((i) => `Element(${list},${i})`), allocate, (coefficients) => `(${scimemiCoordinates(coefficients, [`x(${p})`, `y(${p})`], inverse).join(',')})`));
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

export const CONIC_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = { commonTangents, scimemi: scimemi(false), inverseScimemi: scimemi(true) };
