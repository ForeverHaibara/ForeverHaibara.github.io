import recipesJson from '../generated/relatedCurves.json';
import records from '../data/related-curves/curves.json';
import { add, bind, squaredNorm, triangleSideSquares } from '../algebra/homogeneous';
import type { ExpressionBuilder } from '../types';

interface Recipe {
  degree: number;
  locals: string[][];
  coefficients: string[];
  monomials: number[][];
  terms: Array<[number, number, string]>;
}
const recipes = recipesJson as unknown as Record<string, Recipe>;
export const gibertCurveRecords = records;
const supported = records.map((record) => record.id).join(', ');

export const normalizeGibertId = (literal: string): string => {
  if (/^[1-9]\d*$/u.test(literal) && Number.isSafeInteger(Number(literal)))
    return `Q${literal.padStart(3, '0')}`;
  if (/^"(?:\\.|[^"\\])*"$/u.test(literal)) {
    const value: unknown = JSON.parse(literal);
    if (typeof value === 'string' && /^Q\d{3,}(?:-?[A-Z][A-Z0-9-]*)?$/iu.test(value)) return value.toUpperCase().replace(/^(Q\d{3,})-([A-Z])$/u, '$1$2');
  }
  throw new Error('Invalid Gibert curve ID. Use a positive integer literal or a quoted ID such as "Q012".');
};

/** Only substitute names in generated arithmetic; never evaluate database text. */
const substitute = (source: string, bindings: ReadonlyMap<string, string>) => source.replace(/\b[a-z]\w*\b/gu, (name) => {
  const value = bindings.get(name);
  if (!value) throw new Error(`Unknown generated curve coefficient ${name}.`);
  return `(${value})`;
});

export const gibertCurve: ExpressionBuilder = (args, allocate) => {
  const id = normalizeGibertId(args[3].literal!);
  if (id === 'Q036') throw new Error('Q036 is a family; use "Q036A", "Q036B" or "Q036C".');
  if (['Q000', 'Q035'].includes(id))
    throw new Error(`${id} represents a family of curves; its variants have not been implemented. Supported: ${supported}.`);
  const recipe = recipes[id];
  if (!recipe) throw new Error(`${id} is not implemented. Supported: ${supported}.`);
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const frame = vertices.flatMap((_, i) => {
    const b = vertices[(i + 1) % 3], c = vertices[(i + 2) % 3];
    return [`y(${b})-y(${c})`, `x(${c})-x(${b})`, `x(${b})*y(${c})-y(${b})*x(${c})`];
  });
  return bind(triangleSideSquares(vertices), allocate, (sides) => {
    const bindings = new Map(['a2', 'b2', 'c2'].map((name, i) => [name, sides[i]]));
    ['a', 'b', 'c'].forEach((name, i) => bindings.set(name, `sqrt(${sides[i]})`));
    const locals = (index: number): string => {
      if (index < recipe.locals.length) {
        const [name, value] = recipe.locals[index];
        return bind([substitute(value, bindings)], allocate, ([local]) => {
          bindings.set(name, local);
          return locals(index + 1);
        }, 'number');
      }
      return bind(recipe.coefficients.map((value) => substitute(value, bindings)), allocate, (cs) => {
        cs.forEach((value, i) => bindings.set(`k${i}`, value));
        return bind(frame, allocate, (linear) => {
          linear.forEach((value, i) => bindings.set(`p${i}`, value));
          return bind(recipe.terms.map(([, , value]) => substitute(value, bindings)), allocate, (coefficients) => {
            const polynomial = add(recipe.terms.map(([i, j], n) => `(${coefficients[n]})*x^${i}*y^${j}`));
            const valid = vertices.map((v) => `IsDefined(${v})`).join('&&')
              + `&&!AreCollinear(${vertices.join(',')})&&${squaredNorm(coefficients)}!=0`;
            return `If(${valid},ImplicitCurve(${polynomial}))`;
          }, 'number');
        }, 'number');
      }, 'number');
    };
    return locals(0);
  }, 'number');
};
