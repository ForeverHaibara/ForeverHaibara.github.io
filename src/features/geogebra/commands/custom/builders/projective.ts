import type { ExpressionBuilder, TypedExpression } from '../types';
import type { BindingAllocator } from '../algebra/homogeneous';
import { add, adjugate, bind, coefficientLine, coordinatesToPoint, cross, determinant, homogeneous, mul, product, sub, transpose } from '../algebra/homogeneous';

const directionPoint = (arg: TypedExpression): string[] => {
  const [a, b, c] = homogeneous(arg);
  return arg.type === 'point' ? [a, b, c] : [b, `-(${a})`, '0'];
};

const multiply = (matrix: string[][], vector: string[]) => product(matrix, vector.map((entry) => [entry])).flat();
const dot = (a: string[], b: string[]) => add(a.map((value, i) => mul(value, b[i])));

const collineation: ExpressionBuilder = (args, allocate) => {
  const points = args.map(directionPoint);
  const relative = ([x, y, w]: string[], origin: string[]) => [sub(x, mul(w, origin[0])), sub(y, mul(w, origin[1])), w];
  const withFrame = (offset: number, use: (basis: string[][], weights: string[], origin: string[], valid: string) => string) => {
    const vertices = points.slice(offset, offset + 4);
    const anchor = args.slice(offset, offset + 4).findIndex((arg) => arg.type === 'point');
    return bind(vertices.flat(), allocate, (coords) => {
      const origin = anchor < 0 ? ['0', '0'] : coords.slice(3 * anchor, 3 * anchor + 2);
      const [a, b, c, d] = [0, 3, 6, 9].map((i) => relative(coords.slice(i, i + 3), origin));
      return bind([a, b, c, d].flat(), allocate, (local) => {
        const basis = transpose([local.slice(0, 3), local.slice(3, 6), local.slice(6, 9)]);
        return bind(multiply(adjugate(basis), local.slice(9)), allocate, (weights) =>
          use(basis, weights, origin, [determinant(basis), ...weights].map((v) => `${v}!=0`).join('&&')), 'number');
      }, 'number');
    }, 'number');
  };

  return withFrame(0, (source, weights, sourceOrigin, sourceValid) =>
    withFrame(4, (target, scales, targetOrigin, targetValid) => {
      const inverseWeights = [mul(weights[1], weights[2]), mul(weights[2], weights[0]), mul(weights[0], weights[1])];
      return bind(multiply(adjugate(source), relative(points[8], sourceOrigin)), allocate, (local) => {
        const image = multiply(target, local.map((v, i) => mul(v, scales[i], inverseWeights[i])));
        return bind(image, allocate, ([x, y, w]) =>
          `If(${sourceValid}&&${targetValid},(${targetOrigin[0]}+${x}/${w},${targetOrigin[1]}+${y}/${w}))`, 'number');
      }, 'number');
    }));
};

const involution: ExpressionBuilder = (args, allocate) =>
  bind(args.slice(0, 4).flatMap(directionPoint), allocate, (coords) => {
    const [a, b, c, d] = [0, 3, 6, 9].map((i) => coords.slice(i, i + 3));
    const diagonal = [cross(cross(a, c), cross(b, d)), cross(cross(a, b), cross(c, d)), cross(cross(a, d), cross(b, c))];
    return bind(diagonal.flat(), allocate, (values) => {
      const center = values.slice(0, 3);
      const axis = cross(values.slice(3, 6), values.slice(6));
      const scale = dot(axis, center);
      const point = homogeneous(args[4]);
      const projection = dot(axis, point);
      const image = point.map((entry, i) => sub(mul(scale, entry), mul('2', projection, center[i])));
      return `If(${scale}!=0,${coordinatesToPoint(image)})`;
    }, 'number');
  }, 'number');

type LineCoordinate = [string, string];
const bracket = ([s, w]: LineCoordinate, [t, z]: LineCoordinate) => sub(mul(s, z), mul(w, t));

// Keep the affine chart's origin at a finite anchor. The direction is the
// difference of the first two points, or their common direction at infinity.
const withLineChart = (args: readonly TypedExpression[], allocate: BindingAllocator,
  use: (points: LineCoordinate[], finitePoint: (point: LineCoordinate) => string) => string) =>
  bind(args.flatMap(directionPoint), allocate, (entries) => {
    const [ax, ay, aw, bx, by, bw] = entries;
    const origin = args[0].type === 'point' ? [ax, ay] : [bx, by];
    const direction = [sub(mul(aw, bx), mul(bw, ax)), sub(mul(aw, by), mul(bw, ay))];
    return bind(direction, allocate, (d) => {
      const points = args.map((_, i): LineCoordinate => {
        const [x, y, w] = entries.slice(3 * i, 3 * i + 3);
        return [dot(d, [sub(x, mul(w, origin[0])), sub(y, mul(w, origin[1]))]), w];
      });
      return bind(points.map(([s]) => s), allocate, (values) =>
        use(points.map(([, w], i) => [values[i], w]), ([s, w]) => {
          const denominator = mul(dot(d, d), w);
          return `(${origin[0]}+${mul(d[0], s)}/${denominator},${origin[1]}+${mul(d[1], s)}/${denominator})`;
        }), 'number');
    }, 'number');
  }, 'number');

const collineationL: ExpressionBuilder = (args, allocate) =>
  withLineChart([...args.slice(0, 3), args[6]], allocate, ([a, b, c, p]) =>
    withLineChart(args.slice(3, 6), allocate, ([d, e, f], finitePoint) =>
      bind([bracket(a, b), bracket(c, b), bracket(a, c), bracket(d, e), bracket(f, e), bracket(d, f)], allocate,
        ([ab, cb, ac, de, fe, df]) => {
          const first = mul(bracket(p, b), ac, fe);
          const second = mul(bracket(a, p), cb, df);
          const image = (i: number) => add([mul(first, d[i]), mul(second, e[i])]);
          return `If(${[ab, cb, ac, de, fe, df].map((v) => `${v}!=0`).join('&&')},${finitePoint([image(0), image(1)])})`;
        }, 'number')));

const involutionL: ExpressionBuilder = (args, allocate) =>
  withLineChart(args, allocate, ([a, b, c, d, p = ['1', '0']], finitePoint) => {
    // det(Mu,v)=0 for the trace-zero matrix M=[[h,k],[j,-h]].
    const constraint = ([s, w]: LineCoordinate, [t, z]: LineCoordinate) =>
      [add([mul(s, z), mul(w, t)]), mul(w, z), mul('-1', s, t)];
    return bind(cross(constraint(a, c), constraint(b, d)), allocate, ([h, k, j]) =>
      `If(${add([mul(h, h), mul(k, j)])}!=0,${finitePoint([
        add([mul(h, p[0]), mul(k, p[1])]), sub(mul(j, p[0]), mul(h, p[1])),
      ])})`, 'number');
  });

const pascalLine: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d, e, f] = args.map(homogeneous);
  const u = cross(cross(a, b), cross(d, e));
  const v = cross(cross(b, c), cross(e, f));
  return bind([...u, ...v], allocate, (entries) =>
    coefficientLine(cross(entries.slice(0, 3), entries.slice(3)), allocate), 'number');
};

export const PROJECTIVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  collineation, involution, collineationL, involutionL, pascalLine,
};
