# ETC triangle-center tooling

Run from the repository root:

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py verify
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py check --report .cache/triangle-centers/runs/current/run.jsonl
python -m unittest discover -s scripts/geogebra/tools/triangle_centers -p 'test_*.py'
```

Tests are grouped in three files: `test_triangle_center_import.py` covers parsing,
formulas, domain/title diagnostics and import IO; `test_selected_graph.py` covers
graph and numeric transactions; `test_source_errors.py` holds reviewed source
exceptions. Add related regressions to these files instead of a new file per rule.

The local cache layout is `sources/` (ETC HTML), `native/` (native-atlas.json),
`extracted/` (disposable checkpoints), `runs/<batch>/` (logs and stage events),
`reports/uncovered/`, `reports/reviews/`, `planning/`, `research/`, and archived
`experiments/`. Existing artifacts were moved without deletion; the ignored cache
README and `reports/cache-migration.json` document the migration. Fetch/read/native
commands use the new paths. Historical logs retain their original embedded paths.

Circle inversion now uses only `V`: `V p` for the ABC circumcircle, `V p q r`
for the circle centered at X(q) through X(r). The temporary K opcode is retired.
Double-point F coefficients may use `d`, their finite input distance; this name is
scoped to F with exactly two references and is rejected in cyclic B coordinates.
The client binds input points and d once before expanding those coefficients.

`triangle_center_import.py` handles source preflight, extraction, graph selection,
and generated recipes. `triangle_center_coordinates.py` owns the checked formula
syntax. `triangle_center_support.py` owns progress events and disposable cache IO.

Incidence candidates are stored as one line family per target. Explicit recipes
are retained individually; the solver only generates and screens inferred line
pairs after better explicit recipes fail. All existing pairs remain available,
and the geometry/type/budget screens still apply. Extraction cache schema 2 stores
families rather than duplicating each four-reference intersection and evidence.

`compact_topology_cache.py` migrates old diagnostic snapshots in
`.cache/triangle-centers/planning/topology/`: continuous ID sets become ranges,
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


Source-specific regressions are grouped in `test_source_errors.py` rather than
one file per point. `triangle_center_sources.py` contains reviewed, snapshot-hash
restricted boundary patches; the original downloaded pages remain untouched.
Conflicting duplicate X(66288) fragments are isolated, with the exclusion reason
in seeds. `selected.tsv` is retired; build no longer allocates or writes it.

For full offline analysis without publishing runtime data:

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py dry-run --parts 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 --report .cache/triangle-centers/runs/current/full.jsonl
```

Coordinate transactions use a small overlay of changed/hidden values, committing
that delta only after all checks pass. They do not copy the full coordinate map
per replacement. Full audits still materialize the complete snapshot.


Use `--uncovered-report .cache/triangle-centers/reports/uncovered/current.json` with a build,
check or dry-run to inspect only unresolved IDs, their source Part, candidate
blockers and unresolved inputs. This opt-in report is not a duplicate selected
recipe table. Primary categories summarize possibly overlapping candidate reasons;
`geometry_or_transaction` and `coordinate_admission_or_variants` deliberately
avoid claiming a more specific cause than observed.

Coordinate parsing accepts arithmetic brace groups and one or two explicit,
independent local scalar definitions, including a wrapped `where` line. Global
symbol shadowing, unknown symbols and local definition chains remain rejected.
Extraction cache fingerprints follow parser entry points and their local helper
call graph, global grammar data, coordinate code and source patches. Solver and
report-only edits no longer force page re-extraction; changes to parser helpers
still invalidate the cache. This cache namespace upgrade rebuilds old checkpoints
once, without changing generated recipe semantics.

Three-finite-center circumcenters use `O p q r`, with matching numeric and
GeoGebra `Center(Circle(...))` implementations. Natural `log(...)` is normalized
to `ln(...)`; logarithm arguments must remain dimensionless. Coordinate labels
can have a leading equals sign. Reviewed anchors X(11619/11755/40300) restore a
circle center, a damaged PB entry, and a power-curve tangent pole respectively.
Out-of-Part J/I seeds close without assuming that their page incidence table
was loaded; their construction inputs still undergo numeric/type screening.
The full dry-run now contains 70,088 records and 127 unresolved entries, while
the published small set contains 8,206 records. See the uncovered-analysis doc
for remaining log syntax, PB conflicts, and imaginary-focus dependency roots.

`triangle_center_domains.py` propagates reviewed complex-domain root sets for
opt-in unresolved diagnostics. `DOMAIN nonreal` and `DOMAIN conditional_complex`
rows in seeds are metadata, never construction recipes or skips. Selected recipes
override unused alternatives during propagation. Unresolved alternatives yield
possible dependency risks; conjugate cancellation and independently real recipes
prevent treating reachability as a theorem of nonreality. The queue visits each
(root, target) once and reads shared incidence endpoints without expanding pairs.

Bare function normalization is shared with the existing angle shorthand. Only
explicitly bounded atoms are accepted. The exact positive-side logarithm identity
is rewritten on the arithmetic AST, before dimensional checking. Absolute values
retain scaling degree; side min/max and side-difference bars use checked `abs`
arithmetic. Tests cover argument ambiguity, scaling, cycle propagation, alternative
recipes, and the real midpoint of the complex X(5002)/X(5003) pair.

Extraction cache schema 3 includes each source heading and compact description
hints, reused on warm reads. Unresolved JSON includes `title`, `source_features`
and `title_groups`; grouping normalizes center IDs and ordinals, then optionally
merges similar titles with shared opening words. These are triage suggestions,
never parsing rules or evidence transferred between entries. Only unresolved
entries and their groups appear in that report, without a selected recipe table.

One explicit local cyclic function may occur inside a first-coordinate expression,
for example `(b-c)*f(b,c,a)*f(c,a,b) : : , where f(a,b,c)=...`. Recursive,
unknown or noncyclic calls remain rejected. X(10043)'s broken paragraph marker
has a source-hash-guarded read patch; X(11667)'s squared/prose local definitions
are expanded only in a reviewed seed, checked against its Euler-line combo.

`V p q r` inverts finite X(p) in the circle centered at X(q) through X(r).
The first named mapping is the unqualified ABC Brocard circle, `V p 182 3`.
The full-match rule rejects triangle-relative and conditional suffixes. Other
circle names are not guessed; inventory findings and priorities are documented
in the uncovered-analysis report. Runtime uses GeoGebra's circle reflection.

The Vu 1st PCC rule reuses a two-point distance-scoped F combo and restores eight
Part 20 centers. It is checked against independently constructed pedal/circumcevian
perspectors and known native members. Vu 2nd PCC now uses an independently derived dependent-coordinate formula.
The latest unresolved report is `reports/uncovered/uncovered-vu-second.json`;
full stages/logs are under `runs/vu-second/`, relative to the cache root.

`B source formula` applies a cyclic barycentric formula to one finite center.
Only this form permits x/y/z, which rotate along with a/b/c and are checked for
homogeneous source scaling separately from triangle scaling. It closes through
the dependency graph rather than independent coordinate-anchor admission. Client
and numeric caches bind/key the source explicitly; undefined and ideal results
are not admitted as finite samples. The Vu second PCC source typo is reviewed in
`test_source_errors.py`; related rule tests stay in the existing import/graph files.
