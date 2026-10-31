# Triangle center recipes

`recipes.txt` is the currently reviewed runtime sample from [ETC Part 3](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart3.html). It contains only implemented centers, one compact record per center. All references in this first sample are native GeoGebra centers. Git tracks changes; there is no automatic ETC synchronization.

Fields: `id operation references...`. `M p q` is the midpoint of X(p), X(q); `R p q` reflects X(p) in X(q); `J p q r s` intersects lines X(p)X(q) and X(r)X(s). The source entries state: X(3054) midpoint of X(590), X(615); X(3056) reflection of X(1469) in X(1); X(3057) intersection X(1)X(3) and X(10)X(11); X(3059) intersection X(7)X(8) and X(9)X(55); X(3060) reflection of X(2) in X(51); X(3061) intersection X(1)X(6) and X(2)X(257).

This file tests the compact representation and command dispatch; it is not a representative estimate of ETC operation frequencies. Later batches need reviewed family/range records, offline generation, and measured chunk loading before scaling the data. See the [implementation plan](../../docs/triangle-centers-plan.md).
