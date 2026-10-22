# Conditional geometry derivation

Mode: DDAR + vector algebra with recorded provenance.
Explanation: recorded. Algebra replay: passed (3 steps).
Coordinate branch guards: 2. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. B, E, H are collinear. Given condition.
2. C, D, H are collinear. Given condition.
3. |A, B| · |A, E| = |A, C| · |A, D|. Given condition.
4. |A B| · |A E| = |A C| · |A D|. Express the given condition as an equation; from [3].
5. dir(A, B) − dir(A, C) + dir(A, D) − dir(A, E) = 0 (mod π). Given condition.
6. dir(A,B) − dir(A,C) + dir(A,D) − dir(A,E) = 0 (mod π). Express the given condition as an equation; from [5].
7. F is the midpoint of (B, D). Given condition.
8. O₀→A × O₀→B + O₀→A × O₀→D − 2 × O₀→A × O₀→F = 0. Contract the affine relation with a vector; from [7].
9. −O₀→B × O₀→H − O₀→D × O₀→H + 2 × O₀→F × O₀→H = 0. Contract the affine relation with a vector; from [7].
10. G is the midpoint of (C, E). Given condition.
11. O₀→A × O₀→C + O₀→A × O₀→E − 2 × O₀→A × O₀→G = 0. Contract the affine relation with a vector; from [10].
12. −O₀→C × O₀→H − O₀→E × O₀→H + 2 × O₀→G × O₀→H = 0. Contract the affine relation with a vector; from [10].
13. O₀→B × O₀→E − O₀→B × O₀→H + O₀→E × O₀→H = 0. Collinearity gives zero cross product; from [1].
14. O₀→C × O₀→D − O₀→C × O₀→H + O₀→D × O₀→H = 0. Collinearity gives zero cross product; from [2].
15. −dir(A,B) + dir(A,C) − dir(A,D) + dir(A,E) = 0 (mod π). Integer combination modulo π; from -1 × [6].
16. A, B, A, E, A, C, A, D. Ray orientation of the product from the coordinate witness. **Coordinate branch condition.**
17. O₀→A × O₀→B − O₀→A × O₀→C + O₀→A × O₀→D − O₀→A × O₀→E + O₀→B × O₀→E − O₀→C × O₀→D = 0. Transfer equal length products and corresponding angles; from [4], [15], [16].
18. O₀→A × O₀→F − O₀→A × O₀→G + O₀→F × O₀→H − O₀→G × O₀→H = 0. Exact rational elimination; from 1/2 × [17], -1/2 × [8], 1/2 × [11], -1/2 × [13], 1/2 × [9], 1/2 × [14], -1/2 × [12].
19. A, H, F, G. Nonzero directions from the coordinate witness. **Coordinate branch condition.**
20. (A, H) ∥ (F, G). A zero product determines the direction relation; from [18], [19].
21. (A, H) ∥ (F, G). Integer combination modulo π; from [20].

## Conclusions

- (A, H) ∥ (F, G): recorded [21].