/** One registry for defaults, validation, presets and the settings form. Times are in seconds. */
export const REASONING_FIELDS = {
  loadingSeconds: { group: 'Time budgets', label: 'Engine loading', help: 'Maximum time to prepare Python and load the prover.', min: 10, max: 300, default: 120, light: 120, deep: 180, unit: 's' },
  samplingSeconds: { group: 'Time budgets', label: 'Construction copy checks', help: 'Maximum time for the isolated replica to check six configurations.', min: 5, max: 180, default: 45, light: 30, deep: 90, unit: 's' },
  searchSeconds: { group: 'Time budgets', label: 'Condition search', help: 'Worker time after copy checking has finished.', min: 1, max: 120, default: 30, light: 10, deep: 60, unit: 's' },
  solvingSeconds: { group: 'Time budgets', label: 'Proof solving', help: 'Maximum solving time per proof, goal check or coverage run; excludes engine loading.', min: 1, max: 180, default: 30, light: 10, deep: 90, unit: 's' },
  maxObjects: { group: 'Condition search', label: 'Objects to search', help: 'Maximum dependent objects considered for local suggestions.', min: 1, max: 24, default: 16, light: 8, deep: 24, unit: '' },
  maxScopePoints: { group: 'Condition search', label: 'Points per local scope', help: 'Includes the target, upstream points and optional earlier context. Cost grows quickly with scope size.', min: 2, max: 12, default: 10, light: 6, deep: 12, unit: '' },
  maxCandidatesPerObject: { group: 'Condition search', label: 'Candidates per object', help: 'Maximum retained candidates, including the reserved rejected-candidate allowance.', min: 4, max: 128, default: 80, light: 40, deep: 128, unit: '' },
  maxConditions: { group: 'Condition search', label: 'Suggested conditions', help: 'Total conditions selected by local rank across the construction.', min: 1, max: 40, default: 24, light: 12, deep: 40, unit: '' },
  localMaxTriangles: { group: 'Local numerical discovery', label: 'Triangle candidates', help: 'Candidate budget for each local discovery pass.', min: 0, max: 20000, default: 3000, light: 1000, deep: 8000, unit: '' },
  localMaxAngles: { group: 'Local numerical discovery', label: 'Angle / vector candidates', help: 'Candidate budget for each applicable angle or vector resource.', min: 0, max: 50000, default: 3000, light: 1000, deep: 10000, unit: '' },
  localMaxComparisons: { group: 'Local numerical discovery', label: 'Comparisons per resource', help: 'Separate allowance for each named comparison resource, per local pass.', min: 0, max: 500000, default: 40000, light: 10000, deep: 100000, unit: '' },
  localMaxRelations: { group: 'Local numerical discovery', label: 'Returned relations', help: 'Maximum numerical relations fed into each local condition search.', min: 1, max: 2000, default: 800, light: 300, deep: 1600, unit: '' },
  maxProofNodes: { group: 'Proof computation', label: 'Recorded proof steps', help: 'Recording budget; explicit assumptions are always retained. Reaching it produces a partial explanation.', min: 100, max: 10000, default: 1600, light: 800, deep: 4000, unit: '' },
  maxVectorRounds: { group: 'Proof computation', label: 'Geometry / vector rounds', help: 'Maximum exchanges between DDAR geometry and vector algebra.', min: 1, max: 24, default: 12, light: 4, deep: 24, unit: '' },
  maxVectorQueries: { group: 'Proof computation', label: 'Vector membership queries', help: 'Maximum exact membership tests across vector exchanges.', min: 100, max: 500000, default: 100000, light: 20000, deep: 250000, unit: '' },
  maxProofQueries: { group: 'Conclusion checks', label: 'Additional proof candidates', help: 'Candidates explored when no goal is selected. A selected goal is always used instead.', min: 1, max: 64, default: 32, light: 12, deep: 64, unit: '' },
  maxCoverageQueries: { group: 'Conclusion checks', label: 'Coverage candidates', help: 'Maximum suggested candidates evaluated together in one coverage run.', min: 1, max: 64, default: 64, light: 24, deep: 64, unit: '' },
} as const;

export type ReasoningField = keyof typeof REASONING_FIELDS;
export type ReasoningPreferences = Record<ReasoningField, number> & { validateSamples: boolean; allowEarlierContext: boolean };
export type ReasoningPreset = 'light' | 'standard' | 'deep';
export const REASONING_PREFERENCES_KEY = 'geogebra-reasoning-preferences-v1';
export const REASONING_FIELD_KEYS = Object.keys(REASONING_FIELDS) as ReasoningField[];
export const REASONING_GROUPS = [...new Set(REASONING_FIELD_KEYS.map((key) => REASONING_FIELDS[key].group))];

export const reasoningPreset = (preset: ReasoningPreset = 'standard'): ReasoningPreferences => ({
  ...Object.fromEntries(REASONING_FIELD_KEYS.map((key) => [key, REASONING_FIELDS[key][preset === 'standard' ? 'default' : preset]])) as Record<ReasoningField, number>,
  validateSamples: true, allowEarlierContext: true,
});
export const normalizeReasoningPreferences = (value: unknown): ReasoningPreferences => {
  const result = reasoningPreset();
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  for (const key of REASONING_FIELD_KEYS) {
    const number = source[key], field = REASONING_FIELDS[key];
    if (typeof number === 'number' && Number.isFinite(number)) result[key] = Math.max(field.min, Math.min(field.max, Math.round(number)));
  }
  for (const key of ['validateSamples', 'allowEarlierContext'] as const) if (typeof source[key] === 'boolean') result[key] = source[key];
  return result;
};
export const readReasoningPreferences = (): ReasoningPreferences => {
  try { return normalizeReasoningPreferences(JSON.parse(localStorage.getItem(REASONING_PREFERENCES_KEY) ?? 'null')); }
  catch { return reasoningPreset(); }
};
export const saveReasoningPreferences = (preferences: ReasoningPreferences): boolean => {
  try { localStorage.setItem(REASONING_PREFERENCES_KEY, JSON.stringify(normalizeReasoningPreferences(preferences))); return true; }
  catch { return false; }
};

/** Only these settings cross the Python boundary; timeouts remain enforced by the worker client. */
export const proofComputationLimits = (preferences: ReasoningPreferences) => {
  const p = normalizeReasoningPreferences(preferences);
  return { maxProofNodes: p.maxProofNodes, maxVectorRounds: p.maxVectorRounds, maxVectorQueries: p.maxVectorQueries };
};
