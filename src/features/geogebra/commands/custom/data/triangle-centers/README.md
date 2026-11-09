# TriangleCenter runtime data

Use `TriangleCenter(A,B,C,n)` in the custom command bar. A literal extended ID or
patched native ID uses the site catalogue. Unpatched IDs from 1 through 3053 and
computed selectors use GeoGebra's native command. `!nearestTriangleCenter(A,B,C,P)`
searches the catalogue for the nearest finite center. `GeminiTriangle(A,B,C,k,i)`
returns vertex `i` (1–3) of Gemini triangle `k`. A standalone command
without `i` constructs all three vertices.

The separate ETC maintenance workspace supplies these files as one set.

| File | Contents |
| --- | --- |
| `chunks/*.txt` | Recipes grouped by `floor(n/1000)`. Drawing loads the target chunk and its dependencies on demand. |
| `native-patches.txt` | Native IDs dispatched to custom recipes. Their definitions are also included in the chunks. |
| `native-status.txt` | Native availability notes and ideal directions. The site uses `n p q` rows as the direction of `X(p)X(q)` for `X(n)`. |
| `gemini-triangles.txt` | Rows `k u\|v\|w` giving barycentrics of vertex 1. Vertices 2 and 3 follow by cyclic rotation. |

## Recipe syntax

Each row starts with the target ID `n`, followed by one of the forms below.
`p`, `q`, `r` and `t` are center IDs. References must be positive and cannot
form a cycle.

| Form after `n` | Construction |
| --- | --- |
| `M p q` | Midpoint of `X(p)` and `X(q)`. |
| `R p q` or `R p q r` | Reflect `X(p)` about `X(q)` or across the line `X(q)X(r)`. |
| `C p` or `A p` | Complement or anticomplement of `X(p)` with respect to `ABC`. |
| `P p q r` | Orthogonal projection of `X(p)` onto `X(q)X(r)`. |
| `J p q r t` | Intersection of `X(p)X(q)` and `X(r)X(t)`. |
| `I p q` or `I` | Ideal point with direction `X(p)X(q)`, or an ideal point with no usable direction. |
| `G p` or `T p` | Isogonal or isotomic conjugate of `X(p)`. |
| `V p` or `V p q r` | Invert `X(p)` in the circumcircle or in the circle centered at `X(q)` through `X(r)`. |
| `O p q r` | Circumcenter of `X(p)X(q)X(r)`. |
| `F p:w1 q:w2 ...` | Weighted average of two to six distinct finite centers. The weights must have matching dimensions and a nonzero sum. |
| `B f`, `B p f` or `B p q f` | Cyclic barycentrics from formula `f`, with zero, one or two center inputs. |
| `B p @gk` | Projective image of `X(p)` taking `(A,B,C,X(2))` to the three Gemini vertices of `k` and `X(2)`. |

Requesting an ideal center directly returns an undefined point. A known direction
can define a line with one finite point, or feed `G`, `T` and single-input `B`
with `x^2`, `x^3` or `@gk`. A bare `I` cannot be used as a dependency.

Formulas use numbers, parentheses, explicit multiplication and the operators
`+ - * / ^` without whitespace. Supported functions are
`sqrt sin cos tan cot sec csc sinh asinh atan ln abs`.

- `a,b,c` are the opposite side lengths and `A,B,C` the angles in radians.
- `s` is the semiperimeter and `sa,sb,sc` are `s-a,s-b,s-c`.
- `S` is twice the area. `SA=(b²+c²-a²)/2`, with cyclic `SB,SC`.
  `SW=(a²+b²+c²)/2`.
- `r,R` are the inradius and circumradius. `E=4R²`, `F=SW-E` and `pi` is π.
- In `B`, `x,y,z` are the first input's homogeneous barycentrics and `u,v,w`
  the second input's. The formula is evaluated three times under cyclic
  rotation. `S,SW,r,R,E,F,pi` are invariant.
- In `F` with exactly two inputs, `d` is the distance between the input points.
