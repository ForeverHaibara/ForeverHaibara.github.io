# Triangle center recipe data

For the next expansion stage, see the [full-range performance and dependency-graph plan](../../docs/triangle-centers-scaling-plan.md) (2026-11-01). It records profiling evidence, cached-source heading anomalies, and staged work on observability, caching, graph selection, and runtime construction costs; it does not change the recipes below.

The twenty `chunks/*.txt` files contain 8215 defined centers (2026-11-02), including 243 ideal points with a direction and 20 without one. They are generated from 51 reviewed entries in `seeds.txt` and 8164 automatically extracted constructions from [ETC Parts 3](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart3.html), [4](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart4.html), [5](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart5.html), and [37](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart37.html). Git tracks the compact generated data and extraction rules. ETC pages are manually downloaded to `.cache/triangle-centers/`, which Git ignores; no runtime or scheduled synchronization occurs.

Each row is `id operation references...`. `M p q` means midpoint; `R p q` reflects X(p) in X(q); `C p` and `A p` are complement and anticomplement. `I p q` represents an ideal point by the direction of the finite line X(p)X(q). A bare `I` records an ideal point whose direction is unknown or unavailable; it is coverage metadata and cannot be used as a dependency in any construction. `J p q r s` intersects two lines; either line may contain one ideal endpoint, rendered as a parallel through its finite endpoint. `P p q r` projects X(p) onto line X(q)X(r); `L p q r` reflects X(p) across line X(q)X(r). `G p` and `T p` are isogonal and isotomic conjugates of X(p); an ideal input uses homogeneous barycentrics. `V p` inverts finite X(p) in the circumcircle of ABC using GeoGebra circle reflection. `V p q r` inverts X(p) in the circle centered at X(q) through X(r), rendered as `Reflect(point,Circle(center,through))`; all three inputs must be finite, the radius positive, and the input distinct from the center. Unqualified Brocard-circle inversion maps to `V p 182 3`, using the diameter X(3)X(6). Other named circles and triangle-relative variants are not inferred. `F id:coefficient ...` stores an ETC combo of two to six finite centers; its result is the weighted sum divided by the sum of coefficients. Coefficients are checked formulas without spaces, paired with their references. Extraction accepts complete single-line sums using `X(n)` or `X[n]`, with two to six distinct references; ambiguous prose, products of points, and incomplete or conditional expressions are rejected. Shinagawa coefficients `(u,v)` on the Euler line are converted to the same `F` format as `(3u)X(2)+vX(4)`; `$...$` denotes a cyclic sum, and `and also` variants are separate candidates. Candidate coefficients must have matching scaling degrees. A zero coefficient sum gives an undefined finite point. Constant coefficients have the same selection risk as simple affine relations; variable coefficients rank below conjugates and above coordinate anchors. `O p q r` is the center of the circle through three finite centers, rendered as `Center(Circle(...))`; repeated or collinear inputs are undefined. `B formula` stores one cyclic barycentric coordinate. The parser accepts explicit relations within the target X(n) entry, including `inverse-in-circumcircle of` and `circumcircle-inverse of`, equivalent-pair lists, wrapped intersections, symbolic `∩` intersections, and line lists that share a heading with curve incidences. Both `this line` and `these lines` headings may contain multiple pairs. Listed pairs may use braces, parentheses, or a dot typo between IDs; an isolated damaged numeric token is skipped. It reads up to ten eligible listed lines and proposes pairs of lines with disjoint endpoints. An explicit intersection is preferred over an incidence-only pair when its dependencies become available. Conditions and transformations relative to a triangle other than ABC are excluded.

Coordinate labels may have an optional leading equals sign. Coordinate extraction accepts a direct first coordinate followed by `: :`, an exact cyclic `f(a,b,c) : f(b,c,a) : f(c,a,b), where f(a,b,c) = ...` pattern (also angle variables and function names g, h, or t), a single expression symmetric under swapping B and C, or three explicit coordinates whose normalized expressions agree under cyclic rotation, allowing commutative sum and product reordering. HTML superscripts, square brackets, wrapped formulas, implicit products such as `a2b4`, `aS`, and `rR`, arithmetic, constant powers, square roots including `Sqrt`, `π`/`Pi`, named trigonometric functions, `sinh`, `asinh`, `atan`, and natural `ln` (`log(...)` in ETC) are normalized into a checked expression. A cyclic header or formula may continue across several HTML lines. Trailing author credits are removed before parsing, adjacent coordinate labels are recognized separately, and angle notation such as `sin 2A/3` is read as `sin(2A/3)`. A single source newline is treated as whitespace; blank lines and HTML block or `<br>` boundaries are retained. The importer and runtime have no fixed coordinate formula length, AST node count, or constant exponent magnitude limit; unsupported syntax is still rejected. Ambiguous `π8` is rejected rather than read as `8π`; X(3371)'s formula is a reviewed seed. Angle variables mean angles of ABC; lower-case sides mean opposite side lengths. The supported Conway symbols are `S=2 area`, `SA/SB/SC=(b²+c²−a²)/2` and cycles, `SW=(a²+b²+c²)/2`, `E=4R²`, `F=SW−4R²`, `s`, `sa/sb/sc`, `r`, and `R`. The Brocard angle ω is normalized as `atan(S/SW)`. One nested cyclic-function definition and up to three explicit independent local scalar definitions are expanded when their syntax is unambiguous; other symbols and more complex auxiliary-variable chains are deferred. Cyclic permutations generate the other two coordinates; a trilinear first coordinate is multiplied by `a` during import, so only `B` is stored or interpreted at runtime. A zero barycentric sum with a nonzero direction vector is classified as ideal and is not admitted through `B` yet; four parsed formulas had this result on both samples.

Unary `V` candidates require a finite source away from the circumcenter on both sample triangles. Three-input `V` requires finite inputs, a positive radius and a source distinct from the specified center. The small generated set selects 59 unary and one specified-circle inversion. Long coordinate formulas and extended triangle-center expansions are admitted without a fixed size limit.

Run from the repository root with Python 3 and `beautifulsoup4`:

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py fetch --parts 1 2 3 4 5 37
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py native
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py build
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py check
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py verify
```

Before `native`, `build`, or `check`, run `/scripts/geogebra/browser/verification.html?page=center-anchors` against the local site, download its native coordinate sample, and copy it to `.cache/triangle-centers/native/native-atlas.json`. This ignored build-time sample covers two fixed triangle shapes and is never shipped to the app. Update the unavailable entries in `native-status.txt` from the same screen when the GeoGebra engine changes. The manually cached ETC Parts 1 and 2 feed `native`, which regenerates the direction entries in that same file from the target's own `(parallel)` or infinity-line incidence lists. This is an explicit maintenance action, not automatic ETC synchronization.

`fetch` is the manual page update step. `build` uses cached HTML and the build-time coordinate sample, writes compact chunks, without generating a redundant selected audit table. `check` regenerates from the cache and compares with Git data. `verify` needs neither cached HTML nor the coordinate sample; it checks all chunk IDs, dependencies, directed cycles, formula syntax, ideal/finite input types, and exclusions. A candidate enters only when its dependencies are native or already constructible; forward numeric references are allowed. Selection first closes the relation-only graph without Shinagawa candidates, checks those candidates against available baseline points, coordinates, and listed lines, then forms weak components of the unresolved extended-center dependency graph; shared native and already closed points do not join components. By default, every screened coordinate anchor in an unresolved component is eligible. `--max-coordinate-anchors-per-component` optionally restores a per-component limit; previously selected IDs in `coordinate-priority.txt` remain eligible even when they exceed that allowance. A value of zero disables coordinate anchors. `seeds.txt` fixes the previously screened X(8004) line pair and includes X(3232) using the explicit cyclic barycentrics in ETC X(369), because native X(369) is unavailable; seed dependencies still have to close without cycles and pass the numeric graph screen; directionless `I` seeds are added only after graph selection, and cannot be inputs. Anchor selection favors unresolved dependents when a per-component limit is set. When an existing point is available, a combo must agree with it on every sample on which the combo is real and defined, with at least one valid sample; coordinate formulas must be homogeneous, and variants must agree on their common valid samples; formulas undefined on both samples remain eligible because their real domain may include other triangles; if a known ETC line is available on a valid sample, the point must lie on at least one such line. A missing line is not grounds for rejection. Input types are checked before choosing a recipe, so an unusable ideal input cannot displace a valid finite alternative. Reviewed seeds resolve three conflicting entries: X(5507) uses coordinates derived from its radical-center definition; X(8064) uses printed coordinates agreeing with the isogonal conjugate of the printed ideal coordinates of X(8063), although its listed line conflicts; X(72904) uses printed coordinates verified against multiple listed lines. After reopening the graph, simpler constructions replace formula anchors whenever possible. This batch retains 466 formula rows after selecting 599 candidate anchors. There is no default estimated construction length limit; `--max-length` can impose one explicitly. Isogonal/isotomic recipes bind their input point once before calling the shared conjugate builder, so a coordinate source does not get copied through every signed-area term. The full graph has maximum depth 6; the 8208 rows occupy 258,926 bytes before compression.

`native-status.txt` records 229 native IDs that GeoGebra returned as undefined on at least one of the acute and obtuse representative triangles. A bare ID means unavailable; an ID followed by two finite native IDs gives an ideal direction. Of the 229, 191 have a usable ideal direction from cached ETC Parts 1 and 2. X(1912) is marked ideal but its two available native lines disagree on the samples, so it remains excluded. The other 37 unavailable IDs are not assumed ideal. `seeds.txt` accepts explicit `id SKIP reason...` exclusions (and trailing `#` comments); unresolved dependencies are not permanent skips; X(72904) is now a reviewed coordinate seed. X(72060), previously excluded because its barycentric sum is zero, now has an `I` direction recipe. The build-time numeric graph screens selected constructions on two shapes. Coordinate formulas undefined on both are retained without numerical confirmation, since they may be defined on other triangles; non-coordinate constructions still need a valid sample. Known ideal directions are checked on both shapes; directionless ideal markers are appended only after graph selection and screening. A direct `TriangleCenter(...,idealId)` returns an undefined GeoGebra point because the engine has no drawable point at infinity; its direction remains available to dependent finite recipes. X(6346) remains excluded: its cyclic header uses `g` while the definition uses `f`, and the printed coordinates do not match the orthologic-center construction described at X(6344) on the sample triangles. The earlier 35-point real-engine smoke test remains available; this batch used rule tests and the numeric graph screen. These samples do not prove behavior on every special triangle. See the [staged plan](../../docs/triangle-centers-plan.md).

For an isolated source typo or damaged entry, review the exact ETC statement and independently check the intended construction or ideal-point status, then add the reviewed recipe and a source/reason comment to `seeds.txt`. Do not broaden a general parser rule solely to accommodate one damaged entry. For example, X(5959) has an `I` seed because its infinity-line list says `tthese`; its direction is not available from the current graph.

Reviewed domain metadata also lives in `seeds.txt`: `id DOMAIN nonreal` describes
a generically nonreal point, and `id DOMAIN conditional_complex` records a point
with both real and complex triangle domains. These rows are neither recipes nor
`SKIP` exclusions and never enter runtime chunks or recipe totals. Reviewed nonreal roots
are resolved non-drawable statuses in `resolved_nonreal`, excluded from uncovered counts;
conditional-complex points remain eligible on their real domains. Diagnostics
propagate possible complex dependencies through selected recipes and unresolved
candidate alternatives, including cyclic clusters, without expanding incidence
pairs. This is a risk annotation, not a proof that the result is nonreal: ETC's
X(5002) and X(5003) are complex for obtuse ABC but have real midpoint X(858).
An independent real construction remains eligible. Conditional coordinate
formulas continue to work on their real domain; complex intermediate arithmetic
is not implemented by this metadata.

Bare unary functions share a normalization step: existing angle forms such as
`sin 2A/3` retain their meaning, while `log b - log c` becomes `ln(b/c)`.
Logarithmic differences are rewritten structurally, so `2*log b-log c` and
`-log b-log c` do not undergo an invalid substring substitution. Individual
dimensional logarithms remain rejected. Ambiguous `log bc`, `log b/c` and
`log b^2` require parentheses. `abs(...)` preserves its argument's dimension;
simple side-difference bars and explicit `min(b,c)`/`max(b,c)` normalize to
absolute-value arithmetic. A full cyclic triple may have a redundant trailing
`: :`, but still has to pass cyclic equivalence checking.


Import maintenance: `audit --parts ...` performs heading preflight before expensive extraction. Build/check also preflight their complete input set. Ambiguous or malformed headings currently fail with all detected issues; repair file-level source boundaries explicitly before importing those pages. Individual geometric exceptions remain reviewed seeds.

Build/check reuse gzip extraction checkpoints under `.cache/triangle-centers/extracted/`, invalidated by source, extraction code, filtering state, Part and parser version. Use `--no-cache` to bypass them. Formula caches are bounded and process-local. `--report .cache/triangle-centers/runs/current/run.jsonl` appends stage/cache/closure events and five-second heartbeats with a run ID. Selection still recomputes globally; these caches do not freeze the graph across Part sets. See the scaling plan's implementation record for current limits.


ETC scripts and tests now live in `scripts/geogebra/tools/triangle_centers/` (see its README). Extraction cache schema 2 retains explicit recipes plus shared incidence families; selection tries better explicit definitions before expanding inferred line pairs. Changed dependency/evidence inputs reactivate pending targets, and quiescence triggers a residual audit. The candidate set and geometric screens remain available across these paths.


P2 numerical transactions now update descendant coordinates and incidence readers
with each committed recipe. Rejected changes preserve both the DAG and sample
snapshot. Repair/reopening queues replace the 30-pass loop; quiescence still
performs an independent full numeric audit. Formula sample caches are bounded
and keyed by formula plus the complete ABC triangle, including undefined results.

Reviewed 2026-11-02 source conflicts: the X(5597) Auriga vertex construction and
its stated half-plane convention independently identify X(5601)/X(5602) and
X(9834)/X(9835); conflicting printed signs/line relations cannot swap those IDs.
X(7581)/X(7582) use printed trilinears agreeing with multiple native lines;
their old printed reflection relations gave incorrect positions. Six reviewed
seeds document the decisions. Seven generated rows changed: only X(7581)/X(7582)
move materially on the acute/obtuse samples; the other five are equivalent
constructions. No IDs were removed. See the scaling plan for audit details.


`selected.tsv` is no longer generated or maintained. Compact recipes are the
selected definitions; extraction checkpoints retain source evidence for focused
inspection. `dry-run --parts ... --report ...` executes selection and full graph
checks without writing chunks. Its summary compares current supported IDs and
recipes. File-boundary patches are guarded by exact decoded snapshot hashes in
`triangle_center_sources.py`; X(66288)'s two conflicting definitions are isolated
and explicitly skipped. Source-error regression cases share `test_source_errors.py`.


2026-11-02 parser follow-up: wrapped scalar definitions (one or two independent
locals) and brace grouping recover 63 more IDs in the full dry-run: 69,992 total
recipe/status records, 223 unresolved. Full data is still unpublished. The current
four-page build retains 8,200 IDs; sixteen equivalent intersection recipes changed
with matching sample positions/domains. Unresolved diagnostics are opt-in through
`--uncovered-report`; there is no per-build selected.tsv output.


PB-cluster follow-up: reviewed X(11753)/X(11754) anchors from the X(11752)
preamble are included in the published recipes (seeds are retained even outside
the default Part set). Their U is expanded explicitly, not guessed globally.
Opening p/div/h3 blocks now delimit relation text, and targeted line-list headings
may omit `on` as in the X(41156) example. X(11872)'s formula already worked in the
full dry-run; its previously merged line list is now available as an alternative.
The latest full dry-run has 70,043 records and 172 unresolved targets; it remains
unpublished. X(11619)'s conflicting printed coordinates were correctly rejected
once its incidence evidence became readable; a named-circle-center recipe is a
future recovery path, not a permanent SKIP.


Two-reference `F` coefficients may use `d=Distance(X(p),X(q))`; it has side-length dimension and is unavailable in `B` or combos with more inputs. Inputs and d are bound once at runtime. An unqualified Vu 1st PCC perspector of X(p) maps to `F p:2*R^2 3:d^2-R^2`, derived and independently checked from the circumcevian/pedal-circle construction. The Vu 2nd PCC rule uses a coordinate transform independently derived from its geometry and checked against the preamble typo.


`B source formula` applies cyclic coordinates to one finite input center, with scoped x/y/z denoting its homogeneous barycentrics. `B source1 source2 formula` adds u/v/w for a second finite input; each input scaling is checked separately. Ordinary `B formula` retains its existing meaning and rejects these names. Both triangle-unit scaling and input projective scaling must be homogeneous. The source is a real dependency: input types, depth, estimated size and numeric transactions apply before admission. The client binds the input and its three signed areas once. The Vu 2nd PCC rule uses this form; no individual target seeds are needed.


Explicit local triples and explicitly declared cyclic scalar definitions are supported, including `where x:y:z=cos(A/2):cos(B/2):cos(C/2)` and `where x=..., y and z are defined cyclically`. No cyclic definition is inferred from an x-only clause, and local chains/global shadowing remain rejected. Reviewed nonreal roots cannot use the general undefined-on-both-samples coordinate allowance as evidence of a real anchor; unrelated real constructions and conditional-complex domains remain eligible.
