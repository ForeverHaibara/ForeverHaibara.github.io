# Triangle center recipe data

The nine `chunks/*.txt` files contain 986 supported centers (2026-10-31). They are generated from 17 reviewed entries in `seeds.txt` and 969 automatically extracted constructions from [ETC Parts 3](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart3.html), [4](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart4.html), [5](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart5.html), and [37](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart37.html). Git tracks the compact generated data and extraction rules. ETC pages are manually downloaded to `.cache/triangle-centers/`, which Git ignores; no runtime or scheduled synchronization occurs.

Each row is `id operation references...`. `M p q` means midpoint; `R p q` reflects X(p) in X(q); `C p` and `A p` are complement and anticomplement. `J p q r s` intersects two lines, and `P p q r` projects X(p) onto line X(q)X(r). The automatic batch currently admits only `M/R/C/A`; the three `J` rows and one `P` row are reviewed seeds. The input parser accepts explicit relations within the target X(n) entry, including equivalent-pair lists. It does not treat incidence lists, barycentric expressions, or conditional sentences as executable definitions.

Run from the repository root with Python 3 and `beautifulsoup4`:

```sh
python scripts/geogebra/tools/triangle_center_import.py fetch --parts 3 4 5 37
python scripts/geogebra/tools/triangle_center_import.py build
python scripts/geogebra/tools/triangle_center_import.py check
python scripts/geogebra/tools/triangle_center_import.py verify
```

`fetch` is the manual update step. `build` uses cached HTML, writes compact chunks, and writes a local `selected.tsv` audit table with source sentences. `check` regenerates from the cache and compares with Git data. `verify` needs no HTML cache and checks all chunk IDs, dependencies, and directed cycles. A candidate enters only when its dependencies are native or already constructible; forward numeric references are allowed. The current full graph has maximum depth 5 and estimated expression length 333 characters. The 986 rows occupy 13,084 bytes before compression.

The batch is selected for low singularity, not representative of ETC as a whole. Source pages and rule classes receive stratified review. The 540 distinct native centers referenced by these recipes passed a shared finite-point screen on one acute and one obtuse triangle (`/scripts/geogebra/browser/verification.html?page=center-anchors`). A 15-center sample passed real-engine checks for dragging, obtuse triangles, and export/reopen (`?page=centers`). These checks do not prove behavior on every special triangle. See the [staged plan](../../docs/triangle-centers-plan.md).
