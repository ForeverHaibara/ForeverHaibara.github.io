# Conditional geometry derivation

Mode: DDAR + vector algebra with recorded provenance.
Explanation: recorded. Algebra replay: passed (2 steps).
Coordinate branch guards: 2. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. (A, H) ⊥ (B, C). Given condition.
2. (A, C) ⊥ (B, H). Given condition.
3. A, D, M are collinear. Given condition.
4. $\left(\overrightarrow{\text{H}\,\text{D}} \cdot \overrightarrow{\text{A}\,\text{M}}\right) = 0$. Given condition.
5. $−\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{D}}\right) + \left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{H}}\right) + \left(\overrightarrow{\text{D}} \cdot \overrightarrow{\text{M}}\right) − \left(\overrightarrow{\text{H}} \cdot \overrightarrow{\text{M}}\right) = 0$. Expand the signed vector product; from [4].
6. M is the midpoint of (B, C). Given condition.
7. $−\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{B}}\right) − \left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{C}}\right) + 2\,\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{M}}\right) = 0$. Contract the affine relation with a vector; from [6].
8. $−\left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{B}}\right) − \left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{C}}\right) + 2\,\left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{M}}\right) = 0$. Contract the affine relation with a vector; from [6].
9. $−\left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{H}}\right) − \left(\overrightarrow{\text{C}} \cdot \overrightarrow{\text{H}}\right) + 2\,\left(\overrightarrow{\text{H}} \cdot \overrightarrow{\text{M}}\right) = 0$. Contract the affine relation with a vector; from [6].
10. $\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{B}}\right) − \left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{C}}\right) − \left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{H}}\right) + \left(\overrightarrow{\text{C}} \cdot \overrightarrow{\text{H}}\right) = 0$. Express parallel or perpendicular directions as a product; from [1].
11. $\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{B}}\right) − \left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{H}}\right) − \left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{C}}\right) + \left(\overrightarrow{\text{C}} \cdot \overrightarrow{\text{H}}\right) = 0$. Express parallel or perpendicular directions as a product; from [2].
12. $\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{D}}\right) − \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{M}}\right) + \left(\overrightarrow{\text{D}} \times \overrightarrow{\text{M}}\right) = 0$. Collinearity gives zero cross product; from [3].
13. $\left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{D}}\right) − \left(\overrightarrow{\text{A}} \cdot \overrightarrow{\text{M}}\right) − \left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{B}}\right) + 2\,\left(\overrightarrow{\text{B}} \cdot \overrightarrow{\text{M}}\right) − \left(\overrightarrow{\text{D}} \cdot \overrightarrow{\text{M}}\right) = 0$. Exact rational elimination; from -1 × [5], -1 × [11], -1/2 × [7], 1/2 × [10], -1/2 × [9], [8].
14. A, B, M. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
15. B, D, M. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
16. △(A, B, M) ∼ △(B, D, M). The two signed product equations imply reversing similarity; from [13], [12], [14], [15].
17. |B M|² = |A M| · |D M|. Corresponding sides of similar triangles; from [16].
18. |A, M| · |D, M| = |B, M|². Exact rational elimination; from -1 × [17].

## Conclusions

- |A, M| · |D, M| = |B, M|²: recorded [18].