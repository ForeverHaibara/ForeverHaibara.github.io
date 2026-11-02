# Triangle center recipe data

The published runtime library now uses all cached ETC Parts 1–37 (2026-11-02). `build` and `check` default to that same range; there is no separately maintained small experimental library. It contains 70,161 recipe/status records in 71 chunks (2,206,008 bytes): 70 reviewed recipes and 70,091 automatic records, including 1,127 directed ideal points and 66 bare ideal markers. The latest cached rebuild took about 132 seconds; publication took 0.045 seconds (8 files changed, 63 unchanged). See the latest [implementation entry](../../docs/triangle-centers-scaling-plan.md).

`chunks/*.txt` contains compact generated recipes, grouped by `floor(id/1000)`. The client discovers these files with lazy imports and loads the selected center's dependencies. A full library therefore does not require downloading every chunk when the page opens. Generated recipes may change when Parts, rules, or selection parameters change; equivalent constructions need not retain identical text. The full-range transition also exposed 38 old centers with changed sample positions; all are listed in the [source-review list](../../docs/triangle-centers-source-review.md), with printed-coordinate comparisons. They remain definition/endpoint consistency questions, not certified equivalent changes.

The [tool README](../../../../../../../scripts/geogebra/tools/triangle_centers/README.md) documents all recipe syntax, source syntax, commands, and diagnostic codes in two tables. In particular, `R p q` reflects X(p) about X(q), while `R p q r` reflects X(p) in the line X(q)X(r). Both share R; L is no longer an operation. `V p` and `V p q r` similarly distinguish circumcircle and specified-circle inversion by arity.

`seeds.txt` holds reviewed constructions and annotations, with comments explaining exceptional source entries. `DOMAIN nonreal` records a reviewed generic nonreal point: it has no real-plane recipe and is excluded from unresolved counts. Conditional-complex domains retain their real-domain eligibility. `SKIP` records an explicit reviewed exclusion; it is distinct from unresolved dependencies. A bare `I` records an ideal point without a usable direction and cannot be a dependency. Directed `I p q` supplies a finite line direction to supported projective operations, although requesting the ideal point itself returns an undefined GeoGebra point.

`native-status.txt` records unavailable native IDs and independently checked ideal directions. `coordinate-priority.txt` preserves reviewed anchor priorities without duplicating formulas. Native centers are numbered 1–3053; higher IDs require an extended recipe.

Run from the repository root with Python 3 and `beautifulsoup4`:

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py build --report .cache/triangle-centers/runs/current/build.jsonl
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py check --report .cache/triangle-centers/runs/current/check.jsonl
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py verify
python -m unittest discover -s scripts/geogebra/tools/triangle_centers -p 'test_*.py'
```

ETC HTML is manually downloaded with `fetch` to `.cache/triangle-centers/sources/ETCPartN.html`; this ignored cache is never shipped. The default fetch range is also 1–37. No automatic synchronization occurs. For a deliberate engine/atlas refresh, run `/scripts/geogebra/browser/verification.html?page=center-anchors` against the local site, download its native coordinate sample to `.cache/triangle-centers/native/native-atlas.json`, review unavailable native entries, then run `native`. Ordinary rebuilds reuse the existing reviewed source snapshots and atlas.

Build and check preflight source boundaries, extract candidates, select a globally closed acyclic graph, and screen types, budgets, sample geometry and incidence evidence. Extraction checkpoints are under `extracted/`; they do not freeze selection across Part sets. `verify` checks existing chunks without HTML or atlas. Two sample triangles provide regression evidence, not a proof for every special triangle. Formula candidates undefined on both samples require particular care; reviewed nonreal roots cannot enter through that allowance.

Build already constructs every chunk in memory during validation. Publication compares each output file and skips unchanged content; changed files are replaced through temporary files, then obsolete chunks are removed. It reports write counts, bytes and elapsed time. Replacement is atomic per file, not for the whole directory; avoid concurrent builds/readers during publication. `dry-run` remains an optional diagnostic command but is no longer needed before every normal build. No redundant selected.tsv is generated: selected recipes are the runtime chunks themselves.

Use `--uncovered-report .cache/triangle-centers/reports/uncovered/current.json` for unresolved diagnostics; run logs belong under `runs/`, geometric witnesses under `reports/reviews/`, and experiments under `research/` or `experiments/`. `--skip-ideal-audit` only skips the auxiliary full-formula ideal inventory when the same formula pool and atlas have already been audited; graph/type/numeric checks still run.

See the [coverage history](../../docs/triangle-centers-uncovered.md), [source-review list](../../docs/triangle-centers-source-review.md), and [performance/dependency plan](../../docs/triangle-centers-scaling-plan.md) for mathematical evidence, outstanding conflicts and historical small-library measurements.

Ceva/cross follow-up: four finite-input homogeneous transforms reuse two-input B, with strict ABC-only relation matching and ordered conjugate parameters. They recover X(13580), X(13581), X(64229), reduce pure coordinate anchors to 3,587, and leave 42 unresolved targets. X(14083)/X(14084) are pinned to the user-confirmed singular-focus intersections. The reviewed false X(14821) incidence is excluded without excluding its points. X(4201)/X(9858) use their checked primary definitions. Latest position-conflict evidence, including five newly exposed mismatches, is in the source-review list.
