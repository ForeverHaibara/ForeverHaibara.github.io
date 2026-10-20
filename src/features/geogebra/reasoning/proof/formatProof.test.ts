import { describe, expect, it } from 'vitest';
import { midpointProblem } from '../__fixtures__/problems';
import { exportAg2Proof } from '../backends/ag2/exportProblem';
import { focusProof, formatProofEquation, formatProofPredicate, proofNames, proofToMarkdown } from './formatProof';
import type { ReadableProof } from './types';

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
});
