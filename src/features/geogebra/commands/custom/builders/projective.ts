import type { ExpressionBuilder, TypedExpression } from '../types';
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

const involution = (centerOnly: boolean): ExpressionBuilder => (args, allocate) =>
  bind(args.slice(0, 4).flatMap(directionPoint), allocate, (coords) => {
    const [a, b, c, d] = [0, 3, 6, 9].map((i) => coords.slice(i, i + 3));
    const diagonal = [cross(cross(a, c), cross(b, d)), cross(cross(a, b), cross(c, d)), cross(cross(a, d), cross(b, c))];
    return bind(diagonal.flat(), allocate, (values) => {
      const center = values.slice(0, 3);
      const axis = cross(values.slice(3, 6), values.slice(6));
      const scale = dot(axis, center);
      if (centerOnly) return `If(${scale}!=0,${coordinatesToPoint(center)})`;
      const point = homogeneous(args[4]);
      const projection = dot(axis, point);
      const image = point.map((entry, i) => sub(mul(scale, entry), mul('2', projection, center[i])));
      return `If(${scale}!=0,${coordinatesToPoint(image)})`;
    }, 'number');
  }, 'number');

const pascalLine: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d, e, f] = args.map(homogeneous);
  const u = cross(cross(a, b), cross(d, e));
  const v = cross(cross(b, c), cross(e, f));
  return bind([...u, ...v], allocate, (entries) =>
    coefficientLine(cross(entries.slice(0, 3), entries.slice(3)), allocate), 'number');
};

export const PROJECTIVE_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  collineation, involution: involution(false), involutionCenter: involution(true), pascalLine,
};
