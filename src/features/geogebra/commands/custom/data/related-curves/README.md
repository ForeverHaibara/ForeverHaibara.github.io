# Related Curves data

This is a small, manually maintained mathematical database, not a crawler output.
Assume an established numbered definition is stable. Git records changes; no
snapshot hashes, HTTP metadata, automatic updates or separate version history.

- `catalogue.json`: 203 directory positions Q000–Q202. `degree: null` means the
  title alone does not specify a degree. Directory positions may be families;
  they are not a count of individual curves. This file is not imported at runtime.
- `curves.json`: the supported definitions. Required fields are `id`,
  `name`, `degree`, `source`, `equation`, `centers`, and brief `notes`.
- Optional `alternateEquation` / `alternateSource` provide a second published
  representation for algebraic checking. Point metadata may include
  `samplePoints`, `conditionalCenters`, `infiniteCenters`, `unavailableCenters`.
  `centers` contains finite test candidates, not every center claimed by a page.

All equations are homogeneous in barycentrics `u,v,w`, with `a2=BC²`, `b2=CA²`,
`c2=AB²`, `sa=(b2+c2-a2)/2`, cyclically `sb,sc`. `cyclic(f)` simultaneously
cycles `(a2,b2,c2;u,v,w)` three ways and sums; `cyclicProduct(f)` multiplies.
Only integer arithmetic and nonnegative integer powers are supported initially.
Trilinear, rational and nonhomogeneous sources require an explicit mathematical
conversion before entry; never paste them as though they were barycentric.

To add a record, read its primary source, enter the reviewed equation and usable
test points, then run from the repository root:

```text
python scripts/geogebra/tools/generate_related_curves.py
python scripts/geogebra/tools/generate_related_curves.py --check
npx vitest run src/features/geogebra/commands/custom/tests/geometry/relatedCurves.test.ts
python scripts/geogebra/tools/check_related_curve_points.py
```

Python with SymPy is an offline authoring dependency, not a website dependency.
The generator validates degree/homogeneity and alternative equations, and writes
`custom/generated/relatedCurves.json`. Never edit generated coefficients by hand.
The runtime evaluates only generated scalar arithmetic with native dependencies;
it never evaluates the source equation text or fetches the source website.

Run the real-engine harness `/scripts/geogebra/browser/geogebra-gibert-smoke.html`
with `?id=12&mode=high` (or medium). Add `history=1`, `quoted=1`, or `keep=1`
for history, quoted-ID, and post-cleanup visual checks. Low is intentionally
rejected before evaluation; do not remove the `requiresNamed` guard to benchmark
inside a user's construction. It timed out in the isolated exploration.

Q005 is a cubic and uses the same interface. Q036 has three supported members:
`"Q036A"`, `"Q036B"`, `"Q036C"` (hyphens before the final letter are accepted).
Q000 and Q035 are unimplemented families; a recognized suffix does not imply
that a variant has been implemented.
Do not register each new record as a separate public command or alias.

For a batch, `python scripts/geogebra/tools/inspect_related_curve_candidates.py CACHE_DIR OUTPUT.json` can inspect locally downloaded pages and their explicitly linked TXT files. It makes no requests and does not edit the database. Its output is only a review queue: inspect each source and point attribution before adding a record. The incidence checker uses two exact triangles for the recognized simple centers (including X(4)) and sample points; it also checks the Q034, Q074 and Q099 relationships symbolically. Downloads are manual, single-concurrency and rate-limited; no automatic database update is installed.
