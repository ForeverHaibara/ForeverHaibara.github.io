# Conditional geometry derivation

Mode: DDAR with recorded provenance.
Explanation: recorded. Algebra replay: passed (9 steps).
Coordinate branch guards: 4. Unreconstructed steps: 0.
Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.

## Steps

1. dir(A, B) + dir(A, C) − 2 × dir(A, I) = 0 (mod π). Given condition.
2. dir(A,B) − 2 × dir(A,I) + dir(A,C) = 0 (mod π). Express the given condition as an equation; from [1].
3. A, C, E are collinear. Given condition.
4. −dir(A,C) + dir(A,E) = 0 (mod π). Directions on one line; from [3].
5. (A, C) ⊥ (E, I). Given condition.
6. dir(A,C) − dir(I,E) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [5].
7. A, B, F are collinear. Given condition.
8. −dir(A,B) + dir(A,F) = 0 (mod π). Directions on one line; from [7].
9. (A, B) ⊥ (F, I). Given condition.
10. dir(A,B) − dir(I,F) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [9].
11. B, S, I are collinear. Given condition.
12. −dir(B,S) + dir(B,I) = 0 (mod π). Directions on one line; from [11].
13. −dir(B,S) + dir(S,I) = 0 (mod π). Directions on one line; from [11].
14. E, F, S are collinear. Given condition.
15. dir(S,E) − dir(E,F) = 0 (mod π). Directions on one line; from [14].
16. B, T, I are collinear. Given condition.
17. B, S, T, I are collinear. Join lines with two common points; from [16], [11].
18. dir(B,S) − dir(B,T) = 0 (mod π). Directions on one line; from [17].
19. −dir(B,T) + dir(S,T) = 0 (mod π). Directions on one line; from [17].
20. −dir(B,T) + dir(T,I) = 0 (mod π). Directions on one line; from [17].
21. (A, T) ⊥ (B, I). Given condition.
22. dir(A,T) − dir(B,I) − 1/2 × π = 0 (mod π). Express the given condition as an equation; from [21].
23. 2 × dir(A,I) − dir(A,E) − dir(A,F) = 0 (mod π). Integer combination modulo π; from -1 × [4], -1 × [8], -1 × [2].
24. dir(A,E) + dir(A,F) − dir(I,E) − dir(I,F) = 0 (mod π). Integer combination modulo π; from [4], [8], [10], [6].
25. A, E, I, A, F, I · opposite orientation. Triangle orientation from the coordinate witness. **Coordinate branch condition.**
26. △(A, E, I) ∼ △(A, F, I). AA similarity; from [23], [24], [25].
27. |I E| = |I F|. Corresponding sides of similar triangles; from [26].
28. −dir(A,E) + dir(A,F) + dir(I,E) − dir(I,F) = 0 (mod π). Integer combination modulo π; from -1 × [4], [8], [10], -1 × [6].
29. dir(A,T) − dir(A,E) − dir(T,I) + dir(I,E) = 0 (mod π). Integer combination modulo π; from [22], -1 × [4], [12], -1 × [20], [18], -1 × [6].
30. A, I, E. Noncollinearity from the coordinate witness. **Coordinate branch condition.**
31. A, I, E, F, T are concyclic. Converse of the inscribed-angle theorem; from [28], [29], [30].
32. −dir(A,I) + dir(A,F) + dir(I,E) − dir(E,F) = 0 (mod π). Angles subtending the same chord; from [31].
33. dir(A,T) − dir(A,I) − dir(T,E) + dir(I,E) = 0 (mod π). Angles subtending the same chord; from [31].
34. dir(A,T) − dir(A,I) − dir(T,F) + dir(I,F) = 0 (mod π). Angles subtending the same chord; from [31].
35. −dir(S,T) + dir(S,E) + dir(T,F) − dir(I,F) = 0 (mod π). Integer combination modulo π; from -1 × [19], [15], [22], [12], [18], -1 × [34], [2], -1 × [32], [8], -1 × [6].
36. −dir(S,E) − dir(T,I) + dir(T,E) + dir(I,F) = 0 (mod π). Integer combination modulo π; from -1 × [15], -1 × [33], [22], [12], -1 × [20], [18], [32], -1 × [8], -1 × [10].
37. F, I, T, S, E, T · matching orientation. Triangle orientation from the coordinate witness. **Coordinate branch condition.**
38. △(F, I, T) ∼ △(S, E, T). AA similarity; from [35], [36], [37].
39. |S T| · |I F| = |S E| · |T F|. Corresponding sides of similar triangles; from [38].
40. |S T| · |T I| = |T E| · |T F|. Corresponding sides of similar triangles; from [38].
41. dir(S,I) − dir(S,E) − dir(T,E) + dir(I,E) = 0 (mod π). Integer combination modulo π; from [13], -1 × [15], [33], -1 × [22], -1 × [12], -1 × [2], [32], -1 × [8], [6].
42. dir(S,E) − dir(T,I) + dir(T,E) − dir(I,E) = 0 (mod π). Integer combination modulo π; from [15], -1 × [33], [22], [12], -1 × [20], [18], [2], -1 × [32], [8], -1 × [6].
43. E, T, I, S, E, I · opposite orientation. Triangle orientation from the coordinate witness. **Coordinate branch condition.**
44. △(E, T, I) ∼ △(S, E, I). AA similarity; from [41], [42], [43].
45. |S I| · |T E| = |S E| · |I E|. Corresponding sides of similar triangles; from [44].
46. |E, I|² = |S, I| · |T, I|. Exact rational elimination; from -1 × [45], -1 × [40], [39], [27].

## Conclusions

- |E, I|² = |S, I| · |T, I|: recorded [46].