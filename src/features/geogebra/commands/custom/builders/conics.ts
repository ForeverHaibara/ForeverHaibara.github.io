import type { ExpressionBuilder } from '../types';
import { add, barycentricConic, bind, coefficientLine, coefficientList, cross, independentOutputs, mul, squaredNorm, sub,
  translatedConicCoefficients, triangleAreas, triangleSideSquares } from '../algebra/homogeneous';

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
  return bind([`Center(${c1})`, `Center(${c2})`, `Radius(${c1})`, `Radius(${c2})`], allocate, ([o1, o2, r1, r2]) =>
    bind([`x(${o2})-x(${o1})`, `y(${o2})-y(${o1})`, `${r1}-(${s})*${r2}`], allocate, ([dx, dy, difference]) =>
      bind([`${dx}^2+${dy}^2`, `sqrt(${dx}^2+${dy}^2-${difference}^2)`], allocate, ([squared, height]) => {
        const output = (sign: number) => bind(commonTangentNormal(dx, dy, difference, squared, height, sign), allocate, ([nx, ny]) =>
          `If((${s})^2==1,${coefficientLine([nx, ny, `-${r1}-${nx}*x(${o1})-${ny}*y(${o1})`], allocate)})`, 'number');
        return independentOutputs([output(1), output(-1)], args[3]?.expression);
      }, 'number'), 'number'), ['point', 'point', 'number', 'number']);
};

const conicPencil: ExpressionBuilder = (args, allocate) => {
  const [q1, q2, p] = args.map((arg) => arg.expression);
  const coefficients = bind([`Coefficients(${q1})`, `Coefficients(${q2})`, `x(${p})`, `y(${p})`], allocate, ([a, b, x, y]) => {
    const basis = [`${x}^2`, `${y}^2`, '1', `${x}*${y}`, x, y];
    const evaluate = (q: string) => add(basis.map((term, i) => `Element(${q},${i + 1})*(${term})`));
    return bind([evaluate(a), evaluate(b)], allocate, ([f, g]) =>
      bind(basis.map((_, i) => `${g}*Element(${a},${i + 1})-${f}*Element(${b},${i + 1})`), allocate, (values) =>
        `If(${squaredNorm(values)}!=0,${coefficientList(values)},{1,1,0/0,0,0,0})`, 'number'), 'number');
  }, ['numberList', 'numberList', 'number', 'number']);
  return `Conic(${coefficients})`;
};

const quasiperspectiveConic: ExpressionBuilder = (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  const weights = [0, 1, 2].map((i) => {
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    const difference = (axis: string, from: number, to: number) => `(${axis}(${points[to]})-${axis}(${points[from]}))`;
    return `${difference('x', j, k)}*${difference('y', k + 3, j + 3)}-${difference('y', j, k)}*${difference('x', k + 3, j + 3)}`;
  });
  const coefficients = bind(weights, allocate, ([a, b, c]) =>
    `If(${squaredNorm([a, b, c])}!=0,{0,0,0,${c},${b},${a}},{1,1,0/0,0,0,0})`, 'number');
  return barycentricConic(points.slice(0, 3), coefficients);
};

const coaxialLimitingPoints: ExpressionBuilder = (args, allocate) => {
  const [c1, c2, index] = args.map((arg) => arg.expression);
  return bind([`Center(${c1})`, `Center(${c2})`, `Radius(${c1})`, `Radius(${c2})`], allocate, ([o1, o2, r1, r2]) =>
    bind([`Distance(${o1},${o2})`, `x(${o2})-x(${o1})`, `y(${o2})-y(${o1})`], allocate, ([distance, dx, dy]) =>
      bind([`Max({${distance},${r1},${r2}})`], allocate, ([scale]) =>
        bind([`${distance}/${scale}`, `${r1}/${scale}`, `${r2}/${scale}`], allocate, ([d, r, s]) =>
          bind([`${d}^2+(${r}-${s})*(${r}+${s})`, `sqrt(((${distance}-(${r1}+${r2}))/${scale})*(${d}+${r}+${s})*((${distance}-abs(${r1}-${r2}))/${scale})*(${d}+abs(${r}-${s})))`], allocate, ([k, root]) =>
            bind([`(abs(${k})+${root})/2`], allocate, ([m]) => {
              // Choose the homogeneous root before dividing, so an infinite
              // root does not contaminate the finite slot for concentric circles.
              const output = (sign: number) => {
                // A double root uses the same formula in both slots.
                const large = `${root}>0&&${sign}*${k}>0`;
                return bind([`If(${large},${m},${r}^2)`, `If(${large},${d}^2,${m})`], allocate, ([n, w]) => {
                  const signed = `If(${k}>0,${n},-${n})`;
                  return `(x(${o1})+${signed}*${dx}/${w},y(${o1})+${signed}*${dy}/${w})`;
                }, 'number');
              };
              return independentOutputs([output(-1), output(1)], index);
            }, 'number'), 'number'), 'number'), 'number'), 'number'), ['point', 'point', 'number', 'number']);
};

const radicalCircle: ExpressionBuilder = (args, allocate) =>
  bind(args.map((arg) => arg.expression), allocate, ([first, second, third]) =>
    bind([first, second, third].map((circle) => `Center(${circle})`), allocate, ([o, p, q]) =>
      bind([`x(${p})-x(${o})`, `y(${p})-y(${o})`, `x(${q})-x(${o})`, `y(${q})-y(${o})`,
        ...[first, second, third].map((circle) => `Radius(${circle})^2`)], allocate, ([ux, uy, vx, vy, r1, r2, r3]) => {
        const u = sub(add([squaredNorm([ux, uy]), r1]), r2);
        const v = sub(add([squaredNorm([vx, vy]), r1]), r3);
        // In coordinates relative to the first center, the circle equation
        // is d (|X|²+r1) - n·X = 0, without dividing by the center determinant.
        return bind([sub(mul(ux, vy), mul(uy, vx)), sub(mul(u, vy), mul(uy, v)),
          sub(mul(ux, v), mul(u, vx))], allocate, ([d, nx, ny]) => {
          const x = `x(${o})`;
          const y = `y(${o})`;
          return `Conic(${coefficientList([d, d, add([mul(d, add([squaredNorm([x, y]), r1])), mul(nx, x), mul(ny, y)]),
            '0', sub(`-(${nx})`, mul('2', d, x)), sub(`-(${ny})`, mul('2', d, y))])})`;
        }, 'number');
      }, 'number'), 'point'), 'circle');

const excosineCircles: ExpressionBuilder = (args, allocate) => {
  const vertices = args.slice(0, 3).map((arg) => arg.expression);
  const index = args[3]?.expression;
  return bind([`Center(Circle(${vertices.join(',')}))`], allocate, ([center]) =>
    independentOutputs(vertices.map((_, i) => {
      const b = vertices[(i + 1) % 3];
      const c = vertices[(i + 2) % 3];
      return bind([`(x(${b})+x(${c}))/2`, `(y(${b})+y(${c}))/2`,
        `y(${b})-y(${c})`, `x(${c})-x(${b})`], allocate, ([x, y, nx, ny]) => {
        const sideSquared = squaredNorm([nx, ny]);
        // Keep the signed distance factor so a diameter gives its sideline.
        return bind([add([mul(nx, sub(`x(${center})`, x)), mul(ny, sub(`y(${center})`, y))]),
          `${sideSquared}/2`], allocate, ([d, half]) =>
          `Conic(${coefficientList([d, d, sub(mul(d, sub(squaredNorm([x, y]), `${half}/2`)),
            mul(half, add([mul(nx, x), mul(ny, y)]))), '0',
          sub(mul(half, nx), mul('2', d, x)), sub(mul(half, ny), mul('2', d, y))])})`, 'number');
      }, 'number');
    }), index), 'point');
};

const cevianCircle: ExpressionBuilder = (args, allocate) => {
  const points = args.map((arg) => arg.expression);
  const vertices = points.slice(0, 3);
  const [origin] = vertices;
  const local = vertices.map((p) => [sub(`x(${p})`, `x(${origin})`), sub(`y(${p})`, `y(${origin})`), '1']);
  return bind(triangleAreas(points), allocate, (p) => {
    const pairs = p.map((_, i) => [p[(i + 1) % 3], p[(i + 2) % 3]]);
    const sums = pairs.map(add);
    const sides = triangleSideSquares(vertices);
    // On BC the circle equation is (l_B p_B + l_C p_C)(p_B+p_C)
    // = d a² p_B p_C. Solve the three cyclic equations homogeneously.
    const rhs = pairs.map((pair, i) => mul(sides[i], ...pair, sums[(i + 1) % 3], sums[(i + 2) % 3]));
    return bind([...rhs, mul('2', ...p, ...sums)], allocate, ([u, v, w, d]) => {
      const rhs = [u, v, w];
      const linear = local.map(([x, y], i) => sub(mul(...pairs[i], sub(add([rhs[(i + 1) % 3], rhs[(i + 2) % 3]]), rhs[i])),
        mul(d, squaredNorm([x, y]))));
      const rows = local.map((_, i) => cross(local[(i + 1) % 3], local[(i + 2) % 3]));
      const [lx, ly, constant] = [0, 1, 2].map((j) => add(rows.map((row, i) => mul(row[j], linear[i]))));
      const quadratic = mul(d, add(p));
      return `Conic(${coefficientList(translatedConicCoefficients([quadratic, quadratic, constant, '0', lx, ly], origin))})`;
    }, 'number');
  }, 'number');
};

export const CONIC_BUILDERS: Readonly<Record<string, ExpressionBuilder>> = {
  commonTangents, scimemi: scimemi(false), inverseScimemi: scimemi(true),
  conicPencil, quasiperspectiveConic, coaxialLimitingPoints, radicalCircle, excosineCircles, cevianCircle,
};
