# Site geometry commands

The extra command bar compiles site commands to ordinary GeoGebra expressions.
The native input bar and object scripts are unchanged. No site macros, scripts,
named temporary objects, update callbacks, or sampled coordinates are installed
in the construction. Exported results retain native dependencies.

## Manage the library

`library.json` is the versioned, declarative source for names, descriptions,
typed overloads and implementations. It also feeds command completion and
spelling review. Adding an expression tool normally needs only a catalog entry:

```json
{
  "name": "MyMidpoint",
  "description": "The midpoint of A and B.",
  "overloads": [{
    "params": [{ "name": "A", "type": "point" }, { "name": "B", "type": "point" }],
    "returns": "point",
    "expression": "($A+$B)/2"
  }]
}
```

Parameters and optional `locals: [{name, expression}]` use `$name` placeholders.
Locals may reference parameters and earlier locals, and expand as expressions;
they do not imply runtime caching. Forward references and shadowing are rejected.
Templates emit **native** expressions, so `Conic(...)` in an implementation does
not recursively invoke this compiler. Complex symbolic construction generators
live in `geometryBuilders.ts`, referenced by `builder` instead of `expression`.
Builders receive expressions/types and a hygienic local-name allocator, never
an engine or numeric input values. This boundary can later support additional
backends without changing the command names or signatures.

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

`SecondIntersection(circle,P,Q)` requires a **circle** and a known point P on it.
It reflects P in the foot from the circle center to Line(P,Q). This is Vieta's
second-root construction: it does not select a numerical intersection branch
and returns P at tangency. P=Q is undefined; P lying on the circle is a geometric
precondition, not an extra projection which silently changes the problem.

### Mixed Conic

`Conic(a,b,c,d,e)` accepts five point or line-like constraints in any order.
Segments/rays mean **unbounded supporting lines**, not finite contact domains;
their orientation has no effect. Path parameters 0 and 1/2 are used because a
ray's parameter 1 represents infinity. Five points retain native behavior;
five lines return one conic; mixed input returns a **list of real conics**,
possibly empty. `Element(result,i)` accesses an individual result. The native
six-number and coefficient-list forms still work.

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
Repeated roots and branch collisions inherit its tolerance. List indices are
not persistent branch identifiers across chart transitions or loss of real
solutions. Rank-deficient frames (three collinear base points or concurrent
base lines), duplicate constraints and infinite solution families are not
arbitrarily resolved: they can yield undefined/empty results. Isolated degenerate
conics may be returned using the projective discriminant/adjugate definition of
tangency. This is not a solver for every degenerate family.

## Verification

Run `npm test -- --run` for parser/dispatch, hygiene, completion and adapter
tests. With `npm run dev`, open `/scripts/geogebra-smoke.html` and click **Run
verification** for a disposable real-engine construction. It checks all six
point/line counts against known circle solutions, every returned incidence and
tangency equation, segment/ray normalization, conjugation involutions and a
sideline limit, circle tangency, dragging, helper-label counts, file round trips,
and a file macro overriding a site command. The page is a development harness
and is not part of the production build.
