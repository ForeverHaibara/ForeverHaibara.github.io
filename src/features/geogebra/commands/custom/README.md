# Site geometry commands

The extra command bar compiles site commands to ordinary GeoGebra expressions.
The native input bar and object scripts are unchanged. No site macros, scripts,
named temporary objects, update callbacks, or sampled coordinates are installed
in the construction. Exported results retain native dependencies.

The library is still unpublished and uses version **0.1.0**. Development
milestones in the implementation notes are not release versions.

## Directory layout

The root contains the compiler, syntax/environment handling, types and catalog.
Implementation files are grouped by responsibility:

| Location | Responsibility |
|---|---|
| `builders/index.ts` | Registers builders and implements general point/conic constructions. |
| `builders/triangle.ts`, `builders/triangleCurves.ts` | Triangle maps, axes, conics and triangle-based polynomial curves. |
| `builders/conics.ts`, `builders/curves.ts` | Conic transformations, common tangents and cubic coefficient/polar/intersection operations. |
| `builders/quadrangle.ts`, `builders/quadrilateral.ts` | Unordered four-point and ordered four-line geometry respectively. |
| `builders/curveTransforms.ts` | Polynomial curve conjugation. |
| `algebra/` | Homogeneous coordinates, matrices, anonymous bindings and sparse polynomials. |
| `tests/` | Compiler, catalog, alias, type-contract and algebra tests. |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Definitions, design decisions, source audit and verification history. |

## Manage the library

`library.json` is the versioned, declarative source for names, descriptions,
typed overloads and implementations. It also feeds command completion and
spelling review. Adding an expression tool normally needs only a catalog entry:

```json
{
  "name": "MyMidpoint",
  "aliases": ["HalfwayPoint", "CenterBetween"],
  "description": "The midpoint of A and B.",
  "overloads": [{
    "params": [{ "name": "A", "type": "point" }, { "name": "B", "type": "point" }],
    "returns": "point",
    "expression": "($A+$B)/2"
  }]
}
```

### Aliases

Declare additional names in the canonical entry's optional `aliases` array, as
in the example above. Do not copy implementations or create forwarding commands
for aliases. Every alias automatically shares the canonical description, all
overloads, return types and output behavior. Variants with different interfaces
or definitions remain separate commands.

`studioToolCatalog` contains the editable canonical definitions;
`studioToolLibrary` and `studioTools` expose all callable names to dispatch,
completion and audits. Expansion shares overload objects, so cycles through an
alias are detected by the existing composition guard. Names must be unique
case-insensitively across canonical commands and aliases; self-aliases, duplicate
aliases and malformed names are rejected. Flat lists avoid alias chains. File
macros retain priority at the call site, including when they own only an alias.

The catalog currently has **135 canonical commands and 137 callable names**:
`SouthPole` aliases `ArcMidpoint`, and `NorthPole` aliases `OppositeArcMidpoint`.

### Implementations and composition

Parameters and optional `locals: [{name, expression}]` use `$name` placeholders.
Locals may reference parameters and earlier locals, and expand as expressions;
they do not imply runtime caching. Forward references and shadowing are rejected.
`expression` templates emit **native** expressions, so `Conic(...)` in one does
not recursively invoke this compiler. Use `compose` to call other site tools:

```json
{
  "name": "NinePointCenter",
  "description": "Center of the triangle nine-point circle.",
  "overloads": [{
    "params": [{ "name": "A", "type": "point" }, { "name": "B", "type": "point" }, { "name": "C", "type": "point" }],
    "returns": "point",
    "compose": "(Circumcenter($A,$B,$C)+Orthocenter($A,$B,$C))/2"
  }]
}
```

Exactly one of `expression`, `compose`, or `builder` is required. A `compose`
array contains scalar expressions for independent outputs, ordered as declared;
it never creates a labeled list. Top-level calls emit all outputs, assignments
name the first, and nested calls use the first. Catalog overloads with a final
integer `i` select one output dynamically; invalid indices are undefined.
Internal anonymous `Zip` bindings remain available for reuse without public
list objects. New triangle outputs follow BC, CA, AB order.

Composition parameters and locals are compiled in an isolated typed scope with
hygienic opaque argument tokens. Dependencies resolve against this library,
so a file macro or construction label cannot silently change an internal
dependency. Call-site file-tool priority remains unchanged. Native templates
inside dependencies stay native; already compiled caller arguments are not
expanded a second time. Direct/indirect dependency cycles and excessive nesting
or expansion produce errors; different overloads may call one another.

Complex symbolic construction generators are registered in `builders/index.ts`.
Their domain modules are listed above; shared expression operations live in
`algebra/homogeneous.ts`, and `algebra/polynomial.ts` builds sparse polynomials.
They are referenced by `builder` instead of `expression`.
Builders receive expressions/types and a hygienic local-name allocator, never
an engine or numeric input values. This boundary can later support additional
backends without changing the command names or signatures.

Generated local identifiers are short ASCII names (`v1`, `v2`, …), unique within
each compilation and excluding all identifiers in the input and existing object
labels. This also protects enclosing `Zip` locals and nested expansions. Bare
`_`, `_1` and `#` were rejected as `Zip` variable names by the real engine;
underscores also carry subscript syntax, and `#` starts a comment in our parser.
The naming change shortens expressions; it does not change their dependency
graph or imply fewer native geometry calculations. Existing saved expressions
with the old names continue to work.

The library file can be versioned or shared independently of `.ggb` files.
There is no tool-import/export UI or `.ggt` conversion in this first version.

## Dispatch and syntax

Resolution is **file-defined callable/tool > site overload > native command**.
A file tool owns its command name, including invalid calls; a failed user tool
is never retried as a site command. Existing object/function labels retain their
case-sensitive spelling. Site names and file macro command names are matched
case-insensitively. The compiler inspects `geogebra_macro.xml` through the
read-only `getFileJSON` API; it does not rewrite or register those tools. If that
metadata cannot be read, site expansion fails instead of risking an override.
Completion gives file tools priority 100 and site tools priority 10; native
suggestions use the default priority. File metadata is cached for execution and
completion, and invalidated by file clear/import and macro add/remove/rename
events. This avoids serializing the whole construction for each command. Object
types are read at execution time; no numeric state is cached.

Exact parameter types outrank families. `lineLike` accepts line/segment/ray;
`pointOrLine` additionally accepts points. `conic` accepts circles. `unknown`
is a wildcard, and an optional final variadic parameter may match repeated
arguments. Equally specific matches are errors. Native command names fall
through when no site overload matches, preserving e.g. both coefficient forms
of `Conic`. Pure site commands report the inferred and accepted signatures.

`implicitCurve` recognizes the engine's `implicitpoly`/`implicitcurve` class and
the native `ImplicitCurve`, `Cubic`, and `TriangleCurve` constructors. A conic
can report API type `line` or `point` when it degenerates; object XML preserves
its underlying conic class for dispatch. This inspection reads metadata only.

The balanced lexical compiler preserves strings, comments, `()`/`[]`, lists,
assignments, nested calls and function declaration heads. It does not attempt
to reimplement the whole GeoGebra grammar. It infers types from current object
labels, 2D point/list/numeric literals, simple scalar/point arithmetic, known
native constructors, file-tool output metadata and site return signatures.
`Zip`, `KeepIf` and numeric iteration variables have local type scopes. Opaque
native expressions with unknown return types should first be assigned a label
or expressed using a recognized typed constructor. No probe objects are created.
The compiler rejects excessive nesting/expansion. A multiline submission runs
statements in order so new objects participate in subsequent overloads; as with
GeoGebra scripts this is not an atomic transaction, and earlier results survive
a later error. Returned diagnostics retain the original and expanded input.

## Geometry implementations

`Incenter(A,B,C)` emits `TriangleCenter(A,B,C,1)`.

For conjugation, write signed doubled areas
`u=[B-P,C-P]`, `v=[C-P,A-P]`, `w=[A-P,B-P]`. Isotomic barycentrics are
`(vw,wu,uv)`; isogonal barycentrics are `(a²vw,b²wu,c²uv)`, where
`a=Distance(B,C)`, etc. Homogeneous products avoid reciprocal poles at triangle
sidelines and retain exterior-point signs. Native single-element `Zip` bindings
reuse those scalar expressions without labels. On a sideline the image extends
to the opposite vertex; at a vertex it is indeterminate. A collinear reference
triangle or an image at infinity is undefined as an ordinary affine point.

`SecondIntersection(conic,P,Q)` accepts every conic, including circles, and a
known point P on it. It uses one expression for all conic types:

```
Reflect(P,Intersect(Line(P,Q),ConjugateDiameter(Line(P,Q),conic)))
```

The conjugate diameter meets the chord at its midpoint, so reflecting P gives
the second intersection. For a circle this diameter is perpendicular to the
chord. Algebraically, restricting the quadratic to `P+t*(Q-P)` gives
`t*(H*t+L)=0`; midpoint reflection selects `t=-L/H` without a square root or a
numerical intersection branch. It returns P at ordinary tangency, and remains
dynamic when an ellipse changes into a circle or a supported degenerate conic.
The line-like overload `SecondIntersection(conic,P,l:lineLike)` uses the same midpoint
reflection with the unbounded supporting line l. P must lie on both l and the
conic. In the point overload, P=Q is undefined. A contained line or a second
intersection at infinity is undefined as an
affine point. P lying on the conic is a geometric precondition, not an extra
projection which silently changes the problem.

### Geometry families and preconditions

`RadicalAxis(c1,c2)` is a site command: it is absent from GeoGebra's public
command index. It constructs the equal-power line from the two native centers
and radii, using `PerpendicularLine` through the point
`(O1+O2)/2+(r1²-r2²)*(O2-O1)/(2*Distance(O1,O2)²)`.
Disjoint and tangent circles are supported; concentric circles have no unique
finite axis. `RadicalCenter` uses `compose` to expand this dependency.
`SteinerLineQ(A,B,C,D)` directly emits the equivalent linear equation
`(Bx+Dx-Ax-Cx)*x+(By+Dy-Ay-Cy)*y+A·C-B·D=0`, without constructing circles
or calling `RadicalAxis`. Its line overload and both `TangentParabola` overloads
reuse this coordinate implementation. Do not put
`RadicalAxis(...)` in a native `expression` template.

The catalog includes triangle maps, circle tangency constructions, central
inconics, ordered quadrilateral constructions, and cubic operations. See
[the implementation plan](docs/implementation-plan.md) for the grouped inventory and individual algorithms.
`compose` reuses earlier site commands where a short geometric construction
preserves the required limits. Homogeneous products handle removable poles in
the conjugations; all rank/degree guards and output selection run dynamically
inside GeoGebra, without JavaScript coordinate reads.
`CyclocevianConjugate` composes its reciprocal maps in homogeneous coordinates;
`Orthocorrespondent` takes the pole before converting the orthotransversal to an
affine line. These preserve finite results across intermediate points/lines at
infinity instead of expanding through undefined affine objects.

`InconicWithFocus` promises an ellipse for a strictly interior focus.
`InconicWithCenter` can return an ellipse, hyperbola or degenerate conic;
`IsogonalPairWithMidpoint` extracts its real foci when available. The generalized
`ApolloniusCircle` keeps a conic object at equal side lengths, where its equation
reduces to a line. `NinePointConic` uses a centered quadratic through three
opposite midpoint pairs, including the intersecting-line parallelogram limit.

Four-point `MiquelPoint`, `SteinerLineQ`, and `TangentParabola` use ordered
sidelines AB, BC, CD, DA. Their line overloads normalize all supporting lines
and use consecutive intersections; adjacent parallel sides may therefore yield
undefined affine vertices. `SimsonLine` and `SteinerLine` always use the AB/AC
projection/reflection pair, including off-circumcircle inputs as documented
extensions. `FermatPoint` means X(13), including obtuse triangles.

### Cubic coefficients and residual intersections

`Polar(P,F:implicitCurve)` is the second homogeneous polar line of a cubic.
Native `Polar(P,conic)` and `Polar(line,conic)` retain their original meanings.
`PolarConic` is the first homogeneous polar conic, including contributions from
the constant and lower-degree terms. There is no `PolarLine` alias.

The builders take `LeftSide(F)-RightSide(F)` as a native two-variable function.
They substitute `(x,x^4)`, encoding each cubic monomial `x^i*y^j` as the distinct
power `x^(i+4j)`. Native `Coefficients(f(x,x^4)+0*x)` reads this **univariate
function**, rather than the implicit curve or a two-variable function. Reversing
the list and padding with zeros preserves sparse coefficients as the curve
changes. Native `AreEqual` compares the reconstructed **bivariate** polynomial
with the full original function, and a nonzero third-degree part is required.
This rejects noncubics, including higher-degree terms that collide under the
substitution. Comparisons inherit GeoGebra's polynomial tolerance.

The former `Derivative(...)(0,0)` expressions were rejected by the native
parser. Coefficient extraction now uses the native polynomial expansion path,
without derivatives, CAS evaluation, interpolation, free curve points,
numeric sampling or JavaScript coefficient snapshots.

`ThirdIntersection(F,P,Q)` assumes distinct known curve points P and Q; it
removes the roots 0 and 1 from F(P+t(Q-P)) using Vieta's sum.
`ThirdIntersection(F,P)` uses the gradient tangent direction and removes its
double root instead. Ordinary inflections return P; singular points, contained
lines and residual points at infinity can be undefined. On-curve incidence is
a caller precondition. Use the two-argument form for tangent contact.

`Cubic(P1,...,P9)` normalizes the nine coordinates inside GeoGebra, requires rank
9 of the native 9-by-10 monomial matrix, then transforms native `ImplicitCurve`
back to world coordinates. Rank-deficient inputs remain undefined instead of
silently selecting a lower-degree curve. Native triangle/index `Cubic` forms
still work. `PivotalIsogonalCubic` directly emits a `TriangleCurve` equation.

### Mixed Conic

`Conic(a,b,c,d,e)` accepts five point or line-like constraints in any order.
Segments/rays mean **unbounded supporting lines**, not finite contact domains;
their orientation has no effect. Path parameters 1/4 and 1/2 stay finite on
lines, rays and segments; parameter 0 is at infinity for a full line, and
parameter 1 is at infinity for a ray. Five points retain native behavior;
five lines return one conic. Mixed input creates **independently selectable
conic objects**, with two output slots for four points/one line or one point/
four lines, and four slots for three points/two lines or two points/three lines.
If fewer real solutions exist, the remaining slots are undefined and draw
nothing; retaining them allows solutions to appear after dragging. `K=Conic(...)`
names the first output K; GeoGebra supplies unused names for subsequent outputs.
`Conic(a,b,c,d,e,i)` selects just the i-th real solution (1-based). When used
inside another expression the five-argument form selects the first solution.
The native six-number and coefficient-list forms still work.

The builder still solves the whole family as a native anonymous list. Output
metadata tells the compiler to select individual elements as separate commands;
no named list or helper is created. A typed, undefined conic is prepended inside
the anonymous list so initially empty families still produce conic-typed slots
which can become defined later. Only this implementation sentinel is skipped by
the 1-based public solution index.

If at least three constraints are points, use the primal plane. Otherwise use
the dual plane, swapping incidence with tangency, then take the adjugate to
return a primal conic. Three point vectors form a projective frame M. In that
frame every conic through them has equation `a*v*w+b*w*u+c*u*v=0`.
An additional point yields the linear equation `(vw,wu,uv)·(a,b,c)=0`.
For a tangent with transformed line coordinates `(h1,h2,h3)`, the condition is

```
-a²h1²-b²h2²-c²h3²+2ab*h1*h2+2ac*h1*h3+2bc*h2*h3 = 0
```

Thus four points/one line reduce to line/conic intersection in parameter space,
and three points/two lines reduce to conic/conic intersection (generically at
most two or four solutions respectively). The dual cases are symmetric. Three
affine parameter charts cover projective infinity; each root belongs to the
chart where its fixed coordinate is largest in magnitude, with deterministic
ties. Adj(M), instead of an inverse with determinant division, improves scaling
for incidence coordinates. Native `ApplyMatrix` transforms the resulting conic
back to world coordinates, avoiding large expanded matrix products. Dualization
uses its six coefficients and the adjugate. The final coefficient order is the
native `{x²,y²,constant,xy,x,y}` order.

Native numerical conic intersection controls accuracy and multiplicities.
Repeated roots and branch collisions inherit its tolerance. Solution indices are
not persistent branch identifiers across chart transitions or loss of real
solutions. Rank-deficient frames (three collinear base points or concurrent
base lines), duplicate constraints and infinite solution families are not
arbitrarily resolved: they can yield undefined/empty results. Isolated degenerate
conics may be returned using the projective discriminant/adjugate definition of
tangency. This is not a solver for every degenerate family.

### Special constructions and quadrilateral limits

Triangle tools include the three
axes, Soddy points, Liang–Zelich polarity, Stammler/orthopolar conics,
Cundy–Parry maps and orthopivotal cubics. `SoddyPoint(A,B,C,1)` selects the outer
point X175; index 2 selects the inner point X176. `OrthicAxis` cancels the
removable right-triangle factor before constructing its line.

`CoTf3(P,q)` and `InvCoTf3(P,q)` take the point first. They read conic
coefficients and use affine formulas without choosing principal axes or a
center. The forward circle limit returns the center, the inverse rectangular
hyperbola limit returns the center, and parabolas are supported. The inverse
of a circle and the generic forward image under a rectangular hyperbola have
no finite single-valued result.

`QAP2` through `QAP5` refer to an unordered four-point set. `QAP2` solves the
rectangular-conic constraints directly, without duplicating a vertex as an
extra orthocenter constraint. `QAP4` composes conjugation and inversion before
finite conversion, so a cyclic four-point set returns its circumcenter.

QL tools take **ordered vertices A,B,C,D** of the four supporting lines
AB, BC, CD, DA; crossed configurations are allowed. The component triangles
are ABF, BCE, CDF, DAE, with E=AB∩CD and F=BC∩DA. The center families require
finite component circumcenters. They do not promise all parallel-side limits.
`QLQu3` keeps E and F homogeneous, supporting a single infinite opposite-side
intersection without constructing an undefined affine point.

`QLTf1` exchanges A with C and B with D. Its point overload uses the complex
involution M+κ/(P−M). Line-like and circle inputs return a fixed **conic** class,
including line limits; general conics return implicit curves. The implicit
curve overload accepts only polynomials through degree four and checks the
reconstructed polynomial inside GeoGebra. Images may have degree eight.
Complex monomial coefficients cancel artificial powers of x²+y² before emitting
the real polynomial; this also handles dynamic degree and circular limits.
No coordinates or coefficients are read into JavaScript.

`QL2P1`, `QL2P2` and `QL2P3` have two independent point outputs and an optional
final integer index. Unreal intersections keep undefined slots; fixed points
use a complex square root, whose two results are real plane points even for
negative real κ. Indices do not identify global branches through collisions
or square-root cuts.

`QLCu1`, `QACu1`, `QLQu3` and `OrthopivotalCubic` use direct polynomial equations.
Singular, decomposed and lower-degree limits retain the implicit-curve class.
Existing cubic operations still reject noncubics. `QACu1` uses the cyclic
coaxality formula with its middle-term sign checked independently, rather than
copying the inconsistent displayed CT formula in the reference page.

## Verification

`/scripts/geogebra-smoke.html?suite=algebraic` exercises all 42 algebraic-geometry overloads, output XML
classes and helper counts, conjugation identities, conic limits, supporting
lines, dragging and export/reopen. Add `&tool=CoTf3` (or another exact tool name)
to run just its catalog overloads. The browser suite is separate from Vitest;
current completion and any native-engine limitations are recorded in the PLAN.
`tests/constructionContracts.test.ts` checks expansion budgets, dispatch, independent outputs,
Scimemi similarities, complex quartic coefficients and independent circle-pencil
and QA-cubic identities, including a homogeneous infinite-diagonal limit.

`/scripts/geogebra-smoke.html?suite=cubic` verifies both cubic polars and both
third-intersection overloads, all ten polynomial terms, sparse coefficients,
vertical secants, inflections, noncubic rejection (including encoding collisions),
dynamic degree changes, native triangle cubics, pivotal cubics, nine-point cubics,
coefficient updates and export/reopen. This is separate from the constructions suite.

`tests/nativeCommands.test.ts` checks the final expressions for every catalog overload
against the saved native command index, with explicit scalar/coordinate functions
and generated anonymous local calls. It covers builders, composed dependencies,
independent outputs and input type families. This catches missing native names;
it does not verify native signatures or replace real-engine geometry checks.
The focused `/scripts/geogebra-smoke.html?suite=radical` suite checks circle powers,
tangencies, concentric cases, dependent tools, line/segment/ray supporting-line
overloads, dragging, and export/reopen. Supporting-line extraction uses interior
path parameters 1/4 and 1/2: `Point(line,0)` is at infinity and cannot be used
as an ordinary affine point. The static audit rejects endpoint path parameters
in generated expressions as well as unknown command names.

The canonical tools and alias lists are in `library.json`; the full catalog is not duplicated here.
For basic real-engine verification, open
`/scripts/geogebra-smoke.html?suite=basic` and click **Run verification**. It checks
every new overload, scalar output types, helper counts, harmonic cross-ratios,
similarities, conjugation/polarity identities, supporting lines, dragging and
export/reopen dependencies. This browser suite is separate from Vitest and must
be run against the actual embedded engine.

For construction checks, open `/scripts/geogebra-smoke.html?suite=constructions`. It covers every new
overload, XML geometry classes, helper counts, conjugation identities,
tangencies, inconic foci, six-midpoint incidence and degenerations, cubic
polarity/residual intersections, coefficient dragging, and export/reopen.
Full construction-suite verification remains pending; the implementation plan
records the checks that have actually run. The basic suite remains restricted
to its original tools.

Run `npm test -- --run` for parser/dispatch, hygiene, completion and adapter
tests, including homogeneous algebra identities for the geometry builders. These
tests do not simulate the native engine. With `npm run dev`, open
`/scripts/geogebra-smoke.html` and click **Run
verification** for a disposable real-engine construction. It checks all six
point/line counts against known circle solutions, every returned incidence and
tangency equation, segment/ray normalization, conjugation involutions and a
sideline limit, independent conic outputs, initially undefined slots becoming
defined, optional solution selection, general conic second intersections,
tangency, conic-to-circle/line-pair transitions, dragging, helper-label counts,
file round trips, and a file macro overriding a site command. The page is a development harness
and is not part of the production build.
