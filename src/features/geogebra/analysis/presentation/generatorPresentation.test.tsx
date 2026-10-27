import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DirectionModel, LengthModel } from '../geometryTypes';
import { formatLengthMember, presentDirectionModel, presentLengthModel } from './generatorPresentation';
import { GeneratorDetails } from '../../components/analysis/GeneratorDetails';

const lengthModel: LengthModel = {
  anchor: ['D', 'E'], generators: [['D', 'F'], ['E', 'F']], constraintRank: 2,
  members: [
    { segment: ['D', 'E'], denominator: 1, coefficients: [0, 0], ratio: [1, 1], residual: 0 },
    { segment: ['D', 'F'], denominator: 1, coefficients: [1, 0], ratio: [1, 1], residual: 0 },
    { segment: ['E', 'F'], denominator: 1, coefficients: [0, 1], ratio: [1, 1], residual: 0 },
    { segment: ['E', 'L'], denominator: 1, coefficients: [0, 1], ratio: [1, 2], residual: 0 },
    { segment: ['F', 'L'], denominator: 2, coefficients: [0, 2], ratio: [1, 4], residual: 0 },
  ],
};

describe('length generator equations in original geometric quantities', () => {
  it('removes the reported reference/basis identities and merges the two half lengths', () => {
    const shown = presentLengthModel(lengthModel);
    expect(shown.identities).toBe(3);
    expect(shown.equations).toEqual(['2 × (dist(E, L) = dist(F, L)) = dist(E, F)']);
    expect(formatLengthMember(lengthModel, lengthModel.members[0])).toBeNull();
    expect(formatLengthMember(lengthModel, lengthModel.members[3])).toBe('2 × dist(E, L) = dist(E, F)');
    expect(shown.equations.join(' ')).not.toContain('/');
  });
  it('cancels denominator factors, negative powers and a shared reference before display', () => {
    const model: LengthModel = { anchor: ['A', 'B'], generators: [['A', 'C']], constraintRank: 2, members: [
      { segment: ['A', 'D'], denominator: 1, coefficients: [-1], ratio: [1, 1], residual: 0 },
      { segment: ['A', 'E'], denominator: 2, coefficients: [2], ratio: [1, 1], residual: 0 },
    ] };
    expect(presentLengthModel(model).equations).toEqual(['dist(A, D) × dist(A, C) = dist(A, B)^2', 'dist(A, E) = dist(A, C)']);
  });
  it('keeps essential rational powers and does not turn L²=2R² into L=2R', () => {
    const model: LengthModel = { anchor: ['A', 'B'], generators: [], constraintRank: 1, members: [
      { segment: ['A', 'D'], denominator: 2, coefficients: [], ratio: [2, 1], residual: 0 },
    ] };
    expect(presentLengthModel(model).equations).toEqual(['dist(A, D)^2 = 2 × dist(A, B)^2']);
  });
  it('normalizes reversed segment names and coefficients without mutating the snapshot', () => {
    const model: LengthModel = { ...lengthModel, members: [...lengthModel.members,
      { segment: ['F', 'D'], denominator: 3, coefficients: [3, 0], ratio: [1, 1], residual: 0 }] };
    const before = JSON.stringify(model);
    expect(presentLengthModel(model).identities).toBe(4);
    expect(JSON.stringify(model)).toBe(before);
  });
  it('joins equal and proportional groups into one primitive chain', () => {
    const model: LengthModel = { anchor: ['A', 'B'], generators: [['B', 'C']], constraintRank: 3, members: [
      { segment: ['B', 'C'], denominator: 1, coefficients: [1], ratio: [1, 1], residual: 0 },
      { segment: ['A', 'P'], denominator: 1, coefficients: [1], ratio: [1, 2], residual: 0 },
      { segment: ['B', 'P'], denominator: 1, coefficients: [1], ratio: [1, 1], residual: 0 },
      { segment: ['C', 'P'], denominator: 1, coefficients: [1], ratio: [2, 1], residual: 0 },
    ] };
    expect(presentLengthModel(model).equations).toEqual(['4 × dist(A, P) = 2 × (dist(B, C) = dist(B, P)) = dist(C, P)']);
  });
  it('shows reduced equations in the actual component', () => {
    const html = renderToStaticMarkup(<GeneratorDetails lengthModel={lengthModel} />);
    expect(html).toContain('2 × (dist(E, L) = dist(F, L)) = dist(E, F)');
    expect(html).not.toContain('dist(D, E) / dist(D, E)');
  });
});

describe('direction generator descriptions', () => {
  const model: DirectionModel = { anchor: ['A', 'B'], generators: [['A', 'C'], ['B', 'C']], pointCover: ['A', 'B', 'C'], constraintRank: 5,
    members: [
      { line: ['A', 'B'], denominator: 1, coefficients: [0, 0], constant: 0, residual: 0 },
      { line: ['A', 'C'], denominator: 1, coefficients: [1, 0], constant: 0, residual: 0 },
      { line: ['B', 'C'], denominator: 1, coefficients: [0, 1], constant: 0, residual: 0 },
      { line: ['D', 'E'], denominator: 1, coefficients: [1, 0], constant: 0, residual: 0 },
      { line: ['F', 'G'], denominator: 2, coefficients: [2, 0], constant: 0, residual: 0 },
      { line: ['H', 'I'], denominator: 2, coefficients: [0, 0], constant: 1, residual: 0 },
      { line: ['J', 'K'], denominator: 1, coefficients: [1, -1], constant: 0, residual: 0 },
      { line: ['L', 'M'], denominator: 2, coefficients: [0, 0], constant: 3, residual: 0 },
    ] };
  it('removes basis identities and groups parallel/perpendicular descriptions while retaining the pi branch', () => {
    const shown = presentDirectionModel(model);
    expect(shown.identities).toBe(3);
    expect(shown.equations).toEqual(['D·E ∥ F·G ∥ A·C', '(H·I ∥ L·M) ⊥ A·B', '∠(A·B, J·K) = ∠(B·C, A·C)']);
  });
  it('uses ∠ throughout the component and removes zero coefficients and + negative terms', () => {
    const html = renderToStaticMarkup(<GeneratorDetails model={model} />);
    expect(html).toContain('∠(A·B, A·C)');
    expect(html).not.toContain('δ');
    expect(html).not.toContain('0∠');
    expect(html).not.toContain('+ -');
  });
  it('retains a nonorthogonal pi fraction after simplifying a real lift', () => {
    const fixed: DirectionModel = { ...model, generators: [], members: [{ line: ['D', 'E'], denominator: 3, coefficients: [], constant: -2, residual: 0 }] };
    expect(presentDirectionModel(fixed).equations).toEqual(['∠(A·B, D·E) = π/3']);
  });
});
