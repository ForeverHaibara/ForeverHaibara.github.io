import type { ExpressionBuilder } from '../types';
import source from '../data/triangle-centers/recipes.txt?raw';

type Recipe = { operation: 'M' | 'R' | 'J'; references: number[] };
const recipes = new Map<number, Recipe>();
for (const row of source.trim().split(/\r?\n/u)) {
  const [idText, operation, ...referenceText] = row.split(' ');
  const id = Number(idText);
  const references = referenceText.map(Number);
  if (!Number.isSafeInteger(id) || id <= 3053 || recipes.has(id)
    || !['M', 'R', 'J'].includes(operation)
    || references.length !== (operation === 'J' ? 4 : 2)
    || references.some((reference) => !Number.isSafeInteger(reference) || reference < 1 || reference >= id))
    throw new Error(`Invalid triangle center recipe: ${row}`);
  recipes.set(id, { operation: operation as Recipe['operation'], references });
}

export const triangleCenter: ExpressionBuilder = (args) => {
  const id = Number(args[3].literal);
  if (!Number.isSafeInteger(id) || id <= 3053) throw new Error('Extended TriangleCenter requires an integer literal above 3053.');
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const visiting = new Set<number>();
  const render = (number: number): string => {
    if (number <= 3053) return `TriangleCenter(${vertices.join(',')},${number})`;
    const recipe = recipes.get(number);
    if (!recipe) throw new Error(`Triangle center X(${number}) is not implemented.`);
    if (visiting.has(number)) throw new Error(`Cyclic triangle center recipe at X(${number}).`);
    visiting.add(number);
    try {
      const points = recipe.references.map(render);
      if (recipe.operation === 'M') return `Midpoint(${points[0]},${points[1]})`;
      if (recipe.operation === 'R') return `Reflect(${points[0]},${points[1]})`;
      return `Intersect(Line(${points[0]},${points[1]}),Line(${points[2]},${points[3]}))`;
    } finally { visiting.delete(number); }
  };
  return render(id);
};
