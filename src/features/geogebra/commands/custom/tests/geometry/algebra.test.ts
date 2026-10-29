import { describe, expect, it } from 'vitest';
import { cubicPolarConic, cubicPolarLine, cubicRestriction, CUBIC_MONOMIALS, CUBIC_COEFFICIENT_INDICES } from '../../builders/cubics';
import { isoconjugateWeights, crosspointWeights, cevapointWeights, cevaConjugateWeights, crossConjugateWeights, cyclocevianWeights, antigonalWeights, orthotransversalCoordinates } from '../../builders/triangle';
import { centeredConicShape } from '../../builders/quadrangle';
import { commonTangentNormal } from '../../builders/conics';

// Evaluate the scalar algebra emitted by the builders. No geometry engine is
// simulated: native construction/API behavior belongs to the browser suite.
const scalar = (expression: string) => Number(Function('Distance', 'A', 'B', 'C', `return ${expression.replace(/\^/gu, '**')}`)(
  (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]), [0, 0], [6, 0], [0, 4]));
const normalized = (p: number[]) => p.map((value) => value / p.reduce((sum, x) => sum + x, 0));
const strings = (p: number[]) => p.map(String);
const map = (transform: typeof isoconjugateWeights, ...points: number[][]) => normalized(transform(points.map(strings), ['A', 'B', 'C']).map(scalar));
const close = (p: number[], q: number[]) => p.forEach((value, i) => expect(value).toBeCloseTo(q[i], 8));

describe('homogeneous triangle-map identities', () => {
  const p = normalized([2, -1, 4]);
  const q = normalized([3, 5, -2]);
  const x = normalized([-1, 3, 7]);

  it('fixes X, exchanges X and Y, and is involutory with exterior signed coordinates', () => {
    close(map(isoconjugateWeights, x, x), x);
    close(map(isoconjugateWeights, x, q, x), q);
    close(map(isoconjugateWeights, x, q, map(isoconjugateWeights, x, q, p)), p);
  });

  it('satisfies the defining relations of Ceva and cross conjugation', () => {
    close(map(cevapointWeights, p, q), map(cevapointWeights, q, p));
    close(map(crosspointWeights, p, q), map(crosspointWeights, q, p));
    close(map(cevaConjugateWeights, map(cevapointWeights, p, q), p), q);
    close(map(crossConjugateWeights, map(crosspointWeights, p, q), p), q);
    close(map(cevaConjugateWeights, x, map(cevaConjugateWeights, x, p)), p);
    close(map(crossConjugateWeights, x, map(crossConjugateWeights, x, p)), p);
  });

  it('retains homogeneous scaling and a sideline limit without reciprocal poles', () => {
    close(map(isoconjugateWeights, x.map((value) => value * -1000), p.map((value) => value * 0.002)), map(isoconjugateWeights, x, p));
    close(map(isoconjugateWeights, x, [0, 0.3, 0.7]), [1, 0, 0]);
  });

  it('makes antigonal conjugation involutory and sends an ordinary circumcircle point to H', () => {
    close(map(antigonalWeights, map(antigonalWeights, p)), p);
    const px = 3 + Math.sqrt(13) * Math.cos(0.7);
    const py = 2 + Math.sqrt(13) * Math.sin(0.7);
    close(map(antigonalWeights, [1 - px / 6 - py / 4, px / 6, py / 4]), [1, 0, 0]);
  });

  it('extends cyclocevian conjugation through an intermediate isotomic point at infinity', () => {
    close(map(cyclocevianWeights, map(cyclocevianWeights, p)), p);
    const pole = normalized([1, 1, -0.5]); // pq+qr+rp=0
    const image = map(cyclocevianWeights, pole);
    expect(image.every(Number.isFinite)).toBe(true);
    close(map(cyclocevianWeights, image), pole);
    close(map(cyclocevianWeights, normalized([1, 1, -0.5 + 1e-11])), image);
  });

  it('retains the orthotransversal at infinity so the orthocorrespondent of H is G', () => {
    const vertices = [['0', '0', '1'], ['6', '0', '1'], ['1', '4', '1']];
    const [a, b, c] = orthotransversalCoordinates(vertices, ['1', '1.25', '1']).map(scalar);
    expect(a).toBeCloseTo(0, 10);
    expect(b).toBeCloseTo(0, 10);
    expect(Math.abs(c)).toBeGreaterThan(0);
    const weights = vertices.map(([x, y]) => a * Number(x) + b * Number(y) + c);
    close(normalized(weights.map((_, i) => weights[(i + 1) % 3] * weights[(i + 2) % 3])), [1 / 3, 1 / 3, 1 / 3]);
  });
});

describe('conic and tangent degenerations', () => {
  it('retains all six midpoint incidences, including a parallelogram degeneration', () => {
    for (const d of [[-2, 3], [-5, 4]]) {
      const vertices = [[0, 0], [6, 0], [1, 4], d];
      const center = [0, 1].map((i) => vertices.reduce((sum, p) => sum + p[i], 0) / 4);
      const midpoint = (p: number[], q: number[]) => p.map((value, i) => (value + q[i]) / 2 - center[i]);
      const row = ([x, y]: number[]) => [x * x, y * y, x * y];
      const rows = vertices.slice(1).map((p) => row(midpoint(vertices[0], p)));
      const shape = centeredConicShape(rows.map(strings)).map(scalar);
      const dot = (p: number[]) => shape.reduce((sum, value, i) => sum + value * p[i], 0);
      expect(Math.hypot(...shape)).toBeGreaterThan(0);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        expect(dot(row(midpoint(vertices[i], vertices[j]))) - dot(rows[0])).toBeCloseTo(0, 9);
      }
    }
  });

  it('keeps unit tangent normals at equal radii and merges both branches at tangency', () => {
    for (const difference of [0, -1, 3, 6]) {
      const normals = [1, -1].map((sign) => commonTangentNormal('6', '0', String(difference), '36', String(Math.sqrt(36 - difference ** 2)), sign).map(scalar));
      for (const n of normals) {
        expect(Math.hypot(...n)).toBeCloseTo(1, 10);
        expect(6 * n[0]).toBeCloseTo(difference, 10);
      }
      if (difference === 6) close(normals[0], normals[1]);
    }
  });
});

describe('homogeneous cubic algebra', () => {
  const c = [4, -3, 2, 5, -2, 7, 1, 3, -4, 2];
  const f = (x: number, y: number, z = 1) => c.reduce((sum, a, k) => {
    const [i, j] = CUBIC_MONOMIALS[k];
    return sum + a * x ** i * y ** j * z ** (3 - i - j);
  }, 0);

  it('encodes every cubic monomial without collisions and preserves sparse trailing zeros', () => {
    expect(new Set(CUBIC_COEFFICIENT_INDICES).size).toBe(10);
    for (const coefficients of [c, [0, 0, 0, 0, 0, 0, 2, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 3]]) {
      const encoded = Array<number>(13).fill(0);
      coefficients.forEach((value, i) => { encoded[CUBIC_COEFFICIENT_INDICES[i] - 1] = value; });
      // Coefficients returns descending powers and omits zero leading terms.
      while (encoded.length > 1 && encoded.at(-1) === 0) encoded.pop();
      const padded = [...encoded, ...Array<number>(13).fill(0)];
      expect(CUBIC_COEFFICIENT_INDICES.map((index) => padded[index - 1])).toEqual(coefficients);
      for (const x of [-2, -0.5, 0, 1.25]) {
        const restricted = encoded.reduce((sum, value, exponent) => sum + value * x ** exponent, 0);
        const original = coefficients.reduce((sum, value, i) => sum + value * x ** CUBIC_MONOMIALS[i][0] * (x ** 4) ** CUBIC_MONOMIALS[i][1], 0);
        expect(restricted).toBeCloseTo(original, 9);
      }
    }
  });

  it('satisfies Euler polarity identities, including the constant and lower-degree terms', () => {
    const p = [1.2, -0.4];
    const x = [-0.7, 2.1];
    const line = cubicPolarLine(strings(c), ...strings(p) as [string, string]).map(scalar);
    expect(line[0] * p[0] + line[1] * p[1] + line[2]).toBeCloseTo(3 * f(...p as [number, number]), 9);
    const [a, b, k, d, e, g] = cubicPolarConic(strings(c), ...strings(p) as [string, string]).map(scalar);
    const polar = a * x[0] ** 2 + b * x[1] ** 2 + k + d * x[0] * x[1] + e * x[0] + g * x[1];
    // For a homogeneous cubic, [F(X+P)-F(X-P)-2F(P)]/2 = DP F(X).
    const identity = (f(x[0] + p[0], x[1] + p[1], 2) - f(x[0] - p[0], x[1] - p[1], 0) - 2 * f(...p as [number, number])) / 2;
    expect(polar).toBeCloseTo(identity, 9);
  });

  it('restricts a cubic without a slope chart and recovers secant and tangent residual roots', () => {
    // f=x^3-3xy^2+2y+5. The known intersections on y=0 have x^3=-5;
    // instead use the reducible test f=x(x-1)(x-2)+y for exact real roots.
    const curve = [0, 2, 1, -3, 0, 0, 1, 0, 0, 0];
    const [a, b] = cubicRestriction(strings(curve), '0', '0', '1', '0').map(scalar);
    expect(-b / a - 1).toBe(2);
    const [ta, tb] = cubicRestriction(strings(curve), '0', '0', '1', '-2').map(scalar);
    const t = -tb / ta;
    expect(t ** 3 - 3 * t ** 2 + 2 * t - 2 * t).toBeCloseTo(0, 10);
    // At an inflection, the residual third intersection is the same point.
    const inflection = [0, 0, -1, 0, 0, 0, 1, 0, 0, 0];
    const [ia, ib] = cubicRestriction(strings(inflection), '0', '0', '1', '0').map(scalar);
    expect(-ib / ia).toBeCloseTo(0, 10);
  });

  it('treats vertical secants exactly like other directions', () => {
    const curve = [0, 1, 2, 0, 0, -3, 0, 0, 0, 1];
    const [a, b] = cubicRestriction(strings(curve), '0', '0', '0', '1').map(scalar);
    expect(-b / a - 1).toBe(2);
  });
});
