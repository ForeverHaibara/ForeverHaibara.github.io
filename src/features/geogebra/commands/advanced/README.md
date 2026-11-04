# Advanced commands

`!nearestTriangleCenter(A,B,C,P)` searches the native and published extended ETC
catalogue using the current coordinates of four existing, defined 2D points. Names
may be bare or quoted. The triangle must be nondegenerate. It returns an immediate
JSON value in the command bar, for example:

```json
{
  "id": 2,
  "center": "X(2)",
  "point": { "x": 2.333333333333333, "y": 1.3333333333333333 },
  "distance": 0,
  "evaluated": 71000,
  "skipped": 2266
}
```

The example counts are illustrative: eligibility depends on the triangle and the
published catalogue. The command does not assign its result, create named points,
or install a dependent construction in GeoGebra. Moving vertices requires running
it again. Distances are Euclidean; exact numeric ties prefer the smaller ETC ID.
Ideal, nonreal, unavailable and numerically indeterminate points are skipped.
Unsupported IDs absent from the catalogue are not counted as searched entries.
This is a double-precision numerical search, not a symbolic identity certificate;
ill-conditioned intersections and near-degenerate triangles can lose precision.

## Extension contract

`advancedCommands.ts` owns dispatch and `AdvancedCommand` metadata. Register a
command with a unique, case-insensitive name, description, signatures and async
`execute(engine, args)` handler. Validate arguments in the handler. Metadata feeds
completion and spelling suggestions through `studioCompletionRegistry.ts`; no
separate completion list is maintained. The command bar displays the returned
value using `formatApiResult`. Unknown names still call the allow-listed GeoGebra
API. These commands belong exclusively to the `!` namespace, not the normal tool
compiler, and cannot be embedded in a GeoGebra expression or assigned with `=`.

Keep implementations in `advanced/`. Import `AdvancedCommand` as a type to avoid a
runtime dependency on the registry. Future commands should keep their own result
schema and describe whether their output is a snapshot or an action.

## Triangle center implementation

`nearestTriangleCenter.ts` reads and normalizes a coordinate snapshot, evaluates
native centers with anonymous numeric `getValue` expressions, and restores world
coordinates for the result. It never uses `evalCommand`, labels, or helper cleanup.
The native API guard maps undefined coordinates to NaN rather than accepting zero
as a valid point. The loop yields periodically so the UI can repaint.

`loadTriangleCenterCatalogue` shares the existing builder's validated lazy chunk
loader, native patches, ideal directions and Gemini templates. A full search loads
all chunks on first use; normal TriangleCenter construction retains lazy loading.
No hardcoded extended maximum or duplicated recipe inventory is needed.

`triangleCenterNumerics.ts` evaluates the shared recipe operations with per-search
memoization, including unavailable results. Directed ideal values remain available
to conjugations, lines and supported coordinate maps, but never become nearest
point candidates. `coordinateFormula.ts` interprets only the maintained arithmetic
grammar, without JavaScript eval or Function. New recipe operations must be added
to both the construction builder and numeric evaluator and verified geometrically.

## Verification

Run `npx vitest run src/features/geogebra/commands/advanced
src/features/geogebra/commands/advancedCommands.test.ts` on one line. The committed
numeric fixture uses the independent Python importer and existing acute/obtuse
native atlas, with 275 targets covering all 74 chunks and all recipe operations.
It retains only the native dependencies needed by those targets. Command tests
verify the read-only API contract, undefined inputs, degeneracy and completion.

For real-engine verification, open
`/scripts/geogebra/browser/verification.html?page=nearest` on the local dev server
and click Run verification. It checks the full centroid search, unchanged object
names, and independent labeled native references plus selected constructed
extended centers in a disposable applet. This page does not touch the studio's
construction. Browser verification must finish with PASS; unit mocks do not
substitute for checking the installed engine's anonymous evaluation behavior.
