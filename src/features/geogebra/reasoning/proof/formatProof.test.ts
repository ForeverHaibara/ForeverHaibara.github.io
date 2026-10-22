import { describe, expect, it } from 'vitest';
import { midpointProblem } from '../__fixtures__/problems';
import { exportAg2Proof } from '../backends/ag2/exportProblem';
import { focusProof, formatProofEquation, formatProofPredicate, proofNames, proofToMarkdown } from './formatProof';
import type { ReadableProof } from './types';
import katex from 'katex';

const payload = () => exportAg2Proof(midpointProblem(), { acceptedIds: ['m-midpoint', 'n-midpoint'], goalId: 'midsegment' }).value!;
describe('readable proof presentation', () => {
  it('uses actual point names and preserves exact coefficients and the angular modulus', () => {
    expect(formatProofPredicate('para p1 p2 p3 p4', payload())).toBe('(B, C) ∥ (M, N)');
    expect(formatProofPredicate('angeq p0 p1 p0 p2 1 -1 -90', payload())).toBe('dir(A, B) − dir(A, C) − 90° = 0 (mod π)');
    expect(formatProofEquation({ domain: 'angle', terms: [{ variable: 'dir(p0,p1)', coefficient: '2' }, { variable: 'dir(p0,p2)', coefficient: '-1/2' }] }, payload())).toBe('2 × dir(A,B) − 1/2 × dir(A,C) = 0 (mod π)');
    expect(proofNames('p10 and p1', { ...payload(), names: [{ id: 'x', symbol: 'p1', name: 'X' }, { id: 'y', symbol: 'p10', name: 'Y' }] })).toBe('Y and X');
  });
  it('exports the trust boundary, branch guards and missing explanations', () => {
    const proof: ReadableProof = { version: 1, mode: 'ddar', explanation: 'partial', nodes: [
      { id: 's9', kind: 'guard', rule: 'witness-line-order', premises: [], points: ['p0', 'p3', 'p1'] },
      { id: 's20', kind: 'gap', rule: 'unreconstructed-ddar-conclusion', premises: [{ id: 's9', coefficient: '1' }], predicate: 'para p1 p2 p3 p4' },
    ], conclusions: [{ predicate: 'para p1 p2 p3 p4', nodeId: 's20', backendKnown: true, status: 'unexplained' }], assumptionIds: [], contradictionIds: [], gapIds: ['s20'], guardIds: ['s9'], algebraReplay: { checked: 0, valid: true, errors: [] }, witnessFailures: [], limited: false, certificate: null };
    const markdown = proofToMarkdown(proof, payload());
    expect(markdown).toContain('not a full independent geometry certificate');
    expect(markdown).toContain('A → M → B'); expect(markdown).toContain('from [1]');
    expect(markdown).toContain('Unreconstructed step'); expect(markdown).not.toContain('p1');
    const focused = focusProof(proof, 's9');
    expect(focused.nodes.map((node) => node.id)).toEqual(['s9']);
    expect(focused.gapIds).toEqual([]); expect(focused.explanation).toBe('recorded');
  });
  it('shows exact length products as geometric identities and keeps fractional log rows explicit', () => {
    expect(formatProofPredicate('distmeq p0 p3 p0 p4 p0 p1 1 1 -2 1', payload())).toBe('|A, M| · |A, N| = |A, B|²');
    expect(formatProofPredicate('distmeq p0 p1 p0 p3 1 -1 1/2', payload())).toBe('|A, B| = |A, M| · 2');
    expect(formatProofEquation({ domain: 'length-product', terms: [
      { variable: 'log(|p0 p1|)', coefficient: '2' }, { variable: 'log(|p0 p3|)', coefficient: '-1' },
      { variable: 'log(2)', coefficient: '-1' },
    ] }, payload())).toBe('|A B|² = |A M| · 2');
    expect(formatProofEquation({ domain: 'length-product', terms: [{ variable: 'log(|p0 p1|)', coefficient: '1/2' }] }, payload())).toContain('1/2 × log |A B|');
  });
  it('separates vector products from their signed scalar coefficients', () => {
    const equation = { domain: 'dot' as const, terms: [
      { variable: 'dot(p1,p1)', coefficient: '-1' }, { variable: 'dot(p1,p2)', coefficient: '-1' },
      { variable: 'dot(p1,p3)', coefficient: '2' },
    ] };
    expect(formatProofEquation(equation, payload())).toBe('−(vec(B) · vec(B)) − (vec(B) · vec(C)) + 2 (vec(B) · vec(M)) = 0');
    const cross = { domain: 'cross' as const, terms: [{ variable: 'cross(p0,p1)', coefficient: '-1/2' }] };
    expect(formatProofEquation(cross, payload())).toBe('−(1/2) (vec(A) × vec(B)) = 0');
    const latex = formatProofEquation(cross, payload(), 'latex');
    expect(latex).toContain('\\frac{1}{2}'); expect(latex).toContain('\\times');
    expect(latex).not.toContain('O₀');
    expect(() => katex.renderToString(latex, { throwOnError: true, strict: 'error' })).not.toThrow();
    expect(() => katex.renderToString(formatProofEquation(equation, payload(), 'latex'), { throwOnError: true, strict: 'error' })).not.toThrow();
  });
  it('exports vector statements as inline mathematics in both steps and conclusions', () => {
    const proof: ReadableProof = { version: 1, mode: 'hypothetical', explanation: 'recorded', nodes: [
      { id: 's1', kind: 'assumption', rule: 'accepted-condition', premises: [], equation: { domain: 'dot',
        terms: [{ variable: 'dot(p0,p1)', coefficient: '1' }] } },
    ], conclusions: [{ nodeId: 's1', backendKnown: false, status: 'assumed' }], assumptionIds: ['s1'], contradictionIds: [], gapIds: [], guardIds: [],
    algebraReplay: { checked: 0, valid: true, errors: [] }, witnessFailures: [], limited: false, certificate: null };
    const markdown = proofToMarkdown(proof, payload());
    const formula = '$\\left(\\overrightarrow{\\text{A}} \\cdot \\overrightarrow{\\text{B}}\\right) = 0$';
    expect(markdown).toContain(`1. ${formula}.`);
    expect(markdown).toContain(`- ${formula}: assumed [1].`);
    expect(markdown).not.toContain('O₀');
  });
});
