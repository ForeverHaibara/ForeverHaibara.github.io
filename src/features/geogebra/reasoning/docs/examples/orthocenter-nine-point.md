# Conditional geometry derivation

Mode: DDAR with recorded provenance.
Explanation: recorded. Algebra replay: passed (5 steps).
Coordinate branch guards: 5. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. (A, H) ⊥ (B, C). Given condition.
2. dir(A,H) − dir(B,C) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [1].
3. (A, C) ⊥ (B, H). Given condition.
4. dir(A,C) − dir(B,H) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [3].
5. B, C, D are collinear. Given condition.
6. −dir(B,C) + dir(B,D) = 0 (mod π). Directions on one line; from [5].
7. (B, C) ⊥ (D, H). Given condition.
8. dir(B,C) − dir(H,D) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [7].
9. A, C, E are collinear. Given condition.
10. −dir(A,C) + dir(A,E) = 0 (mod π). Directions on one line; from [9].
11. −dir(A,C) + dir(C,E) = 0 (mod π). Directions on one line; from [9].
12. (A, C) ⊥ (E, H). Given condition.
13. dir(A,C) − dir(H,E) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [12].
14. A, B, F are collinear. Given condition.
15. −dir(A,B) + dir(A,F) = 0 (mod π). Directions on one line; from [14].
16. −dir(A,B) + dir(B,F) = 0 (mod π). Directions on one line; from [14].
17. (A, B) ⊥ (F, H). Given condition.
18. dir(A,B) − dir(H,F) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [17].
19. B, C, R are collinear. Given condition.
20. B, C, D, R are collinear. Join lines with two common points; from [19], [5].
21. B, C, M are collinear. Given condition.
22. B, C, D, M are collinear. Join lines with two common points; from [21], [5].
23. B, C, D, M, R are collinear. Join lines with two common points; from [22], [20].
24. −dir(B,C) + dir(B,M) = 0 (mod π). Directions on one line; from [23].
25. −dir(B,C) + dir(D,M) = 0 (mod π). Directions on one line; from [23].
26. |B, M| = |C, M|. Given condition.
27. |B M| = |C M|. Express the given condition as an equation; from [26].
28. −dir(A,E) + dir(A,F) + dir(H,E) − dir(H,F) = 0 (mod π). Integer combination modulo π; from -1 × [10], [15], [18], -1 × [13].
29. A, H, E. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
30. A, H, E, F are concyclic. Converse of the inscribed-angle theorem; from [28], [29].
31. −dir(A,H) + dir(A,F) + dir(H,E) − dir(E,F) = 0 (mod π). Angles subtending the same chord; from [30].
32. −dir(B,H) + dir(H,E) = 0 (mod π). Integer combination modulo π; from [4], -1 × [13].
33. B, E, H are collinear. Equal directions imply collinearity; from [32].
34. −dir(B,H) + dir(B,E) = 0 (mod π). Directions on one line; from [33].
35. −dir(B,D) + dir(B,F) + dir(H,D) − dir(H,F) = 0 (mod π). Integer combination modulo π; from -1 × [6], [18], [16], -1 × [8].
36. B, H, D. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
37. B, H, D, F are concyclic. Converse of the inscribed-angle theorem; from [35], [36].
38. −dir(B,H) + dir(B,F) + dir(H,D) − dir(D,F) = 0 (mod π). Angles subtending the same chord; from [37].
39. B, C, E. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
40. B, C, E are concyclic. Three noncollinear points determine a circle; from [39].
41. −dir(B,C) − dir(B,E) + dir(B,M) + dir(C,E) − 1/2 × π = 0 (mod π). Integer combination modulo π; from -1 × [34], [11], [4], [24].
42. B, C, E. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
43. M, B, C, E. Identify the center from an equal-radius chord and its inscribed angle; from [40], [27], [41], [42].
44. dir(B,C) − dir(B,E) − dir(C,E) + dir(E,M) − 1/2 × π = 0 (mod π). Radius, chord and inscribed-angle relation; from [43].
45. −dir(D,F) + dir(D,M) + dir(E,F) − dir(E,M) = 0 (mod π). Integer combination modulo π; from -1 × [2], -1 × [13], [38], -1 × [16], [8], [25], -1 × [31], [15], -1 × [44], -1 × [34], -1 × [11].
46. D, E, F. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
47. D, E, F, M are concyclic. Converse of the inscribed-angle theorem; from [45], [46].
48. D, E, F, M are concyclic. Take a subset of the incidence relation; from [47].

## Conclusions

- D, E, F, M are concyclic: recorded [48].