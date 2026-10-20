# Conditional geometry derivation

Mode: DDAR with recorded provenance.
Explanation: recorded. Algebra replay: passed (5 steps).
Coordinate branch guards: 3. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. A, B, M are collinear. Given condition.
2. −dir(A,B) + dir(A,M) = 0 (mod π). Directions on one line; from [1].
3. A → M → B. Point order from the coordinate witness. **Coordinate branch condition.**
4. −|A,B| + |A,M| + |B,M| = 0. Segment addition; from [1], [3].
5. |A, M| = |B, M|. Given condition.
6. |A,M| − |B,M| = 0. Equal lengths; from [5].
7. −1/2 × |A,B| + |A,M| = 0. Exact rational elimination; from 1/2 × [4], 1/2 × [6].
8. |A M| = 1/2 × |A B|. Convert a positive length ratio; from [7].
9. A, C, N are collinear. Given condition.
10. −dir(A,C) + dir(A,N) = 0 (mod π). Directions on one line; from [9].
11. A → N → C. Point order from the coordinate witness. **Coordinate branch condition.**
12. −|A,C| + |A,N| + |C,N| = 0. Segment addition; from [9], [11].
13. |A, N| = |C, N|. Given condition.
14. |A,N| − |C,N| = 0. Equal lengths; from [13].
15. −1/2 × |A,C| + |A,N| = 0. Exact rational elimination; from 1/2 × [12], 1/2 × [14].
16. |A N| = 1/2 × |A C|. Convert a positive length ratio; from [15].
17. log |A B| − log |A C| − log |A M| + log |A N| = 0. Exact rational elimination; from -1 × [8], [16].
18. −dir(A,B) + dir(A,C) + dir(A,M) − dir(A,N) = 0 (mod π). Integer combination modulo π; from [2], -1 × [10].
19. A, B, C, A, M, N · matching orientation. Triangle orientation from the coordinate witness. **Coordinate branch condition.**
20. △(A, B, C) ∼ △(A, M, N). SAS similarity; from [17], [18], [19].
21. dir(A,B) − dir(A,M) − dir(B,C) + dir(M,N) = 0 (mod π). Corresponding directed angles of similar triangles; from [20].
22. (B, C) ∥ (M, N). Integer combination modulo π; from -1 × [21], -1 × [2].

## Conclusions

- (B, C) ∥ (M, N): recorded [22].