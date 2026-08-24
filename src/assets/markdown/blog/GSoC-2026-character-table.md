---
title: GSoC 2026 Character Table
date: 2026-08-23
summary: Topics regarding GSoC 2026: character table
tags: []
---
# GSoC 2026 Character Table

## Overview

The core contribution of my GSoC 2026 project is the new character table module. With this project, SymPy now can compute character tables of a `PermutationGroup` object by calling `.character_table()`. Here is an example of computing the table of $A_4$:
```python
>>> from sympy.combinatorics import *
>>> tbl = AlternatingGroup(4).character_table()
>>> tbl.as_matrix()
Matrix([
[1,          1,          1,  1],
[1, -1 - zeta3,      zeta3,  1],
[1,      zeta3, -1 - zeta3,  1],
[3,          0,          0, -1]])
>>> tbl.conjugacy_class_reps()
[Permutation(3), Permutation(1, 3, 2), Permutation(0, 1, 3), Permutation(0, 2)(1, 3)]
```

Users can compare the computed tables with those available in the literature or in other software packages. Character tables of small groups
are documented, for example, at [https://people.maths.bris.ac.uk/~matyd/GroupNames/characters.html](https://people.maths.bris.ac.uk/~matyd/GroupNames/characters.html). Here is an example of computing the character table of [$\text{PSL}_2(\mathbb F_7)$](https://en.wikipedia.org/wiki/PSL(2,7)) (or $\text{GL}_3(\mathbb F_2)$):
```python
from sympy.combinatorics import *; from sympy import *; from itertools import product
n, p = 3, 2
GL = [m for m in [Matrix(n,n,_) for _ in product(range(p),repeat=n**2)] if m.det()%p]
t = {tuple(m): i for i, m in enumerate(GL)}
g = [Permutation([t[tuple(i%p for i in (m * m2))] for m2 in GL]) for m in GL]
G = PermutationGroup(g)
G.character_table().as_matrix()
```
which yields
```python
Matrix([
[1,  1,  1,  1,                                1,                                1],
[3, -1,  1,  0, -1 - zeta7**2 - zeta7 - zeta7**4,      zeta7**4 + zeta7 + zeta7**2],
[3, -1,  1,  0,      zeta7**4 + zeta7 + zeta7**2, -1 - zeta7**2 - zeta7 - zeta7**4],
[6,  2,  0,  0,                               -1,                               -1],
[7, -1, -1,  1,                                0,                                0],
[8,  0,  0, -1,                                1,                                1]])
```

Most of the implementation work was completed in late July and August. See also in [#30109](https://github.com/sympy/sympy/pull/30109) and [#30266](https://github.com/sympy/sympy/pull/30266).

## Character Table

The ordinary character table of a finite group $G$ is a matrix $M$ where the $(i,j)$-entry is the value of $\chi_i(g_j)$.
Here $\chi_i$ is the $i$-th character and $g_j$ is a representative of the $j$-th conjugacy class. In most cases, the ordering of the irreducible characters and conjugacy classes is not canonical, so **character tables may differ by permutations of rows and columns**.

In this blog and the character table module, we only concern irreducible representations on $\mathbb C$, and the character table is always a square matrix over $\mathbb C$.

Here are some basic properties of character tables, which are used in the test suite of the module.

1. All entries are algebraic integers contained in a cyclotomic field.
2. All entries in the first row (the trivial character) are $1$.
3. The squared sum of the first column (the identity class) equals to the order of the group, $|G|$.
4. Let $M$ be the character table. Then $M^HM$ is diagonal and the diagonal elements are the sizes of centralizers.


The returned character table of a group `G` is a `CharacterTable` object. It looks like:

```python
class CharacterTable(DefaultPrinting):    
    _rep: DomainMatrix
    _conjugacy_class_reps: list[Permutation]

    def conjugacy_class_reps(self) -> list[Permutation]: ...
    def as_domain_matrix(self) -> DomainMatrix: ...
    def as_matrix(self) -> MutableDenseMatrix: ...
    def tolist(self) -> list[list[Expr]]: ...
    @property
    def shape(self) -> tuple[int, int]: ...
    @property
    def zeta_order(self) -> int: ...
```

Since adding two character tables is not a meaningful mathematical operation, `CharacterTable` is not implemented as a subclass of `Matrix`. Users may still want to perform matrix operations on character tables, for example when decomposing reducible characters into irreducibles, so `as_matrix()` or `as_domain_matrix()` can be used.

## Working With DomainMatrix

The values of the computed character tables are stored in a `DomainMatrix` and can be accessed by `._rep` or `.as_domain_matrix()`. For example,

```python
>>> from sympy.combinatorics import *
>>> mat = AlternatingGroup(5).character_table()._rep; type(mat)
<class 'sympy.polys.matrices.domainmatrix.DomainMatrix'>
>>> mat.domain
QQ<zeta5>
>>> mat.to_list()[2][3] # might vary
ANP([1, 1, 0, 1], [1, 1, 1, 1, 1], QQ)
>>> mat.to_list()[2][3].rep
[1, 1, 0, 1]
```
In this approach one can easily access the exact values of the character table.
The result indicates `mat[2][3]` is $z^3+z^2+0z+1$ where $z=e^{2\pi i/5}$, the generator of `QQ<zeta5>`. Using the quadratic [Gauss sum](https://en.wikipedia.org/wiki/Gauss_sum), we can further simplify this to

$$
z^3+z^2+1=\frac{-(z^0+z^1+z^4+z^9+z^{16}) + 1}{2}=\frac{-\sqrt 5 + 1}{2}.
$$

## Dixon's Algorithm

The current implementation uses Dixon's algorithm to compute character tables of finite groups. One can refer to:

1. Dixon, J. "High Speed Computation of Group Characters", [https://gdz.sub.uni-goettingen.de/download/pdf/PPN362160546_0010/LOG_0046.pdf](https://gdz.sub.uni-goettingen.de/download/pdf/PPN362160546_0010/LOG_0046.pdf)
2. Schneider, J. "Dixon's character table algorithm revisited", [https://www.sciencedirect.com/science/article/pii/S0747717108800776](https://www.sciencedirect.com/science/article/pii/S0747717108800776)
3. Holt, D., Eick, B., O'Brien, E. "Handbook of Computational Group Theory", [https://www.jstor.org/stable/4100326](https://www.jstor.org/stable/4100326)

The algorithm performs the computationally expensive linear algebra over a suitable finite field $\mathbb F_p$. The resulting data are then reconstructed over the relevant cyclotomic field $\mathbb Q\langle \zeta_e\rangle$.

The only modification is that the implementation uses a `_get_global_conductor` and a `_lift_to_minimal_field` function to decide the smallest cyclotomic field that
contains the table. The original Dixon's algorithm uses the field $\mathbb Q\langle \zeta_e\rangle$ to embed the character table, where $e$ is the exponenet of the group. But in practice there will often be a smaller field, e.g., $A_4$ has exponent $6$ but the character table can be embedded on $\mathbb Q\langle \zeta_3\rangle$.
To identify a smaller cyclotomic field containing the table, the implementation checks whether the table is invariant under all Galois automorphisms in $\text{Gal}(\mathbb Q\langle\zeta_e\rangle/\mathbb Q\langle\zeta_k\rangle)$, where $k$ is a divisor of $e$. 

## Murnaghan-Nakayama Algorithm

In this GSoC project, I also implemented the [Murnaghan-Nakayama algorithm](https://en.wikipedia.org/wiki/Murnaghan%E2%80%93Nakayama_rule), which is specialized for computing
character tables of a symmetric group $S_n$. The character table of $S_n$ contains only integer values, and the irreducible characters and conjugacy classes of $S_n$ 
are both naturally indexed by the integer partitions of $n$. In the computed table, both irreducible characters and conjugacy classes are ordered according to the corresponding integer partitions of $n$, with the first row being the trivial character and the first column being the identity
class.

```python
>>> from sympy.combinatorics import *
>>> SymmetricGroup(4).character_table().as_matrix()
Matrix([
[1,  1,  1,  1,  1],
[3,  1, -1,  0, -1],
[2,  0,  2, -1,  0],
[3, -1, -1,  0,  1],
[1, -1,  1,  1, -1]])
>>> [g.cycle_structure for g in SymmetricGroup(4).character_table().conjugacy_class_reps()]
[{1: 4}, {2: 1, 1: 2}, {2: 2}, {3: 1, 1: 1}, {4: 1}]
```

Calling `G.character_table()` automatically detects whether `G` is a symmetric group and switches to the Murnaghan–Nakayama algorithm in that case.
