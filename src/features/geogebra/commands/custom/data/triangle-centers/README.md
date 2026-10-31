# Triangle center recipe data

The nine `chunks/*.txt` files contain 2066 supported centers (2026-10-31). They are generated from 17 reviewed entries in `seeds.txt` and 2049 automatically extracted constructions from [ETC Parts 3](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart3.html), [4](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart4.html), [5](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart5.html), and [37](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart37.html). Git tracks the compact generated data and extraction rules. ETC pages are manually downloaded to `.cache/triangle-centers/`, which Git ignores; no runtime or scheduled synchronization occurs.

Each row is `id operation references...`. `M p q` means midpoint; `R p q` reflects X(p) in X(q); `C p` and `A p` are complement and anticomplement. `J p q r s` intersects two lines; `P p q r` projects X(p) onto line X(q)X(r); `L p q r` reflects X(p) across line X(q)X(r). `G p` and `T p` are isogonal and isotomic conjugates of X(p), using the same point builders as the public custom tools. The parser accepts explicit relations within the target X(n) entry, including equivalent-pair lists and wrapped line-intersection titles. It does not treat incidence lists or barycentric expressions as executable definitions. Conditions and transformations relative to a triangle other than ABC are excluded.

Run from the repository root with Python 3 and `beautifulsoup4`:

```sh
python scripts/geogebra/tools/triangle_center_import.py fetch --parts 3 4 5 37
python scripts/geogebra/tools/triangle_center_import.py build
python scripts/geogebra/tools/triangle_center_import.py check
python scripts/geogebra/tools/triangle_center_import.py verify
```

`fetch` is the manual update step. `build` uses cached HTML, writes compact chunks, and writes a local `selected.tsv` audit table with source sentences. `check` regenerates from the cache and compares with Git data. `verify` needs no HTML cache and checks all chunk IDs, dependencies, directed cycles, and the native exclusions. A candidate enters only when its dependencies are native or already constructible; forward numeric references are allowed. Selection prefers affine constructions over line intersections and conjugates, caps each dependency path at one conjugation, and limits estimated expression growth. The full graph has maximum depth 5; the 2066 rows occupy 28,713 bytes before compression.

`native-unavailable.txt` records 16 native IDs that GeoGebra returned as undefined on both representative triangles. These are excluded as references, and another ETC relation is selected when available. This also corrected six previously generated centers affected by parsing complement/anticomplement "wrt" a different triangle as though it were ABC. The final 810 distinct native references passed the shared finite-point screen (`/scripts/geogebra/browser/verification.html?page=center-anchors`); 19 representative centers passed creation, obtuse-triangle, dragging, and export/reopen checks (`?page=centers`). These checks do not prove behavior on every special triangle. See the [staged plan](../../docs/triangle-centers-plan.md).
