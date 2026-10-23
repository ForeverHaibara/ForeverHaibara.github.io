import { describe, expect, it } from 'vitest';
import { proofOutcome } from './proofOutcome';
import type { Ag2RunResult } from '../backends/ag2/protocol';
import type { ReadableProof } from './types';

const proof = (): ReadableProof => ({ version: 1, mode: 'ddar', nodes: [], conclusions: [], assumptionIds: [], contradictionIds: [], gapIds: [], guardIds: [], algebraReplay: { checked: 1, valid: true, errors: [] }, witnessFailures: [], limited: false, explanation: 'recorded', certificate: null });
const result = (status: Ag2RunResult['status'] = 'derived'): Ag2RunResult => ({ status, checks: [true], elapsedMs: 10, points: 5, assumptions: 2, certificate: null, proof: proof() });

describe('proof action status', () => {
  it('distinguishes a derived goal, already assumed goal and an unsuccessful search', () => {
    expect(proofOutcome(result(), true, null)).toMatchObject({ tone: 'success', label: 'Goal derived' });
    expect(proofOutcome(result('already-assumed'), true, null)).toMatchObject({ tone: 'neutral', label: 'Goal already given' });
    expect(proofOutcome(result('not-derived'), true, null)).toMatchObject({ tone: 'warning', label: 'Goal not derived' });
  });
  it('reports actual additional conclusions when no goal is selected', () => {
    const answer = result();
    answer.proof!.conclusions = [{ nodeId: 'a', status: 'recorded', backendKnown: true }, { nodeId: 'b', status: 'assumed', backendKnown: true }, { nodeId: null, status: 'not-derived', backendKnown: false }];
    expect(proofOutcome(answer, false, null)).toMatchObject({ label: '1 conclusion derived', tone: 'success' });
    expect(proofOutcome(result(), false, null)).toMatchObject({ label: 'No new conclusions', tone: 'neutral' });
  });
  it('does not label partial derivations or failed checks as complete proofs', () => {
    const answer = result();
    answer.proof!.explanation = 'partial';
    expect(proofOutcome(answer, true, null)).toMatchObject({ tone: 'warning', label: 'Goal derived · partial explanation' });
    answer.proof!.algebraReplay.valid = false;
    expect(proofOutcome(answer, true, null)).toMatchObject({ tone: 'error', label: 'Proof check failed' });
    answer.proof!.contradictionIds = ['conflict'];
    expect(proofOutcome(answer, true, null)).toMatchObject({ tone: 'error', label: 'Inconsistent conditions' });
  });
  it('keeps failures and hypothesis context explicit', () => {
    const answer = result(); answer.proof!.mode = 'hypothetical';
    expect(proofOutcome(answer, true, null)?.detail).toContain('hypotheses');
    expect(proofOutcome(answer, true, 'Engine failed')).toMatchObject({ tone: 'error', label: 'Reasoning failed', detail: 'Engine failed' });
    expect(proofOutcome(null, false, null)).toBeNull();
  });
});
