import type { ExpressionBuilder } from '../types';
import { add, bind, cross, determinant, mul, squaredNorm, sub, supportingLine } from '../algebra/homogeneous';

const dot = (a: string[], b: string[]) => add(a.map((value, i) => mul(value, b[i])));
const lorentz = (a: string[], b: string[]) => sub(dot(a.slice(0, 2), b.slice(0, 2)), mul(a[2], b[2]));
const roundoff = '10^(-14)';

export const apolloniusProblem: ExpressionBuilder = (args, allocate) => {
  const points = args.filter((arg) => arg.type === 'point');
  if (points.length === 3) {
    const vertices = points.map((arg) => arg.expression).join(',');
    return `If(!AreCollinear(${vertices}),Circle(${vertices}))`;
  }

  const ordered = [...args].sort((a, b) => Number(b.type === 'point') - Number(a.type === 'point')
    || Number(b.type === 'circle') - Number(a.type === 'circle'));
  const data = ordered.flatMap((arg) => {
    if (arg.type === 'point') return [`x(${arg.expression})`, `y(${arg.expression})`, '0'];
    if (arg.type === 'circle') {
      const center = `Center(${arg.expression})`;
      return [`x(${center})`, `y(${center})`, `Radius(${arg.expression})`];
    }
    const line = supportingLine(arg);
    return [`x(${line})`, `y(${line})`, `z(${line})`];
  });

  return bind(data, allocate, (values) => {
    const triple = ordered.map((_, i) => values.slice(3 * i, 3 * i + 3));
    const allLines = ordered[0].type !== 'point' && ordered[0].type !== 'circle';
    const origin = allLines ? ['0', '0'] : triple[0].slice(0, 2);
    const signCount = 2 ** (3 - points.length - 1);
    const outputs: string[] = [];
    for (let mask = 0; mask < signCount; mask++) {
      let signedIndex = 0;
      const signs = ordered.map((arg) => {
        if (arg.type === 'point') return '1';
        const index = signedIndex++;
        return index > 0 && (mask & (1 << (index - 1))) ? '-1' : '1';
      });
      const baseRadius = allLines ? '0' : mul(signs[0], triple[0][2]);
      const rows = triple.map(([x, y, c], i) => {
        const sign = signs[i];
        const type = ordered[i].type;
        if (type === 'point' || type === 'circle') {
          const u = sub(x, origin[0]);
          const v = sub(y, origin[1]);
          const delta = sub(mul(sign, c), baseRadius);
          return [u, v, delta, `${sub(squaredNorm([u, v]), mul(delta, delta))}/2`];
        }
        const norm = `sqrt(${squaredNorm([x, y])})`;
        return [`${x}/${norm}`, `${y}/${norm}`, mul('-1', sign),
          sub(`-(${add([c, dot([x, y], origin)])})/${norm}`, mul(sign, baseRadius))];
      });
      const circle = (p: string[], guard: string) => {
        const x = add([p[0], origin[0]]);
        const y = add([p[1], origin[1]]);
        const radius = `abs(${sub(p[2], baseRadius)})`;
        const distinct = triple.flatMap(([u, v], i) => ordered[i].type === 'circle'
          ? [`(${squaredNorm([sub(x, u), sub(y, v)])}>0)`] : []);
        return `If(${[guard, `${radius}>0`, ...distinct].join('&&')},Circle((${x},${y}),${radius}))`;
      };
      if (allLines) {
        outputs.push(bind(rows.flat(), allocate, (entries) => {
          const matrix = rows.map((_, i) => entries.slice(4 * i, 4 * i + 3));
          const rhs = rows.map((_, i) => entries[4 * i + 3]);
          return bind([determinant(matrix), ...rhs.map((_, j) =>
            determinant(matrix.map((row, i) => row.map((value, k) => k === j ? rhs[i] : value))))], allocate,
          ([d, ...p]) => circle(p.map((value) => `${value}/${d}`), `abs(${d})>${roundoff}`), 'number');
        }, 'number'));
        continue;
      }
      // Subtract the base circle equation. The two remaining constraints
      // are linear in (x,y,w), with w the signed radius shifted by the base radius.
      const roots = bind(rows.slice(1).flat(), allocate, (entries) => {
        const u = entries.slice(0, 3);
        const v = entries.slice(4, 7);
        return bind(cross(u, v), allocate, (d) => {
          const norm = `sqrt(${squaredNorm(d)})`;
          const independent = `${squaredNorm(d)}>${mul(`(${roundoff})^2`, squaredNorm(u), squaredNorm(v))}`;
          const e = cross(v, d);
          const f = cross(d, u);
          const foot = e.map((value, i) => `${add([mul(entries[3], value), mul(entries[7], f[i])])}/${squaredNorm(d)}`);
          return bind([...d.map((value) => `${value}/${norm}`), ...foot], allocate, (line) => {
            const direction = line.slice(0, 3);
            const start = line.slice(3);
            const leading = lorentz(direction, direction);
            return bind([`If(abs(${leading})<=${roundoff},0,${leading})`, lorentz(start, direction), lorentz(start, start)], allocate,
              ([a, b, c]) => {
                const discriminant = sub(mul(b, b), mul(a, c));
                const tolerance = mul(roundoff, add([mul(b, b), `abs(${mul(a, c)})`]));
                return bind([`If(abs(${discriminant})<=${tolerance},0,${discriminant})`], allocate, ([disc]) => {
                  const root = `sqrt(${disc})`;
                  const q = `(-${b}-If(${b}>=0,${root},-${root}))`;
                  const linear = `-${c}/(2*${b})`;
                  const at = (t: string, guard: string) => bind([t], allocate, ([parameter]) =>
                    circle(start.map((value, i) => add([value, mul(parameter, direction[i])])),
                      `${independent}&&(${guard})`), 'number');
                  // Label roots by the sign of a*t+b, including the finite
                  // linear root when the other root moves to infinity.
                  const first = at(`If(${a}==0,${linear},If(${b}>=0,${q}/${a},${c}/${q}))`,
                    `(${a}!=0&&${disc}>=0)||(${a}==0&&${b}<0)`);
                  const second = at(`If(${a}==0,${linear},If(${b}<0,${q}/${a},${c}/${q}))`,
                    `(${a}!=0&&${disc}>0)||(${a}==0&&${b}>0)`);
                  return { expression: first, outputExpressions: [first, second] };
                }, 'number');
              }, 'number');
          }, 'number');
        }, 'number');
      }, 'number');
      outputs.push(...roots.outputExpressions!);
    }
    return { expression: outputs[0], outputExpressions: outputs };
  }, 'number');
};
