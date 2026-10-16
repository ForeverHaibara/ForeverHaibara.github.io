import { describe, expect, it } from 'vitest';
import { compileStudioCommand } from './commandCompiler';
import { studioToolLibrary, selectOverload } from './toolLibrary';
import { scimemiCoordinates, qaCubicCoefficients } from './p3TriangleBuilders';
import { complexBasisCoefficient, QUARTIC_MONOMIALS } from './qlCurveTransforms';
import { circlePairRow, polynomialDeterminant, polynomialExpression } from './polynomialGeometry';
import type { CommandEnvironment, GeometryType, ParameterType } from './types';

const names = ['BrocardAxis', 'LemoineAxis', 'OrthicAxis', 'SoddyPoint', 'LiangZelichPerspector', 'StammlerHyperbola', 'OrthopolarConic', 'CundyParryPhi', 'CundyParryPsi', 'CoTf3', 'InvCoTf3', 'QAP2', 'QAP3', 'QAP4', 'QAP5', 'QL2P1', 'QL2P2', 'QL2P3', 'QLP3', 'QLP4', 'QLP5', 'QLP6', 'QLP7', 'QLP19', 'QLP20', 'QLP21', 'QLTf1', 'QLCi3', 'QLCi5', 'QLCi6', 'QLCu1', 'QACu1', 'QLQu3', 'OrthopivotalCubic'];
const environment = (): CommandEnvironment => ({ objects: new Map<string, GeometryType>([
  ...['A', 'B', 'C', 'D', 'P'].map((p) => [p, 'point'] as [string, GeometryType]),
  ['l', 'line'], ['s', 'segment'], ['r', 'ray'], ['c', 'circle'], ['q', 'conic'], ['F', 'implicitCurve'],
]), macros: new Set() });
const compile = (source: string) => compileStudioCommand(source, environment());
const scalar = (source: string, x = 0, y = 0) => Number(Function('x', 'y', `return ${source.replace(/\^/gu, '**')}`)(x, y));
const strings = (ns: number[]) => ns.map((n) => `(${n})`);
const close = (p: number[], q: number[]) => p.forEach((v, i) => expect(v).toBeCloseTo(q[i], 8));
const actualType = (type: ParameterType): GeometryType => type === 'lineLike' ? 'segment' : type === 'pointOrLine' ? 'point' : type;

describe('P3 catalog, type contracts and expansion budgets', () => {
  it('compiles every new overload with native dependencies and bounded expressions', () => {
    const tools = studioToolLibrary.tools.filter((t) => names.includes(t.name));
    expect(tools).toHaveLength(34);
    expect(tools.reduce((n, t) => n + t.overloads.length, 0)).toBe(42);
    for (const tool of tools) for (const overload of tool.overloads) {
      const scope: CommandEnvironment = { objects: new Map(), macros: new Set() };
      const args = overload.params.map((p, i) => {
        if (p.type === 'number') return '1';
        const label = `LongInputLabel${i}`; scope.objects.set(label, actualType(p.type)); return label;
      });
      const expanded = compileStudioCommand(`${tool.name}(${args.join(',')})`, scope);
      expect(expanded).not.toMatch(/Locus\(|SetValue\(|SetCoords\(|Execute\(|Derivative\(/u);
      expect(expanded.length, `${tool.name}: ${expanded.length}`).toBeLessThan(30_000);
      // Native names and finite support parameters are independently audited by nativeCommands.test.ts.
    }
  });

  it('preserves independent pair outputs and nested/index selection', () => {
    for (const name of ['QL2P1', 'QL2P2', 'QL2P3']) {
      expect(compile(`Pair=${name}(A,B,C,D)`).split('\n')).toHaveLength(2);
      expect(compile(`${name}(A,B,C,D,2)`)).toContain('floor');
      expect(compile(`Line(${name}(A,B,C,D),P)`)).not.toContain('\n');
    }
    expect(compile('QL2P3(A,B,C,D)')).toContain('sqrt(ToComplex(');
  });

  it('keeps generalized circle and higher-curve result types fixed', () => {
    const tool = studioToolLibrary.tools.find((t) => t.name === 'QLTf1')!;
    for (const [input, result] of [['point', 'point'], ['segment', 'conic'], ['ray', 'conic'], ['line', 'conic'], ['circle', 'conic'], ['conic', 'implicitCurve'], ['implicitCurve', 'implicitCurve']] as const) {
      expect(selectOverload(tool, [...Array.from({ length: 4 }, () => ({ type: 'point' as const, expression: 'P' })), { type: input, expression: 'o' }])?.returns).toBe(result);
    }
    expect(() => compile('QLTf1(A,B,C,D,1)')).toThrow('No overload');
    expect(compile('QLTf1(A,B,C,D,F)')).toContain('AreEqual');
    expect(compile('QLTf1(A,B,C,D,F)')).toMatch(/Coefficients\(v\d+\(x,x\^5\)/u);
    for (const l of ['l', 's', 'r']) expect(compile(`QLTf1(A,B,C,D,${l})`)).toContain('Conic');
    expect(compile('Line(QLP5(A,B,C,D),P)')).toContain('TriangleCenter');
  });

  it('protects nested scopes and preserves file macro precedence', () => {
    const scope = environment(); scope.objects.set('v1', 'point');
    const source = 'QLTf1(A,B,C,D,CoTf3(v1,q))';
    expect(compileStudioCommand(source, scope)).not.toMatch(/,v1,\{/u);
    scope.macros.add('qap2');
    expect(compileStudioCommand('QAP2(A,B,C,D)', scope)).toBe('QAP2(A,B,C,D)');
    expect(compileStudioCommand('QAP3(A,B,C,D)', scope)).toContain('Determinant');
  });
});

describe('P3 independent scalar identities', () => {
  const transform = (c: number[], p: number[], inverse = false) => scimemiCoordinates(strings(c), strings(p), inverse).map((v) => scalar(v));
  it('makes the Scimemi maps inverse affine similarities including translation and scale', () => {
    for (const c of [[2, 5, 1, -3, 7], [2, -5, 3, 4, -2], [1, 0, 0, 0, -1]]) {
      const p = [2.1, -4.3]; close(transform(c, transform(c, p), true), p);
      close(transform(c.map((v) => v * -17), p), transform(c, p));
      const a = transform(c, [0, 0]); const b = transform(c, [1, 0]); const d = transform(c, [0, 1]);
      expect((b[0] - a[0]) * (d[0] - a[0]) + (b[1] - a[1]) * (d[1] - a[1])).toBeCloseTo(0, 10);
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(Math.hypot(d[0] - a[0], d[1] - a[1]), 10);
    }
    close(transform([1, 1, 0, -4, 6], [8, 9]), [2, -3]); // circle -> center
    close(transform([1, -1, 0, -4, 6], [8, 9], true), [2, 3]); // rectangular hyperbola inverse
    close(transform([1, 0, 0, 0, -1], [3, 4]), [-3, 5]); // y=x²
  });

  it('reconstructs arbitrary real quartics from the complex-coordinate coefficients', () => {
    const cs = QUARTIC_MONOMIALS.map((_, i) => i % 3 === 0 ? 0 : i - 5);
    for (const [x, y] of [[0.3, -1.7], [2, 1], [-0.4, 0.2]]) {
      const multiply = (a: number[], b: number[]) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
      const pow = (z: number[], n: number) => Array.from({ length: n }).reduce<number[]>((a) => multiply(a, z), [1, 0]);
      let sum = 0;
      for (let n = 0; n <= 4; n++) for (let j = 0; j <= n; j++) {
        const i = n - j; const c = complexBasisCoefficient(strings(cs), QUARTIC_MONOMIALS, i, j).map((v) => scalar(v));
        sum += multiply(c, multiply(pow([x, y], i), pow([x, -y], j)))[0];
      }
      expect(sum).toBeCloseTo(cs.reduce((v, c, k) => v + c * x ** QUARTIC_MONOMIALS[k][0] * y ** QUARTIC_MONOMIALS[k][1], 0), 8);
    }
  });

  it('generates circle pencils and the reduced quartic without circle-center denominators', () => {
    const pairs = [[[0, 0], [3, 3]], [[4, 0], [-1, 2]], [[-9, 0], [12, -24]]];
    const rows = pairs.map(([u, v]) => circlePairRow(strings(u), strings(v)));
    for (let i = 0; i < rows.length; i++) for (const p of [[1, 1], [-2, 3]]) {
      const [s, d, e] = rows[i].map((poly) => scalar(polynomialExpression(poly), ...p));
      const [u, v] = pairs[i]; const f = -s * (p[0] ** 2 + p[1] ** 2) - d * p[0] - e * p[1];
      for (const q of [u, v]) expect(s * (q[0] ** 2 + q[1] ** 2) + d * q[0] + e * q[1] + f).toBeCloseTo(0, 8);
    }
    const det = polynomialDeterminant(rows);
    for (const [key, value] of det) if (key.split(',').map(Number).reduce((a, b) => a + b, 0) > 4) expect(scalar(value)).toBe(0);
    // Independently derived exact quartic for this complete quadrilateral.
    for (const [x, y] of [[1, 1], [0.3, 0.7], [-1, 4]]) {
      const expected = 2808 * (2*x**4+x**3+4*x*x*y*y+54*x*x*y-117*x*x+x*y*y-210*x*y+324*x+2*y**4+54*y**3-267*y*y+252*y);
      expect(scalar(polynomialExpression(det), x, y)).toBeCloseTo(expected, 5);
    }
  });

  it('retains homogeneous scaling and the one-infinite-diagonal quartic limit', () => {
    const finite = circlePairRow(strings([3, -2]), strings([1, 2]));
    const homogeneous = circlePairRow(strings([12, -8, 4]), strings([-5, -10, -5]));
    for (let i = 0; i < 3; i++) expect(scalar(polynomialExpression(homogeneous[i]), 0.3, 1.7)).toBeCloseTo(400 * scalar(polynomialExpression(finite[i]), 0.3, 1.7), 8);
    // A trapezoid: AB parallel CD, E=(1:0:0), F=(-3,-3). No affine E is constructed.
    const rows = [circlePairRow(strings([0, 0]), strings([3, 3])), circlePairRow(strings([4, 0]), strings([1, 3])), circlePairRow(strings([1, 0, 0]), strings([-3, -3, 1]))];
    const quartic = polynomialDeterminant(rows);
    expect([...quartic.values()].some((coefficient) => Math.abs(scalar(coefficient)) > 1)).toBe(true);
    const degenerateCircle = rows[2].map((p) => scalar(polynomialExpression(p), 2, 1));
    expect(degenerateCircle[0]).toBe(0);
    const [, dx, dy] = degenerateCircle;
    expect(dx * (-3 - 2) + dy * (-3 - 1)).toBeCloseTo(0, 10);
  });

  it('uses the sign-corrected QA cubic and agrees with an independent coaxality polynomial', () => {
    const s = [10, 18, 16]; const p = [13 / 12, -3 / 4, 2 / 3];
    const t = p.map((v, i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      return s[i] * (v + p[j]) * (v + p[k]) - s[j] * v * (v + p[j]) - s[k] * v * (v + p[k]);
    });
    const coefficients = qaCubicCoefficients(strings(s), strings(p), strings(t)).map((v) => scalar(v));
    for (const [x, y] of [[1, 1], [-0.2, 2.5], [3, -1]]) {
      const bary = [1 - x / 4 - y / 12, x / 4 - y / 4, y / 3];
      const actual = bary.reduce((v, _, i) => {
        const j = (i + 1) % 3; const k = (i + 2) % 3;
        return v + coefficients[2 * i] * bary[j] ** 2 * bary[k] + coefficients[2 * i + 1] * bary[j] * bary[k] ** 2;
      }, 0);
      const expected = -(13*x**3-6*x*x*y+65*x*x+13*x*y*y+158*x*y-468*x-6*y**3-281*y*y+516*y)/12;
      expect(actual).toBeCloseTo(expected, 8);
    }
  });
});
