/** Benchmark candidate only: no Zip, auxiliary geometry, or production registration. */
export const createQLCu1Equation = (vertices = ['A', 'B', 'C', 'D']) => {
  const [a, b, c, d] = vertices.map((p) => [`x(${p})`, `y(${p})`]);
  const add = (...terms: string[]) => `(${terms.join('+')})`;
  const sub = (p: string, q: string) => `((${p})-(${q}))`;
  const mul = (p: string, q: string) => `((${p})*(${q}))`;
  const square = (p: string) => `((${p})^2)`;
  const ba = b.map((p, i) => sub(p, a[i]));
  const da = d.map((p, i) => sub(p, a[i]));
  const q = b.map((p, i) => sub(add(p, d[i]), add(c[i], a[i])));
  const pr = sub(mul(ba[0], da[0]), mul(ba[1], da[1]));
  const pi = add(mul(ba[0], da[1]), mul(ba[1], da[0]));
  const denominator = add(square(q[0]), square(q[1]));
  const m = [add(a[0], `(${add(mul(pr, q[0]), mul(pi, q[1]))}/${denominator})`),
    add(a[1], `(${sub(mul(pi, q[0]), mul(pr, q[1]))}/${denominator})`)];
  // kappa = (A-M)(C-M) as a complex product; no square root or axis choice.
  const am = a.map((p, i) => sub(p, m[i]));
  const cm = c.map((p, i) => sub(p, m[i]));
  const u = sub(mul(am[0], cm[0]), mul(am[1], cm[1]));
  const v = add(mul(am[0], cm[1]), mul(am[1], cm[0]));
  // Twice the homogeneous line through the two diagonal midpoints.
  const ac = a.map((p, i) => add(p, c[i]));
  const bd = b.map((p, i) => add(p, d[i]));
  const nx = sub(ac[1], bd[1]);
  const ny = sub(bd[0], ac[0]);
  const constant = `(${sub(mul(ac[0], bd[1]), mul(ac[1], bd[0]))}/2)`;
  const wx = sub('x', m[0]); const wy = sub('y', m[1]);
  const localConstant = add(constant, mul(nx, m[0]), mul(ny, m[1]));
  const polynomial = add(mul(add(mul(nx, wx), mul(ny, wy), mul('2', localConstant)), add(square(wx), square(wy))),
    mul(nx, add(mul(u, wx), mul(v, wy))), mul(ny, sub(mul(v, wx), mul(u, wy))));
  // Match the existing finite-center/nonzero-kappa/defined-Newton-line domain.
  const guard = `${denominator}!=0&&${add(square(u), square(v))}!=0&&${add(square(nx), square(ny))}!=0`;
  return { polynomial, expression: `If(${guard},ImplicitCurve(${polynomial}))` };
};
