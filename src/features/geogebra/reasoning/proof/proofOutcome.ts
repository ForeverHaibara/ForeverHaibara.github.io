import type { Ag2RunResult } from '../backends/ag2/protocol';

export interface ProofOutcome {
  tone: 'success' | 'neutral' | 'warning' | 'error';
  label: string;
  detail: string;
}

/** Compact feedback uses the actual result, not just successful task completion. */
export function proofOutcome(result: Ag2RunResult | null, hasGoal: boolean, error: string | null): ProofOutcome | null {
  if (error) return { tone: 'error', label: 'Reasoning failed', detail: error };
  if (!result) return null;
  const proof = result.proof;
  if (result.status === 'inconsistent' || proof?.contradictionIds.length) return { tone: 'error', label: 'Inconsistent conditions', detail: 'The selected assumptions conflict. Review them before continuing.' };
  if (proof && !proof.algebraReplay.valid) return { tone: 'error', label: 'Proof check failed', detail: 'Some recorded algebra steps did not pass replay.' };
  const partial = proof && (proof.explanation === 'partial' || proof.limited || proof.gapIds.length > 0);
  const context = proof?.mode === 'hypothetical' ? 'Under the selected hypotheses.' : 'Under the selected conditions.';
  if (hasGoal) {
    if (result.status === 'already-assumed') return { tone: 'neutral', label: 'Goal already given', detail: 'The goal is an accepted assumption or a direct identity.' };
    if (result.status === 'derived') return { tone: partial ? 'warning' : 'success', label: partial ? 'Goal derived · partial explanation' : 'Goal derived', detail: `${context}${partial ? ' Some explanation steps are missing.' : ''}` };
    return { tone: 'warning', label: 'Goal not derived', detail: 'The current search did not derive the goal; this does not disprove it.' };
  }
  const count = proof?.conclusions.filter((conclusion) => conclusion.status === 'recorded').length ?? 0;
  if (count) return { tone: partial ? 'warning' : 'success', label: `${count} conclusion${count === 1 ? '' : 's'} derived${partial ? ' · partial explanation' : ''}`, detail: context };
  if (proof?.conclusions.some((conclusion) => conclusion.status === 'unexplained')) return { tone: 'warning', label: 'Explanation incomplete', detail: 'The engine knows a consequence but has not recorded its complete derivation.' };
  return { tone: 'neutral', label: 'No new conclusions', detail: 'No additional conclusions were recorded from these conditions.' };
}
