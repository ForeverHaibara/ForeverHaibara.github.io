---
title: GSoC 2026 Domains and Conjugation
date: 2026-07-14
summary: Topics regarding GSoC 2026: improvements in SymPy domains
tags: []
---
# GSoC 2026 Domains and Conjugation

## Overview


This blog records the first part of my GSoC 2026 contribution to SymPy. It mainly involves
utility functionalities in domain or domainmatrix modules. These utilties are useful not only in the subsequent implementation of character tables, but also in future development of SymPy. This part of work was done in June and July and was merged to SymPy 1.15 dev.

## Domain.conjugate

Before this project, there was no unified approach to get the conjugation of a `domainelement` in SymPy. This made it difficult to implement conjugation and Hermitian transpose for `DomainMatrix` while preserving the underlying domain.
The main difficulty is that complex conjugation is not canonical on composite domains such as `QQ[x]`, where the action of conjugation on the generators has to be specified.
There were relevant discussions at issue [#27436](https://github.com/sympy/sympy/issues/27436). 

In this GSoC project I implemented a `ConjugateDomain` mixin class for specific domains, e.g., `ZZ,QQ,RR,CC,ZZ_I,QQ_I,EX,EXRAW` and `AlgebraicField`.
For example,

```python
>>> from sympy import *
>>> ZZ_I.conjugate(ZZ_I(3, 5))
ZZ_I(3, -5)
```

The PR is at [#29877](https://github.com/sympy/sympy/pull/29877).
It is noteworthy that algebraic fields act differently because not all algebraic fields are closed under conjugation. Currently, algebraic fields in SymPy, `QQ<x>`, contain elements in the form
of $a_0+a_1x+\dotsc+a_{n-1}x^{n-1}$ where `x` is the generator and $a_i\in\mathbb Q$. An algebraic field is closed under conjugation if and only if $\overline x\in\mathbb Q\langle x\rangle$ and its conjugate is computed by
$$
\overline{a_0+a_1x+\dotsc+a_{n-1}x^{n-1}}=a_0+a_1\overline{x}+\dotsc+a_{n-1}\overline{x}^{n-1}.
$$
The implementation first tries to convert the conjugation of the generator, $\overline{x}$, to the domain, and then computes the conjugation of an arbitrary element by a polynomial evaluation at $\overline{x}$.

```python
>>> from sympy import *
>>> K = QQ.algebraic_field(sqrt(-5))
>>> K.conjugate(K.convert((sqrt(-5)+1)/2))
ANP([-1/2, 1/2], [1, 0, 5], QQ)
>>> K.is_ConjugateDomain
True

>>> L = QQ.algebraic_field(CRootOf('x^3 - x + 1', 1))
>>> L.is_ConjugateDomain
False
>>> L.conjugate(L.convert(L.ext))
Traceback (most recent call last):
  ...
sympy.polys.polyerrors.DomainError: the algebraic field is not closed under conjugation
```


## DomainMatrix.conjugate

The PR at [#30012](https://github.com/sympy/sympy/pull/30012) implemented `conjugate` and `adjoint` for `DomainMatrix` and its internal representations `SDM`, `DDM` and `DFM`. It is now possible to compute the conjugate or the adjoint of a `DomainMatrix` while preserving the domain.

```python
>>> from sympy import *
>>> dm = Matrix([[1+2*I,3+4*I],[5+6*I,7+8*I]])._rep.convert_to(ZZ_I)
>>> dm
DomainMatrix({0: {0: 1 + 2*I, 1: 3 + 4*I}, 1: {0: 5 + 6*I, 1: 7 + 8*I}}, (2, 2), ZZ_I)
>>> dm.conjugate()
DomainMatrix({0: {0: 1 - 2*I, 1: 3 - 4*I}, 1: {0: 5 - 6*I, 1: 7 - 8*I}}, (2, 2), ZZ_I)
>>> dm.adjoint()
DomainMatrix({0: {0: 1 - 2*I, 1: 5 - 6*I}, 1: {0: 3 - 4*I, 1: 7 - 8*I}}, (2, 2), ZZ_I)
```

This also closed issue [#27436](https://github.com/sympy/sympy/issues/27436).

## CyclotomicField

Before this project, it was difficult to access the order of the root of unity used to generate a cyclotomic field. For example, supposing `K` is a cyclotomic field and `K.mod.to_list() == [1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 1]`. Without additional information, it is not immediately apparent that the minimal polynomial is $\Phi_{36}(x)$ and that $K=\mathbb Q\langle e^{2\pi i /36}\rangle$. After this project, the cyclotomic fields created from `QQ.cyclotomic_field` (or `ZZ.cyclotomic_field`) are `CyclotomicField` objects and have the property `zeta_order`. For example,

```python
>>> from sympy import QQ
>>> K = QQ.cyclotomic_field(36)
>>> type(K), K.zeta_order
(<class 'sympy.polys.domains.cyclotomicfield.CyclotomicField'>, 36)
```

Creating a cyclotomic field (extension) from a cyclotomic field is still cyclotomic:

```python
>>> from sympy import QQ
>>> K = QQ.cyclotomic_field(5)
>>> K2 = K.cyclotomic_field(6)
>>> type(K2), K2.zeta_order
(<class 'sympy.polys.domains.cyclotomicfield.CyclotomicField'>, 30)
```

Moreover, conjugation over cyclotomic fields can be computed efficiently. Since
$\bar x=x^{-1}=x^{r-1}$ if $x$ is a primitive $r$-th root of unity, an element in the form $a_0+a_1x+\dotsc+a_{n-1}x^{n-1}$ has conjugation $a_0x^r + a_1x^{r-1}+\dotsc+a_{n-1}x^{r-n+1}$, where $n=\phi(r)$.