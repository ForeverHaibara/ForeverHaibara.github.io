# Computation preferences

The workspace toolbar opens a full-width **Proof settings** panel above the
canvas. Inputs are drafts until **Apply settings** is selected. Closing discards
unapplied edits. Numeric budget presets preserve evidence toggles and discovery
type selections; **Reset proof defaults** restores proof preferences and discovery
budgets, while preserving discovery types, automatic mode and compression.

`reasoningPreferences.ts` owns the proof parameter registry: types, labels, units,
defaults, bounds, groups and preset values. Add numeric options there, connect the
consumer and add regression coverage. The form and storage validator enumerate
this registry. Missing or invalid stored fields fall back to current defaults;
unknown fields are ignored. Preferences use the versioned
`geogebra-reasoning-preferences-v1` local-storage key, independently of construction
drafts and object styles. Discovery keeps its existing storage key and registry.

## Consumers

| Group | Consumer |
| --- | --- |
| Engine loading / solving time | `Ag2WorkerClient`: separate phase deadlines; terminates the worker |
| Copy-check time | `sampleConstruction`: removes the isolated iframe and listeners |
| Search time | `useCharacterization`: terminates the search worker |
| Search scope and local numerical budgets | `proposeConditions`: independent from the display discovery pool |
| Proof records / vector rounds / membership tests | Python `Knowledge`, `ProofGraph`, `VectorKnowledge` |
| Additional proof candidates | `exportAg2Proof`: balanced query families; explicit goals take precedence |
| Coverage candidates | `evaluateCoverage`: bounded batch with shared closure |

Time values in preferences are integer seconds; timers receive milliseconds.
Workers snapshot settings when started. Applying proof-only settings does not
cancel them. Applying discovery changes in Auto mode recomputes observations; a
catalog change can invalidate an ongoing proof through the existing input
invalidation rules. Stop and construction changes retain their existing behavior.

The three Python computation fields are serialized as `computationLimits` in
worker input and readable-proof exports. Python validates those fields again for
standalone JSON consumers; keep its defaults and defensive bounds aligned with
the TypeScript registry. Native smoke tests cover recording and vector exhaustion.
Project JSON also includes the current reasoning preferences.

## Boundaries

Budgets trade completeness and runtime, not mathematical validity. Copy sampling
keeps four discovery and two holdout configurations and a fixed seed. Numerical
tolerances, coefficient/term bounds and the backend's 40-point / 250-predicate
capacity remain implementation constraints. Batch query construction also respects
the readable backend's 64 expanded-goal capacity: one candidate can contain several
predicates. A query count is therefore an upper bound, not a promised result count.
Discovery comparison allowances are per named resource, not a global operation
budget; existing internal geometry caps can stop a pass earlier. Proof recording
keeps explicit assumptions even if they exceed the record allowance. Exhaustion
is reported as partial or not derived and never treated as a disproof.
