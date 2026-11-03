import type { ExpressionBuilder } from '../types';
import { conjugate } from './conjugates';
import { bind } from '../algebra/homogeneous';
import nativeStatusSource from '../data/triangle-centers/native-status.txt?raw';
import nativePatchSource from '../data/triangle-centers/native-patches.txt?raw';

const nativePatchIds = new Set(nativePatchSource.split(/\r?\n/u)
  .filter((row) => row.trim() && !row.trim().startsWith('#'))
  .map((row) => Number(row.trim().split(/\s+/u)[0])));
if ([...nativePatchIds].some((id) => !Number.isSafeInteger(id) || id < 1 || id > 3053)) {
  throw new Error('Invalid native TriangleCenter patch inventory.');
}
export const requiresTriangleCenterRecipe = (id: number): boolean => id > 3053 || nativePatchIds.has(id);

type Recipe = { operation: 'M' | 'R' | 'J' | 'I' | 'C' | 'A' | 'P' | 'G' | 'T' | 'V' | 'B' | 'F' | 'O'; references: number[]; formula?: string };
type CenterValue = { kind: 'point'; expression: string } | { kind: 'ideal'; from: string; to: string } | { kind: 'unknown-ideal' };
const nativeDirections = new Map<number, [number, number]>(nativeStatusSource.split(/\r?\n/u)
  .filter((row) => row.trim() && !row.trim().startsWith('#'))
  .map((row) => row.trim().split(/\s+/u).map(Number))
  .filter((fields) => fields.length === 3)
  .map(([id, from, to]) => [id, [from, to]]));
const chunkImports = import.meta.glob<string>('../data/triangle-centers/chunks/*.txt', { query: '?raw', import: 'default' });
const recipes = new Map<number, Recipe>();
const loaded = new Set<number>();
const loading = new Map<number, Promise<void>>();
const size = (operation: Recipe['operation']) => operation === 'B' ? 0
  : operation === 'J' ? 4 : ['P', 'O'].includes(operation) ? 3
  : ['C', 'A', 'G', 'T', 'V'].includes(operation) ? 1 : 2;
const rotation: Record<string, string> = { a: 'b', b: 'c', c: 'a', A: 'B', B: 'C', C: 'A',
  x: 'y', y: 'z', z: 'x',
  u: 'v', v: 'w', w: 'u',
  sa: 'sb', sb: 'sc', sc: 'sa', SA: 'SB', SB: 'SC', SC: 'SA' };
const coordinateNames = new Set(['a', 'b', 'c', 'A', 'B', 'C', 's', 'sa', 'sb', 'sc', 'S', 'SA', 'SB', 'SC', 'SW', 'E', 'F', 'pi',
  'r', 'R', 'sqrt', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'asinh', 'atan', 'ln', 'abs']);
const validFormula = (formula: string, pairDistance = false, sourceCoordinates = 0): boolean => /^[A-Za-z0-9_()+*/^,.-]+$/u.test(formula)
  && [...formula.matchAll(/[A-Za-z_]+/gu)].every(([name]) => coordinateNames.has(name) || pairDistance && name === 'd'
    || sourceCoordinates > 0 && ['x', 'y', 'z'].includes(name)
    || sourceCoordinates === 2 && ['u', 'v', 'w'].includes(name));

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
      const operation = opcode as Recipe['operation'];
      const pairs = opcode === 'F' ? referenceText.map((text) => text.split(':')) : [];
      const formula = opcode === 'B' ? referenceText[referenceText.length - 1] : opcode === 'F' ? pairs.map((pair) => pair[1]).join('|') : undefined;
      const references = opcode === 'F' ? pairs.map((pair) => Number(pair[0]))
        : opcode === 'B' ? referenceText.slice(0, -1).map(Number) : referenceText.map(Number);
      if (!Number.isSafeInteger(number) || Math.floor(number / 1000) !== chunk || !requiresTriangleCenterRecipe(number)
        || parsed.has(number) || recipes.has(number) || !['M', 'R', 'J', 'I', 'C', 'A', 'P', 'G', 'T', 'V', 'B', 'F', 'O'].includes(opcode)
        || (operation === 'F' ? references.length < 2 || references.length > 6 || new Set(references).size !== references.length || pairs.some((pair) => pair.length !== 2 || !pair[1] || !validFormula(pair[1], references.length === 2)) : references.length !== size(operation) && !(operation === 'I' && references.length === 0) && !(['R', 'V'].includes(operation) && references.length === 3) && !(operation === 'B' && [1, 2].includes(references.length)))
        || (opcode === 'B' && !formula)
        || (opcode === 'B' && formula !== undefined && (![1, 2, 3].includes(referenceText.length) || !validFormula(formula, false, references.length)))
        || references.some((reference) => !Number.isSafeInteger(reference) || reference < 1 || reference === number))
        throw new Error(`Invalid triangle center recipe: ${row}`);
      parsed.set(number, { operation, references, formula });
    }
    for (const [number, recipe] of parsed) recipes.set(number, recipe);
    loaded.add(chunk);
  }).finally(() => loading.delete(chunk));
  loading.set(chunk, promise);
  return promise;
};

/** Load the selected recipe and every dependency, including patched native IDs. */
export const prepareTriangleCenter = async (id: number, visiting = new Set<number>()): Promise<void> => {
  if (!requiresTriangleCenterRecipe(id)) return;
  await loadChunk(id);
  const recipe = recipes.get(id);
  if (!recipe) throw new Error(`Triangle center X(${id}) is not implemented.`);
  if (visiting.has(id)) throw new Error(`Cyclic triangle center recipe at X(${id}).`);
  visiting.add(id);
  try { for (const reference of recipe.references) await prepareTriangleCenter(reference, visiting); }
  finally { visiting.delete(id); }
};

export const triangleCenter: ExpressionBuilder = (args, allocate) => {
  const id = Number(args[3].literal);
  if (!Number.isSafeInteger(id) || !requiresTriangleCenterRecipe(id)) throw new Error('Custom TriangleCenter requires an extended or patched native integer literal.');
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const visiting = new Set<number>();
  const point = (expression: string): CenterValue => ({ kind: 'point', expression });
  const requirePoint = (value: CenterValue): string => {
    if (value.kind !== 'point') throw new Error('An ideal triangle center cannot be used as a finite point here.');
    return value.expression;
  };
  const line = (first: CenterValue, second: CenterValue): string => {
    if (first.kind === 'unknown-ideal' || second.kind === 'unknown-ideal') throw new Error('The ideal triangle center has no known direction.');
    if (first.kind === 'ideal' && second.kind === 'ideal') throw new Error('Two ideal centers determine the line at infinity.');
    if (first.kind === 'ideal') return `Line(${requirePoint(second)},Line(${first.from},${first.to}))`;
    if (second.kind === 'ideal') return `Line(${requirePoint(first)},Line(${second.from},${second.to}))`;
    return `Line(${first.expression},${second.expression})`;
  };
  const idealConjugate = (source: Extract<CenterValue, { kind: 'ideal' }>, isogonal: boolean): string => {
    const [a, b, c] = vertices;
    return bind([`Vector(${source.from},${source.to})`], allocate, ([d]) => {
      const [u, v, w] = [[b, c], [c, a], [a, b]].map(([p, q]) =>
        `(x(${d})*(y(${p})-y(${q}))-y(${d})*(x(${p})-x(${q})))`);
      return bind([u, v, w], allocate, ([x, y, z]) => {
        const weights = [`(${y})*(${z})`, `(${z})*(${x})`, `(${x})*(${y})`]
          .map((weight, i) => isogonal ? `(${weight})*Distance(${[b, c, a][i]},${[c, a, b][i]})^2` : weight);
        return bind(weights, allocate, ([r, s, t]) => {
          const sum = `((${r})+(${s})+(${t}))`;
          return `If(${sum}!=0,((${r})*(${a})+(${s})*(${b})+(${t})*(${c}))/${sum})`;
        }, 'number');
      }, 'number');
    }, 'vector');
  };
  const withSideVariables = (build: (variables: Record<string, string>) => string): string => {
    const [A, B, C] = vertices;
    return bind([`Distance(${B},${C})`, `Distance(${C},${A})`, `Distance(${A},${B})`], allocate, ([a, b, c]) => {
      const s = `((${a}+${b}+${c})/2)`;
      const S = `(2*sqrt(${s}*(${s}-${a})*(${s}-${b})*(${s}-${c})))`;
      const E = `((${a}*${b}*${c})^2/(${S}^2))`;
      const variables: Record<string, string> = {
        a, b, c, A: `acos((${b}^2+${c}^2-${a}^2)/(2*${b}*${c}))`,
        B: `acos((${c}^2+${a}^2-${b}^2)/(2*${c}*${a}))`,
        C: `acos((${a}^2+${b}^2-${c}^2)/(2*${a}*${b}))`,
        s, sa: `((${b}+${c}-${a})/2)`, sb: `((${c}+${a}-${b})/2)`, sc: `((${a}+${b}-${c})/2)`,
        S, SA: `((${b}^2+${c}^2-${a}^2)/2)`, SB: `((${c}^2+${a}^2-${b}^2)/2)`,
        SC: `((${a}^2+${b}^2-${c}^2)/2)`, r: `(${S}/(${a}+${b}+${c}))`,
        R: `((${a}*${b}*${c})/(2*${S}))`, SW: `((${a}^2+${b}^2+${c}^2)/2)`,
        E, F: `((${a}^2+${b}^2+${c}^2)/2-${E})`, pi: 'pi',
      };
      return build(variables);
    }, 'number');
  };
  const coordinatePoint = (formula: string, sources: CenterValue[] = []): string => {
    const build = (bound: Record<string, string>) => withSideVariables((sides) => {
      const variables = { ...sides, ...bound };
      const [A, B, C] = vertices;
      const cyclic = (turn: number): string => formula.replace(/[A-Za-z_]+/gu, (name) => {
        let rotated = name;
        for (let i = 0; i < turn; i++) rotated = rotation[rotated] ?? rotated;
        return variables[rotated] ? `(${variables[rotated]})` : rotated;
      });
      const weights = [cyclic(0), cyclic(1), cyclic(2)];
      return bind(weights, allocate, ([u, v, w]) => {
        const total = `((${u})+(${v})+(${w}))`;
        return `If(${total}!=0,((${u})*(${A})+(${v})*(${B})+(${w})*(${C}))/${total})`;
      }, 'number');
    });
    if (!sources.length) return build({});
    const expressions = sources.map((source) => source.kind === 'ideal'
      ? `Vector(${source.from},${source.to})` : requirePoint(source));
    return bind(expressions, allocate, (points) => {
      const areas = points.flatMap((p, i) => [[vertices[1], vertices[2]], [vertices[2], vertices[0]], [vertices[0], vertices[1]]]
        .map(([b, c]) => sources[i].kind === 'ideal'
          ? `(x(${p})*(y(${b})-y(${c}))-y(${p})*(x(${b})-x(${c})))`
          : `((x(${b})-x(${p}))*(y(${c})-y(${p}))-(y(${b})-y(${p}))*(x(${c})-x(${p})))`));
      return bind(areas, allocate, (names) => build(Object.fromEntries(names.map((name, i) => [['x', 'y', 'z', 'u', 'v', 'w'][i], name]))), 'number');
    }, sources.map((source) => source.kind === 'ideal' ? 'vector' : 'point'));
  };
  const render = (number: number): CenterValue => {
    if (!requiresTriangleCenterRecipe(number)) {
      const direction = nativeDirections.get(number);
      if (direction) return { kind: 'ideal', from: requirePoint(render(direction[0])), to: requirePoint(render(direction[1])) };
      return point(`TriangleCenter(${vertices.join(',')},${number})`);
    }
    const recipe = recipes.get(number);
    if (!recipe) throw new Error(`Triangle center X(${number}) is not implemented.`);
    if (visiting.has(number)) throw new Error(`Cyclic triangle center recipe at X(${number}).`);
    visiting.add(number);
    try {
      const values = recipe.references.map(render);
      if (values.some((value) => value.kind === 'unknown-ideal')) throw new Error('The ideal triangle center has no known direction.');
      if (recipe.operation === 'B') {
        if (values.some((value) => value.kind === 'ideal') && !(values.length === 1 && ['x^2', 'x^3'].includes(recipe.formula!))) {
          throw new Error('This coordinate transform requires finite inputs.');
        }
        return point(coordinatePoint(recipe.formula!, values));
      }
      if (recipe.operation === 'F') {
        const rawFormulas = recipe.formula!.split('|');
        const buildCombo = (formulas: string[], points = values.map(requirePoint)): string => {
        return bind(formulas, allocate, (weights) => {
          const sum = `(${weights.join('+')})`;
          const numerator = weights.map((weight, i) => `(${weight})*(${points[i]})`).join('+');
          return `If(${sum}!=0,(${numerator})/${sum})`;
        }, 'number');
        };
        if (rawFormulas.some((formula) => /\bd\b/u.test(formula))) {
          return point(bind(values.map(requirePoint), allocate, (points) =>
            bind([`Distance(${points[0]},${points[1]})`], allocate, ([d]) =>
              withSideVariables((variables) => buildCombo(rawFormulas.map((formula) => formula.replace(/[A-Za-z_]+/gu,
                (name) => name === 'd' ? `(${d})` : variables[name] ? `(${variables[name]})` : name)), points)), 'number'), 'point'));
        }
        return point(rawFormulas.every((formula) => !/[A-Za-z_]/u.test(formula)) ? buildCombo(rawFormulas)
          : withSideVariables((variables) => buildCombo(rawFormulas.map((formula) => formula.replace(/[A-Za-z_]+/gu, (name) => variables[name] ? `(${variables[name]})` : name)))));
      }
      if (recipe.operation === 'I') return values.length ? { kind: 'ideal', from: requirePoint(values[0]), to: requirePoint(values[1]) } : { kind: 'unknown-ideal' };
      if (recipe.operation === 'M') return point(`Midpoint(${requirePoint(values[0])},${requirePoint(values[1])})`);
      if (recipe.operation === 'R') return point(`Reflect(${requirePoint(values[0])},${values.length === 2 ? requirePoint(values[1]) : line(values[1], values[2])})`);
      if (recipe.operation === 'P') return point(`ClosestPoint(${line(values[1], values[2])},${requirePoint(values[0])})`);
      if (recipe.operation === 'O') return point(`Center(Circle(${values.map(requirePoint).join(',')}))`);
      if (recipe.operation === 'V') return point(`Reflect(${requirePoint(values[0])},${values.length === 3
        ? `Circle(${requirePoint(values[1])},${requirePoint(values[2])})` : `Circle(${vertices.join(',')})`})`);
      if (recipe.operation === 'G' || recipe.operation === 'T') return point(values[0].kind === 'ideal'
        ? idealConjugate(values[0], recipe.operation === 'G')
        : bind([requirePoint(values[0])], allocate, ([source]) => conjugate(recipe.operation === 'G')(
          [...vertices, source].map((expression) => ({ expression, type: 'point' })), allocate), 'point'));
      if (recipe.operation === 'C' || recipe.operation === 'A') {
        const [a, b, c] = vertices;
        return point(recipe.operation === 'C' ? `((${a})+(${b})+(${c})-(${requirePoint(values[0])}))/2`
          : `(${a})+(${b})+(${c})-2*(${requirePoint(values[0])})`);
      }
      return point(`Intersect(${line(values[0], values[1])},${line(values[2], values[3])})`);
    } finally { visiting.delete(number); }
  };
  const result = render(id);
  // GeoGebra has no drawable point at infinity. Keep its direction in the
  // recursive value so dependent finite constructions can still use it.
  return result.kind === 'point' ? result.expression : `If(false,${vertices[0]})`;
};
