# ETC triangle-center tooling

Run from the repository root:

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py verify
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py check --report .cache/triangle-centers/run.jsonl
python -m unittest discover -s scripts/geogebra/tools/triangle_centers -p 'test_*.py'
```

`triangle_center_import.py` handles source preflight, extraction, graph selection,
and generated recipes. `triangle_center_coordinates.py` owns the checked formula
syntax. `triangle_center_support.py` owns progress events and disposable cache IO.

Incidence candidates are stored as one line family per target. Explicit recipes
are retained individually; the solver only generates and screens inferred line
pairs after better explicit recipes fail. All existing pairs remain available,
and the geometry/type/budget screens still apply. Extraction cache schema 2 stores
families rather than duplicating each four-reference intersection and evidence.

`compact_topology_cache.py` migrates old diagnostic snapshots in
`.cache/triangle-centers/planning-topology/`: continuous ID sets become ranges,
adjacency keys share one ranged node index, reference lists use delta coding,
and the payload is gzip-compressed. Every file is decoded and compared before
the original JSON is removed. `pack`/`unpack` also support diagnostic writers;
these snapshots are neither runtime data nor a source of geometric definitions.

See the data maintenance README and the full-range scaling plan under
`src/features/geogebra/commands/custom/` for domain rules and staged work.


`triangle_center_graph.py` maintains reverse dependencies and cached
(depth, estimated length, conjugate level) metrics for the selected DAG.
Replacement transactions recompute the target and its downstream closure,
check types and budgets, and commit only on success. Rejected replacements leave
recipes, reverse indices and metrics unchanged. Final full validation remains
independent. Closure sample evaluation reuses the preceding snapshot and
recomputes newly admitted centers; undefined results are memoized per snapshot.


`NumericTransactions` commits the sample snapshot with structure, recomputing
changed descendants and checking external incidence readers. Existing failures
may remain queued; the candidate must resolve its own target and may not make a
valid reader fail. Repair can try any admitted operation, reopen independent
alternatives of removed centers, and use current inputs for subsequent candidates.
There is no fixed repair-pass cap. Repeated selected states are reported as an
incidence conflict using a bounded-size 256-bit graph fingerprint; this avoids
retaining a full graph per queue event. Independent full audits remain mandatory.
