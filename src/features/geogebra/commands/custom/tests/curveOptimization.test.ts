import { describe, expect, it } from 'vitest';
import { compileStudioCommand } from '../commandCompiler';
import { outerCalls } from '../commandSyntax';
import { barycentricVariables, translatedConicCoefficients } from '../algebra/homogeneous';
import { circlePairRow, coaxalQuarticCoefficients, polynomialDeterminant, polynomialExpression, radialQuarticExpression } from '../algebra/polynomial';
import type { GeometryType } from '../types';
import { conjugateImagePolynomial } from '../builders/curves';

const scalar = (source: string, x = 0, y = 0) => Number(Function('x', 'y', `return ${source.replace(/\^/gu, '**')}`)(x, y));
const strings = (xs: number[]) => xs.map((x) => `(${x})`);
const conic = ([a, b, f, h, d, e]: number[], x: number, y: number) => a*x*x+b*y*y+f+h*x*y+d*x+e*y;

describe('Curve construction without copied geometry in scalar bindings', () => {
  it('keeps final curves outside local Zip bodies', () => {
    const objects = new Map<string, GeometryType>([
      ...['A', 'B', 'C', 'D', 'P'].map((p) => [p, 'point'] as [string, GeometryType]),
      ['l', 'line'], ['c', 'circle'], ['q', 'conic'], ['f', 'implicitCurve'],
    ]);
    const inspect = (source: string) => {
      for (const call of outerCalls(source)) {
        if (call.name === 'Zip') expect(call.args[0]).not.toMatch(/\b(?:Conic|ImplicitCurve|TriangleCurve|Reflect|Translate|Dilate|ApplyMatrix)\(/u);
        call.args.forEach(inspect);
      }
    };
    for (const source of [
      'PolarConic(P,f)', 'NinePointConic(A,B,C,D)', 'PivotalIsogonalCubic(A,B,C,P)',
      'QACu1(A,B,C,D)', 'OrthopivotalCubic(A,B,C,P)', 'QLQu3(A,B,C,D)',
      'QLTf1(A,B,C,D,l)', 'QLTf1(A,B,C,D,c)', 'QLTf1(A,B,C,D,q)', 'QLTf1(A,B,C,D,f)', 'QLCu1(A,B,l)',
      'IsogonalConjugate(A,B,C,l)', 'IsotomicConjugate(A,B,C,l)',
      'InconicWithCenter(A,B,C,P)', 'ApolloniusCircle(A,B,C)', 'OrthopolarConic(A,B,C,P)', 'StammlerHyperbola(A,B,C)',
      'Conic(l,l,l,l,l)',
    ]) inspect(compileStudioCommand(source, { objects, macros: new Set() }));
  });

  it('transports conic coefficients including circle-to-line limits', () => {
    for (const cs of [[2, 5, -3, 1, -3, 7], [0, 0, 3, 0, 2, -1], [1, 1, 0, 0, 2, 0]]) {
      const translated = translatedConicCoefficients(strings(cs), 'O').map((s) => scalar(s.replace(/x\(O\)/gu, '(2.3)').replace(/y\(O\)/gu, '(-1.7)')));
      for (const [x, y] of [[0, 0], [3, -2], [-1.1, 0.7]]) expect(conic(translated, x, y)).toBeCloseTo(conic(cs, x - 2.3, y + 1.7), 10);
    }
  });

  it('guards inactive image construction before native reflection and implicit plotting', () => {
    for (const type of ['conic', 'implicitCurve'] as const) {
      const objects = new Map<string, GeometryType>([...['A','B','C','D'].map((p) => [p,'point'] as [string, GeometryType]), ['F',type]]);
      const expression = compileStudioCommand('QLTf1(A,B,C,D,F)', { objects, macros: new Set() });
      expect(expression).toContain('Reflect(Reflect(If(');
      expect(expression).toContain('ImplicitCurve(If(!(');
      expect(expression).toMatch(/^If\(/u);
    }
  });

  it('guards the zero polynomial on the final curve rather than only on its function', () => {
    const objects = new Map<string, GeometryType>(['A','B','C','D'].map((p) => [p,'point']));
    for (const name of ['QACu1','OrthopivotalCubic','QLQu3']) {
      const expression = compileStudioCommand(`${name}(A,B,C,D)`, { objects, macros: new Set() });
      const call = outerCalls(expression)[0];
      expect(call.name).toBe('If');
      expect(call.args[0]).toContain('^2');
      expect(call.args[1]).toMatch(/^ImplicitCurve\(/u);
      expect(call.args[1]).toContain(',1+0*x+0*y)');
    }
  });

  it('uses signed linear area coordinates for arbitrary orientation and outside points', () => {
    for (const vertices of [[[0, 0], [4, 0], [3, 3]], [[3, 3], [4, 0], [0, 0]], [[-20, 30], [15, 6], [-8, -11]]]) {
      const linear = barycentricVariables(['A', 'B', 'C']).map((s) => s.replace(/[xy]\([ABC]\)/gu, (m) => '(' + String(vertices['ABC'.indexOf(m[2])][m[0] === 'x' ? 0 : 1]) + ')'));
      for (const p of [[0.3, 0.5], [9, -12]]) for (let i = 0; i < 3; i++) {
        const u = vertices[(i + 1) % 3]; const v = vertices[(i + 2) % 3];
        expect(scalar(linear[i], ...p)).toBeCloseTo((u[0]-p[0])*(v[1]-p[1])-(u[1]-p[1])*(v[0]-p[0]), 9);
      }
    }
  });

  it('matches the independent full coaxality determinant with nine radial coefficients', () => {
    const cases = [
      [[[0, 0], [3, 3]], [[4, 0], [-1, 2]], [[-9, 0], [12, -24]]],
      [[[0, 0], [3, 3]], [[4, 0], [1, 3]], [[1, 0, 0], [-3, -3, 1]]],
      [[[2, -3], [1, 4]], [[-5, 1], [7, -2]], [[4, -2, 3], [5, 7, -2]]],
    ];
    for (const pairs of cases) {
      const rows = pairs.map(([u, v]) => circlePairRow(strings(u), strings(v)));
      const data = rows.map(([s, d, e]) => [s.get('1,0')!, s.get('0,1')!, s.get('0,0')!, d.get('0,1')!, d.get('0,0')!, e.get('0,0')!]);
      const reduced = coaxalQuarticCoefficients(data).map((s) => `(${scalar(s)})`);
      const full = polynomialExpression(polynomialDeterminant(rows));
      for (const [x, y] of [[0.2, -0.7], [1, 1], [5.1, -3.7]]) {
        const expected = scalar(full, x, y);
        expect(Math.abs(scalar(radialQuarticExpression(reduced), x, y) - expected) / Math.max(1, Math.abs(expected))).toBeLessThan(1e-10);
      }
    }
  });

  it('assembles reduced circle and circular-cubic images with the correct conjugation and degree', () => {
    const image = (data: number[], degree: number, x: number, y: number) => {
      const expression = conjugateImagePolynomial('data', degree, () => 'packed');
      const zip = outerCalls(outerCalls(expression)[0].args[0])[0];
      const polynomial = zip.args[0].replace(/Element\(packed,(\d+)\)/gu, (_, index: string) => `(${data[Number(index)-1]})`);
      return Number(Function('x','y','If',`return ${polynomial.replace(/\^/gu,'**')}`)(x,y,(c: boolean,a: number,b = NaN) => c ? a : b));
    };
    // Circle about M=(1,-2), kappa=2+3i: rho(F(T(X))) = 13-rho(X).
    const circle = [1,1,-2, -1,0, 0,0, 0,0, 13,0];
    // F=rho*(x+2y)+x-1, T(z)=2/z. Independently clearing rho² gives
    // G=-rho²+2*x*rho+8*x-16*y, with inverse image 16*F.
    const forward = [2,0,0, -1,0, 1,0, 0,0, 0,0, 0,0, 4,-8, 0,0, 0,0, 0,0];
    const backward = [2,0,0, 0,0, 8,16, 0,0, 0,0, 0,0, 8,0, 0,0, 0,0, -16,0];
    for (const [x,y] of [[0.3,-0.7],[1,2],[-1.2,0.4]]) {
      expect(image(circle,2,x,y)).toBeCloseTo(13-(x-1)**2-(y+2)**2,10);
      const rho=x*x+y*y, u=2*x/rho, v=-2*y/rho;
      expect(image(forward,4,x,y)).toBeCloseTo(((u*u+v*v)*(u+2*v)+u-1)*rho*rho,9);
      expect(image(backward,4,x,y)).toBeCloseTo(16*(rho*(x+2*y)+x-1),9);
    }
  });
});


