# Conditional geometry derivation

Mode: DDAR + vector algebra with recorded provenance.
Explanation: recorded. Algebra replay: passed (2 steps).
Coordinate branch guards: 2. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. (A, H) ⊥ (B, C). Given condition.
2. (A, C) ⊥ (B, H). Given condition.
3. A, D, M are collinear. Given condition.
4. →(H,D) · →(A,M) = 0. Given condition.
5. −O₀→A · O₀→D + O₀→A · O₀→H + O₀→D · O₀→M − O₀→H · O₀→M = 0. Expand the signed vector product; from [4].
6. M is the midpoint of (B, C). Given condition.
7. −O₀→A · O₀→B − O₀→A · O₀→C + 2 × O₀→A · O₀→M = 0. Contract the affine relation with a vector; from [6].
8. −O₀→B · O₀→B − O₀→B · O₀→C + 2 × O₀→B · O₀→M = 0. Contract the affine relation with a vector; from [6].
9. −O₀→B · O₀→H − O₀→C · O₀→H + 2 × O₀→H · O₀→M = 0. Contract the affine relation with a vector; from [6].
10. O₀→A · O₀→B − O₀→A · O₀→C − O₀→B · O₀→H + O₀→C · O₀→H = 0. Express parallel or perpendicular directions as a product; from [1].
11. O₀→A · O₀→B − O₀→A · O₀→H − O₀→B · O₀→C + O₀→C · O₀→H = 0. Express parallel or perpendicular directions as a product; from [2].
12. O₀→A × O₀→D − O₀→A × O₀→M + O₀→D × O₀→M = 0. Collinearity gives zero cross product; from [3].
13. O₀→A · O₀→D − O₀→A · O₀→M − O₀→B · O₀→B + 2 × O₀→B · O₀→M − O₀→D · O₀→M = 0. Exact rational elimination; from -1 × [5], -1 × [11], -1/2 × [7], 1/2 × [10], -1/2 × [9], [8].
14. A, B, M. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
15. B, D, M. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
16. △(A, B, M) ∼ △(B, D, M). The two signed product equations imply reversing similarity; from [13], [12], [14], [15].
17. |B M|² = |A M| · |D M|. Corresponding sides of similar triangles; from [16].
18. |A, M| · |D, M| = |B, M|². Exact rational elimination; from -1 × [17].

## Conclusions

- |A, M| · |D, M| = |B, M|²: recorded [18].