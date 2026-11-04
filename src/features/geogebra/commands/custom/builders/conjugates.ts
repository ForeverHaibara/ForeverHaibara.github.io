import type { TypedExpression } from '../types';
import { bind, mul, triangleAreas } from '../algebra/homogeneous';

/** Shared point conjugation used by the public tools and ETC center recipes. */
export const conjugate = (isogonal: boolean) => (args: readonly TypedExpression[], allocate: () => string): string => {
  const [a, b, c, p] = args.map((arg) => arg.expression);
  // Signed area coordinates; products replace reciprocals and extend across triangle sidelines.
  return bind(triangleAreas([a, b, c, p]), allocate, ([u, v, w]) => {
    const weights = [mul(v, w), mul(w, u), mul(u, v)].map((weight, i) => isogonal ? mul(weight, `Distance(${[b, c, a][i]},${[c, a, b][i]})^2`) : weight);
    return `If((${u}+${v}+${w})!=0,${bind(weights, allocate, ([r, s, t]) => `(${r}*(${a})+${s}*(${b})+${t}*(${c}))/(${r}+${s}+${t})`)})`;
  });
};
