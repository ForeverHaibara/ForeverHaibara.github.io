import type { ExpressionBuilder } from '../types';

type Recipe = { operation: 'M' | 'R' | 'J' | 'C' | 'A' | 'P'; references: number[] };
const chunkImports = import.meta.glob<string>('../data/triangle-centers/chunks/*.txt', { query: '?raw', import: 'default' });
const recipes = new Map<number, Recipe>();
const loaded = new Set<number>();
const loading = new Map<number, Promise<void>>();
const size = (operation: Recipe['operation']) => operation === 'J' ? 4 : operation === 'P' ? 3
  : operation === 'C' || operation === 'A' ? 1 : 2;

const loadChunk = async (id: number): Promise<void> => {
  const chunk = Math.floor(id / 1000);
  if (loaded.has(chunk)) return;
  const existing = loading.get(chunk);
  if (existing) return existing;
  const load = chunkImports[`../data/triangle-centers/chunks/${chunk}.txt`];
  if (!load) throw new Error(`Triangle center X(${id}) is not implemented.`);
  const promise = load().then((source) => {
    const parsed = new Map<number, Recipe>();
    for (const row of source.trim().split(/\r?\n/u)) {
      const [idText, opcode, ...referenceText] = row.trim().split(/\s+/u);
      const number = Number(idText);
      const references = referenceText.map(Number);
      const operation = opcode as Recipe['operation'];
      if (!Number.isSafeInteger(number) || Math.floor(number / 1000) !== chunk || number <= 3053
        || parsed.has(number) || recipes.has(number) || !['M', 'R', 'J', 'C', 'A', 'P'].includes(opcode)
        || references.length !== size(operation)
        || references.some((reference) => !Number.isSafeInteger(reference) || reference < 1 || reference === number))
        throw new Error(`Invalid triangle center recipe: ${row}`);
      parsed.set(number, { operation, references });
    }
    for (const [number, recipe] of parsed) recipes.set(number, recipe);
    loaded.add(chunk);
  }).finally(() => loading.delete(chunk));
  loading.set(chunk, promise);
  return promise;
};

/** Load just the selected recipe and its transitive non-native dependencies. */
export const prepareTriangleCenter = async (id: number, visiting = new Set<number>()): Promise<void> => {
  if (id <= 3053) return;
  await loadChunk(id);
  const recipe = recipes.get(id);
  if (!recipe) throw new Error(`Triangle center X(${id}) is not implemented.`);
  if (visiting.has(id)) throw new Error(`Cyclic triangle center recipe at X(${id}).`);
  visiting.add(id);
  try { for (const reference of recipe.references) await prepareTriangleCenter(reference, visiting); }
  finally { visiting.delete(id); }
};

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
      if (recipe.operation === 'P') return `ClosestPoint(Line(${points[1]},${points[2]}),${points[0]})`;
      if (recipe.operation === 'C' || recipe.operation === 'A') {
        const [a, b, c] = vertices;
        return recipe.operation === 'C' ? `((${a})+(${b})+(${c})-(${points[0]}))/2`
          : `(${a})+(${b})+(${c})-2*(${points[0]})`;
      }
      return `Intersect(Line(${points[0]},${points[1]}),Line(${points[2]},${points[3]}))`;
    } finally { visiting.delete(number); }
  };
  return render(id);
};
