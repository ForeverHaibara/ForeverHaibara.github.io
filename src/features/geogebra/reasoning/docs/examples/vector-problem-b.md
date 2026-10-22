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
8. $\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{B}}\right) + \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{D}}\right) − 2\,\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{F}}\right) = 0$. Contract the affine relation with a vector; from [7].
9. $−\left(\overrightarrow{\text{B}} \times \overrightarrow{\text{H}}\right) − \left(\overrightarrow{\text{D}} \times \overrightarrow{\text{H}}\right) + 2\,\left(\overrightarrow{\text{F}} \times \overrightarrow{\text{H}}\right) = 0$. Contract the affine relation with a vector; from [7].
10. G is the midpoint of (C, E). Given condition.
11. $\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{C}}\right) + \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{E}}\right) − 2\,\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{G}}\right) = 0$. Contract the affine relation with a vector; from [10].
12. $−\left(\overrightarrow{\text{C}} \times \overrightarrow{\text{H}}\right) − \left(\overrightarrow{\text{E}} \times \overrightarrow{\text{H}}\right) + 2\,\left(\overrightarrow{\text{G}} \times \overrightarrow{\text{H}}\right) = 0$. Contract the affine relation with a vector; from [10].
13. $\left(\overrightarrow{\text{B}} \times \overrightarrow{\text{E}}\right) − \left(\overrightarrow{\text{B}} \times \overrightarrow{\text{H}}\right) + \left(\overrightarrow{\text{E}} \times \overrightarrow{\text{H}}\right) = 0$. Collinearity gives zero cross product; from [1].
14. $\left(\overrightarrow{\text{C}} \times \overrightarrow{\text{D}}\right) − \left(\overrightarrow{\text{C}} \times \overrightarrow{\text{H}}\right) + \left(\overrightarrow{\text{D}} \times \overrightarrow{\text{H}}\right) = 0$. Collinearity gives zero cross product; from [2].
15. −dir(A,B) + dir(A,C) − dir(A,D) + dir(A,E) = 0 (mod π). Integer combination modulo π; from -1 × [6].
16. A, B, A, E, A, C, A, D. Ray orientation of the product from the coordinate witness. **Coordinate branch condition.**
17. $\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{B}}\right) − \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{C}}\right) + \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{D}}\right) − \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{E}}\right) + \left(\overrightarrow{\text{B}} \times \overrightarrow{\text{E}}\right) − \left(\overrightarrow{\text{C}} \times \overrightarrow{\text{D}}\right) = 0$. Transfer equal length products and corresponding angles; from [4], [15], [16].
18. $\left(\overrightarrow{\text{A}} \times \overrightarrow{\text{F}}\right) − \left(\overrightarrow{\text{A}} \times \overrightarrow{\text{G}}\right) + \left(\overrightarrow{\text{F}} \times \overrightarrow{\text{H}}\right) − \left(\overrightarrow{\text{G}} \times \overrightarrow{\text{H}}\right) = 0$. Exact rational elimination; from 1/2 × [17], -1/2 × [8], 1/2 × [11], -1/2 × [13], 1/2 × [9], 1/2 × [14], -1/2 × [12].
19. A, H, F, G. Nonzero directions from the coordinate witness. **Coordinate branch condition.**
20. (A, H) ∥ (F, G). A zero product determines the direction relation; from [18], [19].
21. (A, H) ∥ (F, G). Integer combination modulo π; from [20].

## Conclusions

- (A, H) ∥ (F, G): recorded [21].