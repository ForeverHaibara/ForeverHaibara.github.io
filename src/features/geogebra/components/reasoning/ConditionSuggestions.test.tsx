import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ConditionSuggestions from './ConditionSuggestions';
import { midpointConstruction } from '../../reasoning/__fixtures__/problems';
import { proposeConditions } from '../../reasoning/selection/proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from '../../reasoning/selection/types';
import { REPLICA_SNAPSHOT_WARNING } from '../../reasoning/sampling/types';

describe('provisional condition warning', () => {
  it('shows the mismatch warning outside collapsed details, alongside usable suggestions', () => {
    const proposal = proposeConditions(midpointConstruction(), DEFAULT_CHARACTERIZATION_OPTIONS, {
      seed: 1, samples: [], variedPointIds: [], baselineMatched: false, diagnostics: [REPLICA_SNAPSHOT_WARNING],
    });
    const html = renderToStaticMarkup(<ConditionSuggestions proposal={proposal} problem={proposal.problem} coverage={null} fresh busy={false} status="2 proposed conditions" error={null} onApply={() => {}} onEvaluate={() => {}} />);
    expect(html).toContain('role="status"');
    expect(html.indexOf(REPLICA_SNAPSHOT_WARNING)).toBeLessThan(html.indexOf('<details'));
    expect(html).toContain('Definitions may be incomplete');
    expect(html).toContain('add any missing conditions manually');
    expect(html).toContain('Suggested conditions · 2 available');
    expect(html).not.toContain('role="alert"');
  });
});
