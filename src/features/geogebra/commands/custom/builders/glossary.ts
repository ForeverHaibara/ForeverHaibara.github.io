import type { BuiltExpression, ExpressionBuilder } from '../types';
import type { BindingAllocator } from '../algebra/homogeneous';
import { add, barycentricPoint, bind, coefficientLine, cross, homogeneous, independentOutputs, mul, sub, pointBarycentrics, triangleFrameDeterminant, triangleAreas, triangleSideSquares } from '../algebra/homogeneous';
import { antigonalWeights } from './triangle';

const cycle = <T>(values: T[], i: number): [T, T, T] =>
  [values[i], values[(i + 1) % 3], values[(i + 2) % 3]];
const reciprocal = (v: string[]) => v.map((_, i) => mul(v[(i + 1) % 3], v[(i + 2) % 3]));
const square = (value: string) => `(${value})^2`;

const withCoordinates = (vertices: string[], points: string[], allocate: BindingAllocator,
  body: (coordinates: string[][]) => string | BuiltExpression) =>
  bind(points.flatMap((point) => triangleAreas([...vertices, point])), allocate,
    (values) => body(points.map((_, i) => values.slice(3 * i, 3 * i + 3))), 'number');

type WeightMap = (coordinates: string[][], vertices: string[]) => string[];
const pointMap = (weights: WeightMap): ExpressionBuilder => (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  const vertices = points.slice(0, 3);
  return withCoordinates(vertices, points.slice(3), allocate, (coords) =>
    bind(weights(coords, vertices), allocate, (image) =>
      `If(${add(coords[0])}!=0,${barycentricPoint(vertices, image)})`, 'number'));
};

const hirstInverse = pointMap(([pivot, point]) => {
  const p = reciprocal(pivot);
  const q = reciprocal(point);
  return point.map((v, i) => sub(mul(p[i], square(v)), mul(q[i], square(pivot[i]))));
});

const antitomicConjugate = pointMap(([p]) => {
  // Isotomic, Steiner circumellipse inversion, isotomic. Cancel the common
  // p_1 p_2 p_3 before converting the result back to a finite point.
  const products = reciprocal(p);
  const inverted = reciprocal(p.map((v, i) => sub(square(v), products[i])));
  return p.map((v, i) => mul(v, inverted[i]));
});

const syngonal = pointMap(([p], vertices) =>
  antigonalWeights([p.map((_, i) => {
    const [u, v, w] = cycle(p, i);
    return sub(add([v, w]), u);
  })], vertices));

const vertexConjugate = pointMap(([p, q], vertices) => {
  const sides = triangleSideSquares(vertices);
  const denominators = sides.map((_, i) => {
    const [a2, b2, c2] = cycle(sides, i);
    const [u, v, w] = cycle(p, i);
    const [x, y, z] = cycle(q, i);
    return sub(mul(square(a2), v, w, y, z),
      mul(u, x, add([mul(b2, w), mul(c2, v)]), add([mul(b2, z), mul(c2, y)])));
  });
  return reciprocal(denominators).map((value, i) => mul(sides[i], value));
});

const gst = pointMap(([p], vertices) => {
  const sides = triangleSideSquares(vertices);
  const terms = sides.map((side, i) => mul(side, sub(add([sides[(i + 1) % 3], sides[(i + 2) % 3]]), side)));
  return p.map((value, i) => {
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    return mul(square(value), sides[j], sides[k], sub(mul(terms[j], p[k]), mul(terms[k], p[j])));
  });
});

const lineConjugate: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, p, q] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  return withCoordinates(vertices, [p, q], allocate, ([pivot, point]) =>
    bind(triangleSideSquares(vertices), allocate, (sides) => {
      const norm = add(point.map((v, i) => `${square(v)}/${sides[i]}`));
      const dot = add(point.map((v, i) => `${mul(pivot[i], v)}/${sides[i]}`));
      return bind([norm, dot], allocate, ([h, k]) =>
        `If(${add(pivot)}!=0,${barycentricPoint(vertices, pivot.map((v, i) => sub(mul(h, v), mul(k, point[i]))))})`, 'number');
    }, 'number'));
};

const complementaryConjugate = (anti: boolean): ExpressionBuilder => (args, allocate) => {
  const [a, b, c, p, q] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  // Conjugate ETC's weighted reciprocal by complement or anticomplement.
  // Keep the intermediate point homogeneous, even if its image is ideal.
  const transform = (v: string[], isAnti: boolean) => v.map((_, i) => {
    const [x, y, z] = cycle(v, i);
    return isAnti ? sub(add([y, z]), x) : add([y, z]);
  });
  return withCoordinates(vertices, [p, q], allocate, ([pivot, point]) =>
    bind(transform(point, !anti), allocate, (preimage) => {
      const weights = reciprocal(pivot);
      const inverse = reciprocal(preimage);
      const lengths = [`Distance(${b},${c})`, `Distance(${c},${a})`, `Distance(${a},${b})`];
      const image = lengths.map((length, i) => mul(`(${length})^3`, weights[i], inverse[i]));
      return bind(image, allocate, (values) =>
        `If(${add(pivot)}!=0,${barycentricPoint(vertices, transform(values, anti))})`, 'number');
    }, 'number'));
};

type TrilinearFormula = (pivot: string[], point: string[]) => string[];
const trilinearConjugate = (formula: TrilinearFormula): ExpressionBuilder => (args, allocate) => {
  const [a, b, c, p, q] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  return withCoordinates(vertices, [p, q], allocate, (coords) =>
    bind([`Distance(${b},${c})`, `Distance(${c},${a})`, `Distance(${a},${b})`], allocate, (lengths) =>
      bind(coords.flatMap((v) => v.map((value, i) => `${value}/${lengths[i]}`)), allocate, (values) => {
        const image = formula(values.slice(0, 3), values.slice(3));
        return bind(image.map((v, i) => mul(lengths[i], v)), allocate, (weights) =>
          `If(${add(coords[0])}!=0,${barycentricPoint(vertices, weights)})`, 'number');
      }, 'number'), 'number'));
};

const dalethOrWaw = (waw: boolean) => trilinearConjugate((pivot, point) => pivot.map((_, i) => {
  const [p, q, r] = cycle(pivot, i);
  const [x, y, z] = cycle(point, i);
  return mul(p, sub(add([
    mul(waw ? '1' : '2', square(mul(x, q, r))),
    mul(waw ? '2' : '1', square(p), square(sub(mul(r, y), mul(q, z)))),
  ]), mul(p, q, r, x, add([mul(r, y), mul(q, z)]))));
}));

const heConjugate = trilinearConjugate((pivot, point) => pivot.map((_, i) => {
  const [p, q, r] = cycle(pivot, i);
  const [x, y, z] = cycle(point, i);
  const yz = add([y, z]);
  const zx = add([z, x]);
  const xy = add([x, y]);
  return sub(add([
    mul(p, q, r, sub(add([mul(q, square(zx)), mul(r, square(xy))]), mul(p, square(yz)))),
    mul(square(mul(q, r)), xy, zx),
  ]), mul(p, p, yz, add([mul(r, r, xy), mul(q, q, zx)])));
}));

const zayinConjugate = trilinearConjugate((pivot, point) => pivot.map((_, i) => {
  const [p, q, r] = cycle(pivot, i);
  const [x, y, z] = cycle(point, i);
  return sub(add([mul(p, square(add([y, z]))), mul(sub(p, r), x, y), mul(sub(p, q), x, z)]),
    add([mul(r, square(y)), mul(q, square(z))]));
}));

const gimelConjugate: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, p, q] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  return withCoordinates(vertices, [p, q], allocate, ([pivot, point]) =>
    bind([`Distance(${b},${c})`, `Distance(${c},${a})`, `Distance(${a},${b})`], allocate, (lengths) => {
      const cofactors = reciprocal(pivot);
      const reflectionCenter = lengths.map((_, i) => {
        const [u, v, w] = cycle(lengths, i);
        return mul(square(u), cofactors[i], sub(add([square(v), square(w)]), square(u)));
      });
      const reflectedScale = add(point.map((v, i) => {
        const [, u, w] = cycle(pivot, i);
        return `${mul(v, add([u, w]))}/${lengths[i]}`;
      }));
      const area = add(pivot);
      return bind([...reflectionCenter, reflectedScale, mul('4', square(area), ...pivot)], allocate, (values) => {
        const center = values.slice(0, 3);
        const [scale, original] = values.slice(3);
        const image = point.map((v, i) => {
          const [u, w, t] = cycle(center, i);
          return sub(mul(lengths[i], sub(add([w, t]), u), scale), mul(original, v));
        });
        return bind(image, allocate, (weights) =>
          `If(${area}!=0,${barycentricPoint(vertices, weights)})`, 'number');
      }, 'number');
    }, 'number'));
};

const cocevianTriangle: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, , index] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  return bind(pointBarycentrics(vertices, args[3]), allocate, (p) => independentOutputs(p.map((_, i) => {
    const weights = [...p];
    weights[i] = '0';
    weights[(i + 2) % 3] = `-(${weights[(i + 2) % 3]})`;
    const area = args[3].type === 'point' ? add(p) : triangleFrameDeterminant(vertices);
    return `If(${area}!=0,${barycentricPoint(vertices, weights)})`;
  }), index), 'number');
};

type TriangleWeights = (u: string[], v: string[], sides: string[]) => string[];
const triangleMap = (weights: TriangleWeights): ExpressionBuilder => (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  const vertices = points.slice(0, 3);
  const sides = triangleSideSquares(vertices);
  return withCoordinates(vertices, points.slice(3, 6), allocate, (coords) => independentOutputs(
    coords.map((_, i) => {
      const [, u, v] = cycle(coords, i);
      return bind(weights(u, v, sides), allocate, (image) =>
        `If(${add(u)}!=0,${barycentricPoint(vertices, image)})`, 'number');
    }), points[6]));
};

const dualTriangle = triangleMap((u, v, sides) => {
  // Both finite inputs have the same raw barycentric sum. Their difference
  // represents the side's ideal point, which can have a finite isogonal image.
  const direction = v.map((value, i) => sub(value, u[i]));
  return reciprocal(direction).map((value, i) => mul(sides[i], value));
});
const linePolarTriangle = triangleMap((u, v) => reciprocal(cross(u, v)));
const pointPolarTriangle = triangleMap((u, v) => cross(reciprocal(u), reciprocal(v)));
const cofactorWeights: TriangleWeights = (u, v, sides) => cross(u, v).map((value, i) => mul(sides[i], value));
const unaryCofactorTriangle = triangleMap(cofactorWeights);

const eigencenter: ExpressionBuilder = (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  const vertices = points.slice(0, 3);
  const sides = triangleSideSquares(vertices);
  return withCoordinates(vertices, points.slice(3), allocate, (coords) => {
    const joins = coords.flatMap((point, i) => {
      const [, u, v] = cycle(coords, i);
      return cross(point, cofactorWeights(u, v, sides));
    });
    // Same centroid extension as Perspector, with homogeneous joins so
    // an ideal cofactor vertex can still determine a finite perspector.
    return bind(joins, allocate, (values) => {
      const lines = [values.slice(0, 3), values.slice(3, 6), values.slice(6)];
      const intersections = lines.flatMap((_, i) => {
        const [, u, v] = cycle(lines, i);
        return cross(u, v);
      });
      return bind(intersections, allocate, (values) => {
        const points = [values.slice(0, 3), values.slice(3, 6), values.slice(6)];
        const finite = points.map((p) => `(${add(p)}!=0)`).join('&&');
        const center = vertices.map((_, i) => add(points.map((p) => `${p[i]}/${add(p)}`)));
        return `If(${finite},${barycentricPoint(vertices, center)})`;
      }, 'number');
    }, 'number');
  });
};

const trilinearImage: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, d, e, f, point] = args.map((arg) => arg.expression);
  const source = [a, b, c];
  const target = [d, e, f];
  const scales = [`Distance(${e},${f})/Distance(${b},${c})`, `Distance(${f},${d})/Distance(${c},${a})`, `Distance(${d},${e})/Distance(${a},${b})`];
  return withCoordinates(source, [point], allocate, ([p]) =>
    bind(p.map((v, i) => mul(v, scales[i])), allocate, (image) =>
      `If(${add(p)}!=0&&!AreCollinear(${d},${e},${f}),${barycentricPoint(target, image)})`, 'number'));
};

const orthojoin: ExpressionBuilder = (args, allocate) => {
  const [a, b, c, point] = args.map((arg) => arg.expression);
  const vertices = [a, b, c];
  const sides = triangleSideSquares(vertices);
  const world = args.slice(0, 3).map(homogeneous);
  const rows = world.map((_, i) => {
    const [, u, v] = cycle(world, i);
    return cross(u, v);
  });
  return withCoordinates(vertices, [point], allocate, ([p]) => {
    // Trilinear polar of the isogonal image, after cancellation. No finite
    // isogonal point is needed when P lies on the circumcircle or a sideline.
    const coefficients = vertices.map((_, i) => add(rows.map((row, j) => `${mul(row[i], p[j])}/(${sides[j]})`)));
    return bind([coefficientLine(coefficients, allocate)], allocate, ([line]) =>
      `If(${add(p)}!=0,Intersect(PerpendicularLine((${a}+Reflect(${a},${line}))/2,Line(${b},${c})),PerpendicularLine((${b}+Reflect(${b},${line}))/2,Line(${c},${a}))))`, 'line');
  });
};

const gibertPsi = pointMap(([p, q], vertices) => {
  const sides = triangleSideSquares(vertices);
  const direction = q.map((value, i) => sub(mul(add(p), value), mul(add(q), p[i])));
  // The three rectangular hyperbolas in Gibert's pencil have a fixed
  // linear relation. The pole of Q is the intersection of two polars of Q.
  const polar = (i: number) => {
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    const constant = sub(mul(sides[k], p[j], q[j]), mul(sides[j], p[k], q[k]));
    const line = [constant, constant, constant];
    line[j] = sub(constant, mul(sides[k], direction[j]));
    line[k] = add([constant, mul(sides[j], direction[k])]);
    return line;
  };
  return cross(polar(0), polar(1));
});

const cst = pointMap(([p], vertices) => {
  const sides = triangleSideSquares(vertices);
  return p.map((value, i) => {
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    return mul(square(value), add([p[j], p[k]]), sides[j], sides[k]);
  });
});

const orionTransform = pointMap(([p], vertices) => {
  const sides = triangleSideSquares(vertices);
  return p.map((_, i) => {
    const [a2, b2, c2] = cycle(sides, i);
    const [x, y, z] = cycle(p, i);
    const squared = add([mul(c2, square(y)), mul(b2, square(z)), mul(sub(add([b2, c2]), a2), y, z)]);
    return mul(x, sub(mul(square(x), squared), mul(a2, square(mul(y, z)))));
  });
});

const orionConjugate = pointMap(([p], vertices) => {
  const sides = triangleSideSquares(vertices);
  const conway = sides.map((side) => `${sub(add(sides), mul('2', side))}/2`);
  const area = square(add(p));
  const factors = p.map((_, i) => {
    const [, b2, c2] = cycle(sides, i);
    const [sa, sb, sc] = cycle(conway, i);
    const [x, y, z] = cycle(p, i);
    const cubic = add([mul(x, sub(mul(c2, square(y)), mul(b2, square(z)))),
      mul(y, z, sub(mul(sb, y), mul(sc, z)))]);
    // C_a is the conic left when the sideline x = 0 is divided out
    // of a² K_a + S_C K_b + S_B K_c.
    const middle = mul(sa, sub(sb, sc));
    const product = mul(sb, sc);
    const conic = add([mul(area, sub(square(y), square(z))), mul(x, y, sub(middle, product)),
      mul(x, z, add([middle, product]))]);
    return { cubic, conic };
  });
  return reciprocal(factors.map(({ cubic }) => cubic)).map((value, i) => mul(value, factors[i].conic));
});

export const GLOSSARY_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  antitomicConjugate, syngonal, vertexConjugate, gst, hirstInverse, lineConjugate,
  complementaryConjugate: complementaryConjugate(false),
  anticomplementaryConjugate: complementaryConjugate(true),
  dalethConjugate: dalethOrWaw(false), wawConjugate: dalethOrWaw(true),
  heConjugate, zayinConjugate, gimelConjugate, cocevianTriangle, dualTriangle,
  linePolarTriangle, pointPolarTriangle, unaryCofactorTriangle, eigencenter, trilinearImage, orthojoin,
  gibertPsi, cst, orionTransform, orionConjugate,
};
