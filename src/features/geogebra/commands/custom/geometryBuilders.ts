import type { ExpressionBuilder, TypedExpression } from './types';

type Matrix = string[][];
const add = (terms: string[]) => `(${terms.join('+')})`;
const mul = (...terms: string[]) => `(${terms.map((term) => `(${term})`).join('*')})`;
const sub = (a: string, b: string) => `((${a})-(${b}))`;
const matrix = (m: Matrix) => `{${m.map((row) => `{${row.join(',')}}`).join(',')}}`;
const transpose = (m: Matrix): Matrix => m[0].map((_, j) => m.map((row) => row[j]));
const product = (a: Matrix, b: Matrix): Matrix => a.map((row) => b[0].map((_, j) => add(row.map((value, k) => mul(value, b[k][j])))));
const adjugate = (m: Matrix): Matrix => Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => {
  const rows = [0, 1, 2].filter((r) => r !== j);
  const cols = [0, 1, 2].filter((c) => c !== i);
  const minor = sub(mul(m[rows[0]][cols[0]], m[rows[1]][cols[1]]), mul(m[rows[0]][cols[1]], m[rows[1]][cols[0]]));
  return (i + j) % 2 ? `-(${minor})` : minor;
}));
const determinant = (m: Matrix) => add(m[0].map((value, j) => mul(value, adjugate(m)[j][0])));
const cross = (a: string[], b: string[]): string[] => [0, 1, 2].map((i) => sub(mul(a[(i + 1) % 3], b[(i + 2) % 3]), mul(a[(i + 2) % 3], b[(i + 1) % 3])));

/** Local bindings in a native dynamic expression. No labeled construction objects. */
const bind = (values: string[], allocate: () => string, body: (names: string[]) => string): string => {
  const names = values.map(() => allocate());
  return `Element(Zip(${body(names)},${names.map((name, i) => `${name},{${values[i]}}`).join(',')}),1)`;
};

const homogeneous = (arg: TypedExpression): string[] => {
  const e = arg.expression;
  if (arg.type === 'point') return [`x(${e})`, `y(${e})`, '1'];
  // A ray's parameter 1 is its point at infinity. 0 and 1/2 are finite
  // for both segments and rays; the resulting supporting line is unbounded.
  const line = arg.type === 'line' ? e : `Line(Point(${e},0),Point(${e},0.5))`;
  return [`x(${line})`, `y(${line})`, `z(${line})`];
};

const conjugate = (isogonal: boolean): ExpressionBuilder => (args, allocate) => {
  const [a, b, c, p] = args.map((arg) => arg.expression);
  const area = (u: string, v: string) => sub(mul(`x(${u})-x(${p})`, `y(${v})-y(${p})`), mul(`y(${u})-y(${p})`, `x(${v})-x(${p})`));
  // Signed area coordinates; products replace reciprocals and extend across triangle sidelines.
  return bind([area(b, c), area(c, a), area(a, b)], allocate, ([u, v, w]) => {
    const weights = [mul(v, w), mul(w, u), mul(u, v)].map((weight, i) => isogonal ? mul(weight, `Distance(${[b, c, a][i]},${[c, a, b][i]})^2`) : weight);
    return `If((${u}+${v}+${w})!=0,${bind(weights, allocate, ([r, s, t]) => `(${r}*(${a})+${s}*(${b})+${t}*(${c}))/(${r}+${s}+${t})`)})`;
  });
};

// Coefficient order: a²,b²,c²,ab,ac,bc in the projective parameter plane.
const tangency = ([u, v, w]: string[]): string[] => [`-(${u})^2`, `-(${v})^2`, `-(${w})^2`, mul('2', u, v), mul('2', u, w), mul('2', v, w)];
const pairIndex = (i: number, j: number) => ({ '01': 3, '02': 4, '12': 5 })[[i, j].sort().join('') as '01' | '02' | '12'];
const chartConic = (q: string[], fixed: number, free: number[]) => `Conic({${[q[free[0]], q[free[1]], q[fixed], q[pairIndex(...free as [number, number])], q[pairIndex(free[0], fixed)], q[pairIndex(free[1], fixed)]].join(',')}})`;
const incidence = ([u, v, w]: string[]) => [mul(v, w), mul(w, u), mul(u, v)];

/** Five mixed incidence/tangency conditions; solve in primal or dual projective space. */
const conic: ExpressionBuilder = (args, allocate) => {
  const points = args.filter((arg) => arg.type === 'point');
  const lines = args.filter((arg) => arg.type !== 'point');
  if (points.length === 5) return `Conic(${args.map((arg) => arg.expression).join(',')})`;
  const dual = lines.length >= 3;
  const base = dual ? lines : points;
  const tangents = dual ? points : lines;
  const columns = base.slice(0, 3).map(homogeneous);
  const expression = bind(transpose(columns).flat(), allocate, (entries) => {
    const frame = [entries.slice(0, 3), entries.slice(3, 6), entries.slice(6, 9)];
    return bind(adjugate(frame).flat(), allocate, (inverseEntries) => {
      // adj(frame) is a homogeneous inverse: avoid division by its determinant.
      const inverse = [inverseEntries.slice(0, 3), inverseEntries.slice(3, 6), inverseEntries.slice(6, 9)];
      const transformVector = (m: Matrix, v: string[]) => product(m, v.map((entry) => [entry])).flat();
      const extra = base.slice(3).map((arg) => incidence(transformVector(inverse, homogeneous(arg))));
      const tangentVectors = tangents.map((arg) => transformVector(transpose(frame), homogeneous(arg)));
      return bind([...extra.flat(), ...tangentVectors.flat()], allocate, (values) => {
        const extraRows = extra.map((_, i) => values.slice(3 * i, 3 * i + 3));
        const tangentRows = tangents.map((_, i) => values.slice(extra.length * 3 + i * 3, extra.length * 3 + i * 3 + 3));
        const output = ([a, b, c]: string[]) => {
          // Delegate the projective transform to the native conic algorithm,
          // rather than expanding every entry of M^-T Q M^-1 into scalar trees.
          const world = `ApplyMatrix(${matrix(frame)},Conic({0,0,0,${c},${b},${a}}))`;
          const emit = (m: Matrix) => `Conic({${[m[0][0], m[1][1], m[2][2], mul('2', m[0][1]), mul('2', m[0][2]), mul('2', m[1][2])].join(',')}})`;
          if (!dual) return world;
          return bind([world], allocate, ([curve]) => bind(Array.from({ length: 6 }, (_, i) => `Element(Coefficients(${curve}),${i + 1})`), allocate, ([u, v, w, r, s, t]) => emit(adjugate([[u, `(${r})/2`, `(${s})/2`], [`(${r})/2`, v, `(${t})/2`], [`(${s})/2`, `(${t})/2`, w]]))));
        };
        if (extraRows.length === 2) return `If(${determinant(frame)}!=0,${output(cross(extraRows[0], extraRows[1]))})`;
        const charts = [0, 1, 2].map((fixed) => {
          const free = [0, 1, 2].filter((i) => i !== fixed);
          const first = chartConic(tangency(tangentRows[0]), fixed, free);
          const second = extraRows.length
            ? `(${extraRows[0][free[0]]})*x+(${extraRows[0][free[1]]})*y+(${extraRows[0][fixed]})=0`
            : chartConic(tangency(tangentRows[1]), fixed, free);
          const candidate = allocate();
          const kept = allocate();
          const parameters = ['0', '0', '0'];
          parameters[fixed] = '1';
          parameters[free[0]] = `x(${candidate})`;
          parameters[free[1]] = `y(${candidate})`;
          // All three affine charts cover projective infinity. Ownership bounds keep
          // each root in its best-conditioned chart (tie priority 0, then 1, then 2).
          const ownership = free.map((axis, i) => `abs(${i === 0 ? 'x' : 'y'}(${kept}))${axis < fixed ? '<' : '<='}1`).join('&&');
          const roots = `KeepIf(IsDefined(${kept})&&(${ownership}),${kept},{Intersect(${first},${second})})`;
          return `Zip(${output(parameters)},${candidate},${roots})`;
        });
        return `If(${determinant(frame)}!=0,RemoveUndefined(Join(${charts.join(',')})),{})`;
      });
    });
  });
  if (points.length === 0) return expression;
  // A conic sentinel gives Element a fixed GeoConic output type even when
  // the real-solution list is initially empty. It is never a labeled object.
  return {
    expression: `Join({Conic({1,1,0/0,0,0,0})},${expression})`,
    outputCount: points.length === 1 || points.length === 4 ? 2 : 4,
    outputOffset: 1,
  };
};

const conicBranch: ExpressionBuilder = (args, allocate) => {
  const built = conic(args.slice(0, 5), allocate);
  const index = args[5].expression;
  if (typeof built === 'string') return `Element({${built}},${index})`;
  return `Element(${built.expression},(${index})+${built.outputOffset ?? 0})`;
};

export const GEOMETRY_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  isogonal: conjugate(true), isotomic: conjugate(false), conic, conicBranch,
};

